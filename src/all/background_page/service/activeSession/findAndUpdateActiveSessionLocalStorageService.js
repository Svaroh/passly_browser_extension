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
import ActiveSessionLocalStorage from "../local_storage/activeSessionLocalStorage";
import AuthenticationStatusService from "../authenticationStatusService";
import UserActiveSessionEntity, {
  USER_ACTIVE_SESSION_OFFLINE,
  USER_ACTIVE_SESSION_ONLINE,
} from "passbolt-styleguide/src/shared/models/entity/session/userActiveSessionEntity";
import FindServerStatusService from "../status/findServerStatusService";
import Log from "../../model/log";
import MfaAuthenticationRequiredError from "../../error/mfaAuthenticationRequiredError";

const FIND_AND_UPDATE_ACTIVE_SESSION_LS_LOCK_PREFIX = "FIND_AND_UPDATE_ACTIVE_SESSION_LS_LOCK-";

/**
 * The service aims to find and update user active session and store it in the local storage.
 */
export default class FindAndUpdateActiveSessionLocalStorageService {
  /**
   * @constructor
   * @param {AccountEntity} account The user account
   * @param {ApiClientOptions} apiClientOptions The api client options
   */
  constructor(account, apiClientOptions) {
    this.account = account;
    this.authenticationStatusService = new AuthenticationStatusService(apiClientOptions);
    this.findServerStatusService = new FindServerStatusService(apiClientOptions);
    this.activeSessionLocalStorage = new ActiveSessionLocalStorage(account);
  }

  /**
   * Find the user active session
   * If no session, check server status and create an online or offline active session
   * Else
   *  - Update the is server reachable property
   *  - If not authenticated
   *    - Update the type of session accordingly to the is server reachable property
   *  - If Session is online and server reachable
   *    - Retrieve the authentication status from the API and update them in the active session local storage.
   * @returns {Promise<UserActiveSessionEntity>}
   */
  async findAndUpdateAuthenticationStatus() {
    const lockKey = `${FIND_AND_UPDATE_ACTIVE_SESSION_LS_LOCK_PREFIX}${this.account.id}`;

    // If no update is in progress, refresh the session storage.
    return await navigator.locks.request(lockKey, { ifAvailable: true }, async (lock) => {
      // Lock not granted, an update is already in progress. Wait for its completion and return the value of the session storage.
      if (!lock) {
        return await navigator.locks.request(
          lockKey,
          { mode: "shared" },
          async () => new UserActiveSessionEntity(await this.activeSessionLocalStorage.get()),
        );
      }

      // Lock is granted, retrieve the user active session.
      const userActiveSessionDto = await this.activeSessionLocalStorage.get();
      let userActiveSessionEntity;
      // If no active session create a default one
      if (!userActiveSessionDto) {
        userActiveSessionEntity = await this._createDefaultUserActiveSession();
      } else {
        try {
          userActiveSessionEntity = new UserActiveSessionEntity(userActiveSessionDto);
          await this._updateExistingActiveSessionAuthenticationStatus(userActiveSessionEntity);
        } catch (error) {
          console.error(error);
          Log.write({ level: "debug", message: `Create a new user active session due to an issue: ${error.message}` });
          userActiveSessionEntity = await this._createDefaultUserActiveSession();
          if (userActiveSessionEntity.isSessionOnline) {
            await this._updateAuthenticationStatus(userActiveSessionEntity);
          }
        }
      }

      await this.activeSessionLocalStorage.set(userActiveSessionEntity);
      return userActiveSessionEntity;
    });
  }

  /**
   * Create a user active session entity
   * @return {Promise<UserActiveSessionEntity>}
   * @private
   */
  async _createDefaultUserActiveSession() {
    const isServerReachable = await this.findServerStatusService.find();
    const userActiveSessionDto = {
      is_authenticated: false,
      is_mfa_required: false,
      is_server_reachable: isServerReachable,
      type: isServerReachable ? USER_ACTIVE_SESSION_ONLINE : USER_ACTIVE_SESSION_OFFLINE,
    };
    return new UserActiveSessionEntity(userActiveSessionDto);
  }

  /**
   * Update the authentication status of a user active session
   * @param userActiveSessionEntity
   * @return {Promise<void>}
   * @private
   */
  async _updateAuthenticationStatus(userActiveSessionEntity) {
    try {
      userActiveSessionEntity.isAuthenticated = await this.authenticationStatusService.isAuthenticated();
      userActiveSessionEntity.isMfaRequired = false;
    } catch (error) {
      if (!(error instanceof MfaAuthenticationRequiredError)) {
        console.error(error);
        userActiveSessionEntity.isServerReachable = false;
        return;
      }
      userActiveSessionEntity.isAuthenticated = true;
      userActiveSessionEntity.isMfaRequired = true;
    }
  }

  /**
   * Update user active session
   * @param {UserActiveSessionEntity} userActiveSessionEntity
   * @return {Promise<void>}
   * @private
   */
  async _updateExistingActiveSessionAuthenticationStatus(userActiveSessionEntity) {
    userActiveSessionEntity.isServerReachable = await this.findServerStatusService.find();

    // An unauthenticated session derives its type from server reachability.
    if (!userActiveSessionEntity.isAuthenticated) {
      userActiveSessionEntity.type = userActiveSessionEntity.isServerReachable
        ? USER_ACTIVE_SESSION_ONLINE
        : USER_ACTIVE_SESSION_OFFLINE;
    }

    // Refresh the authentication status for an online, reachable session.
    if (userActiveSessionEntity.isSessionOnline && userActiveSessionEntity.isServerReachable) {
      await this._updateAuthenticationStatus(userActiveSessionEntity);
    }
  }
}
