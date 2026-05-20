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

import AccountEntity from "../../model/entity/account/accountEntity";
import { defaultAccountDto } from "../../model/entity/account/accountEntity.test.data";
import { defaultApiClientOptions } from "passbolt-styleguide/src/shared/lib/apiClient/apiClientOptions.test.data";
import AuthLoginController from "../auth/authLoginController";
import BiometricAuthService from "../../service/biometric/biometricAuthService";
import LoginWithBiometricAuthController from "./loginWithBiometricAuthController";

jest.mock("../auth/authLoginController");
jest.mock("../../service/biometric/biometricAuthService");

describe("LoginWithBiometricAuthController", () => {
  describe("LoginWithBiometricAuthController::exec", () => {
    it("Should unlock the passphrase and sign in the user.", async () => {
      const passphrase = "ada@passbolt.com";
      const account = new AccountEntity(defaultAccountDto());
      const apiClientOptions = defaultApiClientOptions();
      const controller = new LoginWithBiometricAuthController(null, null, apiClientOptions, account);

      controller.biometricAuthService.unlock.mockResolvedValue(passphrase);
      controller.authLoginController.exec.mockResolvedValue();

      await controller.exec(true);

      expect(BiometricAuthService).toHaveBeenCalledWith(account);
      expect(AuthLoginController).toHaveBeenCalledWith(null, null, apiClientOptions, account);
      expect(controller.biometricAuthService.unlock).toHaveBeenCalledTimes(1);
      expect(controller.authLoginController.exec).toHaveBeenCalledWith(passphrase, true);
    });

    it("Should throw an exception if the rememberMe parameter is invalid.", async () => {
      const account = new AccountEntity(defaultAccountDto());
      const controller = new LoginWithBiometricAuthController(null, null, defaultApiClientOptions(), account);

      await expect(controller.exec(42)).rejects.toThrow("The rememberMe should be a boolean.");
    });
  });
});
