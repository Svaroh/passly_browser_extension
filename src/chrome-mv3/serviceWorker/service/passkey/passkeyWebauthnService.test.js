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

import { createHash, createPublicKey, verify } from "crypto";
import PasskeyEncodingService from "./passkeyEncodingService";
import PasskeyWebauthnService, {
  PASSKEY_ALGORITHM_ES256,
  PASSKEY_SECRET_OBJECT_TYPE,
  PASSKEY_SECRET_SCHEMA_VERSION,
} from "./passkeyWebauthnService";

function buildCreateRequestDetails(overrides = {}) {
  return {
    challenge: PasskeyEncodingService.toBase64Url(PasskeyEncodingService.utf8ToUint8Array("create-challenge")),
    origin: "https://login.example.com",
    rp: {
      id: "example.com",
      name: "Example",
    },
    user: {
      id: PasskeyEncodingService.toBase64Url(PasskeyEncodingService.utf8ToUint8Array("user-handle")),
      name: "ada@example.com",
      displayName: "Ada Lovelace",
    },
    pubKeyCredParams: [
      {
        type: "public-key",
        alg: PASSKEY_ALGORITHM_ES256,
      },
    ],
    ...overrides,
  };
}

function buildGetRequestDetails(secretDto, overrides = {}) {
  return {
    challenge: PasskeyEncodingService.toBase64Url(PasskeyEncodingService.utf8ToUint8Array("get-challenge")),
    origin: "https://login.example.com",
    rpId: "example.com",
    allowCredentials: [
      {
        type: "public-key",
        id: secretDto.credential_id,
      },
    ],
    userVerification: "required",
    ...overrides,
  };
}

function decodeClientDataJson(encodedClientDataJson) {
  return JSON.parse(
    PasskeyEncodingService.uint8ArrayToUtf8(PasskeyEncodingService.base64UrlToUint8Array(encodedClientDataJson)),
  );
}

