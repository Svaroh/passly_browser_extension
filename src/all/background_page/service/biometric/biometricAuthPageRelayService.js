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

import WorkerService from "../worker/workerService";
import BrowserTabService from "../ui/browserTab.service";
import WorkersSessionStorage from "../sessionStorage/workersSessionStorage";
import User from "../../model/user";

const PAGE_WORKER_RETRY_DELAY = 100;
const PAGE_WORKER_RETRY_COUNT = 100;

class BiometricAuthPageRelayService {
  /**
   * Relay a biometric WebAuthn request to the Passbolt HTTPS page content script.
   * @param {object} worker The requester worker.
   * @param {string} message The message.
   * @param {...*} args The message arguments.
   * @returns {Promise<*>}
   */
  static async request(worker, message, ...args) {
    const pageWorker = await this.getPageWorker(worker);
    return pageWorker.port.request(message, ...args);
  }

  /**
   * Get the bootstrap content script worker in the requester tab.
   * @param {object} worker The requester worker.
   * @returns {Promise<object>}
   */
  static async getPageWorker(worker) {
    const workerNames = this.getCandidateWorkerNames(worker);
    const tabIds = await this.getCandidateTabIds(worker, workerNames);
    const pageWorker = await this.findPageWorker(tabIds, workerNames);
    if (pageWorker) {
      return pageWorker;
    }

    const tab = await this.openTrustedDomainTab();
    return this.waitForPageWorker(tab.id, workerNames);
  }

  /**
   * Find a Passbolt page worker among candidate tabs.
   * @param {number[]} tabIds The tab ids.
   * @param {string[]} workerNames The candidate worker names.
   * @returns {Promise<object|null>}
   */
  static async findPageWorker(tabIds, workerNames) {
    for (const tabId of tabIds) {
      for (const workerName of workerNames) {
        try {
          return await WorkerService.get(workerName, tabId);
        } catch (error) {
          console.debug(error);
        }
      }
    }
    return null;
  }

  /**
   * Open the trusted Passbolt domain to bootstrap a HTTPS page worker.
   * @returns {Promise<browser.tabs.Tab>}
   */
  static async openTrustedDomainTab() {
    const trustedDomain = User.getInstance().settings.getDomain();
    return browser.tabs.create({ url: trustedDomain, active: true });
  }

  /**
   * Wait for a Passbolt page worker to be registered in the given tab.
   * @param {number} tabId The tab id.
   * @param {string[]} workerNames The candidate worker names.
   * @returns {Promise<object>}
   */
  static async waitForPageWorker(tabId, workerNames) {
    for (let retry = 0; retry < PAGE_WORKER_RETRY_COUNT; retry++) {
      const pageWorker = await this.findPageWorker([tabId], workerNames);
      if (pageWorker) {
        return pageWorker;
      }
      await this.sleep(PAGE_WORKER_RETRY_DELAY);
    }
    throw new Error("Could not find a Passbolt page worker for biometric authentication.");
  }

  /**
   * Sleep for a number of milliseconds.
   * @param {number} delay The delay.
   * @returns {Promise<void>}
   */
  static sleep(delay) {
    return new Promise((resolve) => setTimeout(resolve, delay));
  }

  /**
   * Get candidate tab ids for the Passbolt HTTPS page worker.
   * @param {object} worker The requester worker.
   * @param {string[]} workerNames The candidate worker names.
   * @returns {Promise<number[]>}
   */
  static async getCandidateTabIds(worker, workerNames) {
    const tabIds = [];
    const addTabId = (tabId) => {
      if (Number.isInteger(tabId) && !tabIds.includes(tabId)) {
        tabIds.push(tabId);
      }
    };

    if (worker?.tab?.id) {
      addTabId(worker.tab.id);
    }

    try {
      const currentTab = await BrowserTabService.getCurrent();
      addTabId(currentTab?.id);
    } catch (error) {
      console.debug(error);
    }

    const pageWorkers = await WorkersSessionStorage.getWorkersByNames(workerNames);
    pageWorkers.forEach((worker) => addTabId(worker.tabId));

    if (!tabIds.length) {
      throw new Error("Could not find a Passbolt tab for biometric authentication.");
    }
    return tabIds;
  }

  /**
   * Get candidate bootstrap workers for the requester.
   * @param {object} worker The requester worker.
   * @returns {string[]}
   */
  static getCandidateWorkerNames(worker) {
    if (worker?.name === "Recover") {
      return ["RecoverBootstrap", "AuthBootstrap", "AppBootstrap"];
    }
    return ["AuthBootstrap", "AppBootstrap", "RecoverBootstrap"];
  }
}

export default BiometricAuthPageRelayService;
