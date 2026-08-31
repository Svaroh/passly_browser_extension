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
  PASSKEY_RESOURCE_TYPE_SLUG,
  PASSKEY_SECRET_OBJECT_TYPE,
  PASSKEY_SECRET_SCHEMA_VERSION,
} from "./passkeyProviderConstants";

/**
 * Secret properties a passkey cannot be used without. They match the required properties of the
 * `v5-passkey` secret schema, minus the ones this serializer defaults by itself.
 * @type {array<string>}
 */
const REQUIRED_SECRET_PROPERTIES = [
  "credential_id",
  "rp_id",
  "user_handle",
  "user_name",
  "cose_alg",
  "public_key_cose",
  "private_key_pkcs8",
  "aaguid",
  "backup_eligible",
  "backup_state",
  "sign_count",
];

/**
 * Serialize and parse passkey secrets exchanged with import / export files.
 */
class PasskeySecretSerializer {
  /**
   * Check if a resource type holds a passkey secret.
   * @param {ResourceTypeEntity|null} [resourceType] The resource type to check
   * @returns {boolean}
   */
  static isPasskeyResourceType(resourceType) {
    return resourceType?.slug === PASSKEY_RESOURCE_TYPE_SLUG;
  }

  /**
   * Serialize a passkey secret dto.
   * @param {object|null} secretDto The plaintext passkey secret dto
   * @returns {string|null} The serialized secret, or null if the given dto is not a valid passkey secret.
   */
  static serialize(secretDto) {
    const passkeyDto = this.normalize(secretDto);
    return passkeyDto ? JSON.stringify(passkeyDto) : null;
  }

  /**
   * Parse a serialized passkey secret.
   * @param {string|null} serializedSecret The serialized passkey secret
   * @returns {object|null} The passkey secret dto, or null if it could not be parsed.
   */
  static parse(serializedSecret) {
    if (typeof serializedSecret !== "string" || !serializedSecret.length) {
      return null;
    }

    let secretDto;
    try {
      secretDto = JSON.parse(serializedSecret);
    } catch {
      return null;
    }

    return this.normalize(secretDto);
  }

  /**
   * Normalize a passkey secret dto, defaulting the object type and the schema version.
   * @param {object|null} secretDto The passkey secret dto
   * @returns {object|null} The normalized dto, or null if it does not carry a usable passkey.
   */
  static normalize(secretDto) {
    if (!secretDto || typeof secretDto !== "object" || Array.isArray(secretDto)) {
      return null;
    }

    if (typeof secretDto.object_type !== "undefined" && secretDto.object_type !== PASSKEY_SECRET_OBJECT_TYPE) {
      return null;
    }

    const passkeyDto = {
      ...secretDto,
      object_type: PASSKEY_SECRET_OBJECT_TYPE,
      schema_version: Number.isInteger(secretDto.schema_version)
        ? secretDto.schema_version
        : PASSKEY_SECRET_SCHEMA_VERSION,
    };

    const hasRequiredProperties = REQUIRED_SECRET_PROPERTIES.every((property) => {
      const value = passkeyDto[property];
      return typeof value !== "undefined" && value !== null && value !== "";
    });

    return hasRequiredProperties ? passkeyDto : null;
  }
}

export default PasskeySecretSerializer;
