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
import { Html5Qrcode } from "html5-qrcode";
import jsSHA from "jssha";

const PROTOCOL_VERSION_QR_TRANSFER = 1;
const FIRST_PAGE = 0;
const TRANSFER_STATUS_IN_PROGRESS = "in progress";
const TRANSFER_STATUS_COMPLETE = "complete";
const TRANSFER_STATUS_ERROR = "error";
const TRANSFER_STATUS_CANCEL = "cancel";

class MobileTransferQrParser {
  constructor(currentUrl = window.location.href, options = {}) {
    this.currentUrl = currentUrl;
    this.options = {
      assertCurrentUrlMatchesMetadata: true,
      ...options,
    };
    this.reset();
  }

  reset() {
    this.metadata = null;
    this.pages = new Map();
    this.lastAcceptedPage = -1;
  }

  parse(rawQrData) {
    if (typeof rawQrData !== "string" || rawQrData.length <= 3) {
      throw new Error("This is not a valid Passbolt transfer QR code.");
    }

    const version = Number.parseInt(rawQrData.slice(0, 1), 16);
    const page = Number.parseInt(rawQrData.slice(1, 3), 16);

    if (version !== PROTOCOL_VERSION_QR_TRANSFER || Number.isNaN(page)) {
      throw new Error("This is not a Passbolt account transfer QR code.");
    }

    return {
      version,
      page,
      payload: rawQrData.slice(3),
    };
  }

  accept(rawQrData) {
    const qrPage = this.parse(rawQrData);

    if (this.pages.has(qrPage.page)) {
      return { type: "duplicate", page: qrPage.page };
    }

    if (qrPage.page === FIRST_PAGE) {
      return this.acceptFirstPage(qrPage);
    }

    return this.acceptSubsequentPage(qrPage);
  }

  acceptFirstPage(qrPage) {
    if (this.metadata) {
      throw new Error("The first transfer QR code has already been scanned.");
    }

    const metadata = JSON.parse(qrPage.payload);
    this.assertValidMetadata(metadata);
    if (this.options.assertCurrentUrlMatchesMetadata) {
      this.assertCurrentUrlMatchesMetadata(metadata);
    }

    this.metadata = metadata;
    this.pages.set(qrPage.page, null);
    this.lastAcceptedPage = FIRST_PAGE;

    return {
      type: "first-page",
      page: qrPage.page,
      metadata,
      nextPage: FIRST_PAGE + 1,
      totalPages: metadata.total_pages,
    };
  }

  acceptSubsequentPage(qrPage) {
    if (!this.metadata) {
      throw new Error("Scan the first transfer QR code before scanning the key pages.");
    }

    const expectedPage = this.lastAcceptedPage + 1;
    if (qrPage.page !== expectedPage) {
      throw new Error(`Scan QR code page ${expectedPage + 1} next.`);
    }

    if (qrPage.page >= this.metadata.total_pages) {
      throw new Error("The scanned transfer QR code page is outside the expected range.");
    }

    this.pages.set(qrPage.page, qrPage.payload);
    this.lastAcceptedPage = qrPage.page;

    return {
      type: qrPage.page === this.metadata.total_pages - 1 ? "last-page" : "page",
      page: qrPage.page,
      nextPage: qrPage.page + 1,
      totalPages: this.metadata.total_pages,
    };
  }

  assembleKeyData() {
    if (!this.metadata) {
      throw new Error("The transfer metadata is missing.");
    }

    const keyJson = Array.from({ length: this.metadata.total_pages - 1 }, (_, index) => {
      const page = index + 1;
      if (!this.pages.has(page)) {
        throw new Error(`The transfer is missing QR code page ${page + 1}.`);
      }
      return this.pages.get(page);
    }).join("");

    if (this.hash(keyJson) !== this.metadata.hash) {
      throw new Error("The transferred private key checksum does not match.");
    }

    const assembledKey = JSON.parse(keyJson);
    this.assertValidAssembledKey(assembledKey);
    return assembledKey;
  }

  assembleKey() {
    return this.assembleKeyData().armored_key;
  }

  hash(value) {
    const sha = new jsSHA("SHA-512", "TEXT");
    sha.update(value);
    return sha.getHash("HEX").toLowerCase();
  }

  assertValidMetadata(metadata) {
    const requiredFields = ["transfer_id", "user_id", "total_pages", "authentication_token", "hash", "domain"];
    const missingField = requiredFields.find((field) => !metadata?.[field]);
    if (missingField) {
      throw new Error(`The transfer QR code is missing ${missingField}.`);
    }
    if (!Number.isInteger(metadata.total_pages) || metadata.total_pages < 2) {
      throw new Error("The transfer QR code has an invalid page count.");
    }
    const domain = new URL(metadata.domain);
    if (!["https:", "http:"].includes(domain.protocol)) {
      throw new Error("The transfer QR code has an invalid Passbolt server URL.");
    }
  }

