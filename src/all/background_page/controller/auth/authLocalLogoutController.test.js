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
 * @since         5.13.0
 */
import { v4 as uuid } from "uuid";
import AuthLocalLogoutController from "./authLocalLogoutController";
import PostLogoutService from "../../service/auth/postLogoutService";
import SessionCookieFlushService from "../../service/auth/sessionCookieFlushService";

beforeEach(() => {
  jest.clearAllMocks();
});

describe("AuthLocalLogoutController", () => {
  describe("AuthLocalLogoutController::exec", () => {
    it("flushes the session cookies then runs the post-logout cleanup", async () => {
      expect.assertions(2);
      const cookieFlushSpy = jest.spyOn(SessionCookieFlushService, "flush").mockResolvedValue();
      const postLogoutSpy = jest.spyOn(PostLogoutService, "exec").mockResolvedValue();

      const controller = new AuthLocalLogoutController(null, null);
      await controller.exec();

      expect(cookieFlushSpy).toHaveBeenCalledTimes(1);
      expect(postLogoutSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("AuthLocalLogoutController::_exec", () => {
    it("emits SUCCESS once exec resolves", async () => {
      expect.assertions(1);
      jest.spyOn(SessionCookieFlushService, "flush").mockResolvedValue();
      jest.spyOn(PostLogoutService, "exec").mockResolvedValue();
      const requestId = uuid();
      const worker = { port: { emit: jest.fn() } };

      const controller = new AuthLocalLogoutController(worker, requestId);
      await controller._exec();

      expect(worker.port.emit).toHaveBeenCalledWith(requestId, "SUCCESS");
    });

    it("emits ERROR when PostLogoutService throws", async () => {
      expect.assertions(1);
      jest.spyOn(SessionCookieFlushService, "flush").mockResolvedValue();
      const error = new Error("flush failed");
      jest.spyOn(PostLogoutService, "exec").mockRejectedValue(error);
      jest.spyOn(console, "error").mockImplementation(() => {});
      const requestId = uuid();
      const worker = { port: { emit: jest.fn() } };

      const controller = new AuthLocalLogoutController(worker, requestId);
      await controller._exec();

      expect(worker.port.emit).toHaveBeenCalledWith(requestId, "ERROR", error);
    });
  });
});
