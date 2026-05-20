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
import BuildApiClientOptionsService from "../../service/account/buildApiClientOptionsService";
import { OpenpgpAssertion } from "../../utils/openpgp/openpgpAssertions";

class ImportMobileTransferAccountController {
  /**
   * Constructor.
   * @param {Worker} worker The associated worker.
   * @param {string} requestId The associated request id.
   */
  constructor(worker, requestId) {
    this.worker = worker;
    this.requestId = requestId;
  }

  /**
   * Controller executor.
   * @param {object} transferAccountDto The mobile transfer account data.
   * @returns {Promise<void>}
   */
  async _exec(transferAccountDto) {
    try {
      const account = await this.exec(transferAccountDto);
      this.worker.port.emit(this.requestId, "SUCCESS", account.toDto({ security_token: true }));
    } catch (error) {
      console.error(error);
      this.worker.port.emit(this.requestId, "ERROR", error);
    }
  }

  /**
   * Import the transferred mobile account into the extension local account.
   * @param {object} transferAccountDto The mobile transfer account data.
   * @returns {Promise<AccountEntity>}
   */
  async exec(transferAccountDto) {
    this.assertTransferAccountDto(transferAccountDto);

    const metadata = transferAccountDto.metadata;
    const assembledKey = transferAccountDto.assembled_key;
    const transfer = transferAccountDto.transfer;
    const domain = this.normalizeDomain(metadata.domain);
    const apiClientOptions = BuildApiClientOptionsService.buildFromDomain(domain);
    const privateKey = await this.readPrivateKey(assembledKey.armored_key);
    const fingerprint = privateKey.getFingerprint().toUpperCase();

    if (fingerprint !== assembledKey.fingerprint.toUpperCase()) {
      throw new Error("The transferred private key fingerprint does not match the QR metadata.");
    }

    const serverPublicArmoredKey = await this.getServerPublicArmoredKey(apiClientOptions);
    await this.assertKeyIsKnownByServer(apiClientOptions, fingerprint, serverPublicArmoredKey);

    const account = new AccountEntity(
      {
        domain,
        user_id: transfer.user.id,
        username: transfer.user.username,
        first_name: transfer.user.profile.first_name,
        last_name: transfer.user.profile.last_name,
        locale: transfer.user.locale || null,
        user_key_fingerprint: fingerprint,
        user_public_armored_key: privateKey.toPublic().armor(),
        user_private_armored_key: privateKey.armor(),
        server_public_armored_key: serverPublicArmoredKey,
        security_token: this.buildSecurityToken(fingerprint),
      },
      { validateUsername: false },
    );

    await new AccountModel().add(account);
    return account;
  }

  /**
   * Assert mobile transfer account data.
   * @param {object} transferAccountDto The mobile transfer account data.
   * @returns {void}
   */
  assertTransferAccountDto(transferAccountDto) {
    const metadata = transferAccountDto?.metadata;
    const assembledKey = transferAccountDto?.assembled_key;
    const transfer = transferAccountDto?.transfer;
    const user = transfer?.user;
    const profile = user?.profile;

    if (!metadata?.domain || !metadata?.user_id) {
      throw new Error("The transfer metadata is incomplete.");
    }
    if (!assembledKey?.armored_key || !assembledKey?.fingerprint || !assembledKey?.user_id) {
      throw new Error("The transferred private key data is incomplete.");
    }
    if (!transfer?.user_id || !user?.id || !user?.username || !profile?.first_name || !profile?.last_name) {
      throw new Error("The transfer user data is incomplete.");
    }
    if (
      metadata.user_id !== assembledKey.user_id ||
      metadata.user_id !== transfer.user_id ||
      metadata.user_id !== user.id
    ) {
      throw new Error("The transfer user does not match the transferred private key.");
    }
  }

  /**
   * Normalize the transfer domain.
   * @param {string} domain The transfer domain.
   * @returns {string}
   */
  normalizeDomain(domain) {
    const url = new URL(domain);
    if (!["https:", "http:"].includes(url.protocol)) {
      throw new Error("The transfer domain should be an HTTP or HTTPS URL.");
    }
    return url.toString();
  }

  /**
   * Read and validate a transferred private key.
   * @param {string} armoredKey The armored private key.
   * @returns {Promise<openpgp.PrivateKey>}
   */
  async readPrivateKey(armoredKey) {
    const privateKey = await OpenpgpAssertion.readKeyOrFail(armoredKey);
    OpenpgpAssertion.assertPrivateKey(privateKey);
    OpenpgpAssertion.assertEncryptedPrivateKey(privateKey);
    return privateKey;
  }

  /**
   * Get and validate the server public key.
   * @param {ApiClientOptions} apiClientOptions The API client options.
   * @returns {Promise<string>}
   */
  async getServerPublicArmoredKey(apiClientOptions) {
    const serverKeyDto = await new AuthVerifyServerKeyService(apiClientOptions).getServerKey();
    const serverKey = await OpenpgpAssertion.readKeyOrFail(serverKeyDto.armored_key);
    OpenpgpAssertion.assertPublicKey(serverKey);
    return serverKey.armor();
  }

  /**
   * Assert that the transferred user key exists on the target server.
   * @param {ApiClientOptions} apiClientOptions The API client options.
   * @param {string} fingerprint The user key fingerprint.
   * @param {string} serverPublicArmoredKey The server public key.
   * @returns {Promise<void>}
   */
  async assertKeyIsKnownByServer(apiClientOptions, fingerprint, serverPublicArmoredKey) {
    try {
      await new AuthVerifyServerChallengeService(apiClientOptions).verifyAndValidateServerChallenge(
        fingerprint,
        serverPublicArmoredKey,
      );
    } catch (error) {
      throw new Error("The transferred private key does not match an account on this Passbolt server.", {
        cause: error,
      });
    }
  }

  /**
   * Build a default security token for the imported account.
   * @param {string} fingerprint The imported account key fingerprint.
   * @returns {{code: string, color: string, textcolor: string}}
   */
  buildSecurityToken(fingerprint) {
    return {
      code: fingerprint.slice(0, 3),
      color: "#8bc34a",
      textcolor: "#000000",
    };
  }
}

export default ImportMobileTransferAccountController;
