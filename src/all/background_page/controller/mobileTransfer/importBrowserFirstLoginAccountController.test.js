/**
 * Passbolt ~ Open source password manager for teams
 * Copyright (c) 2026 Passbolt SA (https://www.passbolt.com)
 *
 * Licensed under GNU Affero General Public License version 3 of the or any later version.
 * For full copyright and license information, please see the LICENSE.txt
 * Redistributions of files must retain the above copyright notice.
 *
 * @copyright     Copyright (c) 2026 Passbolt SA (https://www.passbolt.com)
 * @license       https://opensource.org/licenses/AGPL-3.0 AGPL License
 * @link          https://www.passbolt.com Passbolt(tm)
 */
import AccountEntity from "../../model/entity/account/accountEntity";
import AccountModel from "../../model/account/accountModel";
import AuthVerifyServerChallengeService from "../../service/auth/authVerifyServerChallengeService";
import AuthVerifyServerKeyService from "../../service/api/auth/authVerifyServerKeyService";
import ImportBrowserFirstLoginAccountController from "./importBrowserFirstLoginAccountController";
import BrowserFirstLoginPrivateKeyPayloadService from "../../service/mobileTransfer/browserFirstLoginPrivateKeyPayloadService";
import { OpenpgpAssertion } from "../../utils/openpgp/openpgpAssertions";
import { pgpKeys } from "passbolt-styleguide/test/fixture/pgpKeys/keys";
import Keyring from "../../model/keyring";
import storage from "../../sdk/storage";