  assertValidAssembledKey(assembledKey) {
    const requiredFields = ["armored_key", "user_id", "fingerprint"];
    const missingField = requiredFields.find((field) => !assembledKey?.[field]);
    if (missingField) {
      throw new Error(`The transferred key is missing ${missingField}.`);
    }
    if (assembledKey.user_id !== this.metadata.user_id) {
      throw new Error("The transferred key does not belong to the scanned transfer user.");
    }
    if (!assembledKey.armored_key.includes("-----BEGIN PGP PRIVATE KEY BLOCK-----")) {
      throw new Error("The transferred key is not an armored OpenPGP private key.");
    }
  }

  assertCurrentUrlMatchesMetadata(metadata) {
    const currentUserId = this.extractSetupOrRecoverUserId(this.currentUrl);
    if (currentUserId && metadata.user_id !== currentUserId) {
      throw new Error("The QR code belongs to a different Passbolt user.");
    }

    const currentUrl = new URL(this.currentUrl);
    const transferDomain = new URL(metadata.domain);
    if (currentUrl.origin !== transferDomain.origin) {
      throw new Error("The QR code belongs to a different Passbolt server.");
    }
  }

  extractSetupOrRecoverUserId(url) {
    const { pathname } = new URL(url);
    const match = pathname.match(/\/setup\/(?:recover\/)?start\/([0-9a-f-]{36})\/[0-9a-f-]{36}/i);
    return match?.[1] || null;
  }
}

class MobileTransferImportPageService {
  constructor(port) {
    this.port = port;
    this.parser = new MobileTransferQrParser();
    this.observer = null;
    this.scanner = null;
    this.modal = null;
    this.processingScan = false;
    this.targetTextArea = null;
  }

  static listen(port) {
    const service = new MobileTransferImportPageService(port);
    service.listen();
    return service;
  }

  listen() {
    this.injectStyle();
    this.injectButtonWhenAvailable();
    this.observer = new MutationObserver(() => this.injectButtonWhenAvailable());
    this.observer.observe(document.body, { childList: true, subtree: true });
  }

  injectStyle() {
    if (document.getElementById("passbolt-mobile-transfer-import-style")) {
      return;
    }

    const style = document.createElement("style");
    style.id = "passbolt-mobile-transfer-import-style";
    style.textContent = `
      .passbolt-mobile-transfer-import-action {
        margin-top: 1.2rem;
      }
      .passbolt-mobile-transfer-import-modal {
        align-items: center;
        background: rgba(0, 0, 0, .62);
        bottom: 0;
        display: flex;
        justify-content: center;
        left: 0;
        position: fixed;
        right: 0;
        top: 0;
        z-index: 2147483647;
      }
      .passbolt-mobile-transfer-import-dialog {
        background: #fff;
        border-radius: .4rem;
        box-shadow: 0 1.6rem 4rem rgba(0, 0, 0, .28);
        color: #111;
        max-width: 43rem;
        padding: 2.4rem;
        width: calc(100% - 3.2rem);
      }
      .passbolt-mobile-transfer-import-dialog h2 {
        font-size: 2rem;
        margin: 0 0 1.6rem;
      }
      .passbolt-mobile-transfer-import-reader {
        background: #f4f4f4;
        border-radius: .4rem;
        min-height: 28rem;
        overflow: hidden;
      }
      .passbolt-mobile-transfer-import-status {
        margin: 1.6rem 0 0;
      }
      .passbolt-mobile-transfer-import-error {
        color: #b00020;
        margin: 1.2rem 0 0;
      }
      .passbolt-mobile-transfer-import-actions {
        display: flex;
        gap: 1.2rem;
        justify-content: flex-end;
        margin-top: 2rem;
      }
    `;
    document.head.appendChild(style);
  }

  injectButtonWhenAvailable() {
    const textArea = this.findPrivateKeyTextArea();
    if (!textArea || textArea.dataset.mobileTransferImportAttached) {
      return;
    }

    textArea.dataset.mobileTransferImportAttached = "true";
    const container = document.createElement("div");
    container.className = "passbolt-mobile-transfer-import-action";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "button secondary";
    button.textContent = "Scan QR from mobile app";
    button.addEventListener("click", () => this.open(textArea));
    container.appendChild(button);
    textArea.insertAdjacentElement("afterend", container);
  }

  findPrivateKeyTextArea() {
    const textAreas = Array.from(document.querySelectorAll("textarea"));
    return textAreas.find((textArea) => {
      const placeholder = textArea.getAttribute("placeholder") || "";
      return /private key|openpgp/i.test(placeholder);
    });
  }

