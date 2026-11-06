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
import { defaultApiClientOptions } from "passbolt-styleguide/src/shared/lib/apiClient/apiClientOptions.test.data";
import { defaultAccountDto } from "../../model/entity/account/accountEntity.test.data";
import AccountEntity from "../../model/entity/account/accountEntity";
import UserPassphraseRequiredError from "passbolt-styleguide/src/shared/error/userPassphraseRequiredError";
import SyncNowController from "./syncNowController";
import SyncEngine, { SyncTrigger, SyncResult } from "../../service/sync/syncEngine";

describe("SyncNowController", () => {
  let worker;
  let requestId;
  let apiClientOptions;
  let account;
  let controller;

  beforeEach(() => {
    jest.clearAllMocks();
    worker = {
      port: {
        emit: jest.fn(),
      },
    };
    requestId = "req-uuid-1";
    apiClientOptions = defaultApiClientOptions();
    account = new AccountEntity(defaultAccountDto());

    jest.spyOn(SyncEngine.prototype, "sync").mockResolvedValue({ status: SyncResult.SUCCESS });

    controller = new SyncNowController(worker, requestId, apiClientOptions, account);
  });

  describe("::exec", () => {
    it("should invoke SyncEngine with MANUAL trigger", async () => {
      const result = await controller.exec();

      expect(SyncEngine.prototype.sync).toHaveBeenCalledWith(SyncTrigger.MANUAL);
      expect(result).toEqual({ status: SyncResult.SUCCESS });
    });

    it("should prompt user for passphrase and retry sync when UserPassphraseRequiredError is returned", async () => {
      const passphraseError = new UserPassphraseRequiredError("Passphrase required");
      SyncEngine.prototype.sync
        .mockResolvedValueOnce({ status: SyncResult.FAILURE, error: passphraseError })
        .mockResolvedValueOnce({ status: SyncResult.SUCCESS, details: { reDecrypted: true } });

      jest.spyOn(controller.getPassphraseService, "getPassphrase").mockResolvedValue("user-entered-passphrase");

      const result = await controller.exec();

      expect(controller.getPassphraseService.getPassphrase).toHaveBeenCalledWith(worker);
      expect(SyncEngine.prototype.sync).toHaveBeenNthCalledWith(1, SyncTrigger.MANUAL);
      expect(SyncEngine.prototype.sync).toHaveBeenNthCalledWith(2, SyncTrigger.MANUAL, "user-entered-passphrase");
      expect(result.status).toBe(SyncResult.SUCCESS);
    });
  });

  describe("::_exec", () => {
    it("should emit SUCCESS on successful sync", async () => {
      await controller._exec();

      expect(worker.port.emit).toHaveBeenCalledWith(requestId, "SUCCESS", { status: SyncResult.SUCCESS });
    });

    it("should emit ERROR when sync throws", async () => {
      SyncEngine.prototype.sync.mockRejectedValue(new Error("Fatal sync error"));

      await controller._exec();

      expect(worker.port.emit).toHaveBeenCalledWith(requestId, "ERROR", expect.any(Error));
    });
  });
});