describe("ImportBrowserFirstLoginAccountController", () => {
  const domain = "https://pass.66ton99.org.ua";
  const secret = "pairing-secret";
  let browserFirstLoginRequest, fingerprint, privateKeyPayload;

  beforeEach(async () => {
    jest.clearAllMocks();
    const publicKey = await OpenpgpAssertion.readKeyOrFail(pgpKeys.ada.public);
    fingerprint = publicKey.getFingerprint().toUpperCase();
    privateKeyPayload = {
      armored_key: pgpKeys.ada.private,
      user_id: pgpKeys.ada.userId,
      fingerprint,
      username: "ada@passbolt.com",
      first_name: "Ada",
      last_name: "Lovelace",
      role_name: "user",
    };
    browserFirstLoginRequest = {
      user_id: pgpKeys.ada.userId,
      user_key_fingerprint: fingerprint,
      encrypted_private_key: await BrowserFirstLoginPrivateKeyPayloadService.encrypt(
        privateKeyPayload,
        secret,
        new Uint8Array(12),
      ),
    };
    jest.spyOn(AuthVerifyServerKeyService.prototype, "getServerKey").mockResolvedValue({
      armored_key: pgpKeys.server.public,
      fingerprint: pgpKeys.server.fingerprint,
    });
    jest.spyOn(AuthVerifyServerChallengeService.prototype, "verifyAndValidateServerChallenge").mockResolvedValue();
    jest.spyOn(AccountModel.prototype, "add").mockResolvedValue();
    jest.spyOn(browser.storage.local, "set").mockResolvedValue();
  });

  describe("::exec", () => {
    it("Should import a browser-first-login account locally with the Android private key", async () => {
      expect.assertions(10);

      const controller = new ImportBrowserFirstLoginAccountController();
      const account = await controller.exec(domain, browserFirstLoginRequest, secret);

      expect(account).toBeInstanceOf(AccountEntity);
      expect(account.domain).toStrictEqual("https://pass.66ton99.org.ua");
      expect(account.userId).toStrictEqual(pgpKeys.ada.userId);
      expect(account.username).toStrictEqual("ada@passbolt.com");
      expect(account.userKeyFingerprint).toStrictEqual(fingerprint);
      expect(account.userPublicArmoredKey).toContain("-----BEGIN PGP PUBLIC KEY BLOCK-----");
      expect(account.userPrivateArmoredKey).toContain("-----BEGIN PGP PRIVATE KEY BLOCK-----");
      expect(AccountModel.prototype.add).toHaveBeenCalledWith(account);
      expect(browser.storage.local.set).toHaveBeenCalledWith({ _passbolt_data: expect.any(Object) });
      expect(AuthVerifyServerChallengeService.prototype.verifyAndValidateServerChallenge).toHaveBeenCalledWith(
        fingerprint,
        expect.stringContaining("-----BEGIN PGP PUBLIC KEY BLOCK-----"),
        { credentials: "omit" },
      );
    });

    it("Should normalize a browser-first-login domain without a trailing slash", async () => {
      expect.assertions(1);

      const controller = new ImportBrowserFirstLoginAccountController();

      expect(controller.normalizeDomain("https://pass.66ton99.org.ua/")).toStrictEqual("https://pass.66ton99.org.ua");
    });

    it("Should persist the transferred private key in the legacy keyring storage", async () => {
      expect.assertions(5);

      AccountModel.prototype.add.mockRestore();
      browser.storage.local.set.mockRestore();
      storage._data = {};

      const controller = new ImportBrowserFirstLoginAccountController();
      await controller.exec(domain, browserFirstLoginRequest, secret);

      const privateKeyInfo = new Keyring().findPrivate();
      const persistedStorage = await browser.storage.local.get("_passbolt_data");
      const persistedPrivateKeys = JSON.parse(persistedStorage._passbolt_data[Keyring.STORAGE_KEY_PRIVATE]);

      expect(privateKeyInfo).toBeDefined();
      expect(privateKeyInfo.armoredKey).toContain("-----BEGIN PGP PRIVATE KEY BLOCK-----");
      expect(privateKeyInfo.fingerprint).toStrictEqual(fingerprint);
      expect(persistedPrivateKeys[Keyring.MY_KEY_ID].armored_key).toContain("-----BEGIN PGP PRIVATE KEY BLOCK-----");
      expect(persistedPrivateKeys[Keyring.MY_KEY_ID].fingerprint).toStrictEqual(fingerprint);
    });

    it("Should import an Android encrypted private-key payload without explicit metadata", async () => {
      expect.assertions(4);

      const encryptedPayload = JSON.parse(browserFirstLoginRequest.encrypted_private_key);
      delete encryptedPayload.v;
      delete encryptedPayload.alg;
      browserFirstLoginRequest.encrypted_private_key = JSON.stringify(encryptedPayload);

      const controller = new ImportBrowserFirstLoginAccountController();
      const account = await controller.exec(domain, browserFirstLoginRequest, secret);

      expect(account.userId).toStrictEqual(pgpKeys.ada.userId);
      expect(account.username).toStrictEqual("ada@passbolt.com");
      expect(account.userKeyFingerprint).toStrictEqual(fingerprint);
      expect(account.userPrivateArmoredKey).toContain("-----BEGIN PGP PRIVATE KEY BLOCK-----");
    });

    it("Should reject unsupported encrypted private-key payload metadata", async () => {
      expect.assertions(1);

      const encryptedPayload = JSON.parse(browserFirstLoginRequest.encrypted_private_key);
      encryptedPayload.alg = "A128GCM";
      browserFirstLoginRequest.encrypted_private_key = JSON.stringify(encryptedPayload);
      const controller = new ImportBrowserFirstLoginAccountController();

      await expect(controller.exec(domain, browserFirstLoginRequest, secret)).rejects.toThrow(
        "The browser first-login private key payload is invalid.",
      );
    });

    it("Should reject incomplete request account data", async () => {
      expect.assertions(1);

      const controller = new ImportBrowserFirstLoginAccountController();
      delete browserFirstLoginRequest.user_id;

      await expect(controller.exec(domain, browserFirstLoginRequest, secret)).rejects.toThrow(
        "The browser first-login account data is incomplete.",
      );
    });

    it("Should reject when the server user public key does not match the selected fingerprint", async () => {
      expect.assertions(1);

      const controller = new ImportBrowserFirstLoginAccountController();
      browserFirstLoginRequest.user_key_fingerprint = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

      await expect(controller.exec(domain, browserFirstLoginRequest, secret)).rejects.toThrow(
        "The browser first-login private key fingerprint does not match the selected account.",
      );
    });

    it("Should reject incomplete private-key payload account data", async () => {
      expect.assertions(1);

      const controller = new ImportBrowserFirstLoginAccountController();
      delete privateKeyPayload.username;
      browserFirstLoginRequest.encrypted_private_key = await BrowserFirstLoginPrivateKeyPayloadService.encrypt(
        privateKeyPayload,
        secret,
        new Uint8Array(12),
      );

      await expect(controller.exec(domain, browserFirstLoginRequest, secret)).rejects.toThrow(
        "The browser first-login private key payload is incomplete.",
      );
    });

    it("Should reject when the private key is not known by the Passbolt server", async () => {
      expect.assertions(1);

      jest
        .spyOn(AuthVerifyServerChallengeService.prototype, "verifyAndValidateServerChallenge")
        .mockRejectedValue(new Error("Unknown key"));
      const controller = new ImportBrowserFirstLoginAccountController();

      await expect(controller.exec(domain, browserFirstLoginRequest, secret)).rejects.toThrow(
        "The browser first-login private key does not match an account on this Passbolt server.",
      );
    });
  });
});
