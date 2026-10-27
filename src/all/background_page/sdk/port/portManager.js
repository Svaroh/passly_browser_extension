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
import Port from "../port";
import PagemodManager from "../../pagemod/pagemodManager";
import WorkersSessionStorage from "../../service/sessionStorage/workersSessionStorage";
import WorkerEntity from "../../model/entity/worker/workerEntity";
import { PASSKEY_PROVIDER_PORT_NAME } from "../../../passkey/passkeyProviderConstants";

class PortManager {
  constructor() {
    this._ports = {}; // Object{portId: port, ...} for which the port is available
    this.onPortConnect = this.onPortConnect.bind(this);
    this.onTabRemoved = this.onTabRemoved.bind(this);
  }

  /**
   * on port connect
   * @param port the port
   * @returns {Promise<void>}
   */
  async onPortConnect(port) {
    if (this.isPasskeyPort(port)) {
      return;
    }
    if (await this.isQuickAccessPort(port.sender, port)) {
      // Quickaccess is not stored in the session storage and there is no worker entity referenced
      await this.registerAndAttachEvent(port, "QuickAccess");
    } else if (await this.isSigninPort(port)) {
      // The local sign in page of the extension
      await this.registerAndAttachEvent(port, "Auth");
    } else if (await this.isWorkspacePort(port)) {
      // The extension-hosted workspace container or detached app
      await this.registerAndAttachEvent(port, "App");
    } else if (await this.isMobileTransferEntrypointPort(port)) {
      // The local setup/recover entrypoint is an extension tab and does not have a bootstrap worker.
      await this.registerAndAttachEvent(port, "MobileTransferEntrypoint");
    } else {
      await this.connectPortFromTab(port);
    }
  }

  /**
   * Connect port from tab
   * @param port the port
   * @returns {Promise<void>}
   */
  async connectPortFromTab(port) {
    const worker = await WorkersSessionStorage.getWorkerById(port.name);
    if (worker) {
      const workerEntity = new WorkerEntity(worker);
      /*
       * If a port is already connected and is still in memory it should not be registered again
       * In the MV3 case the memory is flushed when the service worker is down so the port should be able to reconnect
       */
      if (!this.isPortExist(port.name) && (await this.isKnownPortSender(workerEntity, port.sender))) {
        await this.updateWorkerStatus(workerEntity);
        await this.registerAndAttachEvent(port, workerEntity.name);
      }
    }
  }

  /**
   * Is quickAccess port sender
   * @param sender
   * @param port
   * @returns {Promise<boolean>}
   */
  async isQuickAccessPort(sender, port = null) {
    const quickAppUrl = await browser.runtime.getURL("/webAccessibleResources/quickaccess.html");
    const isPortUrlAQuickAppUrl = sender?.url?.startsWith(quickAppUrl);
    if (isPortUrlAQuickAppUrl) {
      return true;
    }
    return port?.name === "quickaccess";
  }

  /**
   * Is signin port
   * @param port
   * @returns {Promise<boolean>}
   */
  async isSigninPort(port) {
    const signinUrl = await browser.runtime.getURL("/webAccessibleResources/signin.html");
    return port?.name === "signin" || Boolean(port?.sender?.url?.startsWith(signinUrl));
  }

  /**
   * Is workspace port
   * @param port
   * @returns {Promise<boolean>}
   */
  async isWorkspacePort(port) {
    const workspaceUrl = await browser.runtime.getURL("/webAccessibleResources/workspace.html");
    const appUrl = await browser.runtime.getURL("/webAccessibleResources/passbolt-iframe-app.html");
    return (
      port?.name === "workspace" ||
      Boolean(port?.sender?.url?.startsWith(workspaceUrl)) ||
      Boolean(port?.sender?.url?.startsWith(appUrl))
    );
  }

  /**
   * Is mobile transfer entrypoint port
   * @param port
   * @returns {Promise<boolean>}
   */
  async isMobileTransferEntrypointPort(port) {
    const entrypointUrl = await browser.runtime.getURL("/webAccessibleResources/mobile-transfer-entrypoint.html");
    return port.name === "mobile-transfer-entrypoint" && port.sender.url.startsWith(entrypointUrl);
  }

  /**
   * Is passkey provider runtime port
   * @param port
   * @returns {boolean}
   */
  isPasskeyPort(port) {
    return port?.name === PASSKEY_PROVIDER_PORT_NAME;
  }

  /**
   * Is known port sender
   * @param {WorkerEntity} worker The worker
   * @param sender The sender
   * @returns {Promise<boolean>}
   */
  async isKnownPortSender(worker, sender) {
    // Iframe application connecting for the first time are not know therefor their frame id is not yet associated
    if (worker.frameId === null) {
      worker.frameId = sender.frameId;
    }

    if (worker.frameId === 0 && worker.url && worker.tabId === sender.tab.id && worker.url === sender.url) {
      worker.frameId = sender.frameId;
    }

    return worker.tabId === sender.tab.id && worker.frameId === sender.frameId;
  }

  /**
   * Register and attach event to the port
   * @param port The port
   * @param {string} name The pagemod name
   * @returns {Promise<void>}
   */
  async registerAndAttachEvent(port, name) {
    const portWrapper = new Port(port);
    this.registerPort(portWrapper);
    await PagemodManager.attachEventToPort(portWrapper, name);
    portWrapper.emit("passbolt.port.ready");
  }

  /**
   * Update the worker status
   * @param {WorkerEntity} worker The worker
   * @return {Promise<void>}
   */
  async updateWorkerStatus(worker) {
    worker.status = WorkerEntity.STATUS_CONNECTED;
    await WorkersSessionStorage.updateWorker(worker);
  }

  /**
   * Register the port
   * @param port
   */
  registerPort(port) {
    this._ports[port._port.name] = port;
  }

  /**
   * Disconnect and remove the port
   * @param {string} id the id
   * @param {object} removeInfo The remove info
   * @returns <void>
   */
  removePort(id, removeInfo = null) {
    // The port will be disconnected automatically after a tab is removed
    if (!removeInfo) {
      // Disconnect the port manually when the user navigate to another page (browser will disconnect too late)
      this._ports[id]?.disconnect();
    }
    delete this._ports[id];
  }

  /**
   * Is port exist
   * @param {string} id The id
   * @returns {boolean}
   */
  isPortExist(id) {
    return Boolean(this._ports[id]?.isConnected());
  }

  /**
   * Get the port by id
   * @param {string} id The id
   * @returns {Port}
   */
  getPortById(id) {
    return this._ports[id];
  }

  /**
   * Flush.
   * @returns {Promise<void>}
   */
  async flush() {
    this._ports = {};
    await WorkersSessionStorage.flush();
  }

  /**
   * On tab removed, remove associated worker from the session storage and delete runtime ports references.
   * @param {number} tabId The tab id
   * @param {object} removeInfo The remove info (only present on tab on removed event)
   * @returns {Promise<void>}
   */
  async onTabRemoved(tabId, removeInfo = null) {
    if (typeof tabId === "undefined") {
      throw new Error("A tab identifier is required.");
    }
    if (!Number.isInteger(tabId)) {
      throw new Error("The tab identifier should be a valid integer.");
    }
    const workers = await WorkersSessionStorage.getWorkersByTabId(tabId);
    workers.forEach((worker) => this.removePort(worker.id, removeInfo));
    await WorkersSessionStorage.deleteByTabId(tabId);
  }
}

export default new PortManager();
