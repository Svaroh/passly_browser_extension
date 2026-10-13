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
 * @since         5.12.94
 */

import PasskeyCborService from "../../../../all/passkey/passkeyCborService";
import PasskeyEncodingService from "../../../../all/passkey/passkeyEncodingService";
import {
  PASSKEY_SECRET_OBJECT_TYPE,
  PASSKEY_SECRET_SCHEMA_VERSION,
} from "../../../../all/passkey/passkeyProviderConstants";

const PASSKEY_ALGORITHM_ES256 = -7;
const PASSKEY_CREDENTIAL_ID_LENGTH = 32;
const PASSKEY_AAGUID_LENGTH = 16;
const WEBAUTHN_TYPE_CREATE = "webauthn.create";
const WEBAUTHN_TYPE_GET = "webauthn.get";
const WEBAUTHN_FLAG_USER_PRESENT = 0x01;
const WEBAUTHN_FLAG_USER_VERIFIED = 0x04;
const WEBAUTHN_FLAG_ATTESTED_CREDENTIAL_DATA = 0x40;
const COSE_KEY_TYPE_EC2 = 2;
const COSE_CURVE_P256 = 1;

class PasskeyWebauthnService {
  /**
   * Build a new ES256 passkey registration response and its encrypted-vault plaintext DTO.
   * @param {object|string} requestDetails Request details from chrome.webAuthenticationProxy.
   * @returns {Promise<{credential: object, secretDto: object}>}
   */
  static async createCredential(requestDetails) {
    const options = this.parseRequestDetails(requestDetails);
    this.assertSupportedCreateOptions(options);

    const origin = this.getOrigin(options);
    const rpId = this.getRpId(options, origin);
    const credentialId = this.getRandomBytes(PASSKEY_CREDENTIAL_ID_LENGTH);
    const keyPair = await this.generateEs256KeyPair();
    const publicJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
    const privateKeyPkcs8 = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey);
    const publicKeySpki = await crypto.subtle.exportKey("spki", keyPair.publicKey);
    const publicKeyCose = this.buildCoseEc2PublicKey(publicJwk);
    const signCount = 0;
    const authenticatorData = await this.buildAttestationAuthenticatorData(
      rpId,
      credentialId,
      publicKeyCose,
      signCount,
    );
    const clientDataJSON = this.buildClientDataJson(WEBAUTHN_TYPE_CREATE, options.challenge, origin);
    const attestationObject = this.buildAttestationObject(authenticatorData);

    const secretDto = {
      object_type: PASSKEY_SECRET_OBJECT_TYPE,
      schema_version: PASSKEY_SECRET_SCHEMA_VERSION,
      credential_id: PasskeyEncodingService.toBase64Url(credentialId),
      rp_id: rpId,
      origin,
      user_handle: options.user.id,
      user_name: options.user.name,
      user_display_name: options.user.displayName || null,
      cose_alg: PASSKEY_ALGORITHM_ES256,
      public_key_cose: PasskeyEncodingService.toBase64Url(publicKeyCose),
      private_key_pkcs8: PasskeyEncodingService.toBase64Url(privateKeyPkcs8),
      aaguid: this.getAaguidUuid(),
      backup_eligible: false,
      backup_state: false,
      sign_count: signCount,
      transports: ["internal"],
    };

    const credential = {
      id: secretDto.credential_id,
      rawId: secretDto.credential_id,
      type: "public-key",
      authenticatorAttachment: "platform",
      clientExtensionResults: {},
      response: {
        attestationObject: PasskeyEncodingService.toBase64Url(attestationObject),
        authenticatorData: PasskeyEncodingService.toBase64Url(authenticatorData),
        clientDataJSON: PasskeyEncodingService.toBase64Url(PasskeyEncodingService.utf8ToUint8Array(clientDataJSON)),
        publicKey: PasskeyEncodingService.toBase64Url(publicKeySpki),
        publicKeyAlgorithm: PASSKEY_ALGORITHM_ES256,
        transports: ["internal"],
      },
    };