describe("PasskeyWebauthnService", () => {
  describe("ecdsaP1363SignatureToDer", () => {
    it("converts P-1363 signatures that start with an ASN.1 DER sequence marker", () => {
      const rawSignature = new Uint8Array(64);
      rawSignature[0] = 0x30;
      rawSignature[31] = 0x01;
      rawSignature[63] = 0x02;

      const signature = PasskeyWebauthnService.ecdsaP1363SignatureToDer(rawSignature);

      expect(signature).not.toStrictEqual(rawSignature);
      expect(Array.from(signature)).toStrictEqual([
        0x30,
        0x25,
        0x02,
        0x20,
        ...Array.from(rawSignature.slice(0, 32)),
        0x02,
        0x01,
        0x02,
      ]);
    });
  });

  describe("createCredential", () => {
    it("builds a WebAuthn registration response and matching v5 passkey secret DTO", async () => {
      const { credential, secretDto } = await PasskeyWebauthnService.createCredential(buildCreateRequestDetails());

      expect(credential.id).toStrictEqual(secretDto.credential_id);
      expect(credential.rawId).toStrictEqual(secretDto.credential_id);
      expect(credential.type).toStrictEqual("public-key");
      expect(credential.authenticatorAttachment).toStrictEqual("platform");
      expect(credential.clientExtensionResults).toStrictEqual({});
      expect(credential.response.publicKeyAlgorithm).toStrictEqual(PASSKEY_ALGORITHM_ES256);
      expect(credential.response.transports).toStrictEqual(["internal"]);

      expect(secretDto).toMatchObject({
        object_type: PASSKEY_SECRET_OBJECT_TYPE,
        schema_version: PASSKEY_SECRET_SCHEMA_VERSION,
        rp_id: "example.com",
        origin: "https://login.example.com",
        user_handle: buildCreateRequestDetails().user.id,
        user_name: "ada@example.com",
        user_display_name: "Ada Lovelace",
        cose_alg: PASSKEY_ALGORITHM_ES256,
        aaguid: "00000000-0000-0000-0000-000000000000",
        backup_eligible: false,
        backup_state: false,
        sign_count: 0,
        transports: ["internal"],
      });
      expect(secretDto.credential_id).toMatch(/^[\w-]+$/);
      expect(secretDto.private_key_pkcs8).toMatch(/^[\w-]+$/);
      expect(secretDto.public_key_cose).toMatch(/^[\w-]+$/);

      const clientData = decodeClientDataJson(credential.response.clientDataJSON);
      expect(clientData).toStrictEqual({
        type: "webauthn.create",
        challenge: buildCreateRequestDetails().challenge,
        origin: "https://login.example.com",
        crossOrigin: false,
      });

      const authenticatorData = PasskeyEncodingService.base64UrlToUint8Array(credential.response.authenticatorData);
      expect(authenticatorData.slice(0, 32)).toStrictEqual(
        new Uint8Array(createHash("sha256").update("example.com").digest()),
      );
      expect(authenticatorData[32]).toStrictEqual(0x45);
      expect(authenticatorData.slice(33, 37)).toStrictEqual(new Uint8Array([0, 0, 0, 0]));
      expect(authenticatorData.slice(37, 53)).toStrictEqual(new Uint8Array(16));
      expect(authenticatorData[53]).toStrictEqual(0);
      expect(authenticatorData[54]).toStrictEqual(32);
      expect(PasskeyEncodingService.toBase64Url(authenticatorData.slice(55, 87))).toStrictEqual(
        secretDto.credential_id,
      );

      const cosePublicKey = PasskeyEncodingService.base64UrlToUint8Array(secretDto.public_key_cose);
      expect(Array.from(cosePublicKey.slice(0, 10))).toStrictEqual([
        0xa5, 0x01, 0x02, 0x03, 0x26, 0x20, 0x01, 0x21, 0x58, 0x20,
      ]);
      expect(credential.response.attestationObject).toMatch(/^[\w-]+$/);
    });

    it("rejects creation requests that do not allow ES256 public-key credentials", async () => {
      await expect(
        PasskeyWebauthnService.createCredential(
          buildCreateRequestDetails({
            pubKeyCredParams: [{ type: "public-key", alg: -257 }],
          }),
        ),
      ).rejects.toMatchObject({
        name: "NotSupportedError",
        message: "Passly passkey MVP supports only ES256 public-key credentials.",
      });
    });
  });

  describe("getAssertion", () => {
    it("builds a WebAuthn assertion response signed by the stored passkey private key", async () => {
      const { credential: createdCredential, secretDto } =
        await PasskeyWebauthnService.createCredential(buildCreateRequestDetails());
      const { credential } = await PasskeyWebauthnService.getAssertion(buildGetRequestDetails(secretDto), secretDto);

      expect(credential.id).toStrictEqual(secretDto.credential_id);
      expect(credential.rawId).toStrictEqual(secretDto.credential_id);
      expect(credential.type).toStrictEqual("public-key");
      expect(credential.clientExtensionResults).toStrictEqual({});
      expect(credential.response.userHandle).toStrictEqual(secretDto.user_handle);

      const clientData = decodeClientDataJson(credential.response.clientDataJSON);
      expect(clientData).toStrictEqual({
        type: "webauthn.get",
        challenge: buildGetRequestDetails(secretDto).challenge,
        origin: "https://login.example.com",
        crossOrigin: false,
      });

      const authenticatorData = PasskeyEncodingService.base64UrlToUint8Array(credential.response.authenticatorData);
      expect(authenticatorData).toHaveLength(37);
      expect(authenticatorData.slice(0, 32)).toStrictEqual(
        new Uint8Array(createHash("sha256").update("example.com").digest()),
      );
      expect(authenticatorData[32]).toStrictEqual(0x05);
      expect(authenticatorData.slice(33, 37)).toStrictEqual(new Uint8Array([0, 0, 0, 0]));

      const clientDataHash = createHash("sha256")
        .update(PasskeyEncodingService.base64UrlToUint8Array(credential.response.clientDataJSON))
        .digest();
      const signatureBase = Buffer.concat([Buffer.from(authenticatorData), clientDataHash]);
      const publicKey = createPublicKey({
        key: Buffer.from(PasskeyEncodingService.base64UrlToUint8Array(createdCredential.response.publicKey)),
        format: "der",
        type: "spki",
      });
      expect(
        verify(
          "sha256",
          signatureBase,
          publicKey,
          Buffer.from(PasskeyEncodingService.base64UrlToUint8Array(credential.response.signature)),
        ),
      ).toStrictEqual(true);
    });

    it("rejects assertions for a different relying party", async () => {
      const { secretDto } = await PasskeyWebauthnService.createCredential(buildCreateRequestDetails());

      await expect(
        PasskeyWebauthnService.getAssertion(
          buildGetRequestDetails(secretDto, {
            rpId: "evil.example",
          }),
          secretDto,
        ),
      ).rejects.toMatchObject({
        name: "NotAllowedError",
        message: "The passkey does not belong to this relying party.",
      });
    });
  });
});
