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
import GetPassphraseService from "../../../../all/background_page/service/passphrase/getPassphraseService";
import PassphraseStorageService from "../../../../all/background_page/service/session_storage/passphraseStorageService";
import {
  PASSKEY_SECRET_OBJECT_TYPE,
  PASSKEY_SECRET_SCHEMA_VERSION,
} from "../../../../all/passkey/passkeyProviderConstants";
import PasskeyVaultResourceService, { PASSKEY_RESOURCE_TYPE_SLUG } from "./passkeyVaultResourceService";

jest.mock("../../../../all/background_page/service/passphrase/getPassphraseService");

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
      expect(passkeyResourceType.hasSecretDescription()).toBe(false);
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
});
