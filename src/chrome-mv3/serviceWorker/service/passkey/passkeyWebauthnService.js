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
    let parsed;
    if (typeof requestDetails === "string") {
      parsed = JSON.parse(requestDetails);
    } else if (requestDetails && typeof requestDetails === "object") {
      parsed = requestDetails;
    } else {
      throw new TypeError("The WebAuthn request details should be an object or a JSON string.");
    }

    if (parsed && typeof parsed === "object" && parsed.publicKey && typeof parsed.publicKey === "object") {
      return {
        ...parsed,
        ...parsed.publicKey,
        origin: parsed.origin || parsed.publicKey.origin,
      };
    }

    return parsed;
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

    const targetBytes = this.toCredentialBytes(credentialId);
    const normalizedTargetId = this.normalizeCredentialId(credentialId);

    return allowCredentials.some((credential) => {
      if (!credential) {
        return false;
      }

      let candidateRaw = credential;
      if (
        typeof credential === "object" &&
        !ArrayBuffer.isView(credential) &&
        !(credential instanceof ArrayBuffer) &&
        !Array.isArray(credential)
      ) {
        const type = credential.type;
        if (typeof type === "string" && type.toLowerCase() !== "public-key") {
          return false;
        }
        candidateRaw = credential.id ?? credential.rawId ?? credential.credentialId ?? credential.credential_id;
      }

      if (!candidateRaw) {
        return false;
      }

      const candidateId = this.normalizeCredentialId(candidateRaw);
      if (candidateId && normalizedTargetId && candidateId === normalizedTargetId) {
        return true;
      }

      if (this.isHexMatch(candidateId, normalizedTargetId)) {
        return true;
      }

      const candidateBytes = this.toCredentialBytes(candidateRaw);
      if (candidateBytes && targetBytes && candidateBytes.length === targetBytes.length) {
        let byteMatch = true;
        for (let i = 0; i < targetBytes.length; i++) {
          if (candidateBytes[i] !== targetBytes[i]) {
            byteMatch = false;
            break;
          }
        }
        if (byteMatch) {
          return true;
        }
      }

      return false;
    });
  }

  /**
   * Convert any credential ID representation (Base64, Base64URL, Hex, Array,
   * Buffer, or ArrayBufferView) into a raw Uint8Array for binary comparison.
   * @param {any} value
   * @returns {Uint8Array|null}
   */
  static toCredentialBytes(value) {
    if (!value) {
      return null;
    }
    if (value instanceof Uint8Array) {
      return value;
    }
    if (value instanceof ArrayBuffer) {
      return new Uint8Array(value);
    }
    if (ArrayBuffer.isView(value)) {
      return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    }
    if (Array.isArray(value)) {
      return new Uint8Array(value);
    }
    if (typeof value === "object") {
      if (Array.isArray(value.data)) {
        return new Uint8Array(value.data);
      }
      const numericKeys = Object.keys(value).filter((k) => /^\d+$/.test(k));
      if (numericKeys.length > 0) {
        return new Uint8Array(numericKeys.map((k) => value[k]));
      }
    }
    if (typeof value === "string") {
      let stringValue = value.trim();
      if (stringValue.includes("%")) {
        try {
          stringValue = decodeURIComponent(stringValue).trim();
        } catch {
          // ignore malformed URI
        }
      }
      stringValue = stringValue.replace(/\s+/g, "");

      const hexRegex = /^[0-9a-f]{32,}$/i;
      if (hexRegex.test(stringValue) && stringValue.length % 2 === 0) {
        return this.hexToUint8Array(stringValue);
      }

      try {
        return PasskeyEncodingService.base64UrlToUint8Array(stringValue);
      } catch {
        // ignore decoding errors
      }

      if (stringValue.length > 0) {
        const bytes = new Uint8Array(stringValue.length);
        let allBytesValid = true;
        for (let i = 0; i < stringValue.length; i++) {
          const code = stringValue.charCodeAt(i);
          if (code > 255) {
            allBytesValid = false;
            break;
          }
          bytes[i] = code;
        }
        if (allBytesValid && bytes.length >= 16) {
          return bytes;
        }
      }
    }

    return null;
  }

  /**
   * Compare candidate and target IDs in case one is represented as a hex string
   * and the other as base64url.
   * @param {string} a
   * @param {string} b
   * @returns {boolean}
   */
  static isHexMatch(a, b) {
    try {
      const hexRegex = /^[0-9a-f]+$/i;
      if (hexRegex.test(a) && a.length % 2 === 0 && a.length >= 32) {
        const bytesA = this.hexToUint8Array(a);
        const b64UrlA = PasskeyEncodingService.toBase64Url(bytesA).replaceAll("=", "").trim();
        if (b64UrlA === b) {
          return true;
        }
      }
      if (hexRegex.test(b) && b.length % 2 === 0 && b.length >= 32) {
        const bytesB = this.hexToUint8Array(b);
        const b64UrlB = PasskeyEncodingService.toBase64Url(bytesB).replaceAll("=", "").trim();
        if (b64UrlB === a) {
          return true;
        }
      }
    } catch {
      // ignore parsing errors
    }
    return false;
  }

  /**
   * @param {string} hex
   * @returns {Uint8Array}
   */
  static hexToUint8Array(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
    }
    return bytes;
  }

  /**
   * Normalize a credential ID for robust comparison across Base64, Base64URL,
   * with or without padding.
   * @param {string|Uint8Array|ArrayBuffer|Array<number>|object} value
   * @returns {string}
   */
  static normalizeCredentialId(value) {
    if (!value) {
      return "";
    }

    const rawBytes = this.toCredentialBytes(value);
    if (rawBytes && rawBytes.length > 0) {
      try {
        return PasskeyEncodingService.toBase64Url(rawBytes).replaceAll("=", "").trim();
      } catch {
        // fallback to string manipulation
      }
    }

    let stringValue = String(value).trim();
    if (stringValue.includes("%")) {
      try {
        stringValue = decodeURIComponent(stringValue).trim();
      } catch {
        // ignore malformed URI
      }
    }

    return stringValue.replace(/\s+/g, "").replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "").trim();
  }

  /**
   * Check whether a stored passkey RP ID matches a requested RP ID and/or origin.
   * Handles subdomains, casing, origin relaxation, stored origin fallbacks, and candidate URIs.
   * @param {string} storedRpId
   * @param {string} requestedRpId
   * @param {string} [origin]
   * @param {string} [storedOrigin]
   * @param {Array<string>} [candidateUris]
   * @returns {boolean}
   */
  static isRpIdMatching(storedRpId, requestedRpId, origin = null, storedOrigin = null, candidateUris = null) {
    if (Array.isArray(candidateUris) && candidateUris.length > 0) {
      for (const uri of candidateUris) {
        if (typeof uri === "string") {
          const cleanUri = this.normalizeDomain(uri);
          const cleanRequested = requestedRpId ? this.normalizeDomain(requestedRpId) : null;
          const cleanOrigin = origin ? this.normalizeDomain(origin) : null;
          if (cleanRequested && this.isDomainRelated(cleanUri, cleanRequested)) {
            return true;
          }
          if (cleanOrigin && this.isDomainRelated(cleanUri, cleanOrigin)) {
            return true;
          }
        }
      }
    }

    const normStored = this.normalizeDomain(storedRpId);
    const normRequested = this.normalizeDomain(requestedRpId);

    if (normRequested) {
      if (normStored && this.isDomainRelated(normStored, normRequested)) {
        return true;
      }
      if (storedOrigin) {
        try {
          const storedOriginHostname = this.normalizeDomain(new URL(storedOrigin).hostname);
          if (storedOriginHostname && this.isDomainRelated(storedOriginHostname, normRequested)) {
            return true;
          }
        } catch {
          // ignore invalid storedOrigin URLs
        }
      }
      return false;
    }

    if (origin) {
      try {
        const originHostname = this.normalizeDomain(new URL(origin).hostname);
        if (originHostname) {
          if (normStored && this.isDomainRelated(normStored, originHostname)) {
            return true;
          }
          if (storedOrigin) {
            const storedOriginHostname = this.normalizeDomain(new URL(storedOrigin).hostname);
            if (storedOriginHostname && this.isDomainRelated(storedOriginHostname, originHostname)) {
              return true;
            }
          }
        }
      } catch {
        // ignore invalid origin URLs
      }
    }

    return false;
  }

  /**
   * Check whether two domain names are equal, subdomains of one another,
   * or known related domains within the same identity ecosystem (e.g. Oracle SSO).
   * @param {string} domainA
   * @param {string} domainB
   * @returns {boolean}
   */
  static isDomainRelated(domainA, domainB) {
    const normA = this.normalizeDomain(domainA);
    const normB = this.normalizeDomain(domainB);
    if (!normA || !normB) {
      return false;
    }
    if (normA === normB) {
      return true;
    }
    if (normA.endsWith(`.${normB}`)) {
      return true;
    }
    if (normB.endsWith(`.${normA}`)) {
      return true;
    }

    // Oracle Cloud Identity / SSO multi-domain ecosystem
    const isOracleDomain = (d) =>
      d === "oracle.com" || d.endsWith(".oracle.com") || d === "oraclecloud.com" || d.endsWith(".oraclecloud.com");
    if (isOracleDomain(normA) && isOracleDomain(normB)) {
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
