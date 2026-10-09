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
 * @since         6.0.0
 */

import { defaultApiClientOptions } from "passbolt-styleguide/src/shared/lib/apiClient/apiClientOptions.test.data";
import { defaultResourceDto } from "passbolt-styleguide/src/shared/models/entity/resource/resourceEntity.test.data";
import { resourceTypesCollectionDto } from "passbolt-styleguide/src/shared/models/entity/resourceType/resourceTypesCollection.test.data";
import ResourceTypesCollection from "passbolt-styleguide/src/shared/models/entity/resourceType/resourceTypesCollection";
import UserPassphraseRequiredError from "passbolt-styleguide/src/shared/error/userPassphraseRequiredError";
import { metadata } from "passbolt-styleguide/test/fixture/encryptedMetadata/metadata";
import { pgpKeys } from "passbolt-styleguide/test/fixture/pgpKeys/keys";
import FindAndUpdateResourcesLocalStorageFromOPFSController from "./findAndUpdateResourcesLocalStorageFromOPFSController";
import AccountEntity from "../../model/entity/account/accountEntity";
import { defaultAccountDto } from "../../model/entity/account/accountEntity.test.data";
import ResourcesCollection from "../../model/entity/resource/resourcesCollection";
import ResourceLocalStorage from "../../service/local_storage/resourceLocalStorage";
import PassphraseStorageService from "../../service/session_storage/passphraseStorageService";
import GetPassphraseService from "../../service/passphrase/getPassphraseService";

/**
 * Build a resource dto with its metadata encrypted with ada's key, as persisted in the OPFS storage.
 * @param {object} [data = {}] The resource dto data to override.
 * @returns {object}
 */
const privateResourceWithEncryptedMetadataDto = (data = {}) =>
  defaultResourceDto({
    metadata: metadata.withAdaKey.encryptedMetadata[0],
    metadata_key_id: null,
    metadata_key_type: "user_key",
    personal: true,
    ...data,
  });

