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
import BuildApiClientOptionsService from "../service/account/buildApiClientOptionsService";
import ImportMobileTransferAccountController from "../controller/mobileTransfer/importMobileTransferAccountController";
import MobileTransferModel from "../model/mobileTransfer/mobileTransferModel";

const TRANSFER_CONTAIN_OPTIONS = { user: true, "user.profile": true };

const listen = function (worker) {
  worker.port.on(
    "passbolt.mobile-transfer-entrypoint.update-transfer",
    async (requestId, domain, transferId, authenticationToken, transferDto) => {
      try {
        const apiClientOptions = BuildApiClientOptionsService.buildFromDomain(domain);
        const transferModel = new MobileTransferModel(apiClientOptions);
        const transferEntity = await transferModel.updateNoSession(
          transferId,
          authenticationToken,
          transferDto,
          TRANSFER_CONTAIN_OPTIONS,
        );
        worker.port.emit(requestId, "SUCCESS", transferEntity.toDto({ user: { profile: true } }));
      } catch (error) {
        console.error(error);
        worker.port.emit(requestId, "ERROR", error);
      }
    },
  );

  worker.port.on("passbolt.mobile-transfer-entrypoint.import-account", async (requestId, transferAccountDto) => {
    const controller = new ImportMobileTransferAccountController(worker, requestId);
    await controller._exec(transferAccountDto);
  });
};

export const MobileTransferEntrypointEvents = { listen };
