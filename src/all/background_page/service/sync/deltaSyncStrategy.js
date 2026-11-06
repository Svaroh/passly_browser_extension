/**
 * Passly ~ Open source password manager for teams
 * Copyright (c) Passly (https://passly.svaroh.net)
 *
 * Licensed under GNU Affero General Public License version 3 of the or any later version.
 * For full copyright and license information, please see the LICENSE.txt
 * Redistributions of files must retain the above copyright notice.
 *
 * @copyright     Copyright (c) Passly (https://passly.svaroh.net)
 * @license       https://opensource.org/licenses/AGPL-3.0 AGPL License
 * @link          https://passly.svaroh.net Passly
 */
import Log from "../../model/log";

export default class DeltaSyncStrategy {
  /**
   * @param {SyncApiService} syncApiService
   * @param {ChangesApplier} changesApplier
   * @param {SyncStateLocalStorage} syncStateLocalStorage
   */
  constructor(syncApiService, changesApplier, syncStateLocalStorage) {
    this.syncApiService = syncApiService;
    this.changesApplier = changesApplier;
    this.syncStateLocalStorage = syncStateLocalStorage;
  }

  /**
   * Execute delta synchronization loop.
   * @param {string|null} [passphrase=null]
   * @param {Object} [options={}]
   * @param {number} [options.limit=500]
   * @param {number} [options.maxPages=500]
   * @returns {Promise<{success: boolean, isGone?: boolean, cursor?: number, totalUpserts?: number, totalDeletions?: number}>}
   */
  async sync(passphrase = null, options = {}) {
    const syncState = await this.syncStateLocalStorage.get();
    let currentCursor = syncState.cursor ?? 0;
    const currentEpoch = syncState.epoch ?? null;
    let hasMore = true;
    let totalUpserts = 0;
    let totalDeletions = 0;
    let pageCount = 0;
    const maxPages = options.maxPages || 500;

    Log.write({
      level: "debug",
      message: `Delta sync started with cursor=${currentCursor}, epoch=${currentEpoch}`,
    });

    while (hasMore) {
      if (pageCount >= maxPages) {
        Log.write({
          level: "warn",
          message: `Delta sync reached maximum page cap (${maxPages}). Breaking pagination loop.`,
        });
        break;
      }
      pageCount++;

      let changesResponse;
      try {
        changesResponse = await this.syncApiService.getChanges(currentCursor, options.limit || 500);
      } catch (error) {
        const statusCode = error?.data?.code ?? error?.code;
        const isGone =
          statusCode === 410 ||
          error?.data?.header?.status === 410 ||
          (error?.header?.status === "error" && statusCode === 410) ||
          (typeof error?.message === "string" &&
            (error.message.includes("410") ||
              error.message.toLowerCase().includes("older than the retained change journal")));

        if (isGone) {
          Log.write({
            level: "warn",
            message: `Server returned 410 Gone for cursor=${currentCursor}; triggering recovery bootstrap.`,
          });
          return { success: false, isGone: true };
        }
        throw error;
      }

      const body = changesResponse.body || {};
      const newCursor = body.cursor !== undefined && body.cursor !== null ? body.cursor : currentCursor;
      hasMore = Boolean(body.has_more);

      // Guard: if server claims has_more: true but cursor did not strictly advance, break out to prevent infinite loop
      if (hasMore && Number(newCursor) <= Number(currentCursor)) {
        Log.write({
          level: "warn",
          message: `Delta sync cursor did not advance (${currentCursor} -> ${newCursor}) while has_more=true. Halting to avoid loop.`,
        });
        await this.changesApplier.apply(body, passphrase, currentEpoch);
        currentCursor = newCursor;
        totalUpserts += body.upserts?.resources?.length || 0;
        totalDeletions += body.deletions?.resources?.length || 0;
        break;
      }

      await this.changesApplier.apply(body, passphrase, currentEpoch);

      currentCursor = newCursor;
      totalUpserts += body.upserts?.resources?.length || 0;
      totalDeletions += body.deletions?.resources?.length || 0;
    }

    Log.write({
      level: "debug",
      message: `Delta sync finished. Final cursor=${currentCursor}, upserts=${totalUpserts}, deletions=${totalDeletions}`,
    });

    return {
      success: true,
      cursor: currentCursor,
      totalUpserts,
      totalDeletions,
    };
  }
}
