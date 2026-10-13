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
import PasskeyEncodingService from "../../../../all/passkey/passkeyEncodingService";
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

    it("verifies whether creation options are supported by the provider", () => {
      expect(PasskeyWebauthnService.supportsCreateOptions(buildCreateRequestDetails())).toBe(true);
      expect(
        PasskeyWebauthnService.supportsCreateOptions(
          buildCreateRequestDetails({
            pubKeyCredParams: [{ type: "public-key", alg: "-7" }],
          }),
        ),
      ).toBe(true);
      expect(
        PasskeyWebauthnService.supportsCreateOptions(
          buildCreateRequestDetails({
            pubKeyCredParams: [],
          }),
        ),
      ).toBe(true);
      expect(
        PasskeyWebauthnService.supportsCreateOptions(
          buildCreateRequestDetails({
            pubKeyCredParams: [{ type: "public-key", alg: -257 }],
          }),
        ),
      ).toBe(false);
      expect(PasskeyWebauthnService.supportsCreateOptions(null)).toBe(false);
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

    it("allows assertions when allowCredentials uses standard padded Base64 and different RP subdomains", async () => {
      const { secretDto } = await PasskeyWebauthnService.createCredential(
        buildCreateRequestDetails({
          rp: { id: "example.com", name: "Example" },
        }),
      );

      const standardBase64Id = secretDto.credential_id.replaceAll("-", "+").replaceAll("_", "/") + "=";
      const getDetails = buildGetRequestDetails(secretDto, {
        rpId: "auth.example.com",
        origin: "https://auth.example.com",
        allowCredentials: [
          {
            type: "PUBLIC-KEY",
            id: standardBase64Id,
          },
        ],
      });

      const { credential } = await PasskeyWebauthnService.getAssertion(getDetails, secretDto);
      expect(credential.id).toStrictEqual(secretDto.credential_id);
    });
  });

  describe("isCredentialAllowed", () => {
    const rawBytes = new Uint8Array([1, 2, 3, 4, 5, 250, 255]);
    const base64UrlId = PasskeyEncodingService.toBase64Url(rawBytes);

    it("returns true when allowCredentials is empty or not an array", () => {
      expect(PasskeyWebauthnService.isCredentialAllowed([], base64UrlId)).toBe(true);
      expect(PasskeyWebauthnService.isCredentialAllowed(undefined, base64UrlId)).toBe(true);
      expect(PasskeyWebauthnService.isCredentialAllowed(null, base64UrlId)).toBe(true);
    });

    it("matches exact Base64URL credential ids", () => {
      expect(PasskeyWebauthnService.isCredentialAllowed([{ type: "public-key", id: base64UrlId }], base64UrlId)).toBe(
        true,
      );
    });

    it("matches standard Base64 credential ids with padding", () => {
      const standardBase64 = base64UrlId.replaceAll("-", "+").replaceAll("_", "/") + "==";
      expect(
        PasskeyWebauthnService.isCredentialAllowed([{ type: "public-key", id: standardBase64 }], base64UrlId),
      ).toBe(true);
    });

    it("matches Uint8Array credential ids", () => {
      expect(PasskeyWebauthnService.isCredentialAllowed([{ type: "public-key", id: rawBytes }], base64UrlId)).toBe(
        true,
      );
    });

    it("ignores missing or uppercase descriptor type", () => {
      expect(PasskeyWebauthnService.isCredentialAllowed([{ id: base64UrlId }], base64UrlId)).toBe(true);
      expect(PasskeyWebauthnService.isCredentialAllowed([{ type: "PUBLIC-KEY", id: base64UrlId }], base64UrlId)).toBe(
        true,
      );
    });

    it("rejects non-public-key descriptors", () => {
      expect(PasskeyWebauthnService.isCredentialAllowed([{ type: "usb", id: base64UrlId }], base64UrlId)).toBe(false);
    });

    it("rejects mismatched credential ids", () => {
      expect(PasskeyWebauthnService.isCredentialAllowed([{ type: "public-key", id: "other-id" }], base64UrlId)).toBe(
        false,
      );
    });
  });

  describe("isRpIdMatching", () => {
    it("matches identical domains regardless of casing", () => {
      expect(PasskeyWebauthnService.isRpIdMatching("example.com", "EXAMPLE.COM")).toBe(true);
      expect(PasskeyWebauthnService.isRpIdMatching("www.passkeys.io", "www.passkeys.io")).toBe(true);
    });

    it("matches subdomain relationships in both directions", () => {
      expect(PasskeyWebauthnService.isRpIdMatching("example.com", "auth.example.com")).toBe(true);
      expect(PasskeyWebauthnService.isRpIdMatching("auth.example.com", "example.com")).toBe(true);
    });

    it("matches via origin hostname when requestedRpId is omitted", () => {
      expect(PasskeyWebauthnService.isRpIdMatching("example.com", "", "https://my-profile.example.com/account")).toBe(
        true,
      );
      expect(PasskeyWebauthnService.isRpIdMatching("my-profile.example.com", null, "https://example.com")).toBe(true);
    });

    it("strips schemes and ports during comparison", () => {
      expect(PasskeyWebauthnService.isRpIdMatching("https://example.com:8443", "example.com")).toBe(true);
    });

    it("rejects different domains", () => {
      expect(PasskeyWebauthnService.isRpIdMatching("example.com", "evil.example")).toBe(false);
      expect(PasskeyWebauthnService.isRpIdMatching("notexample.com", "example.com")).toBe(false);
    });
  });

  describe("parseRequestDetails", () => {
    it("unwraps nested publicKey options to top-level properties", () => {
      const details = {
        publicKey: {
          challenge: "test-challenge",
          rpId: "example.com",
          allowCredentials: [{ id: "cred-1", type: "public-key" }],
        },
      };

      const parsed = PasskeyWebauthnService.parseRequestDetails(details);
      expect(parsed.rpId).toBe("example.com");
      expect(parsed.challenge).toBe("test-challenge");
      expect(parsed.allowCredentials).toHaveLength(1);
    });

    it("parses JSON string with nested publicKey", () => {
      const json = JSON.stringify({
        origin: "https://example.com",
        publicKey: {
          rpId: "example.com",
          challenge: "test-challenge",
        },
      });

      const parsed = PasskeyWebauthnService.parseRequestDetails(json);
      expect(parsed.rpId).toBe("example.com");
      expect(parsed.origin).toBe("https://example.com");
    });
  });

  describe("isCredentialAllowed with extended formats", () => {
    it("matches when candidate is hex and target is base64url", () => {
      const rawBytes = new Uint8Array([
        0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f, 0x10,
      ]);
      const base64UrlId = PasskeyEncodingService.toBase64Url(rawBytes);
      const hexId = Array.from(rawBytes, (b) => b.toString(16).padStart(2, "0")).join("");

      expect(PasskeyWebauthnService.isCredentialAllowed([{ id: hexId, type: "public-key" }], base64UrlId)).toBe(true);
      expect(PasskeyWebauthnService.isCredentialAllowed([{ id: base64UrlId, type: "public-key" }], hexId)).toBe(true);
    });

    it("matches when candidate is percent-encoded", () => {
      expect(
        PasskeyWebauthnService.isCredentialAllowed([{ id: "cred%2B123%2Fabc%3D", type: "public-key" }], "cred-123_abc"),
      ).toBe(true);
    });

    it("matches when candidate is a byte array or TypedArray", () => {
      const bytes = [1, 2, 3, 4, 5];
      const targetB64Url = PasskeyEncodingService.toBase64Url(new Uint8Array(bytes));

      expect(PasskeyWebauthnService.isCredentialAllowed([{ id: bytes, type: "public-key" }], targetB64Url)).toBe(true);
      expect(
        PasskeyWebauthnService.isCredentialAllowed([{ id: new Uint8Array(bytes), type: "public-key" }], targetB64Url),
      ).toBe(true);
    });

    it("matches when candidate descriptor uses rawId or credentialId instead of id", () => {
      const bytes = new Uint8Array([10, 20, 30, 40, 50, 60, 70, 80]);
      const targetB64Url = PasskeyEncodingService.toBase64Url(bytes);

      expect(PasskeyWebauthnService.isCredentialAllowed([{ rawId: bytes, type: "public-key" }], targetB64Url)).toBe(
        true,
      );
      expect(
        PasskeyWebauthnService.isCredentialAllowed([{ credentialId: targetB64Url, type: "public-key" }], targetB64Url),
      ).toBe(true);
    });

    it("matches when allowCredentials contains raw strings or buffers instead of objects", () => {
      const bytes = new Uint8Array([5, 6, 7, 8, 9]);
      const targetB64Url = PasskeyEncodingService.toBase64Url(bytes);

      expect(PasskeyWebauthnService.isCredentialAllowed([targetB64Url], targetB64Url)).toBe(true);
      expect(PasskeyWebauthnService.isCredentialAllowed([bytes], targetB64Url)).toBe(true);
    });

    it("matches when candidate is an object with numeric keys (JSON-serialized buffer)", () => {
      const bytes = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
      const targetB64Url = PasskeyEncodingService.toBase64Url(bytes);
      const jsonBufferObj = { 0: 1, 1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: 7, 7: 8 };

      expect(
        PasskeyWebauthnService.isCredentialAllowed([{ id: jsonBufferObj, type: "public-key" }], targetB64Url),
      ).toBe(true);
    });
  });

  describe("isRpIdMatching with storedOrigin", () => {
    it("matches via stored origin when stored rp_id does not directly match requested rp_id", () => {
      expect(
        PasskeyWebauthnService.isRpIdMatching(
          "unrelated.com",
          "oraclecloud.com",
          "https://idcs-123.identity.oraclecloud.com",
          "https://idcs-123.identity.oraclecloud.com",
        ),
      ).toBe(true);
    });
  });
});
