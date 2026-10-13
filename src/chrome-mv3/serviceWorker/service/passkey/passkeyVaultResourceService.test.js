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

import ResourceMetadataEntity from "passbolt-styleguide/src/shared/models/entity/resource/metadata/resourceMetadataEntity";
import ResourceFormEntity from "passbolt-styleguide/src/shared/models/entity/resource/resourceFormEntity";
import ResourceTypesCollection from "passbolt-styleguide/src/shared/models/entity/resourceType/resourceTypesCollection";
import FindAndUpdateResourcesLocalStorage from "../../../../all/background_page/service/resource/findAndUpdateResourcesLocalStorageService";
import GetDecryptedUserPrivateKeyService from "../../../../all/background_page/service/account/getDecryptedUserPrivateKeyService";
import GetPassphraseService from "../../../../all/background_page/service/passphrase/getPassphraseService";
import PassphraseStorageService from "../../../../all/background_page/service/session_storage/passphraseStorageService";
import {
  PASSKEY_SECRET_OBJECT_TYPE,
  PASSKEY_SECRET_SCHEMA_VERSION,
} from "../../../../all/passkey/passkeyProviderConstants";
import PasskeyVaultResourceService, { PASSKEY_RESOURCE_TYPE_SLUG } from "./passkeyVaultResourceService";

jest.mock("../../../../all/background_page/service/passphrase/getPassphraseService");
jest.mock("../../../../all/background_page/service/resource/findAndUpdateResourcesLocalStorageService");
jest.mock("../../../../all/background_page/service/secret/findSecretService");

function buildPasskeySecretDto(overrides = {}) {
  return {
    object_type: PASSKEY_SECRET_OBJECT_TYPE,
    schema_version: PASSKEY_SECRET_SCHEMA_VERSION,
    credential_id: "credential-id",
    rp_id: "www.passkeys.io",
    origin: "https://www.passkeys.io",
    user_handle: "user-handle",
    user_name: "ada@example.com",
    user_display_name: "Ada Lovelace",
    cose_alg: -7,
    public_key_cose: "public-key-cose",
    private_key_pkcs8: "private-key-pkcs8",
    aaguid: "00000000-0000-0000-0000-000000000000",
    backup_eligible: false,
    backup_state: false,
    sign_count: 0,
    transports: ["internal"],
    extensions: {},
    ...overrides,
  };
}

