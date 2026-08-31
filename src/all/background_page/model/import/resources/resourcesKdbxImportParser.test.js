/**
 * @jest-environment ./test/jest.custom-kdbx-environment
 */
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
import fs from "fs";
import * as kdbxweb from "kdbxweb";
import ResourcesKdbxImportParser from "./resourcesKdbxImportParser";
import ImportResourcesFileEntity from "../../entity/import/importResourcesFileEntity";
import EntityValidationError from "passbolt-styleguide/src/shared/models/entity/abstract/entityValidationError";
import ImportError from "../../../error/importError";
import ResourceTypesCollection from "passbolt-styleguide/src/shared/models/entity/resourceType/resourceTypesCollection";
import { resourceTypesCollectionDto } from "passbolt-styleguide/src/shared/models/entity/resourceType/resourceTypesCollection.test.data";
import {
  TEST_RESOURCE_TYPE_PASSWORD_AND_DESCRIPTION,
  TEST_RESOURCE_TYPE_PASSWORD_DESCRIPTION_TOTP,
} from "passbolt-styleguide/src/shared/models/entity/resourceType/resourceTypeEntity.test.data";
import { defaultTotpDto } from "../../entity/totp/totpDto.test.data";
import MetadataTypesSettingsEntity from "passbolt-styleguide/src/shared/models/entity/metadata/metadataTypesSettingsEntity";
import {
  defaultMetadataTypesSettingsV4Dto,
  defaultMetadataTypesSettingsV6Dto,
} from "passbolt-styleguide/src/shared/models/entity/metadata/metadataTypesSettingsEntity.test.data";
import IconEntity, {
  ICON_TYPE_KEEPASS_ICON_SET,
} from "passbolt-styleguide/src/shared/models/entity/resource/metadata/IconEntity";
import { PASSKEY_KDBX_FIELD_NAME } from "../../../../passkey/passkeyProviderConstants";
import {
  defaultPasskeySecretDto,
  keepassPasskeyFieldsDto,
  passkeyResourceTypeDto,
} from "../../../../passkey/passkeySecretDto.test.data";
import { KEEPASS_PASSKEY_FIELDS } from "../../../../passkey/passkeyKeepassImportService";

