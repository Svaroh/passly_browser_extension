/**
 * Passbolt ~ Open source password manager for teams
 * Copyright (c) 2026 Passbolt SA (https://www.passbolt.com)
 *
 * Licensed under GNU Affero General Public License version 3 of the or any later version.
 * For full copyright and license information, please see the LICENSE.txt
 * Redistributions of files must retain the above copyright notice.
 *
 * @copyright     Copyright (c) 2026 Passbolt SA (https://www.passbolt.com)
 * @license       https://opensource.org/licenses/AGPL-3.0 AGPL License
 * @link          https://www.passbolt.com Passbolt(tm)
 */

const PAYLOAD_VERSION = 1;
const PAYLOAD_ALGORITHM = "A256GCM";

class BrowserFirstLoginPrivateKeyPayloadService {
  /**
   * Decrypt an Android browser-first-login private-key payload.
   * @param {string} encryptedPayload The encrypted payload JSON.
   * @param {string} secret The QR pairing secret.
   * @returns {Promise<object>}
   */
  static async decrypt(encryptedPayload, secret) {
    const payload = this.parseEncryptedPayload(encryptedPayload);
    const key = await this.importSecretKey(secret, ["decrypt"]);
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: this.base64UrlToUint8Array(payload.iv) },
      key,
      this.base64UrlToUint8Array(payload.ciphertext),
    );

    return JSON.parse(new TextDecoder().decode(plaintext));
  }

  /**
   * Encrypt a private-key payload. Used by tests and mirrors the Android implementation.
   * @param {object} privateKeyPayload The private-key payload.
   * @param {string} secret The QR pairing secret.
   * @param {Uint8Array} [iv] Optional deterministic IV for tests.
   * @returns {Promise<string>}
   */
  static async encrypt(privateKeyPayload, secret, iv = crypto.getRandomValues(new Uint8Array(12))) {
    const key = await this.importSecretKey(secret, ["encrypt"]);
    const plaintext = new TextEncoder().encode(JSON.stringify(privateKeyPayload));
    const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);

    return JSON.stringify({
      v: PAYLOAD_VERSION,
      alg: PAYLOAD_ALGORITHM,
      iv: this.uint8ArrayToBase64Url(iv),
      ciphertext: this.uint8ArrayToBase64Url(new Uint8Array(ciphertext)),
    });
  }

  /**
   * Parse and validate encrypted payload metadata.
   * @param {string} encryptedPayload The encrypted payload JSON.
   * @returns {{v: number, alg: string, iv: string, ciphertext: string}}
   */
  static parseEncryptedPayload(encryptedPayload) {
    if (!encryptedPayload || typeof encryptedPayload !== "string") {
      throw new Error("The browser first-login private key payload is missing.");
    }

    const payload = JSON.parse(encryptedPayload);
    if (payload.v !== PAYLOAD_VERSION || payload.alg !== PAYLOAD_ALGORITHM || !payload.iv || !payload.ciphertext) {
      throw new Error("The browser first-login private key payload is invalid.");
    }

    return payload;
  }

  /**
   * Import the QR secret as an AES-GCM key.
   * @param {string} secret The QR pairing secret.
   * @param {string[]} keyUsages The key usages.
   * @returns {Promise<CryptoKey>}
   */
  static async importSecretKey(secret, keyUsages) {
    if (!secret || typeof secret !== "string") {
      throw new Error("The browser first-login secret is missing.");
    }

    const secretHash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
    return crypto.subtle.importKey("raw", secretHash, "AES-GCM", false, keyUsages);
  }

  /**
   * Decode base64url.
   * @param {string} value The encoded value.
   * @returns {Uint8Array}
   */
  static base64UrlToUint8Array(value) {
    const base64 = value
      .replaceAll("-", "+")
      .replaceAll("_", "/")
      .padEnd(Math.ceil(value.length / 4) * 4, "=");
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  /**
   * Encode base64url.
   * @param {Uint8Array} bytes The bytes to encode.
   * @returns {string}
   */
  static uint8ArrayToBase64Url(bytes) {
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
  }
}

export default BrowserFirstLoginPrivateKeyPayloadService;
