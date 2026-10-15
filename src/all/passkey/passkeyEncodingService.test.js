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
 * @since         6.0.20
 */

import PasskeyEncodingService from "./passkeyEncodingService";

describe("PasskeyEncodingService", () => {
  describe("toUint8Array", () => {
    it("returns Uint8Array unchanged", () => {
      const arr = new Uint8Array([1, 2, 3]);
      expect(PasskeyEncodingService.toUint8Array(arr)).toBe(arr);
    });

    it("converts ArrayBuffer to Uint8Array", () => {
      const buffer = new Uint8Array([1, 2, 3]).buffer;
      const result = PasskeyEncodingService.toUint8Array(buffer);
      expect(result).toBeInstanceOf(Uint8Array);
      expect(Array.from(result)).toEqual([1, 2, 3]);
    });

    it("converts ArrayBufferView to Uint8Array", () => {
      const int32 = new Int32Array([1]);
      const result = PasskeyEncodingService.toUint8Array(int32);
      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.byteLength).toBe(4);
    });

    it("converts plain Array of numbers to Uint8Array", () => {
      const result = PasskeyEncodingService.toUint8Array([10, 20, 30]);
      expect(result).toBeInstanceOf(Uint8Array);
      expect(Array.from(result)).toEqual([10, 20, 30]);
    });

    it("throws TypeError for unsupported types", () => {
      expect(() => PasskeyEncodingService.toUint8Array("invalid")).toThrow(TypeError);
      expect(() => PasskeyEncodingService.toUint8Array(123)).toThrow(TypeError);
    });
  });

  describe("toBase64Url", () => {
    it("encodes typed array to base64url without padding", () => {
      const input = new Uint8Array([251, 255, 254]);
      const encoded = PasskeyEncodingService.toBase64Url(input);
      expect(encoded).not.toContain("+");
      expect(encoded).not.toContain("/");
      expect(encoded).not.toContain("=");
    });

    it("encodes plain number array to base64url", () => {
      const encoded = PasskeyEncodingService.toBase64Url([1, 2, 3]);
      expect(encoded).toBe("AQID");
    });
  });
});
