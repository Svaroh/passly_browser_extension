/**
 * @jest-environment ./test/jest.custom-kdbx-environment
 */
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
import { createPublicKey, createPrivateKey } from "crypto";
import PasskeyEncodingService from "./passkeyEncodingService";
import PasskeyKeepassImportService, { KEEPASS_PASSKEY_FIELDS } from "./passkeyKeepassImportService";
import { PASSKEY_SECRET_OBJECT_TYPE, PASSKEY_SECRET_SCHEMA_VERSION } from "./passkeyProviderConstants";
import {
  keepassPasskeyFieldsDto,
  keepassPasskeyPrivateKeyPem,
  keepassPasskeyPublicCoordinates,
} from "./passkeySecretDto.test.data";

describe("PasskeyKeepassImportService", () => {
  describe("::hasPasskeyFields", () => {
    it("requires the credential id, the private key and the relying party", () => {
      expect.assertions(5);

      expect(PasskeyKeepassImportService.hasPasskeyFields(keepassPasskeyFieldsDto())).toBe(true);
      expect(PasskeyKeepassImportService.hasPasskeyFields(null)).toBe(false);
      expect(PasskeyKeepassImportService.hasPasskeyFields({})).toBe(false);
      expect(
        PasskeyKeepassImportService.hasPasskeyFields(
          keepassPasskeyFieldsDto({ [KEEPASS_PASSKEY_FIELDS.PRIVATE_KEY_PEM]: null }),
        ),
      ).toBe(false);
      expect(
        PasskeyKeepassImportService.hasPasskeyFields(
          keepassPasskeyFieldsDto({ [KEEPASS_PASSKEY_FIELDS.RELYING_PARTY]: null }),
        ),
      ).toBe(false);
    });
  });

  describe("::buildSecretDto", () => {
    it("builds a passkey secret out of the KeePassXC attributes", async () => {
      expect.assertions(1);

      const secretDto = await PasskeyKeepassImportService.buildSecretDto(keepassPasskeyFieldsDto());

      expect(secretDto).toStrictEqual({
        object_type: PASSKEY_SECRET_OBJECT_TYPE,
        schema_version: PASSKEY_SECRET_SCHEMA_VERSION,
        credential_id: "Y3JlZGVudGlhbC1pZA",
        rp_id: "www.spaceship.com",
        origin: "https://www.spaceship.com",
        user_handle: "dXNlci1oYW5kbGU",
        user_name: "66Ton99",
        user_display_name: "66Ton99",
        cose_alg: -7,
        public_key_cose: expect.any(String),
        private_key_pkcs8: expect.any(String),
        aaguid: "00000000-0000-0000-0000-000000000000",
        backup_eligible: true,
        backup_state: true,
        sign_count: 0,
        transports: ["internal"],
      });
    });

    it("keeps the private key usable and derives the matching COSE public key", async () => {
      expect.assertions(3);

      const secretDto = await PasskeyKeepassImportService.buildSecretDto(keepassPasskeyFieldsDto());

      // The stored PKCS#8 is the very key KeePassXC held.
      const privateKeyDer = PasskeyEncodingService.base64UrlToUint8Array(secretDto.private_key_pkcs8);
      const expectedDer = createPrivateKey(keepassPasskeyPrivateKeyPem).export({ type: "pkcs8", format: "der" });
      expect(Buffer.from(privateKeyDer).equals(expectedDer)).toBe(true);

      /*
       * The COSE public key is the ES256 EC2 key of the private key:
       * {1: 2 (EC2), 3: -7 (ES256), -1: 1 (P-256), -2: x, -3: y}
       */
      const publicJwk = createPublicKey(keepassPasskeyPrivateKeyPem).export({ format: "jwk" });
      const expectedCose = new Uint8Array([
        0xa5,
        0x01,
        0x02,
        0x03,
        0x26,
        0x20,
        0x01,
        0x21,
        0x58,
        0x20,
        ...PasskeyEncodingService.base64UrlToUint8Array(publicJwk.x),
        0x22,
        0x58,
        0x20,
        ...PasskeyEncodingService.base64UrlToUint8Array(publicJwk.y),
      ]);
      expect(secretDto.public_key_cose).toStrictEqual(PasskeyEncodingService.toBase64Url(expectedCose));
      expect(publicJwk.x).toStrictEqual(keepassPasskeyPublicCoordinates.x);
    });

    it("falls back on the generated user id and on the entry username", async () => {
      expect.assertions(2);
      const keepassFields = keepassPasskeyFieldsDto({
        [KEEPASS_PASSKEY_FIELDS.USER_HANDLE]: null,
        [KEEPASS_PASSKEY_FIELDS.GENERATED_USER_ID]: "Z2VuZXJhdGVkLXVzZXItaWQ",
        [KEEPASS_PASSKEY_FIELDS.USERNAME]: null,
      });

      const secretDto = await PasskeyKeepassImportService.buildSecretDto(keepassFields, { username: "ada" });

      expect(secretDto.user_handle).toStrictEqual("Z2VuZXJhdGVkLXVzZXItaWQ");
      expect(secretDto.user_name).toStrictEqual("ada");
    });

    it("normalizes standard base64 attributes to base64url", async () => {
      expect.assertions(2);
      // Standard base64 of the bytes 0xfb 0xff 0xbf, which encodes to "+/+/" with padding.
      const keepassFields = keepassPasskeyFieldsDto({
        [KEEPASS_PASSKEY_FIELDS.CREDENTIAL_ID]: "+/+/",
        [KEEPASS_PASSKEY_FIELDS.USER_HANDLE]: "+/+/",
      });

      const secretDto = await PasskeyKeepassImportService.buildSecretDto(keepassFields);

      expect(secretDto.credential_id).toStrictEqual("-_-_");
      expect(secretDto.user_handle).toStrictEqual("-_-_");
    });

    it("reads the backup flags", async () => {
      expect.assertions(2);
      const keepassFields = keepassPasskeyFieldsDto({
        [KEEPASS_PASSKEY_FIELDS.FLAG_BACKUP_ELIGIBLE]: "0",
        [KEEPASS_PASSKEY_FIELDS.FLAG_BACKUP_STATE]: null,
      });

      const secretDto = await PasskeyKeepassImportService.buildSecretDto(keepassFields);

      expect(secretDto.backup_eligible).toBe(false);
      expect(secretDto.backup_state).toBe(false);
    });

    it("rejects an incomplete passkey", async () => {
      expect.assertions(2);

      await expect(
        PasskeyKeepassImportService.buildSecretDto(
          keepassPasskeyFieldsDto({ [KEEPASS_PASSKEY_FIELDS.USER_HANDLE]: null }),
        ),
      ).rejects.toThrow("The KeePassXC passkey is incomplete.");
      await expect(
        PasskeyKeepassImportService.buildSecretDto(
          keepassPasskeyFieldsDto({ [KEEPASS_PASSKEY_FIELDS.USERNAME]: null }),
        ),
      ).rejects.toThrow("The KeePassXC passkey is incomplete.");
    });

    it("rejects a private key which is not a PKCS#8 PEM key", async () => {
      expect.assertions(1);

      await expect(
        PasskeyKeepassImportService.buildSecretDto(
          keepassPasskeyFieldsDto({ [KEEPASS_PASSKEY_FIELDS.PRIVATE_KEY_PEM]: "not a pem key" }),
        ),
      ).rejects.toThrow("The KeePassXC passkey private key is not a PKCS#8 PEM key.");
    });

    it("rejects a passkey which is not an ES256 credential", async () => {
      expect.assertions(1);
      // A PKCS#8 PEM RSA key, which WebCrypto cannot import as an ECDSA P-256 key.
      const rsaPrivateKeyPem = [
        "-----BEGIN PRIVATE KEY-----",
        "MIIBVAIBADANBgkqhkiG9w0BAQEFAASCAT4wggE6AgEAAkEAwoLBLbBHUZ1Kk0Uc",
        "-----END PRIVATE KEY-----",
      ].join("\n");

      await expect(
        PasskeyKeepassImportService.buildSecretDto(
          keepassPasskeyFieldsDto({ [KEEPASS_PASSKEY_FIELDS.PRIVATE_KEY_PEM]: rsaPrivateKeyPem }),
        ),
      ).rejects.toThrow("Only ES256 passkeys are supported.");
    });
  });
});
