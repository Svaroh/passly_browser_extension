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
import {
  RESOURCE_TYPE_PASSWORD_AND_DESCRIPTION_SLUG,
  RESOURCE_TYPE_PASSWORD_DESCRIPTION_TOTP_SLUG,
  RESOURCE_TYPE_PASSWORD_STRING_SLUG,
  RESOURCE_TYPE_TOTP_SLUG,
  RESOURCE_TYPE_V5_CUSTOM_FIELDS_SLUG,
  RESOURCE_TYPE_V5_DEFAULT_SLUG,
  RESOURCE_TYPE_V5_DEFAULT_TOTP_SLUG,
  RESOURCE_TYPE_V5_PASSKEY_SLUG,
  RESOURCE_TYPE_V5_PASSWORD_STRING_SLUG,
  RESOURCE_TYPE_V5_STANDALONE_NOTE_SLUG,
  RESOURCE_TYPE_V5_STANDALONE_PIN_CODE_SLUG,
  RESOURCE_TYPE_V5_TOTP_SLUG,
} from "passbolt-styleguide/src/shared/models/entity/resourceType/resourceTypeSchemasDefinition";
import { defaultTotpDto } from "./entity/totp/totpDto.test.data";
import { defaultPasskeySecretDto } from "../../passkey/passkeySecretDto.test.data";

/**
 * Secret properties every resource type definition carries, whatever its content.
 * @type {array<string>}
 */
const STRUCTURAL_SECRET_PROPERTIES = ["object_type", "schema_version"];

/**
 * Custom fields of a resource, in their metadata and secret parts.
 * @param {string} num Suffix of the custom field values
 * @returns {array<object>}
 */
const customFieldsDto = (num = "1") => [
  {
    id: `d4d0e1a4-4f5f-4d2f-9b2f-b4d0e1a44f5${num}`,
    type: "text",
    metadata_key: `Custom field ${num}`,
    secret_value: `Custom value ${num}`,
  },
];

/**
 * The secret properties of a passkey exercised by the round trip, the optional ones included.
 * @returns {object}
 */
const fullPasskeySecretDto = () =>
  defaultPasskeySecretDto({
    extensions: {},
    description: "A passkey note",
  });

/**
 * Every resource type, with the content a KDBX export / import round trip must preserve.
 *
 * `secretProperties` lists the secret schema properties the case exercises. The round trip test
 * asserts it covers the whole secret definition of the type, so a new secret property, or a new
 * resource type, cannot be added without covering it here.
 *
 * `expectedSlug` is the type the resource comes back as. It only differs for the legacy password
 * string types, which a KDBX entry cannot be told apart from a password with a description.
 *
 * `expectedContent` overrides the content expected back, for the types whose secret does not travel
 * in the KDBX field it came from. `expectedDecryptedContent` does the same for the content the
 * export service reads out of the decrypted secret.
 *
 * @type {array<object>}
 */
