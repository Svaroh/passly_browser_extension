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

import BiometricAuthLocalStorage from "./biometricAuthLocalStorage";

const BIOMETRIC_AUTH_STORAGE_VERSION = 1;
const PRF_SALT_SIZE = 32;
const AES_GCM_IV_SIZE = 12;
const WEBAUTHN_TIMEOUT = 60000;

class BiometricAuthService {
  /**
   * Constructor.
   * @param {AbstractAccountEntity} account The user account.
   */
  constructor(account) {
    this.account = account;
    this.storage = account?.id ? new BiometricAuthLocalStorage(account) : null;
  }

  /**
   * Returns whether the runtime has the APIs required by biometric auth.
   * @returns {Promise<boolean>}
   */
  async isAvailable() {
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
   * Returns whether biometric auth is configured for the current account.
   * @returns {Promise<boolean>}
   */
  async isConfigured() {
    if (!this.storage) {
      return false;
    }
    const storedData = await this.storage.get();
    return this.isValidConfiguration(storedData);
  }

  /**
   * Returns the biometric auth status.
   * @returns {Promise<{available: boolean, configured: boolean}>}
   */
  async getStatus() {
    const [available, configured] = await Promise.all([this.isAvailable(), this.isConfigured()]);
    return { available, configured };
  }

  /**
   * Enable biometric auth by storing the passphrase encrypted with a WebAuthn PRF-derived key.
   * @param {string} passphrase The passphrase to store.
   * @returns {Promise<void>}
   */
  async enable(passphrase) {
    if (typeof passphrase !== "string") {
      throw new Error("The passphrase should be a string.");
    }
    const storage = this.getStorageOrFail();
    await this.assertAvailable();

    const salt = this.getRandomBytes(PRF_SALT_SIZE);
    const credential = await navigator.credentials.create({
      publicKey: this.buildCredentialCreationOptions(salt),
    });
    const credentialId = this.getCredentialId(credential);
    const prfSecret = this.getPrfSecretOrFail(credential);
    const encryptedPassphrase = await this.encryptPassphrase(passphrase, prfSecret);

    await storage.set({
      version: BIOMETRIC_AUTH_STORAGE_VERSION,
      credential_id: this.arrayBufferToBase64Url(credentialId),
      salt: this.arrayBufferToBase64Url(salt),
      iv: this.arrayBufferToBase64Url(encryptedPassphrase.iv),
      ciphertext: this.arrayBufferToBase64Url(encryptedPassphrase.ciphertext),
      created: new Date().toISOString(),
    });
  }

  /**
   * Get the stored biometric auth configuration.
   * @returns {Promise<object|null>}
   */
  async getConfiguration() {
    if (!this.storage) {
      return null;
    }
    const storedData = await this.storage.get();
    if (!this.isValidConfiguration(storedData)) {
      return null;
    }
    return storedData;
  }

  /**
   * Save a biometric auth configuration generated from a trusted extension UI.
   * @param {object} data The encrypted biometric auth configuration.
   * @returns {Promise<void>}
   */
  async saveConfiguration(data) {
    if (!this.isValidConfiguration(data)) {
      throw new Error("The biometric auth configuration is invalid.");
    }
    await this.getStorageOrFail().set({
      version: BIOMETRIC_AUTH_STORAGE_VERSION,
      credential_id: data.credential_id,
      key_storage: data.key_storage,
      rp_id: data.rp_id,
      salt: data.salt,
      iv: data.iv,
      ciphertext: data.ciphertext,
      created: data.created || new Date().toISOString(),
    });
  }

  /**
   * Unlock and decrypt the stored passphrase with the configured platform authenticator.
   * @returns {Promise<string>}
   */
  async unlock() {
    const storage = this.getStorageOrFail();
    await this.assertAvailable();

    const storedData = await storage.get();
    if (!storedData) {
      throw new Error("Biometric auth is not configured.");
    }

    const credentialId = this.base64UrlToArrayBuffer(storedData.credential_id);
    const salt = this.base64UrlToArrayBuffer(storedData.salt);
    const credential = await navigator.credentials.get({
      publicKey: this.buildCredentialRequestOptions(credentialId, salt),
    });

    if (this.arrayBufferToBase64Url(this.getCredentialId(credential)) !== storedData.credential_id) {
      throw new Error("The biometric credential does not match the configured account.");
    }

    const prfSecret = this.getPrfSecretOrFail(credential);
    return this.decryptPassphrase(
      this.base64UrlToArrayBuffer(storedData.ciphertext),
      this.base64UrlToArrayBuffer(storedData.iv),
      prfSecret,
    );
  }

  /**
   * Disable biometric auth for the current account.
   * @returns {Promise<void>}
   */
  async disable() {
    if (this.storage) {
      await this.storage.flush();
    }
  }

  /**
   * Assert biometric auth can be used.
   * @returns {Promise<void>}
   */
  async assertAvailable() {
    if (!(await this.isAvailable())) {
      throw new Error("Biometric authentication is not available on this device or browser.");
    }
  }

  /**
   * Build WebAuthn creation options.
   * @param {ArrayBuffer} salt The PRF salt.
   * @returns {PublicKeyCredentialCreationOptions}
   */
  buildCredentialCreationOptions(salt) {
    return {
      challenge: this.getRandomBytes(32),
      rp: {
        name: "Passbolt",
      },
      user: {
        id: new TextEncoder().encode(this.account.id),
        name: this.account.username,
        displayName: `${this.account.firstName} ${this.account.lastName}`.trim() || this.account.username,
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
      extensions: {
        prf: {
          eval: {
            first: salt,
          },
        },
      },
    };
  }

  /**
   * Build WebAuthn request options.
   * @param {ArrayBuffer} credentialId The credential id.
   * @param {ArrayBuffer} salt The PRF salt.
   * @returns {PublicKeyCredentialRequestOptions}
   */
  buildCredentialRequestOptions(credentialId, salt) {
    return {
      challenge: this.getRandomBytes(32),
      allowCredentials: [
        {
          type: "public-key",
          id: credentialId,
        },
      ],
      userVerification: "required",
      timeout: WEBAUTHN_TIMEOUT,
      extensions: {
        prf: {
          eval: {
            first: salt,
          },
        },
      },
    };
  }

  /**
   * Extract a PRF secret from a WebAuthn credential response.
   * @param {PublicKeyCredential} credential The credential.
   * @returns {ArrayBuffer}
   */
  getPrfSecretOrFail(credential) {
    const prfSecret = credential?.getClientExtensionResults?.()?.prf?.results?.first;
    if (!(prfSecret instanceof ArrayBuffer)) {
      throw new Error("The platform authenticator does not support WebAuthn PRF.");
    }
    return prfSecret;
  }

  /**
   * Extract a credential id from a WebAuthn credential.
   * @param {PublicKeyCredential} credential The credential.
   * @returns {ArrayBuffer}
   */
  getCredentialId(credential) {
    if (credential?.rawId instanceof ArrayBuffer) {
      return credential.rawId;
    }
    throw new Error("The platform authenticator did not return a valid credential.");
  }

  /**
   * Encrypt a passphrase with an AES-GCM key derived from WebAuthn PRF.
   * @param {string} passphrase The passphrase.
   * @param {ArrayBuffer} prfSecret The PRF secret.
   * @returns {Promise<{iv: Uint8Array, ciphertext: ArrayBuffer}>}
   */
  async encryptPassphrase(passphrase, prfSecret) {
    const key = await this.importAesGcmKey(prfSecret, ["encrypt"]);
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
  async decryptPassphrase(ciphertext, iv, prfSecret) {
    const key = await this.importAesGcmKey(prfSecret, ["decrypt"]);
    const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
    return new TextDecoder().decode(plaintext);
  }

  /**
   * Import a WebAuthn PRF secret as AES-GCM key.
   * @param {ArrayBuffer} prfSecret The PRF secret.
   * @param {string[]} keyUsages The key usages.
   * @returns {Promise<CryptoKey>}
   */
  importAesGcmKey(prfSecret, keyUsages) {
    return crypto.subtle.importKey("raw", prfSecret, "AES-GCM", false, keyUsages);
  }

  /**
   * Get account-scoped storage or fail from an executor.
   * @returns {BiometricAuthLocalStorage}
   */
  getStorageOrFail() {
    if (!this.storage) {
      throw new Error("Cannot retrieve account id, necessary to get a biometric auth storage key.");
    }
    return this.storage;
  }

  /**
   * Get cryptographically secure random bytes.
   * @param {number} size The byte length.
   * @returns {Uint8Array}
   */
  getRandomBytes(size) {
    return crypto.getRandomValues(new Uint8Array(size));
  }

  /**
   * Convert ArrayBuffer to base64url.
   * @param {ArrayBuffer|Uint8Array} buffer The buffer.
   * @returns {string}
   */
  arrayBufferToBase64Url(buffer) {
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
  base64UrlToArrayBuffer(value) {
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

  /**
   * Check whether a stored configuration has the required shape.
   * @param {object|null} data The stored configuration.
   * @returns {boolean}
   */
  isValidConfiguration(data) {
    return (
      data?.version === BIOMETRIC_AUTH_STORAGE_VERSION &&
      typeof data.credential_id === "string" &&
      (typeof data.key_storage === "undefined" || typeof data.key_storage === "string") &&
      (data.rp_id === null || typeof data.rp_id === "undefined" || typeof data.rp_id === "string") &&
      typeof data.salt === "string" &&
      typeof data.iv === "string" &&
      typeof data.ciphertext === "string"
    );
  }
}

export default BiometricAuthService;
