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
 * @since         5.12.106
 */

import PasskeyContentScriptInjectionService, {
  PASSKEY_PROVIDER_BRIDGE_SCRIPT,
  PASSKEY_PROVIDER_PAGE_SCRIPT,
} from "./passkeyContentScriptInjectionService";

describe("PasskeyContentScriptInjectionService", () => {
  beforeEach(() => {
    chrome.tabs.query = jest.fn(() =>
      Promise.resolve([
        { id: 1, url: "https://www.passkeys.io/" },
        { id: 2, url: "http://localhost:8845/" },
        { id: 3, url: "chrome://extensions/" },
        { id: 4, url: "about:blank" },
        { url: "https://missing-tab-id.example" },
      ]),
    );
    chrome.scripting.executeScript = jest.fn(() => Promise.resolve());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("injects the bridge and MAIN-world page script into existing http and https tabs", async () => {
    await expect(PasskeyContentScriptInjectionService.injectIntoExistingTabs()).resolves.toBe(2);

    expect(chrome.tabs.query).toHaveBeenCalledWith({
      url: ["http://*/*", "https://*/*"],
    });
    expect(chrome.scripting.executeScript).toHaveBeenCalledWith({
      files: [PASSKEY_PROVIDER_BRIDGE_SCRIPT],
      target: { tabId: 1, allFrames: true },
      world: "ISOLATED",
    });
    expect(chrome.scripting.executeScript).toHaveBeenCalledWith({
      files: [PASSKEY_PROVIDER_PAGE_SCRIPT],
      target: { tabId: 1, allFrames: true },
      world: "MAIN",
    });
    expect(chrome.scripting.executeScript).toHaveBeenCalledWith({
      files: [PASSKEY_PROVIDER_BRIDGE_SCRIPT],
      target: { tabId: 2, allFrames: true },
      world: "ISOLATED",
    });
    expect(chrome.scripting.executeScript).toHaveBeenCalledWith({
      files: [PASSKEY_PROVIDER_PAGE_SCRIPT],
      target: { tabId: 2, allFrames: true },
      world: "MAIN",
    });
  });

  it("does not fail the startup path when a tab refuses injection", async () => {
    chrome.scripting.executeScript.mockRejectedValueOnce(new Error("Cannot access contents of the page"));

    await expect(PasskeyContentScriptInjectionService.injectIntoExistingTabs()).resolves.toBe(2);

    expect(chrome.scripting.executeScript).toHaveBeenCalledTimes(3);
  });

  it("returns false when script injection APIs are unavailable", () => {
    const scripting = chrome.scripting;
    delete chrome.scripting;

    expect(PasskeyContentScriptInjectionService.canInject()).toBe(false);

    chrome.scripting = scripting;
  });
});