export const KDBX_ROUND_TRIP_CASES = [
  {
    slug: RESOURCE_TYPE_PASSWORD_STRING_SLUG,
    secretProperties: [],
    resource: { secret_clear: "Password 1" },
    plaintextSecret: "Password 1",
    expectedSlug: RESOURCE_TYPE_PASSWORD_AND_DESCRIPTION_SLUG,
  },
  {
    slug: RESOURCE_TYPE_PASSWORD_AND_DESCRIPTION_SLUG,
    secretProperties: ["password", "description"],
    resource: { secret_clear: "Password 1", description: "Description 1" },
    plaintextSecret: { password: "Password 1", description: "Description 1" },
    expectedSlug: RESOURCE_TYPE_PASSWORD_AND_DESCRIPTION_SLUG,
  },
  {
    slug: RESOURCE_TYPE_PASSWORD_DESCRIPTION_TOTP_SLUG,
    secretProperties: ["password", "description", "totp"],
    resource: { secret_clear: "Password 1", description: "Description 1", totp: defaultTotpDto() },
    plaintextSecret: { password: "Password 1", description: "Description 1", totp: defaultTotpDto() },
    expectedSlug: RESOURCE_TYPE_PASSWORD_DESCRIPTION_TOTP_SLUG,
  },
  {
    slug: RESOURCE_TYPE_TOTP_SLUG,
    secretProperties: ["totp"],
    resource: { totp: defaultTotpDto() },
    plaintextSecret: { totp: defaultTotpDto() },
    expectedSlug: RESOURCE_TYPE_TOTP_SLUG,
  },
  {
    slug: RESOURCE_TYPE_V5_DEFAULT_SLUG,
    secretProperties: ["password", "description", "custom_fields"],
    resource: {
      secret_clear: "Password 1",
      description: "Description 1",
      custom_fields: customFieldsDto(),
    },
    plaintextSecret: {
      object_type: "PASSBOLT_SECRET_DATA",
      password: "Password 1",
      description: "Description 1",
      custom_fields: customFieldsDto(),
    },
    expectedSlug: RESOURCE_TYPE_V5_DEFAULT_SLUG,
  },
  {
    slug: RESOURCE_TYPE_V5_PASSWORD_STRING_SLUG,
    secretProperties: [],
    resource: { secret_clear: "Password 1" },
    plaintextSecret: "Password 1",
    expectedSlug: RESOURCE_TYPE_V5_DEFAULT_SLUG,
  },
  {
    slug: RESOURCE_TYPE_V5_DEFAULT_TOTP_SLUG,
    secretProperties: ["password", "description", "totp", "custom_fields"],
    resource: {
      secret_clear: "Password 1",
      description: "Description 1",
      totp: defaultTotpDto(),
      custom_fields: customFieldsDto(),
    },
    plaintextSecret: {
      object_type: "PASSBOLT_SECRET_DATA",
      password: "Password 1",
      description: "Description 1",
      totp: defaultTotpDto(),
      custom_fields: customFieldsDto(),
    },
    expectedSlug: RESOURCE_TYPE_V5_DEFAULT_TOTP_SLUG,
  },
  {
    slug: RESOURCE_TYPE_V5_TOTP_SLUG,
    secretProperties: ["totp"],
    resource: { totp: defaultTotpDto() },
    plaintextSecret: { object_type: "PASSBOLT_SECRET_DATA", totp: defaultTotpDto() },
    expectedSlug: RESOURCE_TYPE_V5_TOTP_SLUG,
  },
  {
    slug: RESOURCE_TYPE_V5_CUSTOM_FIELDS_SLUG,
    secretProperties: ["custom_fields"],
    resource: { custom_fields: customFieldsDto() },
    plaintextSecret: { object_type: "PASSBOLT_SECRET_DATA", custom_fields: customFieldsDto() },
    expectedSlug: RESOURCE_TYPE_V5_CUSTOM_FIELDS_SLUG,
  },
  {
    slug: RESOURCE_TYPE_V5_STANDALONE_NOTE_SLUG,
    secretProperties: ["description"],
    resource: { description: "A standalone note" },
    plaintextSecret: { object_type: "PASSBOLT_SECRET_DATA", description: "A standalone note" },
    expectedSlug: RESOURCE_TYPE_V5_STANDALONE_NOTE_SLUG,
  },
  {
    slug: RESOURCE_TYPE_V5_STANDALONE_PIN_CODE_SLUG,
    secretProperties: ["pin_code", "description"],
    /*
     * A PIN code is exported in the password field and is only detected back on an entry holding
     * nothing else, hence the entry without username nor URI.
     */
    resource: { secret_clear: "123456", description: "My ATM PIN", username: "", uris: [] },
    plaintextSecret: { object_type: "PASSBOLT_SECRET_DATA", pin_code: "123456", description: "My ATM PIN" },
    expectedSlug: RESOURCE_TYPE_V5_STANDALONE_PIN_CODE_SLUG,
    // The PIN travels in the password field and is read back as a PIN code.
    expectedContent: { secret_clear: "", pin_code: "123456" },
  },
  {
    slug: RESOURCE_TYPE_V5_PASSKEY_SLUG,
    secretProperties: Object.keys(fullPasskeySecretDto()).filter(
      (property) => !STRUCTURAL_SECRET_PROPERTIES.includes(property),
    ),
    resource: { passkey: fullPasskeySecretDto() },
    plaintextSecret: fullPasskeySecretDto(),
    expectedSlug: RESOURCE_TYPE_V5_PASSKEY_SLUG,
    // A note held by the passkey secret is also read as the resource description on export.
    expectedDecryptedContent: { description: "A passkey note" },
  },
];

/**
 * Build the external resource dto of a round trip case, as the export service builds it out of a
 * decrypted resource.
 * @param {object} roundTripCase A case of KDBX_ROUND_TRIP_CASES
 * @returns {object}
 */
export const buildRoundTripResourceDto = (roundTripCase) => ({
  name: `Resource ${roundTripCase.slug}`,
  username: "ada@passly.test",
  uris: ["https://www.passly.test"],
  description: null,
  secret_clear: "",
  folder_parent_path: "",
  expired: null,
  ...roundTripCase.resource,
});

/**
 * Extract the secret content of an external resource, in a shape comparable before and after a
 * round trip. Custom field ids are dropped, they are regenerated at import.
 * @param {ExternalResourceEntity} externalResourceEntity The resource to read
 * @returns {object}
 */
export const extractSecretContent = (externalResourceEntity) => ({
  secret_clear: externalResourceEntity.secretClear || "",
  description: externalResourceEntity.description || null,
  totp: externalResourceEntity.totp?.toDto() || null,
  custom_fields:
    externalResourceEntity.customFields?.items.map((customField) => ({
      key: customField.key,
      value: customField.value,
    })) || null,
  pin_code: externalResourceEntity.pinCode || null,
  passkey: externalResourceEntity.passkey || null,
});

/**
 * The structural secret properties, shared by every resource type definition.
 * @type {array<string>}
 */
export const KDBX_ROUND_TRIP_STRUCTURAL_SECRET_PROPERTIES = STRUCTURAL_SECRET_PROPERTIES;
