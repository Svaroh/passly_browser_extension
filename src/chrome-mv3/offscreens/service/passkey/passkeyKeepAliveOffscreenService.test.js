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

import PasskeyKeepAliveOffscreenService, {
  PASSKEY_PROVIDER_KEEPALIVE_MESSAGE,
  SEND_MESSAGE_TARGET_PASSKEY_KEEPALIVE_RESPONSE,
} from "./passkeyKeepAliveOffscreenService";

describe("PasskeyKeepAliveOffscreenService", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    PasskeyKeepAliveOffscreenService.flush();
  });

  afterEach(() => {
    PasskeyKeepAliveOffscreenService.flush();
    jest.useRealTimers();
  });

  describe("::handleStartRequest", () => {
    it("starts polling the service worker and returns an acknowledgement", async () => {
      await expect(PasskeyKeepAliveOffscreenService.handleStartRequest()).resolves.toEqual({
        data: { started: true },
        target: SEND_MESSAGE_TARGET_PASSKEY_KEEPALIVE_RESPONSE,
      });

      expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(1);
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ name: PASSKEY_PROVIDER_KEEPALIVE_MESSAGE });
    });
  });

  describe("::handleStopRequest", () => {
    it("stops polling the service worker and returns an acknowledgement", async () => {
      await PasskeyKeepAliveOffscreenService.handleStartRequest();
      chrome.runtime.sendMessage.mockClear();

      expect(PasskeyKeepAliveOffscreenService.handleStopRequest()).toEqual({
        data: { started: false },
        target: SEND_MESSAGE_TARGET_PASSKEY_KEEPALIVE_RESPONSE,
      });
      jest.runOnlyPendingTimers();

      expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
    });
  });
});
