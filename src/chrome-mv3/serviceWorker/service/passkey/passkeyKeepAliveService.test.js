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
 * @since         5.12.103
 */

import Validator from "validator";
import {
  SEND_MESSAGE_TARGET_PASSKEY_KEEPALIVE_START,
  SEND_MESSAGE_TARGET_PASSKEY_KEEPALIVE_STOP,
} from "../../../offscreens/service/passkey/passkeyKeepAliveOffscreenService";
import HandleOffscreenResponseService from "../offscreen/handleOffscreenResponseService";
import PasskeyKeepAliveService from "./passkeyKeepAliveService";

beforeEach(() => {
  jest.clearAllMocks();
  HandleOffscreenResponseService._offscreenResponsePromisesCallbacks = {};
});

describe("PasskeyKeepAliveService", () => {
  describe("::start", () => {
    it("creates the offscreen document and starts keepalive polling", async () => {
      expect.assertions(5);

      jest.spyOn(chrome.runtime, "sendMessage").mockImplementationOnce((message) => {
        expect(Validator.isUUID(message.id)).toBe(true);
        expect(message.target).toBe(SEND_MESSAGE_TARGET_PASSKEY_KEEPALIVE_START);
        HandleOffscreenResponseService._offscreenResponsePromisesCallbacks[message.id].resolve({ started: true });
      });

      await expect(PasskeyKeepAliveService.start()).resolves.toEqual({ started: true });

      expect(chrome.offscreen.createDocument).toHaveBeenCalledTimes(1);
      expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(1);
    });
  });

  describe("::stop", () => {
    it("does not send a stop message when the offscreen document does not exist", async () => {
      await expect(PasskeyKeepAliveService.stop()).resolves.toBe(false);

      expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
    });

    it("stops keepalive polling when the offscreen document exists", async () => {
      expect.assertions(4);

      jest.spyOn(chrome.runtime, "getContexts").mockImplementationOnce(() => ["offscreen"]);
      jest.spyOn(chrome.runtime, "sendMessage").mockImplementationOnce((message) => {
        expect(Validator.isUUID(message.id)).toBe(true);
        expect(message.target).toBe(SEND_MESSAGE_TARGET_PASSKEY_KEEPALIVE_STOP);
        HandleOffscreenResponseService._offscreenResponsePromisesCallbacks[message.id].resolve({ started: false });
      });

      await expect(PasskeyKeepAliveService.stop()).resolves.toEqual({ started: false });

      expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(1);
    });
  });
});
