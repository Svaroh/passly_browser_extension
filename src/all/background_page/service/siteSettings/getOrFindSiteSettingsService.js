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
import SiteSettingsEntity from "passbolt-styleguide/src/shared/models/entity/siteSettings/siteSettingsEntity";
import SiteSettingsLocalStorage from "../local_storage/siteSettingsLocalStorage";
import FindAndUpdateSiteSettingsLocalStorageService from "./findAndUpdateSiteSettingsLocalStorageService";
import SiteSettingsRuntimeCache from "./siteSettingsRuntimeCache";
import GetOrFindActiveSessionService from "../activeSession/getOrFindActiveSessionService";

/**
 * Read entry point for site settings. Successor of the legacy
 * 'OrganizationSettingsModel.getOrFind'.
 *
 * 'getOrFind()' reads the cache that fits the session and falls back to the API.
 *
 *   | session               | cache         | API fall-back |
 *   |-----------------------|---------------|---------------|
 *   | offline               | local storage | no            |
 *   | online, authenticated | local storage | yes           |
 *   | online, anonymous     | runtime cache | yes           |
 *
 * An offline session never falls through to the API - the request cannot complete - so this is the
 * one case where the method resolves to null.
 *
 * The two caches are not interchangeable. Local storage holds what an authenticated session
 * persisted; the runtime cache holds whatever this service worker last fetched, which may be an
 * anonymous response. Hence an authenticated session never reads the
 * runtime cache, and an anonymous one never reads local storage: online it would answer 'canIUse()'
 * for plugins the API hides from anonymous callers, and the API is right there and fresher. Writes
 * follow the same rule - an anonymous response is never persisted over the richer stored settings.
 */
export default class GetOrFindSiteSettingsService {
  /**
   * @param {AccountEntity} account
   * @param {ApiClientOptions} apiClientOptions
   */
  constructor(account, apiClientOptions) {
    this.account = account;
    this.siteSettingsLocalStorage = new SiteSettingsLocalStorage(account);
    this.findAndUpdateSiteSettingsLocalStorageService = new FindAndUpdateSiteSettingsLocalStorageService(
      account,
      apiClientOptions,
    );
    this.getOrFindActiveSessionService = new GetOrFindActiveSessionService(account, apiClientOptions);
  }

  /**
   * Get the site settings from the cache that fits the session, or retrieve them from the API and
   * update the local storage.
   * @returns {Promise<SiteSettingsEntity|null>} null only on an offline session with nothing
   * persisted, the one case that cannot fall back to the API.
   */
  async getOrFind() {
    const activeSession = await this.getOrFindActiveSessionService.getOrFind();

    // An offline session cannot reach the API: the persisted store is the only source.
    if (activeSession.isSessionOffline) {
      return this._getFromLocalStorage();
    }

    const siteSettings = activeSession.isAuthenticated
      ? await this._getFromLocalStorage()
      : this._getFromRuntimeCache();

    return siteSettings ?? this.findAndUpdateSiteSettingsLocalStorageService.findAndUpdateAll();
  }

  /**
   * @returns {SiteSettingsEntity|null} null when the runtime cache is empty.
   * @private
   */
  _getFromRuntimeCache() {
    const cachedDto = SiteSettingsRuntimeCache.get();
    return cachedDto ? new SiteSettingsEntity(cachedDto) : null;
  }

  /**
   * @returns {Promise<SiteSettingsEntity|null>} null when the local storage is empty.
   * @private
   */
  async _getFromLocalStorage() {
    const lsDto = await this.siteSettingsLocalStorage.get();
    if (!lsDto) {
      return null;
    }

    const siteSettings = new SiteSettingsEntity(lsDto);
    /*
     * Mirror the persisted settings into the in-memory runtime cache. The cache is
     * service-worker-lifetime and is flushed on login (postLoginService) and lost on
     * service-worker restart, whereas SiteSettingsLocalStorage survives both. Seeding it
     * here keeps AppEmailValidatorService.validate - which reads SiteSettingsRuntimeCache
     * synchronously to validate account usernames - in sync with the persisted settings,
     * so a custom email validation regex is honored even after the cache has been dropped.
     */
    SiteSettingsRuntimeCache.set(siteSettings);
    return siteSettings;
  }
}
