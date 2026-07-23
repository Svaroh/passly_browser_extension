/**
 * Passbolt ~ Open source password manager for teams
 * Copyright (c) Passbolt SA (https://www.passbolt.com)
 *
 * Licensed under GNU Affero General Public License version 3 of the or any later version.
 * For full copyright and license information, please see the LICENSE.txt
 * Redistributions of files must retain the above copyright notice.
 *
 * @copyright     Copyright (c) Passbolt SA (https://www.passbolt.com)
 * @license       https://opensource.org/licenses/AGPL-3.0 AGPL License
 * @link          https://www.passbolt.com Passbolt(tm)
 * @since         6.0.0
 */
import PostLoginOfflineService from "./postLoginOfflineService";
import PostLoginService from "./postLoginService";
import OfflineSessionExpiryAlarmService from "./offlineSessionExpiryAlarmService";
import FindAndUpdateActiveSessionLocalStorageService from "../activeSession/findAndUpdateActiveSessionLocalStorageService";
import toolbarService from "../toolbar/toolbarService";
import AccountEntity from "../../model/entity/account/accountEntity";
import { defaultAccountDto } from "../../model/entity/account/accountEntity.test.data";
import { defaultApiClientOptions } from "passbolt-styleguide/src/shared/lib/apiClient/apiClientOptions.test.data";
import PassphraseStorageService from "../session_storage/passphraseStorageService";

beforeEach(() => {
  jest.clearAllMocks();
});

describe("PostLoginOfflineService", () => {
  const passphrase = "ada@passbolt.com";
  let account, apiClientOptions;

  beforeEach(() => {
    account = new AccountEntity(defaultAccountDto());
    apiClientOptions = defaultApiClientOptions();
    jest.spyOn(PassphraseStorageService, "set").mockResolvedValue();
    jest.spyOn(FindAndUpdateActiveSessionLocalStorageService.prototype, "authenticateOffline").mockResolvedValue();
    jest.spyOn(OfflineSessionExpiryAlarmService, "scheduleSessionExpiry").mockResolvedValue();
    jest.spyOn(PostLoginService, "sendLoginEventForWorkers").mockResolvedValue();
    jest.spyOn(toolbarService, "handleUserLoggedIn").mockImplementation(() => {});
  });

  describe("::exec", () => {
    it("runs the offline post-login subset: updates the active session, schedules the expiry alarm and notifies the workers", async () => {
      expect.assertions(5);
      const service = new PostLoginOfflineService(account, apiClientOptions);

      await service.exec(passphrase, 300);

      expect(PassphraseStorageService.set).toHaveBeenCalledWith(passphrase, 300);
      expect(FindAndUpdateActiveSessionLocalStorageService.prototype.authenticateOffline).toHaveBeenCalledTimes(1);
      expect(OfflineSessionExpiryAlarmService.scheduleSessionExpiry).toHaveBeenCalledWith(account, 300);
      expect(PostLoginService.sendLoginEventForWorkers).toHaveBeenCalledTimes(1);
      expect(toolbarService.handleUserLoggedIn).toHaveBeenCalledTimes(1);
    });
  });
});
