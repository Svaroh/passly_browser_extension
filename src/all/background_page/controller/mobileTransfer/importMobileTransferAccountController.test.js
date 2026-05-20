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
import ImportMobileTransferAccountController from "./importMobileTransferAccountController";
import { OpenpgpAssertion } from "../../utils/openpgp/openpgpAssertions";
import { pgpKeys } from "passbolt-styleguide/test/fixture/pgpKeys/keys";

describe("ImportMobileTransferAccountController", () => {
  const domain = "https://pass.66ton99.org.ua";
  const worker = { port: { emit: jest.fn() } };
  let transferAccountDto, fingerprint;

  beforeEach(async () => {
    jest.clearAllMocks();
    const privateKey = await OpenpgpAssertion.readKeyOrFail(pgpKeys.ada.private);
    fingerprint = privateKey.getFingerprint().toUpperCase();
    transferAccountDto = {
      metadata: {
        domain,
        user_id: pgpKeys.ada.userId,
      },
      assembled_key: {
        armored_key: pgpKeys.ada.private,
        fingerprint,
        user_id: pgpKeys.ada.userId,
      },
      transfer: {
        user_id: pgpKeys.ada.userId,
        user: {
          id: pgpKeys.ada.userId,
          username: "ada@passbolt.com",
          profile: {
            first_name: "Ada",
            last_name: "Lovelace",
          },
        },
      },
    };
    jest.spyOn(AuthVerifyServerKeyService.prototype, "getServerKey").mockResolvedValue({
      armored_key: pgpKeys.server.public,
      fingerprint: pgpKeys.server.fingerprint,
    });
    jest.spyOn(AuthVerifyServerChallengeService.prototype, "verifyAndValidateServerChallenge").mockResolvedValue();
    jest.spyOn(AccountModel.prototype, "add").mockResolvedValue();
  });

  describe("::exec", () => {
    it("Should import a transferred mobile account locally", async () => {
      expect.assertions(8);

      const controller = new ImportMobileTransferAccountController(worker, "request-id");
      const account = await controller.exec(transferAccountDto);

      expect(account).toBeInstanceOf(AccountEntity);
      expect(account.domain).toStrictEqual("https://pass.66ton99.org.ua/");
      expect(account.userId).toStrictEqual(pgpKeys.ada.userId);
      expect(account.username).toStrictEqual("ada@passbolt.com");
      expect(account.userKeyFingerprint).toStrictEqual(fingerprint);
      expect(account.userPublicArmoredKey).toContain("-----BEGIN PGP PUBLIC KEY BLOCK-----");
      expect(AuthVerifyServerChallengeService.prototype.verifyAndValidateServerChallenge).toHaveBeenCalledWith(
        fingerprint,
        expect.stringContaining("-----BEGIN PGP PUBLIC KEY BLOCK-----"),
      );
      expect(AccountModel.prototype.add).toHaveBeenCalledWith(account);
    });

    it("Should reject a transfer where the user id does not match the key payload", async () => {
      expect.assertions(1);

      transferAccountDto.assembled_key.user_id = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
      const controller = new ImportMobileTransferAccountController(worker, "request-id");

      await expect(controller.exec(transferAccountDto)).rejects.toThrow(
        "The transfer user does not match the transferred private key.",
      );
    });

    it("Should reject a transfer where the private key fingerprint does not match the key payload", async () => {
      expect.assertions(1);

      transferAccountDto.assembled_key.fingerprint = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
      const controller = new ImportMobileTransferAccountController(worker, "request-id");

      await expect(controller.exec(transferAccountDto)).rejects.toThrow(
        "The transferred private key fingerprint does not match the QR metadata.",
      );
    });
  });
});
