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

export const PASSKEY_RESOURCE_TYPE_SLUG = "v5-passkey";
export const PASSKEY_SECRET_OBJECT_TYPE = "PASSLY_PASSKEY";
export const PASSKEY_SECRET_SCHEMA_VERSION = 1;

export const PASSKEY_PROVIDER_ENABLED_STORAGE_KEY = "passlyPasskeyProviderEnabled";
export const PASSKEY_PROVIDER_DEFAULT_ENABLED = true;
export const PASSKEY_PROVIDER_BRIDGE_SCRIPT_PATH = "contentScripts/js/passkey-provider/passkeyProviderBridge.js";
export const PASSKEY_PROVIDER_PAGE_SCRIPT_PATH = "contentScripts/js/passkey-provider/passkeyProviderPageScript.js";
export const PASSKEY_PROVIDER_PORT_NAME = "passly.passkey-provider.port";
export const PASSKEY_PROVIDER_KEEPALIVE_PERIOD = 20_000;

export const PASSKEY_PROVIDER_CHANNELS = Object.freeze({
  INIT: "passly:passkey-provider:init",
  ACK: "passly:passkey-provider:ack",
  REQUEST: "passly:passkey-provider:request",
  RESPONSE: "passly:passkey-provider:response",
});

export const PASSKEY_PROVIDER_MESSAGES = Object.freeze({
  CONTENT_CREATE: "passly.passkey-provider.content-create",
  CONTENT_GET: "passly.passkey-provider.content-get",
  CONTENT_UVPAA: "passly.passkey-provider.content-uvpaa",
  CONFIRM: "passly.passkey-provider.confirm",
  SUSPEND: "passly.passkey-provider.suspend",
  RESUME: "passly.passkey-provider.resume",
  KEEPALIVE: "passly.passkey-provider.keepalive",
});

export const PASSKEY_PROVIDER_RUNTIME_MESSAGES = Object.freeze([
  PASSKEY_PROVIDER_MESSAGES.SUSPEND,
  PASSKEY_PROVIDER_MESSAGES.RESUME,
  PASSKEY_PROVIDER_MESSAGES.KEEPALIVE,
  PASSKEY_PROVIDER_MESSAGES.CONTENT_CREATE,
  PASSKEY_PROVIDER_MESSAGES.CONTENT_GET,
  PASSKEY_PROVIDER_MESSAGES.CONTENT_UVPAA,
]);
