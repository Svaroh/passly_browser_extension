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

import MockExtension from "../../../../../test/mocks/mockExtension";
import AccountEntity from "../../model/entity/account/accountEntity";
import { defaultAccountDto } from "../../model/entity/account/accountEntity.test.data";
import BiometricAuthService from "./biometricAuthService";

describe("BiometricAuthService", () => {
  const passphrase = "ada@passbolt.com";
  const credentialId = new Uint8Array([1, 2, 3, 4]).buffer;
  const prfSecret = new Uint8Array(32).fill(7).buffer;
  let originalPublicKeyCredential;

  beforeEach(async () => {
    await MockExtension.withConfiguredAccount();
    originalPublicKeyCredential = global.PublicKeyCredential;
    global.PublicKeyCredential = {
      isUserVerifyingPlatformAuthenticatorAvailable: jest.fn().mockResolvedValue(true),
    };
    navigator.credentials = {
      create: jest.fn().mockResolvedValue({
        rawId: credentialId,
        getClientExtensionResults: () => ({
          prf: {
            results: {
              first: prfSecret,
            },
          },
        }),
      }),
      get: jest.fn().mockResolvedValue({
        rawId: credentialId,
        getClientExtensionResults: () => ({
          prf: {
            results: {
              first: prfSecret,
            },
          },
        }),
      }),
    };
  });

  afterEach(() => {
    global.PublicKeyCredential = originalPublicKeyCredential;
    delete navigator.credentials;
  });

  describe("BiometricAuthService::getStatus", () => {
    it("Should return the runtime availability and account configuration status.", async () => {
      const account = new AccountEntity(defaultAccountDto());
      const service = new BiometricAuthService(account);

      await expect(service.getStatus()).resolves.toEqual({ available: true, configured: false });
    });

    it("Should not fail when no account is available yet.", async () => {
      const service = new BiometricAuthService();

      await expect(service.getStatus()).resolves.toEqual({ available: true, configured: false });
      await expect(service.getConfiguration()).resolves.toBeNull();
      await expect(service.disable()).resolves.toBeUndefined();
      await expect(service.unlock()).rejects.toThrow(
        "Cannot retrieve account id, necessary to get a biometric auth storage key.",
      );
    });
  });

  describe("BiometricAuthService::enable / unlock", () => {
    it("Should encrypt the passphrase and unlock it with the platform authenticator PRF secret.", async () => {
      const account = new AccountEntity(defaultAccountDto());
      const service = new BiometricAuthService(account);

      await service.enable(passphrase);
      const storedData = await service.storage.get();

      expect(storedData.ciphertext).not.toEqual(passphrase);
      expect(storedData.credential_id).toEqual("AQIDBA");
      expect(navigator.credentials.create).toHaveBeenCalledWith({
        publicKey: expect.objectContaining({
          authenticatorSelection: expect.objectContaining({
            authenticatorAttachment: "platform",
            userVerification: "required",
          }),
          extensions: expect.objectContaining({
            prf: expect.any(Object),
          }),
        }),
      });
      await expect(service.unlock()).resolves.toEqual(passphrase);
      expect(navigator.credentials.get).toHaveBeenCalledWith({
        publicKey: expect.objectContaining({
          allowCredentials: [{ type: "public-key", id: credentialId }],
          userVerification: "required",
          extensions: expect.objectContaining({
            prf: expect.any(Object),
          }),
        }),
      });
    });

    it("Should fail if the platform authenticator does not return a PRF secret.", async () => {
      const account = new AccountEntity(defaultAccountDto());
      const service = new BiometricAuthService(account);
      navigator.credentials.create.mockResolvedValueOnce({
        rawId: credentialId,
        getClientExtensionResults: () => ({}),
      });

      await expect(service.enable(passphrase)).rejects.toThrow(
        "The platform authenticator does not support WebAuthn PRF.",
      );
    });

    it("Should fail if the returned credential does not match the stored credential id.", async () => {
      const account = new AccountEntity(defaultAccountDto());
      const service = new BiometricAuthService(account);

      await service.enable(passphrase);
      navigator.credentials.get.mockResolvedValueOnce({
        rawId: new Uint8Array([5, 6, 7, 8]).buffer,
        getClientExtensionResults: () => ({
          prf: {
            results: {
              first: prfSecret,
            },
          },
        }),
      });

      await expect(service.unlock()).rejects.toThrow("The biometric credential does not match the configured account.");
    });
  });

  describe("BiometricAuthService::saveConfiguration", () => {
    it("Should save and return a valid encrypted configuration.", async () => {
      const account = new AccountEntity(defaultAccountDto());
      const service = new BiometricAuthService(account);
      const configuration = {
        version: 1,
        credential_id: "AQIDBA",
        key_storage: "indexeddb",
        rp_id: "pass.66ton99.org.ua",
        salt: "salt",
        iv: "iv",
        ciphertext: "ciphertext",
      };

      await service.saveConfiguration(configuration);

      await expect(service.getConfiguration()).resolves.toEqual(expect.objectContaining(configuration));
    });

    it("Should reject invalid configuration.", async () => {
      const account = new AccountEntity(defaultAccountDto());
      const service = new BiometricAuthService(account);

      await expect(service.saveConfiguration({ credential_id: "AQIDBA" })).rejects.toThrow(
        "The biometric auth configuration is invalid.",
      );
    });
  });
});
