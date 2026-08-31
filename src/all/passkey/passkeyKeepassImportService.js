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
import PasskeyCborService from "./passkeyCborService";
import PasskeyEncodingService from "./passkeyEncodingService";
import { PASSKEY_SECRET_OBJECT_TYPE, PASSKEY_SECRET_SCHEMA_VERSION } from "./passkeyProviderConstants";

/**
 * Entry attributes KeePassXC stores a passkey in.
 * @see https://github.com/keepassxreboot/keepassxc `EntryAttributes::KPEX_PASSKEY_*`
 */
export const KEEPASS_PASSKEY_FIELDS = Object.freeze({
  MARKER: "KPEX_PASSKEY",
  CREDENTIAL_ID: "KPEX_PASSKEY_CREDENTIAL_ID",
  PRIVATE_KEY_PEM: "KPEX_PASSKEY_PRIVATE_KEY_PEM",
  RELYING_PARTY: "KPEX_PASSKEY_RELYING_PARTY",
  USERNAME: "KPEX_PASSKEY_USERNAME",
  LEGACY_USERNAME: "KPXC_PASSKEY_USERNAME",
  USER_HANDLE: "KPEX_PASSKEY_USER_HANDLE",
  GENERATED_USER_ID: "KPEX_PASSKEY_GENERATED_USER_ID",
  FLAG_BACKUP_ELIGIBLE: "KPEX_PASSKEY_FLAG_BE",
  FLAG_BACKUP_STATE: "KPEX_PASSKEY_FLAG_BS",
});

/**
 * All the KeePassXC passkey attributes, to be excluded from the custom fields at import.
 * @type {array<string>}
 */
export const KEEPASS_PASSKEY_FIELD_NAMES = Object.freeze(Object.values(KEEPASS_PASSKEY_FIELDS));

const PEM_PRIVATE_KEY_START = "-----BEGIN PRIVATE KEY-----";
const PEM_PRIVATE_KEY_END = "-----END PRIVATE KEY-----";
const COSE_ALGORITHM_ES256 = -7;
const COSE_KEY_TYPE_EC2 = 2;
const COSE_CURVE_P256 = 1;
const UNKNOWN_AAGUID = "00000000-0000-0000-0000-000000000000";

/**
 * Build a Passly passkey secret out of the passkey attributes of a KeePassXC entry.
 *
 * KeePassXC stores the credential as a PKCS#8 PEM private key and does not keep the public key,
 * hence it is derived back from the private key.
 */
class PasskeyKeepassImportService {
  /**
   * Check if the given KeePassXC fields carry a passkey.
   * @param {object} keepassFields The KeePassXC passkey attributes, keyed by attribute name
   * @returns {boolean}
   */
  static hasPasskeyFields(keepassFields) {
    return Boolean(
      keepassFields?.[KEEPASS_PASSKEY_FIELDS.CREDENTIAL_ID] &&
        keepassFields?.[KEEPASS_PASSKEY_FIELDS.PRIVATE_KEY_PEM] &&
        keepassFields?.[KEEPASS_PASSKEY_FIELDS.RELYING_PARTY],
    );
  }

