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
import UserPassphraseRequiredError from "passbolt-styleguide/src/shared/error/userPassphraseRequiredError";
import SyncEngine, { SyncTrigger, SyncResult } from "../../service/sync/syncEngine";
import GetPassphraseService from "../../service/passphrase/getPassphraseService";

export default class SyncNowController {
  /**
   * @param {Worker} worker
   * @param {string} requestId
   * @param {ApiClientOptions} apiClientOptions
   * @param {AccountEntity} account
   */
  constructor(worker, requestId, apiClientOptions, account) {
    this.worker = worker;
    this.requestId = requestId;
    this.syncEngine = new SyncEngine(account, apiClientOptions);
    this.getPassphraseService = new GetPassphraseService(account);
  }

  /**
   * Controller executor wrapper emitting result via worker port.
   * @returns {Promise<void>}
   */
  async _exec() {
    try {
      const result = await this.exec();
      this.worker.port.emit(this.requestId, "SUCCESS", result);
    } catch (error) {
      console.error(error);
      this.worker.port.emit(this.requestId, "ERROR", error);
    }
  }

  /**
   * Execute manual synchronization with passphrase prompt handling.
   * @returns {Promise<Object>}
   */
  async exec() {
    let result;
    try {
      result = await this.syncEngine.sync(SyncTrigger.MANUAL);
    } catch (error) {
      result = { status: SyncResult.FAILURE, error, reason: error?.message };
    }

    if (result?.status === SyncResult.FAILURE) {
      const error = result.error;
      const isPassphraseRequired =
        error instanceof UserPassphraseRequiredError ||
        error?.name === "UserPassphraseRequiredError" ||
        error?.cause instanceof UserPassphraseRequiredError ||
        error?.cause?.name === "UserPassphraseRequiredError" ||
        (typeof error?.message === "string" && error.message.includes("passphrase is required")) ||
        (typeof result?.reason === "string" && result.reason.includes("passphrase is required"));

      if (isPassphraseRequired) {
        const passphrase = await this.getPassphraseService.getPassphrase(this.worker);
        result = await this.syncEngine.sync(SyncTrigger.MANUAL, passphrase);
      } else if (result.error) {
        throw result.error;
      }
    }

    return result;
  }
}
