/**
 * Passbolt ~ Open source password manager for teams
 * Copyright (c) 2026 Passbolt SA (https://www.passbolt.com)
 *
 * Licensed under GNU Affero General Public License version 3 of the or any later version.
 * For full copyright and license information, please see the LICENSE.txt
 * Redistributions of files must retain the above copyright notice.
 *
 * @copyright     Copyright (c) 2026 Passbolt SA (https://www.passbolt.com)
 * @license       https://opensource.org/licenses/AGPL-3.0 AGPL License
 * @link          https://www.passbolt.com Passbolt(tm)
 * @since         5.13.0
 */
import AccountEntity from "../../model/entity/account/accountEntity";
import { defaultAccountDto } from "../../model/entity/account/accountEntity.test.data";
import SessionCookieFlushService from "./sessionCookieFlushService";

beforeEach(() => {
  jest.clearAllMocks();
});

describe("SessionCookieFlushService", () => {
  describe("SessionCookieFlushService::flush", () => {
    it("removes the session and CSRF cookies for the configured account domain", async () => {
      expect.assertions(4);
      const account = new AccountEntity(defaultAccountDto({ domain: "https://passbolt.example.com" }));
      jest.spyOn(browser.cookies, "getAll").mockImplementationOnce(() =>
        Promise.resolve([
          { name: "cookie1", url: account.domain, session: false },
          { name: "cookie2", url: account.domain, session: true },
          { name: "cookie3", url: account.domain, session: true },
        ]),
      );

      const service = new SessionCookieFlushService(account);
      await service.flush();

      expect(browser.cookies.getAll).toHaveBeenCalledTimes(1);
      expect(browser.cookies.remove).toHaveBeenCalledTimes(2);
      expect(browser.cookies.remove).toHaveBeenCalledWith({
        url: "https://passbolt.example.com",
        name: "cookie2",
      });
      expect(browser.cookies.remove).toHaveBeenCalledWith({
        url: "https://passbolt.example.com",
        name: "cookie3",
      });
    });
  });
});
