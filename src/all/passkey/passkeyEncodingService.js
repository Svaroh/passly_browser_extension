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

class PasskeyEncodingService {
  /**
   * @param {ArrayBuffer|Uint8Array} value
   * @returns {Uint8Array}
   */
  static toUint8Array(value) {
    if (value instanceof Uint8Array) {
      return value;
    }

    if (value instanceof ArrayBuffer) {
      return new Uint8Array(value);
    }

    throw new TypeError("The value should be an ArrayBuffer or Uint8Array.");
  }

  /**
   * @param {string} value
   * @returns {Uint8Array}
   */
  static utf8ToUint8Array(value) {
    return new TextEncoder().encode(value);
  }

  /**
   * @param {ArrayBuffer|Uint8Array} value
   * @returns {string}
   */
  static uint8ArrayToUtf8(value) {
    return new TextDecoder().decode(this.toUint8Array(value));
  }

  /**
   * @param {ArrayBuffer|Uint8Array} value
   * @returns {string}
   */
  static toBase64Url(value) {
    const bytes = this.toUint8Array(value);
    let binary = "";
    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }

    return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
  }

  /**
   * @param {string} value
   * @returns {Uint8Array}
   */
  static base64UrlToUint8Array(value) {
    if (typeof value !== "string") {
      throw new TypeError("The base64url value should be a string.");
    }

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
   * @param {...(ArrayBuffer|Uint8Array)} values
   * @returns {Uint8Array}
   */
  static concat(...values) {
    const chunks = values.map((value) => this.toUint8Array(value));
    const length = chunks.reduce((total, chunk) => total + chunk.length, 0);
    const result = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    return result;
  }

  /**
   * @param {number} value
   * @returns {Uint8Array}
   */
  static uint16ToBigEndian(value) {
    if (!Number.isInteger(value) || value < 0 || value > 0xffff) {
      throw new TypeError("The value should be a uint16 integer.");
    }

    return new Uint8Array([(value >> 8) & 0xff, value & 0xff]);
  }

  /**
   * @param {number} value
   * @returns {Uint8Array}
   */
  static uint32ToBigEndian(value) {
    if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) {
      throw new TypeError("The value should be a uint32 integer.");
    }

    return new Uint8Array([(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff]);
  }
}

export default PasskeyEncodingService;
