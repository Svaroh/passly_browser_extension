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
import BrowserFirstLoginPrivateKeyPayloadService from "../../service/mobileTransfer/browserFirstLoginPrivateKeyPayloadService";
import { OpenpgpAssertion } from "../../utils/openpgp/openpgpAssertions";
import { Config } from "../../model/config";
import storage from "../../sdk/storage";

class ImportBrowserFirstLoginAccountController {
  /**
   * Import the Android-transferred account locally with its encrypted private key.
   * @param {string} domain The Passbolt domain.
   * @param {object} browserFirstLoginRequest The completed first-login request.
   * @param {string} secret The QR pairing secret.
   * @returns {Promise<AccountEntity>}
   */
  async exec(domain, browserFirstLoginRequest, secret) {
    this.assertBrowserFirstLoginRequest(browserFirstLoginRequest);
    await this.ensureLegacyStorageInitialized();

    const normalizedDomain = this.normalizeDomain(domain);
    const apiClientOptions = BuildApiClientOptionsService.buildFromDomain(normalizedDomain);
    const privateKeyPayload = await BrowserFirstLoginPrivateKeyPayloadService.decrypt(
      browserFirstLoginRequest.encrypted_private_key,
      secret,
    );
    this.assertPrivateKeyPayload(privateKeyPayload, browserFirstLoginRequest);
    const privateKey = await this.readPrivateKey(privateKeyPayload.armored_key);
    const fingerprint = privateKey.getFingerprint().toUpperCase();
    if (fingerprint !== browserFirstLoginRequest.user_key_fingerprint.toUpperCase()) {
      throw new Error("The browser first-login private key fingerprint does not match the selected account.");
    }

    const serverPublicArmoredKey = await this.getServerPublicArmoredKey(apiClientOptions);
    await this.assertKeyIsKnownByServer(apiClientOptions, fingerprint, serverPublicArmoredKey);

    const account = new AccountEntity(
      {
        domain: normalizedDomain,
        user_id: privateKeyPayload.user_id,
        username: privateKeyPayload.username,
        first_name: privateKeyPayload.first_name,
        last_name: privateKeyPayload.last_name,
        locale: privateKeyPayload.locale || null,
        role_name: privateKeyPayload.role_name || null,
        user_key_fingerprint: fingerprint,
        user_public_armored_key: privateKey.toPublic().armor(),
        user_private_armored_key: privateKey.armor(),
        server_public_armored_key: serverPublicArmoredKey,
        security_token: this.buildSecurityToken(fingerprint),
      },
      { validateUsername: false },
    );

    await new AccountModel().add(account);
    await this.persistLegacyStorage();
    return account;
  }

  /**
   * Ensure the legacy active-account storage cache is loaded before importing.
   * @returns {Promise<void>}
   */
  async ensureLegacyStorageInitialized() {
    await storage.init();
    Config.init();
  }

  /**
   * Assert browser-first-login request data.
   * @param {object} browserFirstLoginRequest The first-login request.
   * @returns {void}
   */
  assertBrowserFirstLoginRequest(browserFirstLoginRequest) {
    if (
      !browserFirstLoginRequest?.user_id ||
      !browserFirstLoginRequest?.user_key_fingerprint ||
      !browserFirstLoginRequest?.encrypted_private_key
    ) {
      throw new Error("The browser first-login account data is incomplete.");
    }
  }

  /**
   * Assert Android private-key payload data.
   * @param {object} privateKeyPayload The decrypted private-key payload.
   * @param {object} browserFirstLoginRequest The first-login request.
   * @returns {void}
   */
  assertPrivateKeyPayload(privateKeyPayload, browserFirstLoginRequest) {
    if (
      !privateKeyPayload?.armored_key ||
      !privateKeyPayload?.user_id ||
      !privateKeyPayload?.fingerprint ||
      !privateKeyPayload?.username ||
      !privateKeyPayload?.first_name ||
      !privateKeyPayload?.last_name
    ) {
      throw new Error("The browser first-login private key payload is incomplete.");
    }
    if (privateKeyPayload.user_id !== browserFirstLoginRequest.user_id) {
      throw new Error("The browser first-login private key does not belong to the selected account.");
    }
    if (privateKeyPayload.fingerprint.toUpperCase() !== browserFirstLoginRequest.user_key_fingerprint.toUpperCase()) {
      throw new Error("The browser first-login private key fingerprint does not match the selected account.");
    }
  }

  /**
   * Normalize the domain.
   * @param {string} domain The Passbolt domain.
   * @returns {string}
   */
  normalizeDomain(domain) {
    const url = new URL(domain);
    if (!["https:", "http:"].includes(url.protocol)) {
      throw new Error("The browser first-login domain should be an HTTP or HTTPS URL.");
    }
    return url.toString().replace(/\/+$/g, "");
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
   * Read and validate the Android-transferred private key.
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
      throw new Error("The browser first-login private key does not match an account on this Passbolt server.", {
        cause: error,
      });
    }
  }

  /**
   * Persist legacy active-account storage writes.
   * @returns {Promise<void>}
   */
  async persistLegacyStorage() {
    const legacyStorageData = JSON.parse(JSON.stringify(storage._data));
    await browser.storage.local.set({ _passbolt_data: legacyStorageData });
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

export default ImportBrowserFirstLoginAccountController;
