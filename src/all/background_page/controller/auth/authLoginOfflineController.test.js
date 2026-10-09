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
import MockExtension from "../../../../../test/mocks/mockExtension";
import AuthLoginOfflineController from "./authLoginOfflineController";
import PostLoginOfflineService from "../../service/auth/postLoginOfflineService";
import AccountEntity from "../../model/entity/account/accountEntity";
import { defaultAccountDto } from "../../model/entity/account/accountEntity.test.data";
import { defaultApiClientOptions } from "passbolt-styleguide/src/shared/lib/apiClient/apiClientOptions.test.data";

beforeEach(async () => {
  jest.clearAllMocks();
  await MockExtension.withConfiguredAccount();
});

describe("AuthLoginOfflineController", () => {
  const passphrase = "ada@passbolt.com";
  let account, apiClientOptions;

  beforeEach(() => {
    account = new AccountEntity(defaultAccountDto());
    apiClientOptions = defaultApiClientOptions();
  });

  describe("::exec", () => {
    it("signs in offline: checks the passphrase and runs the offline post-login with the passphrase and chosen duration", async () => {
      expect.assertions(2);
      const controller = new AuthLoginOfflineController(null, null, apiClientOptions, account);
      jest.spyOn(controller.checkPassphraseService, "checkPassphrase").mockResolvedValue();
      const spyOnPostLogin = jest.spyOn(PostLoginOfflineService.prototype, "exec").mockResolvedValue();

      await controller.exec(passphrase, 300);

      expect(controller.checkPassphraseService.checkPassphrase).toHaveBeenCalledWith(passphrase);
      expect(spyOnPostLogin).toHaveBeenCalledWith(passphrase, 300);
    });

    it("throws if the passphrase is not a string", async () => {
      expect.assertions(2);
      const controller = new AuthLoginOfflineController(null, null, apiClientOptions, account);

      await expect(controller.exec(undefined, 300)).rejects.toThrow(
        "The given parameter should be a valid UTF8 string.",
      );
      await expect(controller.exec(42, 300)).rejects.toThrow("The given parameter should be a valid UTF8 string.");
    });

    it("throws if the remember-me duration is not a number", async () => {
      expect.assertions(2);
      const controller = new AuthLoginOfflineController(null, null, apiClientOptions, account);
      jest.spyOn(controller.checkPassphraseService, "checkPassphrase").mockResolvedValue();

      await expect(controller.exec(passphrase, "not-a-number")).rejects.toThrow(
        "The session duration should be a number.",
      );
      // The passphrase check must not run when the arguments are invalid.
      expect(controller.checkPassphraseService.checkPassphrase).not.toHaveBeenCalled();
    });
  });

  describe("::_exec", () => {
    it("emits SUCCESS on the worker port when the sign-in succeeds", async () => {
      expect.assertions(1);
      const worker = { port: { emit: jest.fn() } };
      const controller = new AuthLoginOfflineController(worker, "request-id", apiClientOptions, account);
      jest.spyOn(controller, "exec").mockResolvedValue();

      await controller._exec(passphrase, 300);

      expect(worker.port.emit).toHaveBeenCalledWith("request-id", "SUCCESS");
    });

    it("emits ERROR on the worker port when the sign-in fails", async () => {
      expect.assertions(1);
      const worker = { port: { emit: jest.fn() } };
      const controller = new AuthLoginOfflineController(worker, "request-id", apiClientOptions, account);
      const error = new Error("Invalid passphrase.");
      jest.spyOn(controller, "exec").mockRejectedValue(error);

      await controller._exec(passphrase, 300);

      expect(worker.port.emit).toHaveBeenCalledWith("request-id", "ERROR", error);
    });
  });
});
