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
 * @since         5.13.0
 */
import { v4 as uuidv4 } from "uuid";
import OfflineResourcesOPFSStorage from "./offlineResourcesOPFSStorage";
import {
  defaultResourceDto,
  resourceMetadataEncryptedDto,
} from "passbolt-styleguide/src/shared/models/entity/resource/resourceEntity.test.data";
import { defaultFavoriteDto } from "passbolt-styleguide/src/shared/models/entity/favorite/favoriteEntity.test.data";
import ResourcesCollection from "../../model/entity/resource/resourcesCollection";
import ResourceEntity from "../../model/entity/resource/resourceEntity";
import { metadata } from "passbolt-styleguide/test/fixture/encryptedMetadata/metadata";
import AccountEntity from "../../model/entity/account/accountEntity";
import { defaultAccountDto } from "../../model/entity/account/accountEntity.test.data";
import FavoriteEntity from "../../model/entity/favorite/favoriteEntity";
import TagEntity from "../../model/entity/tag/tagEntity";
import TagsCollection from "../../model/entity/tag/tagsCollection";
import { defaultTagDto } from "../../model/entity/tag/tagEntity.test.data";
import { defaultTagsCollectionDto } from "../../model/entity/tag/tagsCollection.test.data";

describe("OfflineResourcesOPFSStorage", () => {
  let account, storage;
  beforeEach(async () => {
    account = new AccountEntity(defaultAccountDto());
    storage = new OfflineResourcesOPFSStorage(account);
    // flush account related storage before each.
    await storage.flush();
  });

  describe("::get", () => {
    it("Should return undefined if nothing stored in the storage", async () => {
      expect.assertions(1);
      const result = await storage.get();
      expect(result).toBeUndefined();
    });

    it("Should return content stored in the OPFS storage", async () => {
      expect.assertions(3);
      const resourcesDto = [resourceMetadataEncryptedDto()];
      await storage._setOPFSStorage(storage.storageKey, resourcesDto);
      const result = await storage.get();
      expect(result).toEqual(expect.any(Array));
      expect(result).toHaveLength(1);
      expect(result).toEqual(resourcesDto);
    });

    it("Should initialize the cache when getting the data for the first time", async () => {
      expect.assertions(5);
      const resourcesDto = [resourceMetadataEncryptedDto()];
      await storage._setOPFSStorage(storage.storageKey, resourcesDto);
      expect(OfflineResourcesOPFSStorage._runtimeCachedData[account.id]).toBeUndefined();
      await storage.get();
      expect(OfflineResourcesOPFSStorage._runtimeCachedData[account.id]).toBeDefined();
      expect(OfflineResourcesOPFSStorage._runtimeCachedData[account.id]).toEqual(expect.any(Array));
      expect(OfflineResourcesOPFSStorage._runtimeCachedData[account.id]).toHaveLength(1);
      expect(OfflineResourcesOPFSStorage._runtimeCachedData[account.id]).toEqual(resourcesDto);
    });

    it("Should return content stored in the local storage from the cache if set", async () => {
      expect.assertions(4);
      const resourcesDto = [resourceMetadataEncryptedDto()];
      await storage._setOPFSStorage(storage.storageKey, resourcesDto);
      // call a first time to initialize the cache.
      expect(OfflineResourcesOPFSStorage._runtimeCachedData[account.id]).toBeUndefined();
      await storage.get();
      // delete voluntarily the local storage data to ensure it is not used.
      await storage.opfsStorage.delete(storage.storageKey);
      const result = await storage.get();
      expect(result).toEqual(expect.any(Array));
      expect(result).toHaveLength(1);
      expect(result).toEqual(resourcesDto);
    });
  });

  describe("::set", () => {
    it("Should throw if parameter is invalid.", async () => {
      expect.assertions(1);
      await expect(() => storage.set(42)).rejects.toThrow(
        "The `resourcesCollection` parameter should be of type ResourcesCollection",
      );
    });

    it("Should set OPFS storage with empty data", async () => {
      expect.assertions(2);
      const resources = new ResourcesCollection([]);
      await storage.set(resources);
      const storageData = await storage.opfsStorage.get(storage.storageKey);
      expect(storageData).toEqual(expect.any(Array));
      expect(storageData).toHaveLength(0);
    });

    it("Should store data in the OPFS storage", async () => {
      expect.assertions(3);
      const resourcesDto = [resourceMetadataEncryptedDto(), resourceMetadataEncryptedDto()];
      const resources = new ResourcesCollection(resourcesDto);
      await storage.set(resources);
      const storageData = await storage.opfsStorage.get(storage.storageKey);
      expect(storageData).toBeInstanceOf(Array);
      expect(storageData).toHaveLength(2);
      expect(storageData).toEqual(resources.toDto(OfflineResourcesOPFSStorage.DEFAULT_CONTAIN));
    });

    it("Should set the cache when setting the local storage", async () => {
      expect.assertions(5);
      const resourcesDto = [resourceMetadataEncryptedDto(), resourceMetadataEncryptedDto()];
      const resources = new ResourcesCollection(resourcesDto);
      expect(OfflineResourcesOPFSStorage._runtimeCachedData[account.id]).toBeUndefined();
      await storage.set(resources);
      expect(OfflineResourcesOPFSStorage._runtimeCachedData[account.id]).toBeDefined();
      expect(OfflineResourcesOPFSStorage._runtimeCachedData[account.id]).toEqual(expect.any(Array));
      expect(OfflineResourcesOPFSStorage._runtimeCachedData[account.id]).toHaveLength(2);
      expect(OfflineResourcesOPFSStorage._runtimeCachedData[account.id]).toEqual(
        resources.toDto(OfflineResourcesOPFSStorage.DEFAULT_CONTAIN),
      );
    });
  });

  describe("::getOfflineResourceById", () => {
    it("Should return undefined if the OPFS storage is not yet initialized", async () => {
      expect.assertions(1);
      const result = await storage.getOfflineResourceById(uuidv4());
      expect(result).toBeUndefined();
    });

    it("Should return nothing if the target resource is not found in the OPFS storage", async () => {
      expect.assertions(1);
      const resourcesDto = [resourceMetadataEncryptedDto(), resourceMetadataEncryptedDto()];
      await storage._setOPFSStorage(storage.storageKey, resourcesDto);
      const result = await storage.getOfflineResourceById(uuidv4());
      expect(result).toBeUndefined();
    });

    it("Should return the target resource if found in the OPFS storage", async () => {
      expect.assertions(2);
      const resourcesDto = [resourceMetadataEncryptedDto(), resourceMetadataEncryptedDto()];
      await storage._setOPFSStorage(storage.storageKey, resourcesDto);
      const result = await storage.getOfflineResourceById(resourcesDto[0].id);
      expect(result).toEqual(expect.any(Object));
      expect(result).toEqual(resourcesDto[0]);
    });
  });

  describe("::getOfflineResourcesByIds", () => {
    it("Should return undefined if the OPFS storage is not yet initialized", async () => {
      expect.assertions(1);
      const result = await storage.getOfflineResourcesByIds([uuidv4(), uuidv4()]);
      expect(result).toBeUndefined();
    });

    it("Should return nothing if the target resource is not found in the OPFS storage", async () => {
      expect.assertions(1);
      const resourcesDto = [resourceMetadataEncryptedDto(), resourceMetadataEncryptedDto()];
      await storage._setOPFSStorage(storage.storageKey, resourcesDto);
      const result = await storage.getOfflineResourcesByIds([uuidv4(), uuidv4()]);
      expect(result).toEqual([]);
    });

    it("Should return the target resources if found in the OPFS storage", async () => {
      expect.assertions(2);
      const resourcesDto = [
        resourceMetadataEncryptedDto(),
        resourceMetadataEncryptedDto(),
        resourceMetadataEncryptedDto(),
      ];
      await storage._setOPFSStorage(storage.storageKey, resourcesDto);
      const result = await storage.getOfflineResourcesByIds([resourcesDto[0].id, resourcesDto[2].id, uuidv4()]);
      expect(result).toEqual(expect.any(Array));
      expect(result).toEqual([resourcesDto[0], resourcesDto[2]]);
    });

    it("Should return the target resources if found in the OPFS storage", async () => {
      expect.assertions(2);
      const resourcesDto = [
        resourceMetadataEncryptedDto(),
        resourceMetadataEncryptedDto(),
        resourceMetadataEncryptedDto(),
      ];
      await storage._setOPFSStorage(storage.storageKey, resourcesDto);
      const result = await storage.getOfflineResourcesByIds([
        resourcesDto[0].id,
        resourcesDto[1].id,
        resourcesDto[2].id,
      ]);
      expect(result).toEqual(expect.any(Array));
      expect(result).toEqual(resourcesDto);
    });
  });

  describe("::addResource", () => {
    it("Should throw if no data passed as parameter", async () => {
      expect.assertions(1);
      const promise = storage.addResource();
      await expect(promise).rejects.toThrow("OfflineResourcesOPFSStorage expects a ResourceEntity to be set");
    });

    it("Should throw if the resource parameter is not a ResourceEntity", async () => {
      expect.assertions(1);
      const promise = storage.addResource(42);
      await expect(promise).rejects.toThrow("OfflineResourcesOPFSStorage expects an object of type ResourceEntity");
    });

    it("Should throw if the resource does not validate", async () => {
      expect.assertions(1);
      const resourceDto = resourceMetadataEncryptedDto();
      delete resourceDto.id;
      const resource = new ResourceEntity(resourceDto);
      const promise = storage.addResource(resource);
      await expect(promise).rejects.toThrow("OfflineResourcesOPFSStorage expects ResourceEntity id to be set");
    });

    it("Should store a new resource", async () => {
      expect.assertions(3);
      const resourceDto = resourceMetadataEncryptedDto();
      const resource = new ResourceEntity(resourceDto);
      await storage.addResource(resource);
      const storageData = await storage.opfsStorage.get(storage.storageKey);
      expect(storageData).toEqual(expect.any(Array));
      expect(storageData).toHaveLength(1);
      expect(storageData[0]).toEqual(resourceDto);
    });

    it("Should update the cache with the added resource", async () => {
      expect.assertions(5);
      const resourceDto = resourceMetadataEncryptedDto();
      const resource = new ResourceEntity(resourceDto);
      expect(OfflineResourcesOPFSStorage._runtimeCachedData[account.id]).toBeUndefined();
      await storage.addResource(resource);
      expect(OfflineResourcesOPFSStorage._runtimeCachedData[account.id]).toBeDefined();
      expect(OfflineResourcesOPFSStorage._runtimeCachedData[account.id]).toEqual(expect.any(Array));
      expect(OfflineResourcesOPFSStorage._runtimeCachedData[account.id]).toHaveLength(1);
      expect(OfflineResourcesOPFSStorage._runtimeCachedData[account.id][0]).toEqual(
        ResourceEntity.transformDtoFromV4toV5(resourceDto),
      );
    });
  });

  describe("::addResources", () => {
    it("Should throw if no data passed as parameter", async () => {
      expect.assertions(1);
      const promise = storage.addResources();
      await expect(promise).rejects.toThrow("he `resources` parameter should be of type ResourcesCollection");
    });

    it("Should throw if the resourcesEntities parameter is not an array", async () => {
      expect.assertions(1);
      const promise = storage.addResources(42);
      await expect(promise).rejects.toThrow("he `resources` parameter should be of type ResourcesCollection");
    });

    it("Should throw if one of the resources does not validate", async () => {
      expect.assertions(1);
      const resourceDto1 = resourceMetadataEncryptedDto();
      delete resourceDto1.id;
      const resource1 = new ResourceEntity(resourceDto1);
      const resource2 = new ResourceEntity(resourceMetadataEncryptedDto());
      const resourcesArr = new ResourcesCollection([resource1, resource2]);
      const promise = storage.addResources(resourcesArr);
      await expect(promise).rejects.toThrow("OfflineResourcesOPFSStorage expects ResourceEntity id to be set");
    });

    it("Should store new resources", async () => {
      expect.assertions(4);
      const resourceDto1 = resourceMetadataEncryptedDto();
      const resource1 = new ResourceEntity(resourceDto1);
      const resourceDto2 = resourceMetadataEncryptedDto();
      const resource2 = new ResourceEntity(resourceDto2);
      const resourcesArr = new ResourcesCollection([resource1, resource2]);
      await storage.addResources(resourcesArr);

      const storageData = await storage.opfsStorage.get(storage.storageKey);
      expect(storageData).toEqual(expect.any(Array));
      expect(storageData).toHaveLength(2);
      expect(storageData[0]).toEqual(ResourceEntity.transformDtoFromV4toV5(resourceDto1));
      expect(storageData[1]).toEqual(ResourceEntity.transformDtoFromV4toV5(resourceDto2));
    });

    it("Should update the cache with the added resources", async () => {
      expect.assertions(6);
      const resourceDto1 = resourceMetadataEncryptedDto();
      const resource1 = new ResourceEntity(resourceDto1);
      const resourceDto2 = resourceMetadataEncryptedDto();
      const resource2 = new ResourceEntity(resourceDto2);
      const resourcesArr = new ResourcesCollection([resource1, resource2]);
      expect(OfflineResourcesOPFSStorage._runtimeCachedData[account.id]).toBeUndefined();
      await storage.addResources(resourcesArr);
      expect(OfflineResourcesOPFSStorage._runtimeCachedData[account.id]).toBeDefined();
      expect(OfflineResourcesOPFSStorage._runtimeCachedData[account.id]).toEqual(expect.any(Array));
      expect(OfflineResourcesOPFSStorage._runtimeCachedData[account.id]).toHaveLength(2);
      expect(OfflineResourcesOPFSStorage._runtimeCachedData[account.id][0]).toEqual(
        ResourceEntity.transformDtoFromV4toV5(resourceDto1),
      );
      expect(OfflineResourcesOPFSStorage._runtimeCachedData[account.id][1]).toEqual(
        ResourceEntity.transformDtoFromV4toV5(resourceDto2),
      );
    });
  });

  describe("::updateResource", () => {
    it("Should throw if no data passed as parameter", async () => {
      expect.assertions(1);
      const promise = storage.updateResource();
      await expect(promise).rejects.toThrow("OfflineResourcesOPFSStorage expects a ResourceEntity to be set");
    });

    it("Should throw if the resource parameter is not a ResourceEntity", async () => {
      expect.assertions(1);
      const promise = storage.updateResource(42);
      await expect(promise).rejects.toThrow("OfflineResourcesOPFSStorage expects an object of type ResourceEntity");
    });

    it("Should throw if the resource does not validate", async () => {
      expect.assertions(1);
      const resourceDto = resourceMetadataEncryptedDto();
      delete resourceDto.id;
      const resource = new ResourceEntity(resourceDto);
      const promise = storage.updateResource(resource);
      await expect(promise).rejects.toThrow("OfflineResourcesOPFSStorage expects ResourceEntity id to be set");
    });

    it("Should throw if the resource is not found in the OPFS storage", async () => {
      expect.assertions(1);
      const resourceDto = resourceMetadataEncryptedDto();
      const resource = new ResourceEntity(resourceDto);
      const promise = storage.updateResource(resource);
      await expect(promise).rejects.toThrow("The offline resource could not be found in the OPFS storage");
    });

    it("Should update the resource", async () => {
      expect.assertions(4);
      const resourceDto = resourceMetadataEncryptedDto();
      const resourcesDtos = [resourceDto];
      await storage._setOPFSStorage(storage.storageKey, resourcesDtos);
      const resource = new ResourceEntity({ ...resourceDto, expired: "2022-03-04T13:59:11+00:00" });
      await storage.updateResource(resource);
      const storageData = await storage.opfsStorage.get(storage.storageKey);
      expect(storageData).toEqual(expect.any(Array));
      expect(storageData).toHaveLength(1);
      expect(storageData[0]).toEqual(resource.toDto(OfflineResourcesOPFSStorage.DEFAULT_CONTAIN));
      expect(storageData[0].expired).not.toEqual(resourceDto.expired);
    });

    it("Should update the cache with the updated resource", async () => {
      expect.assertions(6);
      const resourceDto = resourceMetadataEncryptedDto();
      const resourcesDtos = [resourceDto];
      await storage._setOPFSStorage(storage.storageKey, resourcesDtos);
      const resource = new ResourceEntity({ ...resourceDto, expired: "2022-03-04T13:59:11+00:00" });
      expect(OfflineResourcesOPFSStorage._runtimeCachedData[account.id]).toBeUndefined();
      await storage.updateResource(resource);
      expect(OfflineResourcesOPFSStorage._runtimeCachedData[account.id]).toBeDefined();
      expect(OfflineResourcesOPFSStorage._runtimeCachedData[account.id]).toEqual(expect.any(Array));
      expect(OfflineResourcesOPFSStorage._runtimeCachedData[account.id]).toHaveLength(1);
      expect(OfflineResourcesOPFSStorage._runtimeCachedData[account.id][0]).toEqual(
        resource.toDto(OfflineResourcesOPFSStorage.DEFAULT_CONTAIN),
      );
      expect(OfflineResourcesOPFSStorage._runtimeCachedData[account.id][0].expired).not.toEqual(resourceDto.expired);
    });
  });

  describe("::updateResourceFavorite", () => {
    it("Should throw if no data passed as parameter", async () => {
      expect.assertions(1);
      const promise = storage.updateResourceFavorite();
      await expect(promise).rejects.toThrow("The parameter resourceId should be a UUID.");
    });

    it("Should throw if the resource parameter is not a uuid", async () => {
      expect.assertions(1);
      const promise = storage.updateResourceFavorite(42);
      await expect(promise).rejects.toThrow("The parameter resourceId should be a UUID.");
    });

    it("Should throw if the resource parameter is not a FavoriteEntity", async () => {
      expect.assertions(1);
      const promise = storage.updateResourceFavorite(uuidv4(), {});
      await expect(promise).rejects.toThrow("The `favoriteEntity` parameter should be of type FavoriteEntity");
    });

    it("Should throw if the resource is not found in the OPFS storage", async () => {
      expect.assertions(1);
      const favoriteDto = defaultFavoriteDto();
      const favorite = new FavoriteEntity(favoriteDto);
      const promise = storage.updateResourceFavorite(uuidv4(), favorite);
      await expect(promise).rejects.toThrow("The offline resource could not be found in the OPFS storage");
    });

    it("Should update the resource favorite", async () => {
      expect.assertions(4);
      const resourceDto = resourceMetadataEncryptedDto();
      const resourcesDtos = [resourceDto];
      await storage._setOPFSStorage(storage.storageKey, resourcesDtos);
      const favoriteDto = defaultFavoriteDto();
      const favorite = new FavoriteEntity(favoriteDto);
      await storage.updateResourceFavorite(resourceDto.id, favorite);
      const storageData = await storage.opfsStorage.get(storage.storageKey);
      expect(storageData).toEqual(expect.any(Array));
      expect(storageData).toHaveLength(1);
      expect(storageData[0].favorite).toEqual(favoriteDto);
      expect(storageData[0]).not.toEqual(resourceDto);
    });

    it("Should update the cache with the updated resource", async () => {
      expect.assertions(6);
      const resourceDto = resourceMetadataEncryptedDto();
      const resourcesDtos = [resourceDto];
      await storage._setOPFSStorage(storage.storageKey, resourcesDtos);
      const favoriteDto = defaultFavoriteDto();
      const favorite = new FavoriteEntity(favoriteDto);
      expect(OfflineResourcesOPFSStorage._runtimeCachedData[account.id]).toBeUndefined();
      await storage.updateResourceFavorite(resourceDto.id, favorite);
      expect(OfflineResourcesOPFSStorage._runtimeCachedData[account.id]).toBeDefined();
      expect(OfflineResourcesOPFSStorage._runtimeCachedData[account.id]).toEqual(expect.any(Array));
      expect(OfflineResourcesOPFSStorage._runtimeCachedData[account.id]).toHaveLength(1);
      expect(OfflineResourcesOPFSStorage._runtimeCachedData[account.id][0].favorite).toEqual(favoriteDto);
      expect(OfflineResourcesOPFSStorage._runtimeCachedData[account.id][0]).not.toEqual(resourceDto);
    });
  });

  describe("::updateResourceTags", () => {
    it("Should throw if no data passed as parameter", async () => {
      expect.assertions(1);
      const promise = storage.updateResourceTags();
      await expect(promise).rejects.toThrow("The parameter resourceId should be a UUID.");
    });

    it("Should throw if the resource parameter is not a uuid", async () => {
      expect.assertions(1);
      const promise = storage.updateResourceTags(42);
      await expect(promise).rejects.toThrow("The parameter resourceId should be a UUID.");
    });

    it("Should throw if the tags parameter is not a TagsCollection", async () => {
      expect.assertions(1);
      const promise = storage.updateResourceTags(uuidv4(), {});
      await expect(promise).rejects.toThrow("The `tagsCollection` parameter should be of type TagsCollection");
    });

    it("Should not write in the storage if the resource is not cached offline", async () => {
      expect.assertions(2);
      const resourceDto = resourceMetadataEncryptedDto();
      await storage._setOPFSStorage(storage.storageKey, [resourceDto]);
      jest.spyOn(storage, "_setOPFSStorage");
      const tags = new TagsCollection(defaultTagsCollectionDto());
      await storage.updateResourceTags(uuidv4(), tags);
      expect(storage._setOPFSStorage).not.toHaveBeenCalled();
      expect(await storage.opfsStorage.get(storage.storageKey)).toEqual([resourceDto]);
    });

    it("Should update the resource tags", async () => {
      expect.assertions(3);
      const tagsDto = defaultTagsCollectionDto();
      const resourceDto = resourceMetadataEncryptedDto({ tags: [defaultTagDto()] });
      await storage._setOPFSStorage(storage.storageKey, [resourceDto]);
      await storage.updateResourceTags(resourceDto.id, new TagsCollection(tagsDto));
      const storageData = await storage.opfsStorage.get(storage.storageKey);
      expect(storageData).toEqual(expect.any(Array));
      expect(storageData).toHaveLength(1);
      expect(storageData[0].tags).toEqual(tagsDto);
    });

    it("Should update the cache with the updated resource", async () => {
      expect.assertions(3);
      const tagsDto = defaultTagsCollectionDto();
      const resourceDto = resourceMetadataEncryptedDto({ tags: [defaultTagDto()] });
      await storage._setOPFSStorage(storage.storageKey, [resourceDto]);
      expect(OfflineResourcesOPFSStorage._runtimeCachedData[account.id]).toBeUndefined();
      await storage.updateResourceTags(resourceDto.id, new TagsCollection(tagsDto));
      expect(OfflineResourcesOPFSStorage._runtimeCachedData[account.id]).toHaveLength(1);
      expect(OfflineResourcesOPFSStorage._runtimeCachedData[account.id][0].tags).toEqual(tagsDto);
    });
  });

  describe("::updateResourcesTags", () => {
    it("Should throw if no data passed as parameter", async () => {
      expect.assertions(1);
      const promise = storage.updateResourcesTags();
      await expect(promise).rejects.toThrow(
        "The `resourcesCollection` parameter should be of type ResourcesCollection",
      );
    });

    it("Should throw if the resourcesCollection parameter is not a ResourcesCollection", async () => {
      expect.assertions(1);
      const promise = storage.updateResourcesTags(42);
      await expect(promise).rejects.toThrow(
        "The `resourcesCollection` parameter should be of type ResourcesCollection",
      );
    });

    it("Should update the tags of the cached resources and ignore the others", async () => {
      expect.assertions(4);
      const tagsDto = defaultTagsCollectionDto();
      const cachedResourceDto = resourceMetadataEncryptedDto({ tags: [defaultTagDto()] });
      const otherCachedResourceDto = resourceMetadataEncryptedDto({ tags: [defaultTagDto()] });
      await storage._setOPFSStorage(storage.storageKey, [cachedResourceDto, otherCachedResourceDto]);
      const resourcesCollection = new ResourcesCollection([
        defaultResourceDto({ id: cachedResourceDto.id, tags: tagsDto }),
        // Not cached offline, it should be ignored.
        defaultResourceDto({ tags: tagsDto }),
      ]);
      await storage.updateResourcesTags(resourcesCollection);
      const storageData = await storage.opfsStorage.get(storage.storageKey);
      expect(storageData).toHaveLength(2);
      expect(storageData[0].tags).toEqual(tagsDto);
      expect(storageData[1].tags).toEqual(otherCachedResourceDto.tags);
      expect(OfflineResourcesOPFSStorage._runtimeCachedData[account.id][0].tags).toEqual(tagsDto);
    });

    it("Should empty the tags of a resource having none", async () => {
      expect.assertions(1);
      const cachedResourceDto = resourceMetadataEncryptedDto({ tags: [defaultTagDto()] });
      await storage._setOPFSStorage(storage.storageKey, [cachedResourceDto]);
      const resourcesCollection = new ResourcesCollection([defaultResourceDto({ id: cachedResourceDto.id })]);
      await storage.updateResourcesTags(resourcesCollection);
      const storageData = await storage.opfsStorage.get(storage.storageKey);
      expect(storageData[0].tags).toEqual([]);
    });

    it("Should not write in the storage if none of the resources is cached offline", async () => {
      expect.assertions(1);
      const cachedResourceDto = resourceMetadataEncryptedDto();
      await storage._setOPFSStorage(storage.storageKey, [cachedResourceDto]);
      jest.spyOn(storage, "_setOPFSStorage");
      const resourcesCollection = new ResourcesCollection([defaultResourceDto({ tags: defaultTagsCollectionDto() })]);
      await storage.updateResourcesTags(resourcesCollection);
      expect(storage._setOPFSStorage).not.toHaveBeenCalled();
    });
  });

  describe("::replaceTag", () => {
    it("Should throw if no data passed as parameter", async () => {
      expect.assertions(1);
      const promise = storage.replaceTag();
      await expect(promise).rejects.toThrow("The parameter tagId should be a UUID.");
    });

    it("Should throw if the tag parameter is not a uuid", async () => {
      expect.assertions(1);
      const promise = storage.replaceTag(42);
      await expect(promise).rejects.toThrow("The parameter tagId should be a UUID.");
    });

    it("Should throw if the tag parameter is not a TagEntity", async () => {
      expect.assertions(1);
      const promise = storage.replaceTag(uuidv4(), {});
      await expect(promise).rejects.toThrow("The `tagEntity` parameter should be of type TagEntity");
    });

    it("Should replace the tag in every resource holding it", async () => {
      expect.assertions(4);
      const tagDto = defaultTagDto({ slug: "tag-to-rename" });
      const untouchedTagDto = defaultTagDto({ slug: "untouched-tag" });
      const resourceDto = resourceMetadataEncryptedDto({ tags: [untouchedTagDto, tagDto] });
      const otherResourceDto = resourceMetadataEncryptedDto({ tags: [tagDto] });
      const resourceWithoutTagDto = resourceMetadataEncryptedDto({ tags: [untouchedTagDto] });
      await storage._setOPFSStorage(storage.storageKey, [resourceDto, otherResourceDto, resourceWithoutTagDto]);
      const renamedTagDto = { ...tagDto, slug: "renamed-tag" };
      await storage.replaceTag(tagDto.id, new TagEntity(renamedTagDto));
      const storageData = await storage.opfsStorage.get(storage.storageKey);
      expect(storageData[0].tags).toEqual([untouchedTagDto, renamedTagDto]);
      expect(storageData[1].tags).toEqual([renamedTagDto]);
      expect(storageData[2].tags).toEqual([untouchedTagDto]);
      expect(OfflineResourcesOPFSStorage._runtimeCachedData[account.id][1].tags).toEqual([renamedTagDto]);
    });

    it("Should not write in the storage if no resource holds the tag", async () => {
      expect.assertions(1);
      const resourceDto = resourceMetadataEncryptedDto({ tags: [defaultTagDto()] });
      await storage._setOPFSStorage(storage.storageKey, [resourceDto]);
      jest.spyOn(storage, "_setOPFSStorage");
      const tagDto = defaultTagDto();
      await storage.replaceTag(tagDto.id, new TagEntity(tagDto));
      expect(storage._setOPFSStorage).not.toHaveBeenCalled();
    });
  });

  describe("::removeTagById", () => {
    it("Should throw if no data passed as parameter", async () => {
      expect.assertions(1);
      const promise = storage.removeTagById();
      await expect(promise).rejects.toThrow("The parameter tagId should be a UUID.");
    });

    it("Should throw if the tag parameter is not a uuid", async () => {
      expect.assertions(1);
      const promise = storage.removeTagById(42);
      await expect(promise).rejects.toThrow("The parameter tagId should be a UUID.");
    });

    it("Should remove the tag from every resource holding it", async () => {
      expect.assertions(4);
      const tagDto = defaultTagDto({ slug: "tag-to-delete" });
      const untouchedTagDto = defaultTagDto({ slug: "untouched-tag" });
      const resourceDto = resourceMetadataEncryptedDto({ tags: [untouchedTagDto, tagDto] });
      const otherResourceDto = resourceMetadataEncryptedDto({ tags: [tagDto] });
      const resourceWithoutTagDto = resourceMetadataEncryptedDto({ tags: [untouchedTagDto] });
      await storage._setOPFSStorage(storage.storageKey, [resourceDto, otherResourceDto, resourceWithoutTagDto]);
      await storage.removeTagById(tagDto.id);
      const storageData = await storage.opfsStorage.get(storage.storageKey);
      expect(storageData[0].tags).toEqual([untouchedTagDto]);
      expect(storageData[1].tags).toEqual([]);
      expect(storageData[2].tags).toEqual([untouchedTagDto]);
      expect(OfflineResourcesOPFSStorage._runtimeCachedData[account.id][1].tags).toEqual([]);
    });

    it("Should not write in the storage if no resource holds the tag", async () => {
      expect.assertions(1);
      const resourceDto = resourceMetadataEncryptedDto({ tags: [defaultTagDto()] });
      await storage._setOPFSStorage(storage.storageKey, [resourceDto]);
      jest.spyOn(storage, "_setOPFSStorage");
      await storage.removeTagById(uuidv4());
      expect(storage._setOPFSStorage).not.toHaveBeenCalled();
    });
  });

  describe("::updateResourcesCollection", () => {
    it("Should throw if no data passed as parameter", async () => {
      expect.assertions(1);
      const promise = storage.updateResourcesCollection();
      await expect(promise).rejects.toThrow("The parameter resourcesEntities should be of ResourcesCollection type.");
    });

    it("Should throw if the resourcesEntities parameter is not an array", async () => {
      expect.assertions(1);
      const promise = storage.updateResourcesCollection(42);
      await expect(promise).rejects.toThrow("The parameter resourcesEntities should be of ResourcesCollection type.");
    });

    it("Should throw if one of the resources does not validate", async () => {
      expect.assertions(1);
      const resourceDto1 = resourceMetadataEncryptedDto();
      delete resourceDto1.id;
      const resourceDto2 = resourceMetadataEncryptedDto();
      const resources = new ResourcesCollection([resourceDto1, resourceDto2]);
      const promise = storage.updateResourcesCollection(resources);
      await expect(promise).rejects.toThrow("OfflineResourcesOPFSStorage expects ResourceEntity id to be set");
    });

    it("Should throw if one of the resource is not found in the OPFS storage", async () => {
      expect.assertions(1);

      const resourceDto = resourceMetadataEncryptedDto();
      const resources = new ResourcesCollection([resourceDto]);

      const promise = storage.updateResourcesCollection(resources);
      await expect(promise).rejects.toThrow("The resource could not be found in the OPFS storage");
    });

    it("Should update resources", async () => {
      expect.assertions(6);
      const resourceDto1 = resourceMetadataEncryptedDto();
      const resourceDto2 = resourceMetadataEncryptedDto();
      const resourceDto3 = resourceMetadataEncryptedDto();
      const resourceDto4 = resourceMetadataEncryptedDto();
      const resourcesDtos = [resourceDto1, resourceDto2, resourceDto3, resourceDto4];
      await storage._setOPFSStorage(storage.storageKey, resourcesDtos);
      const resources = new ResourcesCollection([
        resourceDto1,
        { ...resourceDto2, name: "Resource 2 name update" },
        resourceDto3,
        { ...resourceDto4, name: "Resource 4 name update" },
      ]);
      await storage.updateResourcesCollection(resources);
      const storageData = await storage.opfsStorage.get(storage.storageKey);
      expect(storageData).toEqual(expect.any(Array));
      expect(storageData).toHaveLength(4);
      expect(storageData[0]).toEqual(ResourceEntity.transformDtoFromV4toV5(resourceDto1));
      expect(storageData[1]).toEqual(
        ResourceEntity.transformDtoFromV4toV5({ ...resourceDto2, name: "Resource 2 name update" }),
      );
      expect(storageData[2]).toEqual(ResourceEntity.transformDtoFromV4toV5(resourceDto3));
      expect(storageData[3]).toEqual(
        ResourceEntity.transformDtoFromV4toV5({ ...resourceDto4, name: "Resource 4 name update" }),
      );
    });

    it("Should update cache when updating resources", async () => {
      expect.assertions(8);
      const resourceDto1 = resourceMetadataEncryptedDto();
      const resourceDto2 = resourceMetadataEncryptedDto();
      const resourceDto3 = resourceMetadataEncryptedDto();
      const resourceDto4 = resourceMetadataEncryptedDto();
      const resourcesDtos = [resourceDto1, resourceDto2, resourceDto3, resourceDto4];
      await storage._setOPFSStorage(storage.storageKey, resourcesDtos);
      const resources = new ResourcesCollection([
        resourceDto1,
        { ...resourceDto2, name: "Resource 2 name update" },
        resourceDto3,
        { ...resourceDto4, name: "Resource 4 name update" },
      ]);
      expect(OfflineResourcesOPFSStorage._runtimeCachedData[account.id]).toBeUndefined();
      await storage.updateResourcesCollection(resources);
      expect(OfflineResourcesOPFSStorage._runtimeCachedData[account.id]).toBeDefined();
      expect(OfflineResourcesOPFSStorage._runtimeCachedData[account.id]).toEqual(expect.any(Array));
      expect(OfflineResourcesOPFSStorage._runtimeCachedData[account.id]).toHaveLength(4);
      expect(OfflineResourcesOPFSStorage._runtimeCachedData[account.id][0]).toEqual(
        ResourceEntity.transformDtoFromV4toV5(resourceDto1),
      );
      expect(OfflineResourcesOPFSStorage._runtimeCachedData[account.id][1]).toEqual(
        ResourceEntity.transformDtoFromV4toV5({ ...resourceDto2, name: "Resource 2 name update" }),
      );
      expect(OfflineResourcesOPFSStorage._runtimeCachedData[account.id][2]).toEqual(
        ResourceEntity.transformDtoFromV4toV5(resourceDto3),
      );
      expect(OfflineResourcesOPFSStorage._runtimeCachedData[account.id][3]).toEqual(
        ResourceEntity.transformDtoFromV4toV5({ ...resourceDto4, name: "Resource 4 name update" }),
      );
    });
  });
  describe("::addOrReplaceResourcesCollection", () => {
    it("Should throw if no data passed as parameter", async () => {
      expect.assertions(1);
      const promise = storage.addOrReplaceResourcesCollection();
      await expect(promise).rejects.toThrow("The parameter resourcesEntities should be of ResourcesCollection type.");
    });

    it("Should throw if the resourcesEntities parameter is not an array", async () => {
      expect.assertions(1);
      const promise = storage.addOrReplaceResourcesCollection(42);
      await expect(promise).rejects.toThrow("The parameter resourcesEntities should be of ResourcesCollection type.");
    });

    it("Should throw if one of the resources does not validate", async () => {
      expect.assertions(1);
      const resourceDto1 = resourceMetadataEncryptedDto();
      delete resourceDto1.id;
      const resourceDto2 = resourceMetadataEncryptedDto();
      const resources = new ResourcesCollection([resourceDto1, resourceDto2]);
      const promise = storage.addOrReplaceResourcesCollection(resources);
      await expect(promise).rejects.toThrow("OfflineResourcesOPFSStorage expects ResourceEntity id to be set");
    });

    it("Should add the resource if one of the resource is not found in the OPFS storage", async () => {
      expect.assertions(3);

      const resourceDto = resourceMetadataEncryptedDto();
      const resources = new ResourcesCollection([resourceDto]);
      await storage.addOrReplaceResourcesCollection(resources);
      const storageData = await storage.opfsStorage.get(storage.storageKey);

      expect(storageData).toEqual(expect.any(Array));
      expect(storageData).toHaveLength(1);
      expect(storageData[0]).toEqual(ResourceEntity.transformDtoFromV4toV5(resourceDto));
    });

    it("Should update resources", async () => {
      expect.assertions(6);
      const resourceDto1 = resourceMetadataEncryptedDto();
      const resourceDto2 = resourceMetadataEncryptedDto();
      const resourceDto3 = resourceMetadataEncryptedDto();
      const resourceDto4 = resourceMetadataEncryptedDto();
      const resourcesDtos = [resourceDto1, resourceDto2, resourceDto3, resourceDto4];
      await storage._setOPFSStorage(storage.storageKey, resourcesDtos);
      const resources = new ResourcesCollection([
        resourceDto1,
        { ...resourceDto2, name: "Resource 2 name update" },
        resourceDto3,
        { ...resourceDto4, name: "Resource 4 name update" },
      ]);
      await storage.addOrReplaceResourcesCollection(resources);
      const storageData = await storage.opfsStorage.get(storage.storageKey);
      expect(storageData).toEqual(expect.any(Array));
      expect(storageData).toHaveLength(4);
      expect(storageData[0]).toEqual(ResourceEntity.transformDtoFromV4toV5(resourceDto1));
      expect(storageData[1]).toEqual(
        ResourceEntity.transformDtoFromV4toV5({ ...resourceDto2, name: "Resource 2 name update" }),
      );
      expect(storageData[2]).toEqual(ResourceEntity.transformDtoFromV4toV5(resourceDto3));
      expect(storageData[3]).toEqual(
        ResourceEntity.transformDtoFromV4toV5({ ...resourceDto4, name: "Resource 4 name update" }),
      );
    });

    it("Should update cache when updating resources", async () => {
      expect.assertions(8);
      const resourceDto1 = resourceMetadataEncryptedDto();
      const resourceDto2 = resourceMetadataEncryptedDto();
      const resourceDto3 = resourceMetadataEncryptedDto();
      const resourceDto4 = resourceMetadataEncryptedDto();
      const resourcesDtos = [resourceDto1, resourceDto2, resourceDto3, resourceDto4];
      await storage._setOPFSStorage(storage.storageKey, resourcesDtos);
      const resources = new ResourcesCollection([
        resourceDto1,
        { ...resourceDto2, name: "Resource 2 name update" },
        resourceDto3,
        { ...resourceDto4, name: "Resource 4 name update" },
      ]);
      expect(OfflineResourcesOPFSStorage._runtimeCachedData[account.id]).toBeUndefined();
      await storage.addOrReplaceResourcesCollection(resources);
      expect(OfflineResourcesOPFSStorage._runtimeCachedData[account.id]).toBeDefined();
      expect(OfflineResourcesOPFSStorage._runtimeCachedData[account.id]).toEqual(expect.any(Array));
      expect(OfflineResourcesOPFSStorage._runtimeCachedData[account.id]).toHaveLength(4);
      expect(OfflineResourcesOPFSStorage._runtimeCachedData[account.id][0]).toEqual(
        ResourceEntity.transformDtoFromV4toV5(resourceDto1),
      );
      expect(OfflineResourcesOPFSStorage._runtimeCachedData[account.id][1]).toEqual(
        ResourceEntity.transformDtoFromV4toV5({ ...resourceDto2, name: "Resource 2 name update" }),
      );
      expect(OfflineResourcesOPFSStorage._runtimeCachedData[account.id][2]).toEqual(
        ResourceEntity.transformDtoFromV4toV5(resourceDto3),
      );
      expect(OfflineResourcesOPFSStorage._runtimeCachedData[account.id][3]).toEqual(
        ResourceEntity.transformDtoFromV4toV5({ ...resourceDto4, name: "Resource 4 name update" }),
      );
    });
  });

  describe("::deleteResource", () => {
    it("Should throw if no data passed as parameter", async () => {
      expect.assertions(1);
      const promise = storage.delete();
      await expect(promise).rejects.toThrow("The parameter resourceId should be a UUID.");
    });

    it("Should throw if the resource parameter is not a ResourceEntity", async () => {
      expect.assertions(1);
      const promise = storage.delete(42);
      await expect(promise).rejects.toThrow("The parameter resourceId should be a UUID.");
    });

    it("Should do nothing if the resource is not found in the OPFS storage", async () => {
      expect.assertions(2);
      const resourceDto = resourceMetadataEncryptedDto();
      const resourcesDtos = [resourceDto];
      await storage._setOPFSStorage(storage.storageKey, resourcesDtos);
      await storage.delete(uuidv4());
      const storageData = await storage.opfsStorage.get(storage.storageKey);
      expect(storageData).toEqual(expect.any(Array));
      expect(storageData).toHaveLength(1);
    });

    it("Should delete the resource", async () => {
      expect.assertions(3);
      const resourceDto1 = resourceMetadataEncryptedDto();
      const resourceDto2 = resourceMetadataEncryptedDto();
      const resourcesDtos = [resourceDto1, resourceDto2];
      await storage._setOPFSStorage(storage.storageKey, resourcesDtos);
      await storage.delete(resourceDto1.id);
      const storageData = await storage.opfsStorage.get(storage.storageKey);
      expect(storageData).toEqual(expect.any(Array));
      expect(storageData).toHaveLength(1);
      expect(storageData[0]).toEqual(resourceDto2);
    });

    it("Should update cache after deleting the resource", async () => {
      expect.assertions(5);
      const resourceDto1 = resourceMetadataEncryptedDto();
      const resourceDto2 = resourceMetadataEncryptedDto();
      const resourcesDtos = [resourceDto1, resourceDto2];
      await storage._setOPFSStorage(storage.storageKey, resourcesDtos);
      expect(OfflineResourcesOPFSStorage._runtimeCachedData[account.id]).toBeUndefined();
      await storage.delete(resourceDto1.id);
      expect(OfflineResourcesOPFSStorage._runtimeCachedData[account.id]).toBeDefined();
      expect(OfflineResourcesOPFSStorage._runtimeCachedData[account.id]).toEqual(expect.any(Array));
      expect(OfflineResourcesOPFSStorage._runtimeCachedData[account.id]).toHaveLength(1);
      expect(OfflineResourcesOPFSStorage._runtimeCachedData[account.id][0]).toEqual(resourceDto2);
    });
  });

  describe("::assertEntityBeforeSave", () => {
    it("Should throw if no data provided", async () => {
      expect.assertions(1);
      await expect(() => OfflineResourcesOPFSStorage.assertEntityBeforeSave()).toThrow(
        "OfflineResourcesOPFSStorage expects a ResourceEntity to be set",
      );
    });

    it("Should throw if not a ResourceEntity is provided", async () => {
      expect.assertions(1);
      await expect(() => OfflineResourcesOPFSStorage.assertEntityBeforeSave(42)).toThrow(
        "OfflineResourcesOPFSStorage expects an object of type ResourceEntity",
      );
    });

    it("Should throw if the resource has no id", async () => {
      expect.assertions(1);
      const resourceDto = resourceMetadataEncryptedDto();
      delete resourceDto.id;
      const resource = new ResourceEntity(resourceDto);
      await expect(() => OfflineResourcesOPFSStorage.assertEntityBeforeSave(resource)).toThrow(
        "OfflineResourcesOPFSStorage expects ResourceEntity id to be set",
      );
    });

    it("Should throw if the resource has no permission", async () => {
      expect.assertions(1);
      const resourceDto = resourceMetadataEncryptedDto();
      delete resourceDto.permission;
      const resource = new ResourceEntity(resourceDto);
      await expect(() => OfflineResourcesOPFSStorage.assertEntityBeforeSave(resource)).toThrow(
        "OfflineResourcesOPFSStorage::set expects ResourceEntity permission to be set",
      );
    });

    it("Should throw if the resource metadata are encrypted", async () => {
      expect.assertions(1);
      const resourceDto = defaultResourceDto({ metadata: metadata.withSharedKey.decryptedMetadata[0] });
      const resource = new ResourceEntity(resourceDto);
      await expect(() => OfflineResourcesOPFSStorage.assertEntityBeforeSave(resource)).toThrow(
        "OfflineResourcesOPFSStorage::set expects ResourceEntity metadata to be encrypted",
      );
    });
  });

  describe("::flush", () => {
    it("Should flush not initialized OPFS storage and cache", async () => {
      expect.assertions(2);
      await storage.flush();
      const storageData = await storage.opfsStorage.get(storage.storageKey);
      expect(storageData).toBeUndefined();
      expect(OfflineResourcesOPFSStorage._runtimeCachedData[account.id]).toBeUndefined();
    });

    it("Should flush", async () => {
      expect.assertions(2);
      const resourcesDto = [resourceMetadataEncryptedDto(), resourceMetadataEncryptedDto()];
      const resources = new ResourcesCollection(resourcesDto);
      await storage.set(resources);
      await storage.flush();
      const storageData = await storage.opfsStorage.get(storage.storageKey);
      expect(storageData).toBeUndefined();
      expect(OfflineResourcesOPFSStorage._runtimeCachedData[account.id]).toBeUndefined();
    });
  });

  describe("::deleteResources", () => {
    it("Should throw if no data passed as parameter", async () => {
      expect.assertions(1);
      const promise = storage.deleteResources();
      await expect(promise).rejects.toThrow("The given parameter is not a valid array of uuid");
    });

    it("Should throw if the resourceIds parameter is not a valid entry", async () => {
      expect.assertions(1);
      const promise = storage.deleteResources(42);
      await expect(promise).rejects.toThrow("he given parameter is not a valid array of uuid");
    });

    it("Should do nothing if the resource is not found in the local storage", async () => {
      expect.assertions(2);
      const resourceDto = resourceMetadataEncryptedDto();
      const resourcesDtos = [resourceDto];
      await storage._setOPFSStorage(storage.storageKey, resourcesDtos);
      await storage.deleteResources([uuidv4()]);
      const storageData = await storage.opfsStorage.get(storage.storageKey);
      expect(storageData).toEqual(expect.any(Array));
      expect(storageData).toHaveLength(1);
    });

    it("Should update the resources", async () => {
      expect.assertions(3);
      const resourceDto1 = resourceMetadataEncryptedDto();
      const resourceDto2 = resourceMetadataEncryptedDto();
      const resourceDto3 = resourceMetadataEncryptedDto();
      const resourcesDtos = [resourceDto1, resourceDto2, resourceDto3];
      await storage._setOPFSStorage(storage.storageKey, resourcesDtos);
      await storage.deleteResources([resourceDto1.id, resourceDto2.id]);
      const storageData = await storage.opfsStorage.get(storage.storageKey);
      expect(storageData).toEqual(expect.any(Array));
      expect(storageData).toHaveLength(1);
      expect(storageData[0]).toEqual(resourceDto3);
    });

    it("Should update cache after deleting the resources", async () => {
      expect.assertions(5);
      const resourceDto1 = resourceMetadataEncryptedDto();
      const resourceDto2 = resourceMetadataEncryptedDto();
      const resourceDto3 = resourceMetadataEncryptedDto();
      const resourcesDtos = [resourceDto1, resourceDto2, resourceDto3];
      await storage._setOPFSStorage(storage.storageKey, resourcesDtos);
      expect(OfflineResourcesOPFSStorage._runtimeCachedData[account.id]).toBeUndefined();
      await storage.deleteResources([resourceDto1.id, resourceDto2.id]);
      expect(OfflineResourcesOPFSStorage._runtimeCachedData[account.id]).toBeDefined();
      expect(OfflineResourcesOPFSStorage._runtimeCachedData[account.id]).toEqual(expect.any(Array));
      expect(OfflineResourcesOPFSStorage._runtimeCachedData[account.id]).toHaveLength(1);
      expect(OfflineResourcesOPFSStorage._runtimeCachedData[account.id][0]).toEqual(resourceDto3);
    });
  });
});
