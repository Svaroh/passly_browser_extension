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
import * as kdbxweb from "kdbxweb";
import MetadataTypesSettingsEntity from "passbolt-styleguide/src/shared/models/entity/metadata/metadataTypesSettingsEntity";
import {
  defaultMetadataTypesSettingsV4Dto,
  defaultMetadataTypesSettingsV6Dto,
} from "passbolt-styleguide/src/shared/models/entity/metadata/metadataTypesSettingsEntity.test.data";
import ResourceTypeSchemasDefinition from "passbolt-styleguide/src/shared/models/entity/resourceType/resourceTypeSchemasDefinition";
import ResourceTypesCollection from "passbolt-styleguide/src/shared/models/entity/resourceType/resourceTypesCollection";
import { resourceTypesCollectionDto } from "passbolt-styleguide/src/shared/models/entity/resourceType/resourceTypesCollection.test.data";
import { passkeyResourceTypeDto } from "../../passkey/passkeySecretDto.test.data";
import ExternalResourceEntity from "./entity/resource/external/externalResourceEntity";
import ExportResourcesFileEntity, { FORMAT_KDBX } from "./entity/export/exportResourcesFileEntity";
import ImportResourcesFileEntity from "./entity/import/importResourcesFileEntity";
import ResourcesKdbxExporter from "./export/resources/resourcesKdbxExporter";
import ResourcesKdbxImportParser from "./import/resources/resourcesKdbxImportParser";
import PlaintextEntity from "./entity/plaintext/plaintextEntity";
import {
  buildRoundTripResourceDto,
  extractSecretContent,
  KDBX_ROUND_TRIP_CASES,
  KDBX_ROUND_TRIP_STRUCTURAL_SECRET_PROPERTIES,
} from "./resourcesKdbxRoundTrip.test.data";

/**
 * A KDBX export followed by an import must give the resource back with its content, whatever the
 * resource type. This guards against a content type being silently exported without its secret, or
 * imported with the default content type.
 */
