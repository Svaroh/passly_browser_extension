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
import { defaultAccountDto } from "../model/entity/account/accountEntity.test.data";
import AccountEntity from "../model/entity/account/accountEntity";
import { ResourceEvents } from "./resourceEvents";
import SyncNowController from "../controller/sync/syncNowController";
import SyncStateLocalStorage from "../service/local_storage/syncStateLocalStorage";

describe("ResourceEvents - sync endpoints", () => {
  let worker, listeners, apiClientOptions, account;

  beforeEach(() => {
    jest.clearAllMocks();
    listeners = {};
    worker = {
      port: {
        emit: jest.fn(),
        on: jest.fn((eventName, listener) => {
          listeners[eventName] = listener;
        }),
      },
    };
    apiClientOptions = defaultApiClientOptions();
    account = new AccountEntity(defaultAccountDto());

    ResourceEvents.listen(worker, apiClientOptions, account);
  });

  describe("passbolt.sync.sync-now", () => {
    it("should instantiate SyncNowController and execute _exec", async () => {
      const mockExec = jest.spyOn(SyncNowController.prototype, "_exec").mockResolvedValue();

      await listeners["passbolt.sync.sync-now"]("req-sync-1");

      expect(mockExec).toHaveBeenCalledTimes(1);
    });
  });

  describe("passbolt.sync.get-status", () => {
    it("should emit current sync state", async () => {
      const mockState = { cursor: 123, epoch: "epoch-x" };
      jest.spyOn(SyncStateLocalStorage.prototype, "get").mockResolvedValue(mockState);

      await listeners["passbolt.sync.get-status"]("req-status-1");

      expect(worker.port.emit).toHaveBeenCalledWith("req-status-1", "SUCCESS", mockState);
    });
  });
});