describe("PasskeyVaultResourceService", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  describe("buildResourceDto", () => {
    it("builds resource metadata from WebAuthn request details without exposing secret key material", () => {
      const resourceType = {
        id: "2f6b119d-97f7-4e1f-b322-46f72cf9406a",
        slug: PASSKEY_RESOURCE_TYPE_SLUG,
      };
      const secretDto = {
        credential_id: "credential-id",
        rp_id: "example.com",
        user_name: "ada@example.com",
        private_key_pkcs8: "private-key-material",
      };
      const requestDetails = {
        origin: "https://login.example.com",
        rp: {
          id: "example.com",
          name: "Example",
        },
      };

      const resourceDto = PasskeyVaultResourceService.buildResourceDto(requestDetails, secretDto, resourceType);

      expect(resourceDto).toStrictEqual({
        resource_type_id: resourceType.id,
        folder_parent_id: null,
        metadata: {
          object_type: ResourceMetadataEntity.METADATA_OBJECT_TYPE,
          resource_type_id: resourceType.id,
          name: "Example passkey",
          username: "ada@example.com",
          uris: ["https://login.example.com"],
          description: null,
        },
      });
      expect(JSON.stringify(resourceDto)).not.toContain("private-key-material");
      expect(JSON.stringify(resourceDto)).not.toContain("credential-id");
    });
  });

  describe("requestUserPassphrase", () => {
    it("uses the session passphrase without opening a QuickAccess prompt", async () => {
      const getPassphrase = jest.spyOn(PassphraseStorageService, "get").mockResolvedValue("passphrase");

      await expect(PasskeyVaultResourceService.requestUserPassphrase()).resolves.toBe("passphrase");

      expect(getPassphrase).toHaveBeenCalledWith();
      expect(GetPassphraseService).not.toHaveBeenCalled();
    });

    it("opens the attached QuickAccess prompt when the session is locked", async () => {
      const account = { id: "account-id" };
      const requestPassphraseFromQuickAccess = jest.fn().mockResolvedValue("passphrase");
      jest.spyOn(PassphraseStorageService, "get").mockResolvedValue(null);
      GetPassphraseService.mockImplementation(() => ({
        requestPassphraseFromQuickAccess,
      }));

      await expect(PasskeyVaultResourceService.requestUserPassphrase(account)).resolves.toBe("passphrase");

      expect(GetPassphraseService).toHaveBeenCalledWith(account);
      expect(requestPassphraseFromQuickAccess).toHaveBeenCalledWith({
        force: true,
        attachedOnly: true,
      });
    });

    it("normalizes QuickAccess unlock failures to a WebAuthn NotAllowedError", async () => {
      const account = { id: "account-id" };
      const requestPassphraseFromQuickAccess = jest.fn().mockRejectedValue(new Error("Popup failed."));
      jest.spyOn(PassphraseStorageService, "get").mockResolvedValue(null);
      GetPassphraseService.mockImplementation(() => ({
        requestPassphraseFromQuickAccess,
      }));

      await expect(PasskeyVaultResourceService.requestUserPassphrase(account)).rejects.toMatchObject({
        name: "NotAllowedError",
        message: "Popup failed.",
      });
    });
  });

  describe("getPasskeyResourceType", () => {
    it("keeps the API v5-passkey resource type in the styleguide collection", async () => {
      const resourceTypes = new ResourceTypesCollection([
        {
          id: "333239fb-2598-580e-8d8a-508f9c49998b",
          name: "Passkey",
          slug: PASSKEY_RESOURCE_TYPE_SLUG,
          definition: {},
          description: "A resource with an encrypted passkey credential.",
        },
      ]);
      const passkeyResourceType = resourceTypes.getFirstBySlug(PASSKEY_RESOURCE_TYPE_SLUG);
      const resourceTypeModel = {
        getOrFindAll: jest.fn(() => resourceTypes),
        updateLocalStorage: jest.fn(),
      };

      await expect(PasskeyVaultResourceService.getPasskeyResourceType(resourceTypeModel)).resolves.toBe(
        passkeyResourceType,
      );

      expect(passkeyResourceType.definition.secret.properties.object_type.enum).toStrictEqual([
        PASSKEY_SECRET_OBJECT_TYPE,
      ]);
      expect(passkeyResourceType.hasPassword()).toBe(false);
      expect(passkeyResourceType.hasMetadataUris()).toBe(true);
      expect(resourceTypeModel.updateLocalStorage).not.toHaveBeenCalled();
    });

    it("allows the resource editor form entity to load a v5-passkey resource without treating it as a password", () => {
      const resourceTypes = new ResourceTypesCollection([
        {
          id: "333239fb-2598-580e-8d8a-508f9c49998b",
          name: "Passkey",
          slug: PASSKEY_RESOURCE_TYPE_SLUG,
          definition: {},
          description: "A resource with an encrypted passkey credential.",
        },
      ]);
      const passkeyResourceType = resourceTypes.getFirstBySlug(PASSKEY_RESOURCE_TYPE_SLUG);
      const secretDto = buildPasskeySecretDto();
      const resourceDto = {
        id: "6a956ef4-36d3-4692-bad5-02ab11124399",
        resource_type_id: passkeyResourceType.id,
        folder_parent_id: null,
        metadata: {
          object_type: ResourceMetadataEntity.METADATA_OBJECT_TYPE,
          resource_type_id: passkeyResourceType.id,
          name: "www.passkeys.io passkey",
          username: "ada@example.com",
          uris: ["https://www.passkeys.io"],
          description: null,
        },
        secret: secretDto,
      };

      const resourceFormEntity = new ResourceFormEntity(resourceDto, { resourceTypes });

      expect(resourceFormEntity.secret.constructor.name).toBe("SecretDataV5PasskeyEntity");
      expect(resourceFormEntity.toSecretDto()).toStrictEqual(secretDto);
      expect(resourceFormEntity.secret.areSecretsDifferent(secretDto)).toBe(false);
      expect(passkeyResourceType.hasPassword()).toBe(false);
    });

    it("refreshes the resource type cache when v5-passkey is missing locally", async () => {
      const passkeyResourceType = {
        id: "2f6b119d-97f7-4e1f-b322-46f72cf9406a",
        slug: PASSKEY_RESOURCE_TYPE_SLUG,
      };
      const cachedResourceTypes = {
        getFirstBySlug: jest.fn(() => null),
      };
      const refreshedResourceTypes = {
        getFirstBySlug: jest.fn(() => passkeyResourceType),
      };
      const resourceTypeModel = {
        getOrFindAll: jest.fn(() => cachedResourceTypes),
        updateLocalStorage: jest.fn(() => refreshedResourceTypes),
      };

      await expect(PasskeyVaultResourceService.getPasskeyResourceType(resourceTypeModel)).resolves.toBe(
        passkeyResourceType,
      );

      expect(resourceTypeModel.getOrFindAll).toHaveBeenCalledTimes(1);
      expect(resourceTypeModel.updateLocalStorage).toHaveBeenCalledTimes(1);
      expect(cachedResourceTypes.getFirstBySlug).toHaveBeenCalledWith(PASSKEY_RESOURCE_TYPE_SLUG);
      expect(refreshedResourceTypes.getFirstBySlug).toHaveBeenCalledWith(PASSKEY_RESOURCE_TYPE_SLUG);
    });

    it("fails after refreshing when the API does not expose v5-passkey", async () => {
      const cachedResourceTypes = {
        getFirstBySlug: jest.fn(() => null),
      };
      const refreshedResourceTypes = {
        getFirstBySlug: jest.fn(() => null),
      };
      const resourceTypeModel = {
        getOrFindAll: jest.fn(() => cachedResourceTypes),
        updateLocalStorage: jest.fn(() => refreshedResourceTypes),
      };

      await expect(PasskeyVaultResourceService.getPasskeyResourceType(resourceTypeModel)).rejects.toMatchObject({
        name: "NotSupportedError",
        message: "The Passly API does not expose the v5-passkey resource type.",
      });

      expect(resourceTypeModel.updateLocalStorage).toHaveBeenCalledTimes(1);
    });
  });

  describe("findSecretForAssertion", () => {
    const resourceType = {
      id: "2f6b119d-97f7-4e1f-b322-46f72cf9406a",
      slug: PASSKEY_RESOURCE_TYPE_SLUG,
      definition: { secret: {} },
    };

    beforeEach(() => {
      jest.spyOn(PasskeyVaultResourceService, "getContext").mockResolvedValue({
        account: { id: "account-id" },
        apiClientOptions: { setResourceName: jest.fn() },
        getOrFindResourceTypesService: {},
      });
      jest.spyOn(PasskeyVaultResourceService, "requestUserPassphrase").mockResolvedValue("passphrase");
      jest.spyOn(PasskeyVaultResourceService, "getPasskeyResourceType").mockResolvedValue(resourceType);
      jest.spyOn(GetDecryptedUserPrivateKeyService, "getKey").mockResolvedValue("decrypted-private-key");
    });

    it("returns matching passkey secret from existing cached resources", async () => {
      const secretDto = buildPasskeySecretDto({
        credential_id: "test-credential-id",
        rp_id: "example.com",
      });
      const resourceDto = {
        id: "res-1",
        resource_type_id: resourceType.id,
        secret: secretDto,
      };

      jest.spyOn(PasskeyVaultResourceService, "getPasskeyResources").mockResolvedValue([resourceDto]);

      const requestDetails = {
        origin: "https://login.example.com",
        rpId: "example.com",
        allowCredentials: [{ type: "public-key", id: "test-credential-id" }],
      };

      const result = await PasskeyVaultResourceService.findSecretForAssertion(requestDetails);
      expect(result).toStrictEqual(secretDto);
    });

    it("matches credentials when allowCredentials uses padded Base64 and RP subdomain", async () => {
      const secretDto = buildPasskeySecretDto({
        credential_id: "test-credential-id",
        rp_id: "example.com",
      });
      const resourceDto = {
        id: "res-1",
        resource_type_id: resourceType.id,
        secret: secretDto,
      };

      jest.spyOn(PasskeyVaultResourceService, "getPasskeyResources").mockResolvedValue([resourceDto]);

      const requestDetails = {
        origin: "https://auth.example.com",
        rpId: "auth.example.com",
        allowCredentials: [{ type: "PUBLIC-KEY", id: "test-credential-id==" }],
      };

      const result = await PasskeyVaultResourceService.findSecretForAssertion(requestDetails);
      expect(result).toStrictEqual(secretDto);
    });

    it("refreshes resources from Passly API when local cache does not have matching passkey", async () => {
      const oldResourceDto = {
        id: "res-old",
        resource_type_id: resourceType.id,
        secret: buildPasskeySecretDto({
          credential_id: "other-id",
          rp_id: "other.com",
        }),
      };
      const newSecretDto = buildPasskeySecretDto({
        credential_id: "new-credential-id",
        rp_id: "example.com",
      });
      const newResourceDto = {
        id: "res-new",
        resource_type_id: resourceType.id,
        secret: newSecretDto,
      };

      jest.spyOn(PasskeyVaultResourceService, "getPasskeyResources").mockResolvedValue([oldResourceDto]);

      const findAndUpdateAll = jest.fn().mockResolvedValue({
        toDto: () => [oldResourceDto, newResourceDto],
      });
      FindAndUpdateResourcesLocalStorage.mockImplementation(() => ({
        findAndUpdateAll,
      }));

      const requestDetails = {
        origin: "https://login.example.com",
        rpId: "example.com",
        allowCredentials: [{ type: "public-key", id: "new-credential-id" }],
      };

      const result = await PasskeyVaultResourceService.findSecretForAssertion(requestDetails);

      expect(result).toStrictEqual(newSecretDto);
      expect(findAndUpdateAll).toHaveBeenCalledTimes(1);
    });

    it("throws NotAllowedError when no matching passkey is found even after refresh", async () => {
      jest.spyOn(PasskeyVaultResourceService, "getPasskeyResources").mockResolvedValue([]);

      const findAndUpdateAll = jest.fn().mockResolvedValue({
        toDto: () => [],
      });
      FindAndUpdateResourcesLocalStorage.mockImplementation(() => ({
        findAndUpdateAll,
      }));

      const requestDetails = {
        origin: "https://login.example.com",
        rpId: "example.com",
      };

      await expect(PasskeyVaultResourceService.findSecretForAssertion(requestDetails)).rejects.toMatchObject({
        name: "NotAllowedError",
        message: "No Passly passkey matches this WebAuthn request.",
      });

      expect(findAndUpdateAll).toHaveBeenCalledTimes(1);
    });

    it("decrypts an encrypted passkey resource using DecryptAndParseResourceSecretService", async () => {
      const secretDto = buildPasskeySecretDto({
        credential_id: "encrypted-cred-id",
        rp_id: "example.com",
      });
      const resourceDto = {
        id: "res-enc",
        resource_type_id: resourceType.id,
      };

      const findSecretService = {
        findByResourceId: jest.fn().mockResolvedValue({ id: "sec-1", data: "pgp-encrypted-data" }),
      };

      const DecryptAndParseResourceSecretService =
        require("../../../../all/background_page/service/secret/decryptAndParseResourceSecretService").default;
      const decryptSpy = jest.spyOn(DecryptAndParseResourceSecretService, "decryptAndParse").mockResolvedValue({
        toDto: () => secretDto,
      });

      const decrypted = await PasskeyVaultResourceService.tryDecryptPasskeySecret(
        resourceDto,
        resourceType.definition?.secret,
        "private-key",
        findSecretService,
      );

      expect(decrypted).toStrictEqual(secretDto);
      expect(findSecretService.findByResourceId).toHaveBeenCalledWith("res-enc");
      expect(decryptSpy).toHaveBeenCalledWith(
        { id: "sec-1", data: "pgp-encrypted-data" },
        resourceType.definition.secret,
        "private-key",
      );
    });

    it("parses real JSON passkey secret using DecryptAndParseResourceSecretService.parse", async () => {
      const secretDto = buildPasskeySecretDto({
        credential_id: "real-cred-id",
        rp_id: "example.com",
      });
      const resourceTypes = new ResourceTypesCollection([
        {
          id: "333239fb-2598-580e-8d8a-508f9c49998b",
          name: "Passkey",
          slug: PASSKEY_RESOURCE_TYPE_SLUG,
          definition: {},
          description: "A resource with an encrypted passkey credential.",
        },
      ]);
      const passkeyResourceType = resourceTypes.getFirstBySlug(PASSKEY_RESOURCE_TYPE_SLUG);
      const secretSchema = passkeyResourceType.definition.secret;

      const DecryptAndParseResourceSecretService =
        require("../../../../all/background_page/service/secret/decryptAndParseResourceSecretService").default;

      const parsed = await DecryptAndParseResourceSecretService.parse(JSON.stringify(secretDto), secretSchema);
      expect(parsed.toDto()).toStrictEqual(secretDto);
    });

    it("filters out resources with non-matching metadata URIs without decrypting them", async () => {
      const oracleSecret = buildPasskeySecretDto({
        credential_id: "oracle-cred-id",
        rp_id: "oraclecloud.com",
      });
      const matchingResource = {
        id: "res-oracle",
        resource_type_id: resourceType.id,
        metadata: {
          name: "Oracle passkey",
          uris: ["https://idcs-bffa4b47e4ee4df29bef28d7a072bcfe.identity.oraclecloud.com"],
        },
        secret: oracleSecret,
      };
      const unrelatedResource = {
        id: "res-uber",
        resource_type_id: resourceType.id,
        metadata: {
          name: "Uber passkey",
          uris: ["https://uber.com"],
        },
        secret: buildPasskeySecretDto({
          credential_id: "uber-cred-id",
          rp_id: "uber.com",
        }),
      };

      const tryDecryptSpy = jest.spyOn(PasskeyVaultResourceService, "tryDecryptPasskeySecret");
      jest
        .spyOn(PasskeyVaultResourceService, "getPasskeyResources")
        .mockResolvedValue([unrelatedResource, matchingResource]);

      const result = await PasskeyVaultResourceService.findSecretForAssertion({
        origin: "https://idcs-bffa4b47e4ee4df29bef28d7a072bcfe.identity.oraclecloud.com",
        rpId: "oraclecloud.com",
        allowCredentials: [{ type: "public-key", id: "oracle-cred-id" }],
      });

      expect(result).toStrictEqual(oracleSecret);
      // unrelatedResource should not even be passed to tryDecryptPasskeySecret
      expect(tryDecryptSpy).toHaveBeenCalledTimes(1);
      expect(tryDecryptSpy).toHaveBeenCalledWith(
        matchingResource,
        expect.anything(),
        expect.anything(),
        expect.anything(),
      );
    });
  });

  describe("isResourceCandidateForRp", () => {
    it("returns true when resource has matching origin URI", () => {
      const resource = {
        metadata: {
          uris: ["https://idcs-bffa4b47e4ee4df29bef28d7a072bcfe.identity.oraclecloud.com"],
        },
      };
      expect(
        PasskeyVaultResourceService.isResourceCandidateForRp(
          resource,
          "oraclecloud.com",
          "https://idcs-bffa4b47e4ee4df29bef28d7a072bcfe.identity.oraclecloud.com",
        ),
      ).toBe(true);
    });

    it("returns false when resource has completely different URI", () => {
      const resource = {
        metadata: {
          uris: ["https://uber.com"],
        },
      };
      expect(
        PasskeyVaultResourceService.isResourceCandidateForRp(
          resource,
          "oraclecloud.com",
          "https://idcs-bffa4b47e4ee4df29bef28d7a072bcfe.identity.oraclecloud.com",
        ),
      ).toBe(false);
    });

    it("returns true when resource lacks uris but name matches RP", () => {
      const resource = {
        metadata: {
          name: "Oracle Cloud passkey",
        },
      };
      expect(
        PasskeyVaultResourceService.isResourceCandidateForRp(
          resource,
          "oraclecloud.com",
          "https://idcs.oraclecloud.com",
        ),
      ).toBe(true);
    });

    it("returns true when resource lacks both uris and name for test mock compatibility", () => {
      const resource = { id: "res-test" };
      expect(
        PasskeyVaultResourceService.isResourceCandidateForRp(
          resource,
          "oraclecloud.com",
          "https://idcs.oraclecloud.com",
        ),
      ).toBe(true);
    });
  });
});
