/**
 * Passbolt ~ Open source password manager for teams
 * Copyright (c) 2023 Passbolt SA (https://www.passbolt.com)
 *
 * Licensed under GNU Affero General Public License version 3 of the or any later version.
 * For full copyright and license information, please see the LICENSE.txt
 * Redistributions of files must retain the above copyright notice.
 *
 * @copyright     Copyright (c) 2023 Passbolt SA (https://www.passbolt.com)
 * @license       https://opensource.org/licenses/AGPL-3.0 AGPL License
 * @link          https://www.passbolt.com Passbolt(tm)
 * @since         4.0.0
 */
import WorkersSessionStorage from "../sessionStorage/workersSessionStorage";
import hasUrlSameOrigin from "../../utils/url/hasSameOriginUrl";
import PortManager from "../../sdk/port/portManager";
import WebNavigationService from "../webNavigation/webNavigationService";
import PromiseTimeoutService from "../../utils/promise/promiseTimeoutService";
import WorkerEntity from "../../model/entity/worker/workerEntity";
import WorkerService from "../worker/workerService";
import BrowserTabService from "../ui/browserTab.service";
import ParseAppUrlService from "../app/parseAppUrlService";

class TabService {
  /**
   * Handle tabs onUpdated events.
   * Used by Chrome and Firefox entry points.
   * @see /doc/worker-port-lifecycle.md to know more about worker and content script applications port lifecycle.
   *
   * @param {number} tabId The tab id
   * @param {object} changeInfo The change info of the tab
   * @param {object} tab The tab
   * @returns {Promise<void>}
   */
  static async exec(tabId, changeInfo, tab) {
    // ignore loading requests
    if (changeInfo.status !== "complete") {
      return;
    }

    // ignore about:blank urls they can not be interacted with anyway
    if (tab.url === "about:blank") {
      return;
    }
    /*
     * We can't insert scripts if the url is not https or http
     * as this is not allowed, instead we insert the scripts manually in the background page if needed
     */
    if (!(tab?.url?.startsWith("http://") || tab?.url?.startsWith("https://"))) {
      return;
    }

    await TabService.handleNavigation(tabId, tab.url);
  }

