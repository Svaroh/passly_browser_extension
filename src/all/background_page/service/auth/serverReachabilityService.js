/**
 * Passly - Open source password manager for teams
 * Copyright (c) 2026 Svaroh
 *
 * Licensed under GNU Affero General Public License version 3 of the or any later version.
 * For full copyright and license information, please see the LICENSE.txt
 * Redistributions of files must retain the above copyright notice.
 *
 * @copyright     Copyright (c) Svaroh
 * @license       https://opensource.org/licenses/AGPL-3.0 AGPL License
 * @link          https://passly.svaroh.net Passly
 * @since         6.0.10
 */

const REACHABILITY_TIMEOUT_MS = 2500;

/**
 * Tells whether the API can be reached right now.
 *
 * Used to decide where a request to open the vault should land: the workspace served by the API when it answers, the
 * copy carried by the extension when it does not. The check has to be quick - somebody clicked and is waiting - and
 * its answer is never cached, because reachability is exactly the thing that changes from one moment to the next.
 */
class ServerReachabilityService {
  /**
   * @param {string} domain the API domain
   * @returns {Promise<boolean>} false when the request failed at the transport level
   */
  static async isReachable(domain) {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      return false;
    }
    try {
      await fetch(domain, {
        method: "HEAD",
        cache: "no-store",
        credentials: "omit",
        signal: AbortSignal.timeout(REACHABILITY_TIMEOUT_MS),
      });
      // any answer, even an unhappy one, means the server is there
      return true;
    } catch (error) {
      if (error?.name === "TimeoutError") {
        /*
         * Slow is not gone. A device busy fetching a large vault can miss this budget while the server is perfectly
         * fine, and answering "unreachable" here sends a working tab to the offline copy - which reloads, refreshes,
         * and makes the next probe slower still. Ambiguity counts as reachable.
         */
        console.debug(`The server at ${domain} did not answer within the probe budget, assuming it is there`);
        return true;
      }
      console.debug(`The server at ${domain} could not be reached: ${error?.message}`);
      return false;
    }
  }
}

export default ServerReachabilityService;
export { REACHABILITY_TIMEOUT_MS };