describe("ResourcesKdbxImportParser", () => {
  let resourceTypesCollection, metadataTypesSettings;

  beforeEach(() => {
    resourceTypesCollection = new ResourceTypesCollection(resourceTypesCollectionDto());
    metadataTypesSettings = new MetadataTypesSettingsEntity(defaultMetadataTypesSettingsV4Dto());
  });

  it("should read import file", async () => {
    expect.assertions(1);
    const file = fs.readFileSync("./src/all/background_page/model/import/resources/kdbx/kdbx-not-protected.kdbx", {
      encoding: "base64",
    });
    const importDto = {
      ref: "import-ref",
      file_type: "kdbx",
      file: file,
    };
    const importEntity = new ImportResourcesFileEntity(importDto);
    const parser = new ResourcesKdbxImportParser(importEntity);
    const kdbx = await parser.readKdbxDb();
    expect(kdbx).toBeInstanceOf(kdbxweb.Kdbx);
  });

  it("should read import file protected by password", async () => {
    expect.assertions(1);
    const file = fs.readFileSync(
      "./src/all/background_page/model/import/resources/kdbx/kdbx-with-all-resource-types.kdbx",
      { encoding: "base64" },
    );
    const importDto = {
      ref: "import-ref",
      file_type: "kdbx",
      file: file,
      options: {
        credentials: {
          password: "test",
        },
      },
    };
    const importEntity = new ImportResourcesFileEntity(importDto);
    const parser = new ResourcesKdbxImportParser(importEntity, resourceTypesCollection, metadataTypesSettings);
    const kdbx = await parser.readKdbxDb();
    expect(kdbx).toBeInstanceOf(kdbxweb.Kdbx);
  });

  it("should not be able to read import file protected by password if wrong password", async () => {
    expect.assertions(1);
    const file = fs.readFileSync("./src/all/background_page/model/import/resources/kdbx/kdbx-protected-password.kdbx", {
      encoding: "base64",
    });
    const importDto = {
      ref: "import-ref",
      file_type: "kdbx",
      file: file,
    };
    const importEntity = new ImportResourcesFileEntity(importDto);
    const parser = new ResourcesKdbxImportParser(importEntity, resourceTypesCollection, metadataTypesSettings);
    try {
      await parser.readKdbxDb();
    } catch (error) {
      expect(error).toBeInstanceOf(kdbxweb.KdbxError);
    }
  });

  it("should read import file protected by keyfile", async () => {
    expect.assertions(1);
    const file = fs.readFileSync("./src/all/background_page/model/import/resources/kdbx/kdbx-protected-keyfile.kdbx", {
      encoding: "base64",
    });
    const keyfile = fs.readFileSync("./src/all/background_page/model/import/resources/kdbx/kdbx-keyfile.key", {
      encoding: "base64",
    });
    const importDto = {
      ref: "import-ref",
      file_type: "kdbx",
      file: file,
      options: {
        credentials: {
          keyfile: keyfile,
        },
      },
    };
    const importEntity = new ImportResourcesFileEntity(importDto);
    const parser = new ResourcesKdbxImportParser(importEntity, resourceTypesCollection, metadataTypesSettings);
    const kdbx = await parser.readKdbxDb();
    expect(kdbx).toBeInstanceOf(kdbxweb.Kdbx);
  });

  it("should not be able to read import file protected by keyfile if wrong keyfile", async () => {
    expect.assertions(1);
    const file = fs.readFileSync("./src/all/background_page/model/import/resources/kdbx/kdbx-protected-keyfile.kdbx", {
      encoding: "base64",
    });
    const importDto = {
      ref: "import-ref",
      file_type: "kdbx",
      file: file,
    };
    const importEntity = new ImportResourcesFileEntity(importDto);
    const parser = new ResourcesKdbxImportParser(importEntity, resourceTypesCollection, metadataTypesSettings);
    try {
      await parser.readKdbxDb();
    } catch (error) {
      expect(error).toBeInstanceOf(kdbxweb.KdbxError);
    }
  });

  function buildExternalResourceDto(num, data) {
    return Object.assign(
      {
        name: `Password ${num}`,
        username: `username${num}`,
        uris: [`https://url${num}.com`],
        description: `Description ${num}`,
        secret_clear: `Secret ${num}`,
        folder_parent_path: ``,
        expired: null,
      },
      data,
    );
  }

  function buildExternalFolderDto(num, data) {
    return Object.assign(
      {
        name: `Folder ${num}`,
        folder_parent_path: ``,
      },
      data,
    );
  }

  /**
   * Build a base64 kdbx file holding a single entry, as exported by Passly.
   * @param {object} fields The kdbx entry fields
   * @returns {Promise<string>}
   */
  async function buildKdbxFile(fields) {
    const kdbxDb = kdbxweb.Kdbx.create(new kdbxweb.Credentials(null, null), "passbolt export");
    kdbxDb.setVersion(3);
    const kdbxEntry = kdbxDb.createEntry(kdbxDb.getDefaultGroup());
    Object.entries(fields).forEach(([key, value]) => kdbxEntry.fields.set(key, value));
    kdbxEntry.times.expiryTime = undefined;
    kdbxEntry.times.expires = false;
    const file = await kdbxDb.save();
    return kdbxweb.ByteUtils.bytesToBase64(new Uint8Array(file));
  }

  /**
   * Build the import entity of a kdbx file holding a single KeePassXC passkey entry.
   * @param {object} [keepassFields] The KeePassXC passkey attributes
   * @param {object} [entryFields] Additional kdbx entry fields
   * @returns {Promise<ImportResourcesFileEntity>}
   */
  async function buildKeepassPasskeyImportEntity(keepassFields = keepassPasskeyFieldsDto(), entryFields = {}) {
    const protectedFieldNames = [
      KEEPASS_PASSKEY_FIELDS.CREDENTIAL_ID,
      KEEPASS_PASSKEY_FIELDS.PRIVATE_KEY_PEM,
      KEEPASS_PASSKEY_FIELDS.USER_HANDLE,
    ];
    const fields = {
      Title: "www.spaceship.com",
      UserName: "66Ton99",
      URL: "https://www.spaceship.com",
      Notes: "",
      ...entryFields,
    };
    Object.entries(keepassFields).forEach(([key, value]) => {
      if (value === null || typeof value === "undefined") {
        return;
      }
      // KeePassXC protects the credential id, the private key and the user handle.
      fields[key] = protectedFieldNames.includes(key) ? kdbxweb.ProtectedValue.fromString(value) : value;
    });

    const file = await buildKdbxFile(fields);

    return new ImportResourcesFileEntity({ ref: "import-ref", file_type: "kdbx", file: file });
  }

  /**
   * Build the import entity of a kdbx file holding a single passkey entry.
   * @param {string} serializedPasskey The serialized passkey secret
   * @returns {Promise<ImportResourcesFileEntity>}
   */
  async function buildPasskeyImportEntity(serializedPasskey) {
    const file = await buildKdbxFile({
      Title: "Spaceship passkey",
      UserName: "66Ton99",
      URL: "https://www.spaceship.com",
      Notes: "",
      [PASSKEY_KDBX_FIELD_NAME]: kdbxweb.ProtectedValue.fromString(serializedPasskey),
    });

    return new ImportResourcesFileEntity({ ref: "import-ref", file_type: "kdbx", file: file });
  }

  it("should parse resources and folders", async () => {
    expect.assertions(12);
    const file = fs.readFileSync("./src/all/background_page/model/import/resources/kdbx/kdbx-not-protected.kdbx", {
      encoding: "base64",
    });
    const importDto = {
      ref: "import-ref",
      file_type: "kdbx",
      file: file,
    };
    const importEntity = new ImportResourcesFileEntity(importDto);
    const parser = new ResourcesKdbxImportParser(importEntity, resourceTypesCollection, metadataTypesSettings);
    await parser.parseImport();
    const expectedResourceType = resourceTypesCollection.items.find(
      (resourceType) => resourceType.slug === "password-and-description",
    );

    // Assert resources
    expect(importEntity.importResources.items).toHaveLength(4);
    const resource1Dto = buildExternalResourceDto(1, {
      folder_parent_path: "import-ref/Root/Folder 1/Folder 2",
      resource_type_id: expectedResourceType.id,
    });
    const resource2Dto = buildExternalResourceDto(2, {
      folder_parent_path: "import-ref/Root/Folder 1",
      resource_type_id: expectedResourceType.id,
    });
    const resource3Dto = buildExternalResourceDto(3, {
      folder_parent_path: "import-ref/Root/Folder 3/Folder 4",
      resource_type_id: expectedResourceType.id,
    });
    const resource4Dto = buildExternalResourceDto(4, {
      folder_parent_path: "import-ref/Root/Folder 2/Folder 1",
      resource_type_id: expectedResourceType.id,
    });
    expect(importEntity.importResources.toJSON()).toEqual([resource1Dto, resource2Dto, resource4Dto, resource3Dto]);

    // Assert folders
    expect(importEntity.importFolders.items).toHaveLength(9);
    const folderRefDto = { name: "import-ref", folder_parent_path: "" };
    expect(importEntity.importFolders.toJSON()).toEqual(expect.arrayContaining([folderRefDto]));
    const folderKdbxRootDto = { name: "Root", folder_parent_path: "import-ref" };
    expect(importEntity.importFolders.toJSON()).toEqual(expect.arrayContaining([folderKdbxRootDto]));
    const folder1RootDto = buildExternalFolderDto(1, { folder_parent_path: "import-ref/Root" });
    expect(importEntity.importFolders.toJSON()).toEqual(expect.arrayContaining([folder1RootDto]));
    const folder2Dto = buildExternalFolderDto(2, { folder_parent_path: "import-ref/Root/Folder 1" });
    expect(importEntity.importFolders.toJSON()).toEqual(expect.arrayContaining([folder2Dto]));
    const folder3Dto = buildExternalFolderDto(3, { folder_parent_path: "import-ref/Root" });
    expect(importEntity.importFolders.toJSON()).toEqual(expect.arrayContaining([folder3Dto]));
    const folder4Dto = buildExternalFolderDto(4, { folder_parent_path: "import-ref/Root/Folder 3" });
    expect(importEntity.importFolders.toJSON()).toEqual(expect.arrayContaining([folder4Dto]));
    const folder2RootDto = buildExternalFolderDto(2, { folder_parent_path: "import-ref/Root" });
    expect(importEntity.importFolders.toJSON()).toEqual(expect.arrayContaining([folder2RootDto]));
    const folder1Dto = buildExternalFolderDto(1, { folder_parent_path: "import-ref/Root/Folder 2" });
    expect(importEntity.importFolders.toJSON()).toEqual(expect.arrayContaining([folder1Dto]));
    const folder5Dto = buildExternalFolderDto(5, { folder_parent_path: "import-ref/Root" });
    expect(importEntity.importFolders.toJSON()).toEqual(expect.arrayContaining([folder5Dto]));
  });

  it("should parse resources with TOTP and folders", async () => {
    expect.assertions(6);
    const resourceTypesCollection = new ResourceTypesCollection(resourceTypesCollectionDto());
    const file = fs.readFileSync(
      "./src/all/background_page/model/import/resources/kdbx/kdbx-with-totp-protected-password.kdbx",
      { encoding: "base64" },
    );
    const importDto = {
      ref: "import-ref",
      file_type: "kdbx",
      file: file,
      options: {
        credentials: {
          password: "passbolt",
        },
      },
    };
    const importEntity = new ImportResourcesFileEntity(importDto);
    const parser = new ResourcesKdbxImportParser(importEntity, resourceTypesCollection, metadataTypesSettings);
    await parser.parseImport();

    // Assert resources
    const totp = defaultTotpDto({ secret_key: "TJSNMLGTCYOEMXZG" });
    expect(importEntity.importResources.items).toHaveLength(2);
    const resource1Dto = buildExternalResourceDto(1, {
      totp: totp,
      folder_parent_path: "import-ref/Root",
      resource_type_id: TEST_RESOURCE_TYPE_PASSWORD_DESCRIPTION_TOTP,
      expired: "2023-11-10T08:09:04.000Z",
    });
    expect(importEntity.importResources.toJSON()).toEqual(expect.arrayContaining([resource1Dto]));
    const resource2Dto = buildExternalResourceDto(2, {
      totp: totp,
      folder_parent_path: "import-ref/Root",
      resource_type_id: TEST_RESOURCE_TYPE_PASSWORD_DESCRIPTION_TOTP,
    });
    expect(importEntity.importResources.toJSON()).toEqual(expect.arrayContaining([resource2Dto]));

    // Assert folders
    expect(importEntity.importFolders.items).toHaveLength(2);
    const folderRefDto = { name: "import-ref", folder_parent_path: "" };
    expect(importEntity.importFolders.toJSON()).toEqual(expect.arrayContaining([folderRefDto]));
    const folderKdbxRootDto = { name: "Root", folder_parent_path: "import-ref" };
    expect(importEntity.importFolders.toJSON()).toEqual(expect.arrayContaining([folderKdbxRootDto]));
  });

  it("should parse resources with TOTP and folders from kdbx windows", async () => {
    expect.assertions(7);
    const resourceTypesCollection = new ResourceTypesCollection(resourceTypesCollectionDto());
    const file = fs.readFileSync(
      "./src/all/background_page/model/import/resources/kdbx/kdbx-windows-with-totp-protected-password.kdbx",
      { encoding: "base64" },
    );
    const importDto = {
      ref: "import-ref",
      file_type: "kdbx",
      file: file,
      options: {
        credentials: {
          password: "passbolt",
        },
      },
    };
    const importEntity = new ImportResourcesFileEntity(importDto);
    const parser = new ResourcesKdbxImportParser(importEntity, resourceTypesCollection, metadataTypesSettings);
    await parser.parseImport();

    // Assert resources
    const totp = defaultTotpDto({ secret_key: "THISISANOTHERSECRET" });
    const totp2 = defaultTotpDto({ secret_key: "THISISTOTPSECRT", algorithm: "SHA256", digits: 8, period: 60 });
    expect(importEntity.importResources.items).toHaveLength(3);
    const resource1Dto = buildExternalResourceDto(1, {
      folder_parent_path: "import-ref/Database",
      resource_type_id: TEST_RESOURCE_TYPE_PASSWORD_AND_DESCRIPTION,
    });
    expect(importEntity.importResources.toJSON()).toEqual(expect.arrayContaining([resource1Dto]));
    const resource2Dto = buildExternalResourceDto(2, {
      totp: totp,
      folder_parent_path: "import-ref/Database",
      resource_type_id: TEST_RESOURCE_TYPE_PASSWORD_DESCRIPTION_TOTP,
    });
    expect(importEntity.importResources.toJSON()).toEqual(expect.arrayContaining([resource2Dto]));
    const resource3Dto = buildExternalResourceDto(3, {
      totp: totp2,
      folder_parent_path: "import-ref/Database",
      resource_type_id: TEST_RESOURCE_TYPE_PASSWORD_DESCRIPTION_TOTP,
    });
    expect(importEntity.importResources.toJSON()).toEqual(expect.arrayContaining([resource3Dto]));

    // Assert folders
    expect(importEntity.importFolders.items).toHaveLength(2);
    const folderRefDto = { name: "import-ref", folder_parent_path: "" };
    expect(importEntity.importFolders.toJSON()).toEqual(expect.arrayContaining([folderRefDto]));
    const folderKdbxRootDto = { name: "Database", folder_parent_path: "import-ref" };
    expect(importEntity.importFolders.toJSON()).toEqual(expect.arrayContaining([folderKdbxRootDto]));
  });

  it("should catch and keep a reference of import resource entity validation error", async () => {
    expect.assertions(16);
    const file = fs.readFileSync(
      "./src/all/background_page/model/import/resources/kdbx/kdbx-content-error-not-protected.kdbx",
      { encoding: "base64" },
    );
    const importDto = {
      ref: "import-ref",
      file_type: "kdbx",
      file: file,
    };
    const importEntity = new ImportResourcesFileEntity(importDto);
    const parser = new ResourcesKdbxImportParser(importEntity, resourceTypesCollection, metadataTypesSettings);
    await parser.parseImport();
    const expectedResourceType = resourceTypesCollection.items.find(
      (resourceType) => resourceType.slug === "password-and-description",
    );

    // Assert resources
    expect(importEntity.importResources.items).toHaveLength(2);
    const resource1Dto = buildExternalResourceDto(1, {
      folder_parent_path: "import-ref/Root/Folder 1",
      resource_type_id: expectedResourceType.id,
    });
    expect(importEntity.importResources.toJSON()).toEqual(expect.arrayContaining([resource1Dto]));

    // Assert folders
    expect(importEntity.importFolders.items).toHaveLength(4);
    const folderRefDto = { name: "import-ref", folder_parent_path: "" };
    expect(importEntity.importFolders.toJSON()).toEqual(expect.arrayContaining([folderRefDto]));
    const folderKdbxRootDto = { name: "Root", folder_parent_path: "import-ref" };
    expect(importEntity.importFolders.toJSON()).toEqual(expect.arrayContaining([folderKdbxRootDto]));
    const folder1RootDto = buildExternalFolderDto(1, { folder_parent_path: "import-ref/Root" });
    expect(importEntity.importFolders.toJSON()).toEqual(expect.arrayContaining([folder1RootDto]));

    // Assert folders errors
    expect(importEntity.importFoldersErrors).toHaveLength(1);
    // Folder name exceeding max length
    let error = importEntity.importFoldersErrors[0];
    expect(error).toBeInstanceOf(ImportError);
    expect(error.sourceError).toBeInstanceOf(EntityValidationError);
    expect(error.sourceError.details).toHaveProperty("name");
    expect(error.data.name).toEqual(
      "too-long-folder-name-too-long-folder-name-too-long-folder-name-too-long-folder-nametoo-long-folder-name-too-long-folder-name-too-long-folder-name-too-long-folder-nametoo-long-folder-name-too-long-folder-name-too-long-folder-name-too-long-folder-nametoo-long-folder-name-too-long-folder-name-too-long-folder-name-too-long-folder-name",
    );

    // Assert resources errors
    expect(importEntity.importResourcesErrors).toHaveLength(1);
    error = importEntity.importResourcesErrors[0];
    expect(error).toBeInstanceOf(ImportError);
    expect(error.sourceError).toBeInstanceOf(EntityValidationError);
    expect(error.sourceError.details).toHaveProperty("name");
    const resourceName =
      "too-long-resource-name-too-long-resource-name-too-long-resource-name-too-long-resource-name-too-long-resource-name-too-long-resource-name-too-long-resource-name-too-long-resource-name-too-long-resource-name-too-long-resource-name-too-long-resource-name-too-long-resource-name-too-long-resource-name-too-long-resource-name";
    expect(error.data.name).toEqual(resourceName);
  });

  it("should import the expiration date", async () => {
    expect.assertions(2);
    const file = fs.readFileSync("./src/all/background_page/model/import/resources/kdbx/kdbx-protected-password.kdbx", {
      encoding: "base64",
    });
    const importDto = {
      ref: "import-ref",
      file_type: "kdbx",
      file: file,
      options: {
        credentials: {
          password: "passbolt",
        },
      },
    };
    const importEntity = new ImportResourcesFileEntity(importDto);
    const parser = new ResourcesKdbxImportParser(importEntity, resourceTypesCollection, metadataTypesSettings);
    await parser.parseImport();

    // Assert resources
    expect(importEntity.importResources.items).toHaveLength(2);
    expect(importEntity.importResources.items[1].expired).toStrictEqual("2020-11-16T23:00:42.000Z");
  });

  it("should import the icon and background color data if any", async () => {
    expect.assertions(6);

    const metadataTypesSettings = new MetadataTypesSettingsEntity(defaultMetadataTypesSettingsV6Dto());

    const file = fs.readFileSync(
      "./src/all/background_page/model/import/resources/kdbx/kdbx-protected-with-color-and-icon.kdbx",
      { encoding: "base64" },
    );
    const importDto = {
      ref: "import-ref",
      file_type: "kdbx",
      file: file,
      options: {
        credentials: {
          password: "passbolt",
        },
      },
    };
    const importEntity = new ImportResourcesFileEntity(importDto);
    const parser = new ResourcesKdbxImportParser(importEntity, resourceTypesCollection, metadataTypesSettings);
    await parser.parseImport();

    // Assert resources
    expect(importEntity.importResources.items).toHaveLength(2);
    expect(importEntity.importResources.items[0]._icon).toBeInstanceOf(IconEntity);
    expect(importEntity.importResources.items[0]._icon.type).toStrictEqual(ICON_TYPE_KEEPASS_ICON_SET);
    expect(importEntity.importResources.items[0]._icon.value).toStrictEqual(4);
    expect(importEntity.importResources.items[0]._icon.backgroundColor).toStrictEqual("#FF0000");
    expect(importEntity.importResources.items[1]._icon).toBeUndefined();
  });

  it("should import the multiple uris", async () => {
    expect.assertions(2);

    const metadataTypesSettings = new MetadataTypesSettingsEntity(defaultMetadataTypesSettingsV6Dto());

    const file = fs.readFileSync("./src/all/background_page/model/import/resources/kdbx/kdbx-multiple-uris.kdbx", {
      encoding: "base64",
    });
    const importDto = {
      ref: "import-ref",
      file_type: "kdbx",
      file: file,
      options: {
        credentials: {
          password: "passbolt",
        },
      },
    };
    const importEntity = new ImportResourcesFileEntity(importDto);
    const parser = new ResourcesKdbxImportParser(importEntity, resourceTypesCollection, metadataTypesSettings);
    await parser.parseImport();

    // Assert resources
    expect(importEntity.importResources.items).toHaveLength(1);
    expect(importEntity.importResources.items[0].uris).toEqual([
      "https://main.url",
      "https://additional1.url",
      "https://additional2.url",
      "https://additional3.url",
    ]);
  });

  it("should import max 32 multiple uris", async () => {
    expect.assertions(4);

    const metadataTypesSettings = new MetadataTypesSettingsEntity(defaultMetadataTypesSettingsV6Dto());

    const file = fs.readFileSync(
      "./src/all/background_page/model/import/resources/kdbx/kdbx-multiple-uris-with-33-entries.kdbx",
      { encoding: "base64" },
    );
    const importDto = {
      ref: "import-ref",
      file_type: "kdbx",
      file: file,
      options: {
        credentials: {
          password: "passbolt",
        },
      },
    };
    const importEntity = new ImportResourcesFileEntity(importDto);
    const parser = new ResourcesKdbxImportParser(importEntity, resourceTypesCollection, metadataTypesSettings);
    await parser.parseImport();

    // Assert resources
    expect(importEntity.importResources.items).toHaveLength(1);
    expect(importEntity.importResources.items[0].uris).toHaveLength(32);
    expect(importEntity.importResourcesErrors).toHaveLength(0);
    expect(importEntity.importResourcesWarnings).toHaveLength(1);
  });

  it("should import custom fields", async () => {
    expect.assertions(5);

    const metadataTypesSettings = new MetadataTypesSettingsEntity(defaultMetadataTypesSettingsV6Dto());

    const file = fs.readFileSync(
      "./src/all/background_page/model/import/resources/kdbx/kdbx-custom-fields-with-uris.kdbx",
      { encoding: "base64" },
    );
    const importDto = {
      ref: "import-ref",
      file_type: "kdbx",
      file: file,
      options: {
        credentials: {
          password: "passbolt",
        },
      },
    };
    const importEntity = new ImportResourcesFileEntity(importDto);
    const parser = new ResourcesKdbxImportParser(importEntity, resourceTypesCollection, metadataTypesSettings);
    await parser.parseImport();

    // Assert resources
    expect(importEntity.importResources.items).toHaveLength(1);
    expect(importEntity.importResources.items[0].customFields).toHaveLength(3);
    expect(importEntity.importResources.items[0].uris).toHaveLength(3);
    expect(importEntity.importResourcesErrors).toHaveLength(0);
    expect(importEntity.importResourcesWarnings).toHaveLength(0);
  });

  it("should import custom fields with protected values", async () => {
    expect.assertions(5);

    const metadataTypesSettings = new MetadataTypesSettingsEntity(defaultMetadataTypesSettingsV6Dto());

    const file = fs.readFileSync(
      "./src/all/background_page/model/import/resources/kdbx/kdbx-with-protected-custom-fields.kdbx",
      { encoding: "base64" },
    );
    const importDto = {
      ref: "import-ref",
      file_type: "kdbx",
      file: file,
      options: {
        credentials: {
          password: "passbolt",
        },
      },
    };
    const importEntity = new ImportResourcesFileEntity(importDto);
    const parser = new ResourcesKdbxImportParser(importEntity, resourceTypesCollection, metadataTypesSettings);
    await parser.parseImport();

    // Assert resources
    expect(importEntity.importResources.items).toHaveLength(1);
    expect(importEntity.importResources.items[0].customFields).toHaveLength(1);
    expect(importEntity.importResources.items[0].uris).toHaveLength(1);
    expect(importEntity.importResourcesErrors).toHaveLength(0);
    expect(importEntity.importResourcesWarnings).toHaveLength(0);
  });

  it("should not import custom fields  if the default is v4", async () => {
    expect.assertions(2);
    const file = fs.readFileSync(
      "./src/all/background_page/model/import/resources/kdbx/kdbx-custom-fields-with-uris.kdbx",
      { encoding: "base64" },
    );
    const importDto = {
      ref: "import-ref",
      file_type: "kdbx",
      file: file,
      options: {
        credentials: {
          password: "passbolt",
        },
      },
    };
    const importEntity = new ImportResourcesFileEntity(importDto);
    const parser = new ResourcesKdbxImportParser(importEntity, resourceTypesCollection, metadataTypesSettings);
    await parser.parseImport();

    // Assert resources
    expect(importEntity.importResources.items).toHaveLength(1);
    expect(importEntity.importResources.items[0].customFields).toBeNull();
  });
  it("should not import the icon if the default is v4", async () => {
    expect.assertions(3);
    const file = fs.readFileSync(
      "./src/all/background_page/model/import/resources/kdbx/kdbx-protected-with-color-and-icon.kdbx",
      { encoding: "base64" },
    );
    const importDto = {
      ref: "import-ref",
      file_type: "kdbx",
      file: file,
      options: {
        credentials: {
          password: "passbolt",
        },
      },
    };
    const importEntity = new ImportResourcesFileEntity(importDto);
    const parser = new ResourcesKdbxImportParser(importEntity, resourceTypesCollection, metadataTypesSettings);
    await parser.parseImport();

    // Assert resources
    expect(importEntity.importResources.items).toHaveLength(2);
    expect(importEntity.importResources.items[0]._icon).toBeUndefined();
    expect(importEntity.importResources.items[1]._icon).toBeUndefined();
  });
  it("should parse a passkey exported by Passly", async () => {
    expect.assertions(5);
    const passkey = defaultPasskeySecretDto();
    const resourceTypesCollection = new ResourceTypesCollection([
      ...resourceTypesCollectionDto(),
      passkeyResourceTypeDto(),
    ]);
    const metadataTypesSettings = new MetadataTypesSettingsEntity(defaultMetadataTypesSettingsV6Dto());
    const importEntity = await buildPasskeyImportEntity(JSON.stringify(passkey));

    const parser = new ResourcesKdbxImportParser(importEntity, resourceTypesCollection, metadataTypesSettings);
    await parser.parseImport();

    expect(importEntity.importResourcesErrors).toHaveLength(0);
    expect(importEntity.importResourcesWarnings).toHaveLength(0);
    expect(importEntity.importResources.items).toHaveLength(1);
    const resource = importEntity.importResources.items[0];
    expect(resource.resourceTypeId).toStrictEqual(passkeyResourceTypeDto().id);
    expect(resource.passkey).toStrictEqual(passkey);
  });

  it("should not import the passkey as a custom field", async () => {
    expect.assertions(2);
    const resourceTypesCollection = new ResourceTypesCollection([
      ...resourceTypesCollectionDto(),
      passkeyResourceTypeDto(),
    ]);
    const metadataTypesSettings = new MetadataTypesSettingsEntity(defaultMetadataTypesSettingsV6Dto());
    const importEntity = await buildPasskeyImportEntity(JSON.stringify(defaultPasskeySecretDto()));

    const parser = new ResourcesKdbxImportParser(importEntity, resourceTypesCollection, metadataTypesSettings);
    await parser.parseImport();

    const resource = importEntity.importResources.items[0];
    expect(resource.customFields).toBeNull();
    expect(resource.secretClear).toStrictEqual("");
  });

  it("should import the resource without its passkey if the organization does not support passkeys", async () => {
    expect.assertions(5);
    const resourceTypesCollection = new ResourceTypesCollection(resourceTypesCollectionDto());
    const metadataTypesSettings = new MetadataTypesSettingsEntity(defaultMetadataTypesSettingsV6Dto());
    const importEntity = await buildPasskeyImportEntity(JSON.stringify(defaultPasskeySecretDto()));

    const parser = new ResourcesKdbxImportParser(importEntity, resourceTypesCollection, metadataTypesSettings);
    await parser.parseImport();

    expect(importEntity.importResourcesErrors).toHaveLength(0);
    expect(importEntity.importResourcesWarnings[0]).toBeInstanceOf(ImportError);
    expect(importEntity.importResourcesWarnings[0].message).toStrictEqual(
      "Passkey content type not supported, the passkey was not imported",
    );
    // The passkey secret must not be kept in the resource, nor reported in the warning details.
    expect(importEntity.importResourcesWarnings[0].data.passkey).toBeUndefined();
    expect(importEntity.importResources.items[0].passkey).toBeNull();
  });

  it("should warn and import the resource without its passkey if the passkey cannot be read", async () => {
    expect.assertions(4);
    const resourceTypesCollection = new ResourceTypesCollection([
      ...resourceTypesCollectionDto(),
      passkeyResourceTypeDto(),
    ]);
    const metadataTypesSettings = new MetadataTypesSettingsEntity(defaultMetadataTypesSettingsV6Dto());
    const importEntity = await buildPasskeyImportEntity("not a passkey");

    const parser = new ResourcesKdbxImportParser(importEntity, resourceTypesCollection, metadataTypesSettings);
    await parser.parseImport();

    expect(importEntity.importResourcesErrors).toHaveLength(0);
    expect(importEntity.importResourcesWarnings[0].message).toStrictEqual(
      "Passkey could not be read and was not imported",
    );
    expect(importEntity.importResources.items).toHaveLength(1);
    expect(importEntity.importResources.items[0].passkey).toBeNull();
  });
  it("should parse a passkey exported by KeePassXC", async () => {
    expect.assertions(6);
    const resourceTypesCollection = new ResourceTypesCollection([
      ...resourceTypesCollectionDto(),
      passkeyResourceTypeDto(),
    ]);
    const metadataTypesSettings = new MetadataTypesSettingsEntity(defaultMetadataTypesSettingsV6Dto());
    const importEntity = await buildKeepassPasskeyImportEntity();

    const parser = new ResourcesKdbxImportParser(importEntity, resourceTypesCollection, metadataTypesSettings);
    await parser.parseImport();

    expect(importEntity.importResourcesErrors).toHaveLength(0);
    expect(importEntity.importResourcesWarnings).toHaveLength(0);
    expect(importEntity.importResources.items).toHaveLength(1);
    const resource = importEntity.importResources.items[0];
    expect(resource.resourceTypeId).toStrictEqual(passkeyResourceTypeDto().id);
    expect(resource.passkey).toEqual(
      expect.objectContaining({
        object_type: "PASSLY_PASSKEY",
        credential_id: "Y3JlZGVudGlhbC1pZA",
        rp_id: "www.spaceship.com",
        user_handle: "dXNlci1oYW5kbGU",
        user_name: "66Ton99",
        cose_alg: -7,
        sign_count: 0,
      }),
    );
    // The KeePassXC passkey attributes must not be imported as custom fields.
    expect(resource.customFields).toBeNull();
  });

  it("should import a KeePassXC entry holding both a password and a passkey as two resources", async () => {
    expect.assertions(7);
    const resourceTypesCollection = new ResourceTypesCollection([
      ...resourceTypesCollectionDto(),
      passkeyResourceTypeDto(),
    ]);
    const metadataTypesSettings = new MetadataTypesSettingsEntity(defaultMetadataTypesSettingsV6Dto());
    const importEntity = await buildKeepassPasskeyImportEntity(keepassPasskeyFieldsDto(), {
      Password: kdbxweb.ProtectedValue.fromString("Secret 1"),
    });

    const parser = new ResourcesKdbxImportParser(importEntity, resourceTypesCollection, metadataTypesSettings);
    await parser.parseImport();

    expect(importEntity.importResourcesErrors).toHaveLength(0);
    expect(importEntity.importResources.items).toHaveLength(2);
    const [passwordResource, passkeyResource] = importEntity.importResources.items;

    expect(passwordResource.name).toStrictEqual("www.spaceship.com");
    expect(passwordResource.secretClear).toStrictEqual("Secret 1");
    expect(passwordResource.passkey).toBeNull();

    expect(passkeyResource.name).toStrictEqual("www.spaceship.com passkey");
    expect(passkeyResource.resourceTypeId).toStrictEqual(passkeyResourceTypeDto().id);
  });

  it("should not split a KeePassXC entry when the organization does not support passkeys", async () => {
    expect.assertions(3);
    const resourceTypesCollection = new ResourceTypesCollection(resourceTypesCollectionDto());
    const metadataTypesSettings = new MetadataTypesSettingsEntity(defaultMetadataTypesSettingsV6Dto());
    const importEntity = await buildKeepassPasskeyImportEntity(keepassPasskeyFieldsDto(), {
      Password: kdbxweb.ProtectedValue.fromString("Secret 1"),
    });

    const parser = new ResourcesKdbxImportParser(importEntity, resourceTypesCollection, metadataTypesSettings);
    await parser.parseImport();

    expect(importEntity.importResources.items).toHaveLength(1);
    expect(importEntity.importResources.items[0].secretClear).toStrictEqual("Secret 1");
    expect(importEntity.importResourcesWarnings[0].message).toStrictEqual(
      "Passkey content type not supported, the passkey was not imported",
    );
  });

  it("should warn and import the resource without its passkey if the KeePassXC passkey is unusable", async () => {
    expect.assertions(3);
    const resourceTypesCollection = new ResourceTypesCollection([
      ...resourceTypesCollectionDto(),
      passkeyResourceTypeDto(),
    ]);
    const metadataTypesSettings = new MetadataTypesSettingsEntity(defaultMetadataTypesSettingsV6Dto());
    const importEntity = await buildKeepassPasskeyImportEntity(
      keepassPasskeyFieldsDto({ [KEEPASS_PASSKEY_FIELDS.PRIVATE_KEY_PEM]: "not a pem key" }),
    );

    const parser = new ResourcesKdbxImportParser(importEntity, resourceTypesCollection, metadataTypesSettings);
    await parser.parseImport();

    expect(importEntity.importResourcesErrors).toHaveLength(0);
    expect(importEntity.importResourcesWarnings[0].message).toStrictEqual(
      "Passkey could not be read and was not imported",
    );
    expect(importEntity.importResources.items[0].passkey).toBeNull();
  });
});