  /**
   * Build a passkey secret dto out of the KeePassXC passkey attributes.
   * @param {object} keepassFields The KeePassXC passkey attributes, keyed by attribute name
   * @param {object} [options] Fallbacks taken from the entry itself
   * @param {string} [options.username] The entry username, used when the passkey has no user name
   * @returns {Promise<object>} The plaintext passkey secret dto
   * @throws {Error} If the passkey is incomplete or not an ES256 credential
   */
  static async buildSecretDto(keepassFields, options = {}) {
    const rpId = keepassFields[KEEPASS_PASSKEY_FIELDS.RELYING_PARTY]?.trim();
    const credentialId = this.toBase64Url(keepassFields[KEEPASS_PASSKEY_FIELDS.CREDENTIAL_ID]);
    const userHandle = this.toBase64Url(
      keepassFields[KEEPASS_PASSKEY_FIELDS.USER_HANDLE] || keepassFields[KEEPASS_PASSKEY_FIELDS.GENERATED_USER_ID],
    );
    const userName =
      keepassFields[KEEPASS_PASSKEY_FIELDS.USERNAME]?.trim() ||
      keepassFields[KEEPASS_PASSKEY_FIELDS.LEGACY_USERNAME]?.trim() ||
      options.username?.trim();

    if (!rpId || !credentialId || !userHandle || !userName) {
      throw new Error("The KeePassXC passkey is incomplete.");
    }

    const privateKeyPkcs8 = this.parsePkcs8Pem(keepassFields[KEEPASS_PASSKEY_FIELDS.PRIVATE_KEY_PEM]);
    const publicKeyCose = await this.buildCoseEc2PublicKey(privateKeyPkcs8);

    return {
      object_type: PASSKEY_SECRET_OBJECT_TYPE,
      schema_version: PASSKEY_SECRET_SCHEMA_VERSION,
      credential_id: credentialId,
      rp_id: rpId,
      origin: `https://${rpId}`,
      user_handle: userHandle,
      user_name: userName,
      user_display_name: userName,
      cose_alg: COSE_ALGORITHM_ES256,
      public_key_cose: PasskeyEncodingService.toBase64Url(publicKeyCose),
      private_key_pkcs8: PasskeyEncodingService.toBase64Url(privateKeyPkcs8),
      aaguid: UNKNOWN_AAGUID,
      // KeePassXC defaults both backup flags to "1" when it creates a passkey.
      backup_eligible: this.readFlag(keepassFields[KEEPASS_PASSKEY_FIELDS.FLAG_BACKUP_ELIGIBLE]),
      backup_state: this.readFlag(keepassFields[KEEPASS_PASSKEY_FIELDS.FLAG_BACKUP_STATE]),
      // KeePassXC does not keep a signature counter, relying parties accept a credential staying at 0.
      sign_count: 0,
      transports: ["internal"],
    };
  }

  /**
   * Read a KeePassXC boolean flag attribute.
   * @param {string} [value] The attribute value
   * @returns {boolean}
   */
  static readFlag(value) {
    return value?.trim() === "1" || value?.trim().toLowerCase() === "true";
  }

  /**
   * Re-encode a base64 or base64url value as an unpadded base64url one.
   * @param {string} [value] The value to normalize
   * @returns {string|null} The normalized value, or null if it is not base64 data
   */
  static toBase64Url(value) {
    if (typeof value !== "string" || !value.trim().length) {
      return null;
    }

    try {
      return PasskeyEncodingService.toBase64Url(PasskeyEncodingService.base64UrlToUint8Array(value.trim()));
    } catch {
      return null;
    }
  }

  /**
   * Extract the DER bytes of a PKCS#8 PEM private key.
   * @param {string} privateKeyPem The PEM private key
   * @returns {Uint8Array}
   * @throws {Error} If the value is not a PKCS#8 PEM private key
   */
  static parsePkcs8Pem(privateKeyPem) {
    const pem = typeof privateKeyPem === "string" ? privateKeyPem.trim() : "";
    if (!pem.startsWith(PEM_PRIVATE_KEY_START) || !pem.endsWith(PEM_PRIVATE_KEY_END)) {
      throw new Error("The KeePassXC passkey private key is not a PKCS#8 PEM key.");
    }

    const base64 = pem.slice(PEM_PRIVATE_KEY_START.length, pem.length - PEM_PRIVATE_KEY_END.length).replace(/\s/g, "");

    return PasskeyEncodingService.base64UrlToUint8Array(base64);
  }

  /**
   * Derive the COSE public key of an ES256 PKCS#8 private key.
   * @param {Uint8Array} privateKeyPkcs8 The PKCS#8 private key
   * @returns {Promise<Uint8Array>}
   * @throws {Error} If the key is not an ES256 (ECDSA P-256) private key
   */
  static async buildCoseEc2PublicKey(privateKeyPkcs8) {
    let privateJwk;
    try {
      const privateKey = await crypto.subtle.importKey(
        "pkcs8",
        privateKeyPkcs8,
        { name: "ECDSA", namedCurve: "P-256" },
        true,
        ["sign"],
      );
      privateJwk = await crypto.subtle.exportKey("jwk", privateKey);
    } catch {
      throw new Error("Only ES256 passkeys are supported.");
    }

    if (privateJwk.crv !== "P-256" || typeof privateJwk.x !== "string" || typeof privateJwk.y !== "string") {
      throw new Error("Only ES256 passkeys are supported.");
    }

    return PasskeyCborService.encode(
      new Map([
        [1, COSE_KEY_TYPE_EC2],
        [3, COSE_ALGORITHM_ES256],
        [-1, COSE_CURVE_P256],
        [-2, PasskeyEncodingService.base64UrlToUint8Array(privateJwk.x)],
        [-3, PasskeyEncodingService.base64UrlToUint8Array(privateJwk.y)],
      ]),
    );
  }
}

export default PasskeyKeepassImportService;