describe("Resources KDBX export / import round trip", () => {
  /**
   * Build the resource types available to the import, the passkey type included.
   * The collection is filtered in place by the import parser, so it cannot be shared between cases.
   * @returns {ResourceTypesCollection}
   */
  function buildResourceTypesCollection() {
    return new ResourceTypesCollection([...resourceTypesCollectionDto(), passkeyResourceTypeDto()]);
  }

  /**
   * Export a resource to a KDBX file, then import it back.
   * @param {object} externalResourceDto The resource to export
   * @param {ResourceTypesCollection} resourceTypesCollection The resource types available at import
   * @param {MetadataTypesSettingsEntity} metadataTypesSettings The organization content types settings
   * @returns {Promise<ImportResourcesFileEntity>}
   */
  async function exportAndImport(externalResourceDto, resourceTypesCollection, metadataTypesSettings) {
    const exportEntity = new ExportResourcesFileEntity({
      format: FORMAT_KDBX,
      export_resources: [externalResourceDto],
      export_folders: [],
    });
    await new ResourcesKdbxExporter(exportEntity).export();

    const importEntity = new ImportResourcesFileEntity({
      ref: "import-ref",
      file_type: "kdbx",
      file: kdbxweb.ByteUtils.bytesToBase64(new Uint8Array(exportEntity.file)),
    });
    const parser = new ResourcesKdbxImportParser(importEntity, resourceTypesCollection, metadataTypesSettings);
    await parser.parseImport();

    return importEntity;
  }

  it("covers every resource type of the resource type definitions", () => {
    expect.assertions(1);
    const coveredSlugs = KDBX_ROUND_TRIP_CASES.map((roundTripCase) => roundTripCase.slug).sort();
    const definedSlugs = Object.keys(ResourceTypeSchemasDefinition.SCHEMAS).sort();

    /*
     * A new resource type was added: give it export / import support, then cover it in
     * KDBX_ROUND_TRIP_CASES. Without it, resources of that type are exported without their secret
     * and imported with the default content type.
     */
    expect(coveredSlugs).toStrictEqual(definedSlugs);
  });

  describe.each(KDBX_ROUND_TRIP_CASES)("$slug", (roundTripCase) => {
    const isV4 = !roundTripCase.slug.startsWith("v5");
    const metadataTypesSettings = new MetadataTypesSettingsEntity(
      isV4 ? defaultMetadataTypesSettingsV4Dto() : defaultMetadataTypesSettingsV6Dto(),
    );

    it("exercises the whole secret definition of the resource type", () => {
      expect.assertions(1);
      const resourceType = buildResourceTypesCollection().getFirst("slug", roundTripCase.slug);
      const secretProperties = Object.keys(resourceType.definition.secret.properties || {}).filter(
        (property) => !KDBX_ROUND_TRIP_STRUCTURAL_SECRET_PROPERTIES.includes(property),
      );

      /*
       * A secret property was added to this resource type: cover it in KDBX_ROUND_TRIP_CASES, so
       * the round trip proves it survives an export followed by an import.
       */
      expect(roundTripCase.secretProperties).toEqual(expect.arrayContaining(secretProperties));
    });

    it("keeps the resource content through an export and an import", async () => {
      expect.assertions(4);
      const resourceTypesCollection = buildResourceTypesCollection();
      const externalResourceDto = buildRoundTripResourceDto(roundTripCase);

      const importEntity = await exportAndImport(externalResourceDto, resourceTypesCollection, metadataTypesSettings);

      expect(importEntity.importResourcesErrors).toHaveLength(0);
      // A fallback to the default content type means the content type is not supported by the round trip.
      expect(importEntity.importResourcesWarnings.map((warning) => warning.message)).toStrictEqual([]);
      expect(importEntity.importResources.items).toHaveLength(1);

      const importedResource = importEntity.importResources.items[0];
      const expectedContent = {
        ...extractSecretContent(new ExternalResourceEntity(externalResourceDto)),
        ...roundTripCase.expectedContent,
      };
      expect(extractSecretContent(importedResource)).toStrictEqual(expectedContent);
    });

    it("rebuilds a secret the import can encrypt for the imported content type", async () => {
      expect.assertions(2);
      const resourceTypesCollection = buildResourceTypesCollection();

      const importEntity = await exportAndImport(
        buildRoundTripResourceDto(roundTripCase),
        resourceTypesCollection,
        metadataTypesSettings,
      );

      const importedResource = importEntity.importResources.items[0];
      const resourceType = resourceTypesCollection.getFirstById(importedResource.resourceTypeId);
      const secretDto = importedResource.toSecretDto(resourceType);

      // The import validates the secret against the resource type definition before encrypting it.
      expect(() => new PlaintextEntity(secretDto, { schema: resourceType.definition.secret })).not.toThrow();

      /*
       * A secret holding nothing but its structural properties means the imported content was not
       * carried over to the secret, and would be encrypted empty.
       */
      const contentProperties = Object.keys(secretDto).filter(
        (property) => !KDBX_ROUND_TRIP_STRUCTURAL_SECRET_PROPERTIES.includes(property),
      );
      expect(contentProperties.length).toBeGreaterThan(0);
    });

    it("imports the resource back with the expected content type", async () => {
      expect.assertions(1);
      const resourceTypesCollection = buildResourceTypesCollection();

      const importEntity = await exportAndImport(
        buildRoundTripResourceDto(roundTripCase),
        resourceTypesCollection,
        metadataTypesSettings,
      );

      const importedResource = importEntity.importResources.items[0];
      const importedSlug = resourceTypesCollection.getFirstById(importedResource.resourceTypeId)?.slug;
      expect(importedSlug).toStrictEqual(roundTripCase.expectedSlug);
    });
  });
});
