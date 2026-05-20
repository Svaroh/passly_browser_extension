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
 */

const BIOMETRIC_AUTH_STORAGE_VERSION = 1;
const PRF_SALT_SIZE = 32;
const AES_GCM_IV_SIZE = 12;
const WEBAUTHN_TIMEOUT = 60000;
const DEFAULT_RP_ID = "pass.66ton99.org.ua";
const BIOMETRIC_AUTH_KEY_STORAGE_PRF = "prf";
const BIOMETRIC_AUTH_KEY_STORAGE_INDEXEDDB = "indexeddb";
const BIOMETRIC_AUTH_INDEXEDDB_NAME = "passbolt-biometric-auth";
const BIOMETRIC_AUTH_INDEXEDDB_STORE = "keys";

class BiometricAuthClientService {
  /**
   * Returns whether the current extension context can use WebAuthn.
   * Firefox rejects WebAuthn calls from moz-extension pages with a security error.
   * Delegate these calls to a content script running on the Passbolt HTTPS page.
   * @returns {boolean}
   */
  static isSupportedBrowserContext() {
    return globalThis.location?.protocol !== "moz-extension:";
  }

  /**
   * Returns whether the page can trigger platform biometric auth.
   * @param {string|null} rpId The relying party id.
   * @returns {Promise<boolean>}
   */
  static async isAvailable(rpId = null) {
    if (!this.isSupportedBrowserContext(rpId)) {
      return false;
    }

    if (
      typeof PublicKeyCredential === "undefined" ||
      !navigator?.credentials?.create ||
      !navigator?.credentials?.get ||
      !crypto?.subtle ||
      !crypto?.getRandomValues
    ) {
      return false;
    }

    if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== "function") {
      return false;
    }