describe("FindAndUpdateResourcesLocalStorageFromOPFSController", () => {
  let controller, worker, service;

  beforeEach(async () => {
    // Restore and not only clear, the spied implementations must not leak from one test to another.
    jest.restoreAllMocks();
    worker = {
      port: {
        emit: jest.fn(),
      },
    };
    const account = new AccountEntity(defaultAccountDto());
    controller = new FindAndUpdateResourcesLocalStorageFromOPFSController(
      worker,
      null,
      defaultApiClientOptions(),
      account,
    );
    service = controller.findAndUpdateResourcesLocalStorageFromOPFSService;
    // flush account related storage before each.
    await service.offlineResourcesOPFSStorage.flush();
    await ResourceLocalStorage.flush();
    jest
      .spyOn(service.getOrFindResourceTypesService, "getOrFindAll")
      .mockImplementation(async () => new ResourceTypesCollection(resourceTypesCollectionDto()));
  });

  describe("::_exec", () => {
    it("calls the find and update service and emits a success message.", async () => {
      expect.assertions(3);

      jest.spyOn(service, "findAndUpdateAll").mockImplementationOnce(jest.fn());

      await controller._exec();

      expect(service.findAndUpdateAll).toHaveBeenCalledTimes(1);
      expect(service.findAndUpdateAll).toHaveBeenCalledWith();
      expect(worker.port.emit).toHaveBeenCalledWith(null, "SUCCESS");
    });

    it("emits an error message if the find and update service fails.", async () => {
      expect.assertions(2);

      const error = new Error("Unexpected error.");
      jest.spyOn(service, "findAndUpdateAll").mockImplementationOnce(() => {
        throw error;
      });

      await controller._exec();

      expect(service.findAndUpdateAll).toHaveBeenCalledTimes(1);
      expect(worker.port.emit).toHaveBeenCalledWith(null, "ERROR", error);
    });

    it("emits an error message if the retry with the user passphrase fails.", async () => {
      expect.assertions(2);

      const error = new Error("Unexpected error.");
      jest
        .spyOn(service, "findAndUpdateAll")
        .mockImplementationOnce(() => {
          throw new UserPassphraseRequiredError();
        })
        .mockImplementationOnce(() => {
          throw error;
        });
      jest.spyOn(GetPassphraseService.prototype, "getPassphrase").mockImplementation(() => pgpKeys.ada.passphrase);

      await controller._exec();

      expect(service.findAndUpdateAll).toHaveBeenCalledTimes(2);
      expect(worker.port.emit).toHaveBeenCalledWith(null, "ERROR", error);
    });
  });

  describe("::exec", () => {
    it("throws if the find and update service fails with an error other than a passphrase required error.", async () => {
      expect.assertions(2);

      const error = new Error("Unexpected error.");
      jest.spyOn(service, "findAndUpdateAll").mockImplementation(() => {
        throw error;
      });
      jest.spyOn(GetPassphraseService.prototype, "getPassphrase");

      await expect(() => controller.exec()).rejects.toThrow(error);
      expect(GetPassphraseService.prototype.getPassphrase).not.toHaveBeenCalled();
    });

    it("does not request the user passphrase if it is not required.", async () => {
      expect.assertions(2);

      jest.spyOn(service, "findAndUpdateAll").mockImplementationOnce(jest.fn());
      jest.spyOn(GetPassphraseService.prototype, "getPassphrase");

      await controller.exec();

      expect(GetPassphraseService.prototype.getPassphrase).not.toHaveBeenCalled();
      expect(service.findAndUpdateAll).toHaveBeenCalledTimes(1);
    });

    it("requests the user passphrase whenever the decryption of the metadata requires it and retries with it.", async () => {
      expect.assertions(4);

      jest
        .spyOn(service, "findAndUpdateAll")
        .mockImplementationOnce(() => {
          throw new UserPassphraseRequiredError();
        })
        .mockImplementationOnce(jest.fn());
      jest.spyOn(GetPassphraseService.prototype, "getPassphrase").mockImplementation(() => pgpKeys.ada.passphrase);

      await controller.exec();

      expect(GetPassphraseService.prototype.getPassphrase).toHaveBeenCalledWith(worker);
      expect(service.findAndUpdateAll).toHaveBeenCalledTimes(2);
      expect(service.findAndUpdateAll).toHaveBeenNthCalledWith(1);
      // The service takes the passphrase as its first and only parameter.
      expect(service.findAndUpdateAll).toHaveBeenNthCalledWith(2, pgpKeys.ada.passphrase);
    });

    it("does not store the passphrase in the session storage, it would cut the offline session short.", async () => {
      expect.assertions(2);

      jest
        .spyOn(service, "findAndUpdateAll")
        .mockImplementationOnce(() => {
          throw new UserPassphraseRequiredError();
        })
        .mockImplementationOnce(jest.fn());
      jest.spyOn(GetPassphraseService.prototype, "getPassphrase").mockImplementation(() => pgpKeys.ada.passphrase);
      jest.spyOn(PassphraseStorageService, "set");

      await controller.exec();

      expect(GetPassphraseService.prototype.getPassphrase).toHaveBeenCalledTimes(1);
      expect(PassphraseStorageService.set).not.toHaveBeenCalled();
    });

    it(
      "updates the resources local storage with the resources retrieved from the OPFS storage.",
      async () => {
        expect.assertions(3);

        const resourceDto = privateResourceWithEncryptedMetadataDto();
        await service.offlineResourcesOPFSStorage.set(new ResourcesCollection([resourceDto]));
        jest.spyOn(PassphraseStorageService, "get").mockImplementation(() => pgpKeys.ada.passphrase);

        await controller._exec();

        const storageValue = await ResourceLocalStorage.get();
        expect(storageValue).toHaveLength(1);
        expect(storageValue[0].id).toStrictEqual(resourceDto.id);
        expect(worker.port.emit).toHaveBeenCalledWith(null, "SUCCESS");
      },
      10 * 1000,
    );

    it(
      "prompts the user passphrase and decrypts the resources metadata whenever the passphrase is not in session.",
      async () => {
        expect.assertions(4);

        const resourceDto = privateResourceWithEncryptedMetadataDto();
        await service.offlineResourcesOPFSStorage.set(new ResourcesCollection([resourceDto]));
        jest.spyOn(PassphraseStorageService, "get").mockImplementation(() => null);
        jest.spyOn(PassphraseStorageService, "set");
        jest
          .spyOn(GetPassphraseService.prototype, "requestPassphrase")
          .mockImplementation(() => pgpKeys.ada.passphrase);

        await controller._exec();

        expect(GetPassphraseService.prototype.requestPassphrase).toHaveBeenCalledWith(worker);
        expect(PassphraseStorageService.set).not.toHaveBeenCalled();
        // The resource metadata could be decrypted with the prompted passphrase.
        const storageValue = await ResourceLocalStorage.get();
        expect(storageValue).toHaveLength(1);
        expect(worker.port.emit).toHaveBeenCalledWith(null, "SUCCESS");
      },
      10 * 1000,
    );
  });
});
