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

import PasskeyEncodingService from "./passkeyEncodingService";

class PasskeyCborService {
  /**
   * Encode a JavaScript value as deterministic-enough CBOR for WebAuthn COSE and attestation objects.
   * @param {*} value
   * @returns {Uint8Array}
   */
  static encode(value) {
    if (value instanceof Uint8Array || value instanceof ArrayBuffer) {
      return this.encodeBytes(PasskeyEncodingService.toUint8Array(value));
    }

    if (typeof value === "string") {
      return this.encodeText(value);
    }

    if (Number.isInteger(value)) {
      return this.encodeInteger(value);
    }

    if (Array.isArray(value)) {
      return this.encodeArray(value);
    }

    if (value && typeof value === "object") {
      return this.encodeMap(value);
    }

    throw new TypeError("Unsupported CBOR value.");
  }

  /**
   * @param {number} value
   * @returns {Uint8Array}
   */
  static encodeInteger(value) {
    if (value >= 0) {
      return this.encodeTypeAndLength(0, value);
    }

    return this.encodeTypeAndLength(1, -1 - value);
  }

  /**
   * @param {Uint8Array} value
   * @returns {Uint8Array}
   */
  static encodeBytes(value) {
    return PasskeyEncodingService.concat(this.encodeTypeAndLength(2, value.length), value);
  }

  /**
   * @param {string} value
   * @returns {Uint8Array}
   */
  static encodeText(value) {
    const bytes = PasskeyEncodingService.utf8ToUint8Array(value);
    return PasskeyEncodingService.concat(this.encodeTypeAndLength(3, bytes.length), bytes);
  }

  /**
   * @param {Array} value
   * @returns {Uint8Array}
   */
  static encodeArray(value) {
    return PasskeyEncodingService.concat(
      this.encodeTypeAndLength(4, value.length),
      ...value.map((item) => this.encode(item)),
    );
  }

  /**
   * @param {object|Map} value
   * @returns {Uint8Array}
   */
  static encodeMap(value) {
    const entries = value instanceof Map ? Array.from(value.entries()) : Object.entries(value);
    const chunks = [this.encodeTypeAndLength(5, entries.length)];
    for (const [key, item] of entries) {
      const mapKey = typeof key === "string" && /^-?\d+$/.test(key) ? Number(key) : key;
      chunks.push(this.encode(mapKey));
      chunks.push(this.encode(item));
    }

    return PasskeyEncodingService.concat(...chunks);
  }

  /**
   * @param {number} majorType
   * @param {number} length
   * @returns {Uint8Array}
   */
  static encodeTypeAndLength(majorType, length) {
    if (!Number.isInteger(length) || length < 0) {
      throw new TypeError("CBOR length should be a non-negative integer.");
    }

    const prefix = majorType << 5;
    if (length < 24) {
      return new Uint8Array([prefix | length]);
    }

    if (length <= 0xff) {
      return new Uint8Array([prefix | 24, length]);
    }

    if (length <= 0xffff) {
      return new Uint8Array([prefix | 25, (length >> 8) & 0xff, length & 0xff]);
    }

    if (length <= 0xffffffff) {
      return new Uint8Array([
        prefix | 26,
        (length >>> 24) & 0xff,
        (length >>> 16) & 0xff,
        (length >>> 8) & 0xff,
        length & 0xff,
      ]);
    }

    throw new TypeError("CBOR length is too large.");
  }
}

export default PasskeyCborService;
