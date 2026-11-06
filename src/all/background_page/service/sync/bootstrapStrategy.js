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

export default class BootstrapStrategy {
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
   * Execute full bootstrap or recovery snapshot.
   * @param {string|null} [passphrase=null]
   * @param {Object} [options={}]
   * @param {number} [options.limit=500]
   * @returns {Promise<{success: boolean, cursor: number|null, epoch: string|null}>}
   */
  async bootstrap(passphrase = null, options = {}) {
    let page = 1;
    let hasMore = true;
    let pinnedCursor = null;
    let epoch = null;

    // Fetch protocol metadata to record authoritative epoch
    try {
      const metaResponse = await this.syncApiService.getMeta();
      epoch = metaResponse.body?.epoch ?? null;
    } catch (error) {
      Log.write({
        level: "warn",
        message: `Failed to fetch sync meta during bootstrap: ${error?.message}`,
      });
    }

    Log.write({
      level: "info",
      message: `Bootstrap starting with epoch=${epoch}`,
    });

    const maxPages = options.maxPages || 500;

    while (hasMore && page <= maxPages) {
      const bootstrapResponse = await this.syncApiService.getBootstrap(page, options.limit || 500, pinnedCursor);
      const body = bootstrapResponse.body || {};

      if (pinnedCursor === null && body.cursor !== undefined && body.cursor !== null) {
        pinnedCursor = body.cursor;
      }
      hasMore = Boolean(body.has_more);

      // Apply incoming entities: pass cursor=null for intermediate pages to ensure atomicity
      const pageDataForApplier = {
        ...body,
        cursor: hasMore ? null : pinnedCursor,
      };

      await this.changesApplier.apply(pageDataForApplier, passphrase, epoch);

      page++;
    }

    if (hasMore) {
      Log.write({
        level: "warn",
        message: `Bootstrap reached maximum pagination cap (${maxPages} pages) while more pages remained.`,
      });
    }

    // Explicitly commit the final pinned cursor after all pages are completely processed
    if (pinnedCursor !== null && pinnedCursor !== undefined) {
      await this.syncStateLocalStorage.updateCursor(pinnedCursor, epoch);
    }

    Log.write({
      level: "info",
      message: `Bootstrap completed successfully. Final pinned cursor=${pinnedCursor}, epoch=${epoch}`,
    });

    return {
      success: true,
      cursor: pinnedCursor,
      epoch,
    };
  }
}