    return { credential, secretDto };
  }

  /**
   * Build a WebAuthn assertion response from a stored passkey secret DTO.
   * @param {object|string} requestDetails Request details from chrome.webAuthenticationProxy.
   * @param {object} secretDto Decrypted v5-passkey secret DTO.
   * @returns {Promise<{credential: object, secretDto: object}>}
   */
  static async getAssertion(requestDetails, secretDto) {
    const options = this.parseRequestDetails(requestDetails);
    this.assertValidSecretDto(secretDto);

    const origin = this.getOrigin(options);
    const rpId = this.getRequestRpId(options, origin);
    if (!this.isRpIdMatching(secretDto.rp_id, rpId, origin)) {
      throw this.buildNotAllowedError("The passkey does not belong to this relying party.");
    }

    if (!this.isCredentialAllowed(options.allowCredentials, secretDto.credential_id)) {
      throw this.buildNotAllowedError("The relying party did not allow this passkey credential.");
    }

    const clientDataJSON = this.buildClientDataJson(WEBAUTHN_TYPE_GET, options.challenge, origin);
    const clientDataHash = await this.sha256(PasskeyEncodingService.utf8ToUint8Array(clientDataJSON));
    const assertionRpId = this.getEffectiveAssertionRpId(options, secretDto, origin);
    const authenticatorData = await this.buildAssertionAuthenticatorData(assertionRpId, secretDto.sign_count || 0);
    const signatureBase = PasskeyEncodingService.concat(authenticatorData, clientDataHash);
    const privateKey = await this.importEs256PrivateKey(secretDto.private_key_pkcs8);
    const rawSignature = await crypto.subtle.sign(
      { name: "ECDSA", hash: { name: "SHA-256" } },
      privateKey,
      signatureBase,
    );
    const signature = this.ecdsaP1363SignatureToDer(rawSignature);

    const credential = {
      id: secretDto.credential_id,
      rawId: secretDto.credential_id,
      type: "public-key",
      authenticatorAttachment: "platform",
      clientExtensionResults: {},
      response: {
        authenticatorData: PasskeyEncodingService.toBase64Url(authenticatorData),
        clientDataJSON: PasskeyEncodingService.toBase64Url(PasskeyEncodingService.utf8ToUint8Array(clientDataJSON)),
        signature: PasskeyEncodingService.toBase64Url(signature),
        userHandle: secretDto.user_handle,
      },
    };

    return { credential, secretDto };
  }

  /**
   * @param {object|string} requestDetails
   * @returns {object}
   */
  static parseRequestDetails(requestDetails) {
    if (typeof requestDetails === "string") {
      return JSON.parse(requestDetails);
    }

    if (requestDetails && typeof requestDetails === "object") {
      return requestDetails;
    }

    throw new TypeError("The WebAuthn request details should be an object or a JSON string.");
  }

  /**
   * @param {object} parameter
   * @returns {boolean}
   */
  static isEs256CredParam(parameter) {
    if (!parameter || typeof parameter !== "object") {
      return false;
    }

    const type = parameter.type;
    if (typeof type === "string" && type.toLowerCase() !== "public-key") {
      return false;
    }

    const alg = Number(parameter.alg);
    return alg === PASSKEY_ALGORITHM_ES256;
  }

  /**
   * Check whether WebAuthn creation options can be fulfilled by the Passly passkey provider.
   * @param {object|string} requestDetails
   * @returns {boolean}
   */
  static supportsCreateOptions(requestDetails) {
    let options;
    try {
      options = this.parseRequestDetails(requestDetails);
    } catch {
      return false;
    }

    if (!options || typeof options !== "object") {
      return false;
    }

    if (typeof options.challenge !== "string") {
      return false;
    }

    if (typeof options?.rp?.name !== "string") {
      return false;
    }

    if (typeof options?.user?.id !== "string" || typeof options?.user?.name !== "string") {
      return false;
    }

    if (!Array.isArray(options.pubKeyCredParams) || options.pubKeyCredParams.length === 0) {
      return true;
    }

    return options.pubKeyCredParams.some((parameter) => this.isEs256CredParam(parameter));
  }

  /**
   * @param {object} options
   */
  static assertSupportedCreateOptions(options) {
    if (typeof options.challenge !== "string") {
      throw new TypeError("The WebAuthn creation challenge should be a base64url string.");
    }

    if (typeof options?.rp?.name !== "string") {
      throw new TypeError("The WebAuthn creation request should contain an RP name.");
    }

    if (typeof options?.user?.id !== "string" || typeof options?.user?.name !== "string") {
      throw new TypeError("The WebAuthn creation request should contain a user id and user name.");
    }

    if (Array.isArray(options.pubKeyCredParams) && options.pubKeyCredParams.length > 0) {
      const supportsEs256 = options.pubKeyCredParams.some((parameter) => this.isEs256CredParam(parameter));
      if (!supportsEs256) {
        throw this.buildNotSupportedError("Passly passkey MVP supports only ES256 public-key credentials.");
      }
    }
  }

  /**
   * @param {object} secretDto
   */
  static assertValidSecretDto(secretDto) {
    if (
      secretDto?.object_type !== PASSKEY_SECRET_OBJECT_TYPE ||
      secretDto?.schema_version !== PASSKEY_SECRET_SCHEMA_VERSION ||
      secretDto?.cose_alg !== PASSKEY_ALGORITHM_ES256 ||
      typeof secretDto?.credential_id !== "string" ||
      typeof secretDto?.rp_id !== "string" ||
      typeof secretDto?.user_handle !== "string" ||
      typeof secretDto?.private_key_pkcs8 !== "string"
    ) {
      throw new TypeError("The passkey secret DTO is invalid.");
    }
  }

  /**
   * @param {object} options
   * @returns {string}
   */
  static getOrigin(options) {
    const origin = options.origin || options.passlyOrigin || options.passly_origin;
    if (typeof origin === "string" && origin) {
      return new URL(origin).origin;
    }

    if (typeof options?.rp?.id === "string" && options.rp.id) {
      return `https://${options.rp.id}`;
    }

    if (typeof options.rpId === "string" && options.rpId) {
      return `https://${options.rpId}`;
    }

    throw new TypeError("The WebAuthn request origin is required when RP ID is not explicit.");
  }

  /**
   * @param {object} options
   * @param {string} origin
   * @returns {string}
   */
  static getRpId(options, origin) {
    if (typeof options?.rp?.id === "string" && options.rp.id) {
      return this.normalizeDomain(options.rp.id);
    }
    if (typeof options.rpId === "string" && options.rpId) {
      return this.normalizeDomain(options.rpId);
    }
    if (typeof options.rp_id === "string" && options.rp_id) {
      return this.normalizeDomain(options.rp_id);
    }

    return this.normalizeDomain(new URL(origin).hostname);
  }

  /**
   * @param {object} options
   * @param {string} origin
   * @returns {string}
   */
  static getRequestRpId(options, origin) {
    if (typeof options.rpId === "string" && options.rpId) {
      return this.normalizeDomain(options.rpId);
    }
    if (typeof options?.rp?.id === "string" && options.rp.id) {
      return this.normalizeDomain(options.rp.id);
    }
    if (typeof options.rp_id === "string" && options.rp_id) {
      return this.normalizeDomain(options.rp_id);
    }

    return this.normalizeDomain(new URL(origin).hostname);
  }

  /**
   * Determine the effective RP ID to hash into the assertion authenticator data.
   * WebAuthn relying parties verify rpIdHash against the rpId requested in options
   * (or the caller's origin hostname when rpId was omitted).
   * @param {object} options
   * @param {object} secretDto
   * @param {string} origin
   * @returns {string}
   */
  static getEffectiveAssertionRpId(options, secretDto, origin) {
    if (typeof options.rpId === "string" && options.rpId) {
      return this.normalizeDomain(options.rpId);
    }
    if (typeof options?.rp?.id === "string" && options.rp.id) {
      return this.normalizeDomain(options.rp.id);
    }
    if (typeof options.rp_id === "string" && options.rp_id) {
      return this.normalizeDomain(options.rp_id);
    }
    if (secretDto?.rp_id) {
      return this.normalizeDomain(secretDto.rp_id);
    }

    return this.getRequestRpId(options, origin);
  }

  /**
   * @returns {Promise<CryptoKeyPair>}
   */
  static generateEs256KeyPair() {
    return crypto.subtle.generateKey(
      {
        name: "ECDSA",
        namedCurve: "P-256",
      },
      true,
      ["sign", "verify"],
    );
  }

  /**
   * @param {string} privateKeyPkcs8
   * @returns {Promise<CryptoKey>}
   */
  static importEs256PrivateKey(privateKeyPkcs8) {
    return crypto.subtle.importKey(
      "pkcs8",
      PasskeyEncodingService.base64UrlToUint8Array(privateKeyPkcs8),
      {
        name: "ECDSA",
        namedCurve: "P-256",
      },
      false,
      ["sign"],
    );
  }

  /**
   * @param {JsonWebKey} publicJwk
   * @returns {Uint8Array}
   */
  static buildCoseEc2PublicKey(publicJwk) {
    if (publicJwk.crv !== "P-256" || typeof publicJwk.x !== "string" || typeof publicJwk.y !== "string") {
      throw new TypeError("The ES256 public key should contain P-256 x/y coordinates.");
    }

    return PasskeyCborService.encode(
      new Map([
        [1, COSE_KEY_TYPE_EC2],
        [3, PASSKEY_ALGORITHM_ES256],
        [-1, COSE_CURVE_P256],
        [-2, PasskeyEncodingService.base64UrlToUint8Array(publicJwk.x)],
        [-3, PasskeyEncodingService.base64UrlToUint8Array(publicJwk.y)],
      ]),
    );
  }

  /**
   * @param {string} rpId
   * @param {Uint8Array} credentialId
   * @param {Uint8Array} publicKeyCose
   * @param {number} signCount
   * @returns {Promise<Uint8Array>}
   */
  static async buildAttestationAuthenticatorData(rpId, credentialId, publicKeyCose, signCount) {
    const flags = WEBAUTHN_FLAG_USER_PRESENT | WEBAUTHN_FLAG_USER_VERIFIED | WEBAUTHN_FLAG_ATTESTED_CREDENTIAL_DATA;
    const attestedCredentialData = PasskeyEncodingService.concat(
      this.getAaguid(),
      PasskeyEncodingService.uint16ToBigEndian(credentialId.length),
      credentialId,
      publicKeyCose,
    );

    return PasskeyEncodingService.concat(
      await this.sha256(PasskeyEncodingService.utf8ToUint8Array(rpId)),
      new Uint8Array([flags]),
      PasskeyEncodingService.uint32ToBigEndian(signCount),
      attestedCredentialData,
    );
  }

  /**
   * @param {string} rpId
   * @param {number} signCount
   * @returns {Promise<Uint8Array>}
   */
  static async buildAssertionAuthenticatorData(rpId, signCount) {
    const flags = WEBAUTHN_FLAG_USER_PRESENT | WEBAUTHN_FLAG_USER_VERIFIED;
    return PasskeyEncodingService.concat(
      await this.sha256(PasskeyEncodingService.utf8ToUint8Array(rpId)),
      new Uint8Array([flags]),
      PasskeyEncodingService.uint32ToBigEndian(signCount),
    );
  }

  /**
   * @param {Uint8Array} authenticatorData
   * @returns {Uint8Array}
   */
  static buildAttestationObject(authenticatorData) {
    return PasskeyCborService.encode({
      fmt: "none",
      attStmt: {},
      authData: authenticatorData,
    });
  }

  /**
   * @param {string} type
   * @param {string} challenge
   * @param {string} origin
   * @returns {string}
   */
  static buildClientDataJson(type, challenge, origin) {
    return JSON.stringify({
      type,
      challenge,
      origin,
      crossOrigin: false,
    });
  }

  /**
   * @returns {Uint8Array}
   */
  static getAaguid() {
    return new Uint8Array(PASSKEY_AAGUID_LENGTH);
  }

  /**
   * @returns {string}
   */
  static getAaguidUuid() {
    return "00000000-0000-0000-0000-000000000000";
  }

  /**
   * @param {number} size
   * @returns {Uint8Array}
   */
  static getRandomBytes(size) {
    return crypto.getRandomValues(new Uint8Array(size));
  }

  /**
   * @param {ArrayBuffer|Uint8Array} value
   * @returns {Promise<Uint8Array>}
   */
  static async sha256(value) {
    return new Uint8Array(await crypto.subtle.digest("SHA-256", PasskeyEncodingService.toUint8Array(value)));
  }

  /**
   * Convert WebCrypto ECDSA P-1363 signatures to ASN.1 DER Ecdsa-Sig-Value.
   * @param {ArrayBuffer|Uint8Array} signature
   * @returns {Uint8Array}
   */
  static ecdsaP1363SignatureToDer(signature) {
    const bytes = PasskeyEncodingService.toUint8Array(signature);
    if (bytes[0] === 0x30) {
      return bytes;
    }

    if (bytes.length !== 64) {
      throw new TypeError("ES256 signature should be 64-byte P-1363 or DER encoded.");
    }

    const r = this.derEncodeInteger(bytes.slice(0, 32));
    const s = this.derEncodeInteger(bytes.slice(32));
    return PasskeyEncodingService.concat(new Uint8Array([0x30, r.length + s.length]), r, s);
  }

  /**
   * @param {Uint8Array} value
   * @returns {Uint8Array}
   */
  static derEncodeInteger(value) {
    let offset = 0;
    while (offset < value.length - 1 && value[offset] === 0) {
      offset++;
    }

    let trimmed = value.slice(offset);
    if (trimmed[0] & 0x80) {
      trimmed = PasskeyEncodingService.concat(new Uint8Array([0]), trimmed);
    }

    return PasskeyEncodingService.concat(new Uint8Array([0x02, trimmed.length]), trimmed);
  }

  /**
   * @param {Array<object>|undefined} allowCredentials
   * @param {string} credentialId
   * @returns {boolean}
   */
  static isCredentialAllowed(allowCredentials, credentialId) {
    if (!Array.isArray(allowCredentials) || allowCredentials.length === 0) {
      return true;
    }

    const normalizedTargetId = this.normalizeCredentialId(credentialId);
    if (!normalizedTargetId) {
      return false;
    }

    return allowCredentials.some((credential) => {
      if (!credential || typeof credential !== "object") {
        return false;
      }

      const type = credential.type;
      if (typeof type === "string" && type.toLowerCase() !== "public-key") {
        return false;
      }

      const candidateId = this.normalizeCredentialId(credential.id);
      return candidateId === normalizedTargetId;
    });
  }

  /**
   * Normalize a credential ID for robust comparison across Base64, Base64URL,
   * with or without padding.
   * @param {string|Uint8Array|ArrayBuffer|Array<number>} value
   * @returns {string}
   */
  static normalizeCredentialId(value) {
    if (!value) {
      return "";
    }

    if (typeof value === "string") {
      return value.replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "").trim();
    }

    if (
      value instanceof Uint8Array ||
      value instanceof ArrayBuffer ||
      ArrayBuffer.isView(value) ||
      Array.isArray(value)
    ) {
      return PasskeyEncodingService.toBase64Url(value).replaceAll("=", "").trim();
    }

    return String(value).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "").trim();
  }

  /**
   * Check whether a stored passkey RP ID matches a requested RP ID and/or origin.
   * Handles subdomains, casing, and origin relaxation according to WebAuthn rules.
   * @param {string} storedRpId
   * @param {string} requestedRpId
   * @param {string} [origin]
   * @returns {boolean}
   */
  static isRpIdMatching(storedRpId, requestedRpId, origin = null) {
    const normStored = this.normalizeDomain(storedRpId);
    const normRequested = this.normalizeDomain(requestedRpId);

    if (!normStored) {
      return false;
    }

    if (normRequested) {
      return this.isDomainRelated(normStored, normRequested);
    }

    if (origin) {
      try {
        const originHostname = this.normalizeDomain(new URL(origin).hostname);
        if (originHostname) {
          return this.isDomainRelated(normStored, originHostname);
        }
      } catch {
        // ignore invalid origin URLs
      }
    }

    return false;
  }

  /**
   * Check whether two domain names are equal or subdomain of one another.
   * @param {string} domainA
   * @param {string} domainB
   * @returns {boolean}
   */
  static isDomainRelated(domainA, domainB) {
    if (!domainA || !domainB) {
      return false;
    }
    if (domainA === domainB) {
      return true;
    }
    if (domainA.endsWith(`.${domainB}`)) {
      return true;
    }
    if (domainB.endsWith(`.${domainA}`)) {
      return true;
    }
    return false;
  }

  /**
   * Normalize domain names to lowercase without scheme, port, or surrounding dots.
   * @param {string|null|undefined} domain
   * @returns {string}
   */
  static normalizeDomain(domain) {
    if (!domain || typeof domain !== "string") {
      return "";
    }

    let cleaned = domain.trim().toLowerCase();
    if (cleaned.startsWith("https://") || cleaned.startsWith("http://")) {
      try {
        cleaned = new URL(cleaned).hostname.toLowerCase();
      } catch {
        // keep cleaned as is
      }
    }

    cleaned = cleaned.split(":")[0];
    while (cleaned.startsWith(".")) {
      cleaned = cleaned.slice(1);
    }
    while (cleaned.endsWith(".")) {
      cleaned = cleaned.slice(0, -1);
    }

    return cleaned;
  }

  /**
   * @param {string} message
   * @returns {{name: string, message: string}}
   */
  static buildNotSupportedError(message) {
    const error = new Error(message);
    error.name = "NotSupportedError";
    return error;
  }

  /**
   * @param {string} message
   * @returns {{name: string, message: string}}
   */
  static buildNotAllowedError(message) {
    const error = new Error(message);
    error.name = "NotAllowedError";
    return error;
  }
}

export {
  PASSKEY_ALGORITHM_ES256,
  PASSKEY_SECRET_OBJECT_TYPE,
  PASSKEY_SECRET_SCHEMA_VERSION,
  WEBAUTHN_TYPE_CREATE,
  WEBAUTHN_TYPE_GET,
};
export default PasskeyWebauthnService;