  /**
   * Handle a completed top-frame navigation. Manages worker lifecycle and triggers pagemod identification.
   * Shared by both tabs.onUpdated (exec) and webNavigation.onCompleted (execNavigationCompletion) entry points.
   * @param {number} tabId The tab id
   * @param {string} url The URL the tab navigated to
   * @returns {Promise<void>}
   */
  static async handleNavigation(tabId, url) {
    // Get the worker on the main frame
    const worker = await WorkersSessionStorage.getWorkerOnMainFrame(tabId);

    /*
     * If there is still a worker in memory relative to the tab top frame. It means that the tab was previously
     * identified by a pagemod and a worker attached to it.
     *
     * If an application remains active on the tab, abort the pagemods identification process, otherwise start
     * the process and flush the previous worker attached to this tab.
     */
    if (worker) {
      const workerEntity = new WorkerEntity(worker);
      /*
       * A pagemod might already trying to attach a worker to the tab and is awaiting the content script to open or
       * reopen the port and connect to it. It can happen when the navigation event fires too many events, especially
       * happening when a user reloads the tab multiple times very fast.
       *
       * To avoid this scenario, ensure that the worker attachment process triggered by the first navigation
       * event had time to complete its treatment. The attachment will be completed when the content script inserted
       * in the tab successfully opened the port and connect to the background script.
       *
       * To avoid any deadlock on the tab, if the content script was not able to connect to the background page within
       * 300ms, treat the last navigation event and trigger a pagemod identification process on it.
       */
      if (workerEntity.isWaitingConnection || workerEntity.isReconnecting) {
        if (workerEntity.url && TabService.hasSameDocumentUrl(workerEntity.url, url)) {
          return;
        }
        await WorkerService.checkAndExecNavigationForWorkerWaitingConnection(workerEntity);
        return;
      }

      /*
       * If a port associated to this worker still exists in memory, try to connect to the content script application
       * that opened it.
       */
      if (PortManager.isPortExist(worker.id)) {
        // Port exists in runtime memory.
        const port = PortManager.getPortById(workerEntity.id);
        /*
         * Only try to connect with the content script application if the origin of the tab url is similar to the
         * origin of the application url referenced by the associated port. If the origin change, the tab DOM has
         * been flushed and within any application on it.
         */
        const workerUrl = workerEntity.url || port._port.sender.url;
        const canUseExistingPort =
          TabService.hasSameDocumentUrl(workerUrl, url) || TabService.isAppBootstrapRouteNavigation(workerEntity, url);
        if (hasUrlSameOrigin(workerUrl, url) && canUseExistingPort) {
          try {
            await PromiseTimeoutService.exec(port.request("passbolt.port.check"), 1000);
            return;
          } catch (error) {
            console.error(error);
            /*
             * Timeout could be reached if the application is slow and do not receive acknowledgement from the port in 1000ms.
             * Detect if url or port has been changed and do nothing if it's  the case.
             * If nothing change could be related to a very slow performance issue or same url navigation same port.
             * Then retry for 1500ms if any error or timeout start a new navigation
             */
            if (error?.name === "TimeoutError") {
              const tab = await BrowserTabService.getById(tabId);
              if (tab.url !== url) {
                return;
              } else if (!PortManager.isPortExist(worker.id)) {
                return;
              } else {
                try {
                  await PromiseTimeoutService.exec(port.request("passbolt.port.check"), 1500);
                  return;
                } catch {
                  // Continue with a fresh pagemod identification process.
                }
              }
            }
          }
        }
      } else {
        /*
         * If the worker port cannot be found in runtime memory, it could be due to the browser stopping the service
         * worker (MV3) and with it disconnecting all the ports. If any application remains on the tab message it and
         * request it to reconnect its port.
         */
        try {
          workerEntity.status = WorkerEntity.STATUS_RECONNECTING;
          await WorkersSessionStorage.updateWorker(workerEntity);
          await BrowserTabService.sendMessage(workerEntity, "passbolt.port.connect", workerEntity.id);
          return;
        } catch {
          // Continue with a fresh pagemod identification process.
        }
      }
    }

    // Execute the process of a web navigation to detect pagemod and script to insert
    const frameDetails = {
      frameId: 0,
      tabId: tabId,
      url: url,
    };
    await WebNavigationService.exec(frameDetails);
  }

  /**
   * Whether two URLs point to the same loaded document for a content script.
   * The hash is ignored because it does not reload the document, while query/path changes do.
   * @param {string} portUrl The URL recorded on the runtime port sender.
   * @param {string} navigationUrl The URL from the browser navigation event.
   * @returns {boolean}
   */
  static hasSameDocumentUrl(portUrl, navigationUrl) {
    try {
      const portUrlObject = new URL(portUrl);
      const navigationUrlObject = new URL(navigationUrl);
      return (
        portUrlObject.origin === navigationUrlObject.origin &&
        portUrlObject.pathname === navigationUrlObject.pathname &&
        portUrlObject.search === navigationUrlObject.search
      );
    } catch {
      return false;
    }
  }

  /**
   * Whether an AppBootstrap worker can keep handling an application route navigation.
   * Passbolt app route changes can update the top-frame URL while the injected app shell remains alive.
   * @param {WorkerEntity} workerEntity The worker entity.
   * @param {string} navigationUrl The URL from the browser navigation event.
   * @returns {boolean}
   */
  static isAppBootstrapRouteNavigation(workerEntity, navigationUrl) {
    if (workerEntity.name !== "AppBootstrap") {
      return false;
    }

    return ParseAppUrlService.test(navigationUrl);
  }
}

export default TabService;