  async open(textArea) {
    this.targetTextArea = textArea;
    this.parser.reset();
    this.createModal();
    await this.startScanner();
  }

  createModal() {
    this.modal = document.createElement("div");
    this.modal.className = "passbolt-mobile-transfer-import-modal";

    const dialog = document.createElement("div");
    dialog.className = "passbolt-mobile-transfer-import-dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");

    const title = document.createElement("h2");
    title.textContent = "Scan QR codes from your phone";

    const reader = document.createElement("div");
    reader.id = "passbolt-mobile-transfer-import-reader";
    reader.className = "passbolt-mobile-transfer-import-reader";

    const status = document.createElement("p");
    status.className = "passbolt-mobile-transfer-import-status";
    status.textContent = "Waiting for the first QR code.";

    const error = document.createElement("p");
    error.className = "passbolt-mobile-transfer-import-error";
    error.hidden = true;

    const actions = document.createElement("div");
    actions.className = "passbolt-mobile-transfer-import-actions";

    const cancelButton = document.createElement("button");
    cancelButton.type = "button";
    cancelButton.className = "button cancel";
    cancelButton.textContent = "Cancel";
    cancelButton.addEventListener("click", () => this.cancel());
    actions.appendChild(cancelButton);

    dialog.append(title, reader, status, error, actions);
    this.modal.appendChild(dialog);
    document.body.appendChild(this.modal);
  }

  async startScanner() {
    this.scanner = new Html5Qrcode("passbolt-mobile-transfer-import-reader");
    await this.scanner.start(
      { facingMode: "environment" },
      { fps: 8, qrbox: { width: 240, height: 240 } },
      (decodedText) => this.handleScan(decodedText),
      () => {},
    );
  }

  async handleScan(decodedText) {
    if (this.processingScan) {
      return;
    }

    this.processingScan = true;
    try {
      const result = this.parser.accept(decodedText);
      if (result.type === "duplicate") {
        return;
      }

      if (result.type === "first-page") {
        await this.updateTransfer(result.nextPage, TRANSFER_STATUS_IN_PROGRESS);
        this.setStatus(`Scanned page 1 of ${result.totalPages}.`);
      } else if (result.type === "page") {
        await this.updateTransfer(result.nextPage, TRANSFER_STATUS_IN_PROGRESS);
        this.setStatus(`Scanned page ${result.page + 1} of ${result.totalPages}.`);
      } else if (result.type === "last-page") {
        const armoredKey = this.parser.assembleKey();
        this.fillPrivateKey(armoredKey);
        await this.updateTransfer(result.page, TRANSFER_STATUS_COMPLETE);
        this.setStatus("The private key was transferred.");
        this.parser.reset();
        await this.close();
      }
    } catch (error) {
      this.setError(error.message);
      await this.updateTransferErrorIfInitialized();
    } finally {
      this.processingScan = false;
    }
  }

  async updateTransfer(page, status) {
    const { transfer_id: transferId, authentication_token: authenticationToken } = this.parser.metadata;
    await this.port.request("passbolt.mobile.transfer.update-no-session", transferId, authenticationToken, {
      current_page: page,
      status,
    });
  }

  async updateTransferErrorIfInitialized() {
    if (!this.parser.metadata) {
      return;
    }
    try {
      await this.updateTransfer(this.parser.lastAcceptedPage, TRANSFER_STATUS_ERROR);
    } catch (error) {
      console.error(error);
    }
  }

  async cancel() {
    if (this.parser.metadata) {
      try {
        await this.updateTransfer(this.parser.lastAcceptedPage, TRANSFER_STATUS_CANCEL);
      } catch (error) {
        console.error(error);
      }
    }
    await this.close();
  }

  fillPrivateKey(armoredKey) {
    const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
    valueSetter.call(this.targetTextArea, armoredKey);
    this.targetTextArea.dispatchEvent(new Event("input", { bubbles: true }));
    this.targetTextArea.dispatchEvent(new Event("change", { bubbles: true }));
  }

  setStatus(message) {
    const status = this.modal?.querySelector(".passbolt-mobile-transfer-import-status");
    if (status) {
      status.textContent = message;
    }
    this.setError("");
  }

  setError(message) {
    const error = this.modal?.querySelector(".passbolt-mobile-transfer-import-error");
    if (!error) {
      return;
    }
    error.hidden = !message;
    error.textContent = message;
  }

  async close() {
    if (this.scanner) {
      try {
        await this.scanner.stop();
      } catch {
        // The scanner can already be stopped by the browser.
      }
      this.scanner.clear();
    }
    this.scanner = null;
    this.modal?.remove();
    this.modal = null;
    this.parser.reset();
  }
}

export { MobileTransferQrParser };
export default MobileTransferImportPageService;
