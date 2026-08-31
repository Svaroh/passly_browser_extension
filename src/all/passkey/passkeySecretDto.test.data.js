/**
 * Passly ~ Open source password manager for teams
 * Copyright (c) Svaroh
 *
 * Licensed under GNU Affero General Public License version 3 of the or any later version.
 * For full copyright and license information, please see the LICENSE.txt
 * Redistributions of files must retain the above copyright notice.
 *
 * @copyright     Copyright (c) Svaroh
 * @license       https://opensource.org/licenses/AGPL-3.0 AGPL License
 * @link          https://passly.svaroh.net Passly
 * @since         6.0.4
 */
import ResourceTypeSchemasDefinition from "passbolt-styleguide/src/shared/models/entity/resourceType/resourceTypeSchemasDefinition";
import { KEEPASS_PASSKEY_FIELDS } from "./passkeyKeepassImportService";
import {
  PASSKEY_RESOURCE_TYPE_SLUG,
  PASSKEY_SECRET_OBJECT_TYPE,
  PASSKEY_SECRET_SCHEMA_VERSION,
} from "./passkeyProviderConstants";

/**
 * Plaintext passkey secret dto.
 * @param {object} [data] Data to override the default dto with
 * @returns {object}
 */
export const defaultPasskeySecretDto = (data = {}) => ({
  object_type: PASSKEY_SECRET_OBJECT_TYPE,
  schema_version: PASSKEY_SECRET_SCHEMA_VERSION,
  credential_id: "Y3JlZGVudGlhbC1pZA",
  rp_id: "www.spaceship.com",
  origin: "https://www.spaceship.com",
  user_handle: "dXNlci1oYW5kbGU",
  user_name: "66Ton99",
  user_display_name: "66Ton99",
  cose_alg: -7,
  public_key_cose: "cHVibGljLWtleS1jb3Nl",
  private_key_pkcs8: "cHJpdmF0ZS1rZXktcGtjczg",
  aaguid: "00000000-0000-0000-0000-000000000000",
  backup_eligible: false,
  backup_state: false,
  sign_count: 0,
  transports: ["internal"],
  ...data,
});

/**
 * ES256 PKCS#8 private key, as KeePassXC stores it in `KPEX_PASSKEY_PRIVATE_KEY_PEM`.
 * Test material only, it protects nothing.
 * @type {string}
 */
export const keepassPasskeyPrivateKeyPem = [
  "-----BEGIN PRIVATE KEY-----",
  "MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgDLQegrAWCJEtBGr8",
  "40iBVsPurZ+llHVlD+HLQyBw2CuhRANCAATJadslOFd33kGczwgK/fGCgwP1xstQ",
  "0+G0fY5PdbgQeT5/YW8KGR3+AJ4EjvQI2ge8kbsJ4CwRAMpLkq/GE7fB",
  "-----END PRIVATE KEY-----",
].join("\n");

/**
 * The P-256 public coordinates of `keepassPasskeyPrivateKeyPem`, base64url encoded.
 * @type {object}
 */
export const keepassPasskeyPublicCoordinates = {
  x: "yWnbJThXd95BnM8ICv3xgoMD9cbLUNPhtH2OT3W4EHk",
  y: "Pn9hbwoZHf4AngSO9AjaB7yRuwngLBEAykuSr8YTt8E",
};

/**
 * KeePassXC passkey entry attributes.
 * @param {object} [data] Data to override the default attributes with
 * @returns {object}
 */
export const keepassPasskeyFieldsDto = (data = {}) => ({
  [KEEPASS_PASSKEY_FIELDS.CREDENTIAL_ID]: "Y3JlZGVudGlhbC1pZA",
  [KEEPASS_PASSKEY_FIELDS.PRIVATE_KEY_PEM]: keepassPasskeyPrivateKeyPem,
  [KEEPASS_PASSKEY_FIELDS.RELYING_PARTY]: "www.spaceship.com",
  [KEEPASS_PASSKEY_FIELDS.USERNAME]: "66Ton99",
  [KEEPASS_PASSKEY_FIELDS.USER_HANDLE]: "dXNlci1oYW5kbGU",
  [KEEPASS_PASSKEY_FIELDS.FLAG_BACKUP_ELIGIBLE]: "1",
  [KEEPASS_PASSKEY_FIELDS.FLAG_BACKUP_STATE]: "1",
  ...data,
});

/**
 * Passkey resource type dto.
 * @param {object} [data] Data to override the default dto with
 * @returns {object}
 */
export const passkeyResourceTypeDto = (data = {}) => ({
  id: "333239fb-2598-580e-8d8a-508f9c49998b",
  name: "Passkey",
  slug: PASSKEY_RESOURCE_TYPE_SLUG,
  definition: ResourceTypeSchemasDefinition.SCHEMAS[PASSKEY_RESOURCE_TYPE_SLUG],
  description: "A resource with an encrypted passkey credential.",
  ...data,
});
