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
 * @since         5.12.135
 */

import fs from "fs";
import path from "path";
import {
  PASSKEY_PROVIDER_CHANNELS,
  PASSKEY_PROVIDER_MESSAGES,
  PASSKEY_PROVIDER_PAGE_SCRIPT_PATH,
  PASSKEY_PROVIDER_PORT_NAME,
} from "../../../../all/passkey/passkeyProviderConstants";

function readContentScriptSource(fileName) {
  return fs.readFileSync(path.resolve(__dirname, "../../../contentScripts/js/passkey-provider", fileName), "utf8");
}

function expectSourceConst(source, name, value) {
  expect(source).toContain(`const ${name} = "${value}";`);
}

describe("passkey provider content-script protocol", () => {
  const bridgeSource = readContentScriptSource("passkeyProviderBridge.js");
  const pageSource = readContentScriptSource("passkeyProviderPageScript.js");

  it("keeps bridge and page channel names aligned with shared constants", () => {
    for (const source of [bridgeSource, pageSource]) {
      expectSourceConst(source, "CHANNEL_INIT", PASSKEY_PROVIDER_CHANNELS.INIT);
      expectSourceConst(source, "CHANNEL_ACK", PASSKEY_PROVIDER_CHANNELS.ACK);
      expectSourceConst(source, "CHANNEL_REQUEST", PASSKEY_PROVIDER_CHANNELS.REQUEST);
      expectSourceConst(source, "CHANNEL_RESPONSE", PASSKEY_PROVIDER_CHANNELS.RESPONSE);
    }
  });

  it("keeps bridge and page request names aligned with shared constants", () => {
    for (const source of [bridgeSource, pageSource]) {
      expectSourceConst(source, "MESSAGE_CREATE", PASSKEY_PROVIDER_MESSAGES.CONTENT_CREATE);
      expectSourceConst(source, "MESSAGE_GET", PASSKEY_PROVIDER_MESSAGES.CONTENT_GET);
      expectSourceConst(source, "MESSAGE_UVPAA", PASSKEY_PROVIDER_MESSAGES.CONTENT_UVPAA);
      expectSourceConst(source, "MESSAGE_CONFIRM", PASSKEY_PROVIDER_MESSAGES.CONFIRM);
      expectSourceConst(source, "MESSAGE_SUSPEND", PASSKEY_PROVIDER_MESSAGES.SUSPEND);
      expectSourceConst(source, "MESSAGE_RESUME", PASSKEY_PROVIDER_MESSAGES.RESUME);
    }
  });

  it("keeps bridge runtime transport constants aligned with shared constants", () => {
    expectSourceConst(bridgeSource, "PORT_NAME", PASSKEY_PROVIDER_PORT_NAME);
    expectSourceConst(bridgeSource, "PAGE_SCRIPT_PATH", PASSKEY_PROVIDER_PAGE_SCRIPT_PATH);
  });
});