    return PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  }

  /**
   * Create a biometric auth configuration for a passphrase.
   * @param {string} passphrase The passphrase.
   * @param {string|null} rpId The relying party id.
   * @returns {Promise<object>}
   */
  static async createConfiguration(passphrase, rpId = null) {
    rpId = this.normalizeRpId(rpId, null);
    if (!this.isSupportedBrowserContext(rpId)) {
      throw new Error("Biometric authentication is not available in this browser context.");
    }

    const salt = this.getRandomBytes(PRF_SALT_SIZE);
    const credential = await this.createCredential(salt, rpId);
    const credentialId = this.getCredentialId(credential);
    const credentialIdBase64Url = this.arrayBufferToBase64Url(credentialId);
    const prfSecret = this.getPrfSecret(credential);
    const hasPrfSecret = prfSecret instanceof ArrayBuffer;
    const encryptionKey = hasPrfSecret ? prfSecret : await this.createAndStoreLocalAesKey(credentialIdBase64Url);
    const encryptedPassphrase = await this.encryptPassphrase(passphrase, encryptionKey);

    return {
      version: BIOMETRIC_AUTH_STORAGE_VERSION,
      credential_id: credentialIdBase64Url,
      key_storage: hasPrfSecret ? BIOMETRIC_AUTH_KEY_STORAGE_PRF : BIOMETRIC_AUTH_KEY_STORAGE_INDEXEDDB,
      rp_id: rpId,
      salt: this.arrayBufferToBase64Url(salt),
      iv: this.arrayBufferToBase64Url(encryptedPassphrase.iv),
      ciphertext: this.arrayBufferToBase64Url(encryptedPassphrase.ciphertext),
      created: new Date().toISOString(),
    };
  }

  /**
   * Unlock a biometric auth configuration and return the passphrase.
   * @param {object} configuration The encrypted biometric auth configuration.
   * @param {string|null} rpId The relying party id.
   * @returns {Promise<string>}
   */
  static async unlock(configuration, rpId = null) {
    rpId = this.normalizeRpId(configuration.rp_id || rpId, null);
    if (!this.isSupportedBrowserContext(rpId)) {
      throw new Error("Biometric authentication is not available in this browser context.");
    }

    const credentialId = this.base64UrlToArrayBuffer(configuration.credential_id);
    const salt = this.base64UrlToArrayBuffer(configuration.salt);
    const credential = await navigator.credentials.get({
      publicKey: this.buildCredentialRequestOptions(
        credentialId,
        salt,
        rpId,
        configuration.key_storage !== BIOMETRIC_AUTH_KEY_STORAGE_INDEXEDDB,
      ),
    });

    if (this.arrayBufferToBase64Url(this.getCredentialId(credential)) !== configuration.credential_id) {
      throw new Error("The biometric credential does not match the configured account.");
    }

    const decryptionKey =
      configuration.key_storage === BIOMETRIC_AUTH_KEY_STORAGE_INDEXEDDB
        ? await this.getStoredLocalAesKey(configuration.credential_id)
        : this.getPrfSecretOrFail(credential);
    return this.decryptPassphrase(
      this.base64UrlToArrayBuffer(configuration.ciphertext),
      this.base64UrlToArrayBuffer(configuration.iv),
      decryptionKey,
    );
  }

  /**
   * Create a WebAuthn credential, retrying without PRF if the browser rejects the extension.
   * @param {ArrayBuffer} salt The PRF salt.
   * @param {string|null} rpId The relying party id.
   * @returns {Promise<PublicKeyCredential>}
   */
  static async createCredential(salt, rpId = null) {
    try {
      return await navigator.credentials.create({
        publicKey: this.buildCredentialCreationOptions(salt, rpId),
      });
    } catch (error) {
      if (!this.isPrfUnsupportedError(error)) {
        throw error;
      }
      return navigator.credentials.create({
        publicKey: this.buildCredentialCreationOptions(salt, rpId, false),
      });
    }
  }

  /**
   * Build WebAuthn creation options.
   * @param {ArrayBuffer} salt The PRF salt.
   * @param {string|null} rpId The relying party id.
   * @returns {PublicKeyCredentialCreationOptions}
   */
  static buildCredentialCreationOptions(salt, rpId = null, usePrf = true) {
    return {
      challenge: this.getRandomBytes(32),
      rp: {
        name: "Passbolt",
        ...(rpId ? { id: rpId } : {}),
      },
      user: {
        id: this.getRandomBytes(32),
        name: "passbolt",
        displayName: "Passbolt",
      },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        residentKey: "discouraged",
        requireResidentKey: false,
        userVerification: "required",
      },
      timeout: WEBAUTHN_TIMEOUT,
      ...(usePrf
        ? {
            extensions: {
              prf: {
                eval: {
                  first: salt,
                },
              },
            },
          }
        : {}),
    };
  }

  /**
   * Build WebAuthn request options.
   * @param {ArrayBuffer} credentialId The credential id.
   * @param {ArrayBuffer} salt The PRF salt.
   * @param {string|null} rpId The relying party id.
   * @returns {PublicKeyCredentialRequestOptions}
   */
  static buildCredentialRequestOptions(credentialId, salt, rpId = null, usePrf = true) {
    return {
      challenge: this.getRandomBytes(32),
      ...(rpId ? { rpId } : {}),
      allowCredentials: [
        {
          type: "public-key",
          id: credentialId,
        },
      ],
      userVerification: "required",
      timeout: WEBAUTHN_TIMEOUT,
      ...(usePrf
        ? {
            extensions: {
              prf: {
                eval: {
                  first: salt,
                },
              },
            },
          }
        : {}),
    };
  }

  /**
   * Extract a PRF secret from a WebAuthn credential response.
   * @param {PublicKeyCredential} credential The credential.
   * @returns {ArrayBuffer}
   */
  static getPrfSecretOrFail(credential) {
    const prfSecret = this.getPrfSecret(credential);
    if (!(prfSecret instanceof ArrayBuffer)) {
      throw new Error("The platform authenticator does not support WebAuthn PRF.");
    }
    return prfSecret;
  }

  /**
   * Extract a PRF secret from a WebAuthn credential response when available.
   * @param {PublicKeyCredential} credential The credential.
   * @returns {ArrayBuffer|undefined}
   */
  static getPrfSecret(credential) {
    return credential?.getClientExtensionResults?.()?.prf?.results?.first;
  }

  /**
   * Extract a credential id from a WebAuthn credential.
   * @param {PublicKeyCredential} credential The credential.
   * @returns {ArrayBuffer}
   */
  static getCredentialId(credential) {
    if (credential?.rawId instanceof ArrayBuffer) {
      return credential.rawId;
    }
    throw new Error("The platform authenticator did not return a valid credential.");
  }

  /**
   * Returns whether an error is an expected browser-level biometric unavailability error.
   * @param {Error|DOMException} error The error.
   * @returns {boolean}
   */
  static isUnavailableError(error) {
    const message = error?.message || "";
    return (
      message.includes("Biometric authentication is not available in this browser context") ||
      message.includes("The operation is insecure") ||
      error?.name === "SecurityError"
    );
  }

  /**
   * Returns whether the browser rejected the optional PRF extension.
   * @param {Error|DOMException} error The error.
   * @returns {boolean}
   */
  static isPrfUnsupportedError(error) {
    const message = error?.message || "";
    return error?.name === "NotSupportedError" || message.includes("prf") || message.includes("PRF");
  }

  /**
   * Normalize a trusted domain or host into a WebAuthn RP ID.
   * @param {string|null} value The trusted domain or host.
   * @returns {string}
   */
  static normalizeRpId(value, fallback = DEFAULT_RP_ID) {
    if (!value) {
      return fallback;
    }
    try {
      return new URL(value).hostname || fallback;
    } catch {
      return value.replace(/^https?:\/\//, "").split("/")[0] || fallback;
    }
  }

  /**
   * Encrypt a passphrase with an AES-GCM key derived from WebAuthn PRF.
   * @param {string} passphrase The passphrase.
   * @param {ArrayBuffer} prfSecret The PRF secret.
   * @returns {Promise<{iv: Uint8Array, ciphertext: ArrayBuffer}>}
   */
  static async encryptPassphrase(passphrase, encryptionKey) {
    const key = await this.getAesGcmKey(encryptionKey, ["encrypt"]);
    const iv = this.getRandomBytes(AES_GCM_IV_SIZE);
    const plaintext = new TextEncoder().encode(passphrase);
    const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
    return { iv, ciphertext };
  }

  /**
   * Decrypt a passphrase with an AES-GCM key derived from WebAuthn PRF.
   * @param {ArrayBuffer} ciphertext The encrypted passphrase.
   * @param {ArrayBuffer} iv The AES-GCM IV.
   * @param {ArrayBuffer} prfSecret The PRF secret.
   * @returns {Promise<string>}
   */
  static async decryptPassphrase(ciphertext, iv, decryptionKey) {
    const key = await this.getAesGcmKey(decryptionKey, ["decrypt"]);
    const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
    return new TextDecoder().decode(plaintext);
  }

  /**
   * Get an AES-GCM CryptoKey from either an existing CryptoKey or raw key material.
   * @param {CryptoKey|ArrayBuffer} key The key or raw key material.
   * @param {string[]} keyUsages The key usages.
   * @returns {Promise<CryptoKey>}
   */
  static getAesGcmKey(key, keyUsages) {
    if (key instanceof CryptoKey) {
      return key;
    }
    return this.importAesGcmKey(key, keyUsages);
  }

  /**
   * Create and store a non-extractable local AES key for browsers without WebAuthn PRF.
   * @param {string} credentialId The credential id.
   * @returns {Promise<CryptoKey>}
   */
  static async createAndStoreLocalAesKey(credentialId) {
    const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
    await this.storeLocalAesKey(credentialId, key);
    return key;
  }

  /**
   * Store a local AES key in IndexedDB.
   * @param {string} credentialId The credential id.
   * @param {CryptoKey} key The AES key.
   * @returns {Promise<void>}
   */
  static async storeLocalAesKey(credentialId, key) {
    const database = await this.openBiometricKeyDatabase();
    await new Promise((resolve, reject) => {
      const transaction = database.transaction(BIOMETRIC_AUTH_INDEXEDDB_STORE, "readwrite");
      transaction.objectStore(BIOMETRIC_AUTH_INDEXEDDB_STORE).put({ credentialId, key });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
  }

  /**
   * Get a local AES key from IndexedDB.
   * @param {string} credentialId The credential id.
   * @returns {Promise<CryptoKey>}
   */
  static async getStoredLocalAesKey(credentialId) {
    const database = await this.openBiometricKeyDatabase();
    const record = await new Promise((resolve, reject) => {
      const transaction = database.transaction(BIOMETRIC_AUTH_INDEXEDDB_STORE, "readonly");
      const request = transaction.objectStore(BIOMETRIC_AUTH_INDEXEDDB_STORE).get(credentialId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    database.close();
    if (!(record?.key instanceof CryptoKey)) {
      throw new Error("The local biometric encryption key is not available.");
    }
    return record.key;
  }

  /**
   * Open the IndexedDB database used for non-PRF biometric encryption keys.
   * @returns {Promise<IDBDatabase>}
   */
  static openBiometricKeyDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(BIOMETRIC_AUTH_INDEXEDDB_NAME, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore(BIOMETRIC_AUTH_INDEXEDDB_STORE, { keyPath: "credentialId" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Import a WebAuthn PRF secret as AES-GCM key.
   * @param {ArrayBuffer} prfSecret The PRF secret.
   * @param {string[]} keyUsages The key usages.
   * @returns {Promise<CryptoKey>}
   */
  static importAesGcmKey(prfSecret, keyUsages) {
    return crypto.subtle.importKey("raw", prfSecret, "AES-GCM", false, keyUsages);
  }

  /**
   * Get cryptographically secure random bytes.
   * @param {number} size The byte length.
   * @returns {Uint8Array}
   */
  static getRandomBytes(size) {
    return crypto.getRandomValues(new Uint8Array(size));
  }

  /**
   * Convert ArrayBuffer to base64url.
   * @param {ArrayBuffer|Uint8Array} buffer The buffer.
   * @returns {string}
   */
  static arrayBufferToBase64Url(buffer) {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    let binary = "";
    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }
    return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
  }

  /**
   * Convert base64url to ArrayBuffer.
   * @param {string} value The base64url value.
   * @returns {ArrayBuffer}
   */
  static base64UrlToArrayBuffer(value) {
    const base64 = value
      .replaceAll("-", "+")
      .replaceAll("_", "/")
      .padEnd(Math.ceil(value.length / 4) * 4, "=");
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
}

export default BiometricAuthClientService;
