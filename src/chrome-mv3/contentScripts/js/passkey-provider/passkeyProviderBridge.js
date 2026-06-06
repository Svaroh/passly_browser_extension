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
 * @since         5.12.105
 */

(() => {
  if (window.__passlyPasskeyProviderBridgeLoaded) {
    return;
  }
  window.__passlyPasskeyProviderBridgeLoaded = true;

  const CHANNEL_INIT = "passly:passkey-provider:init";
  const CHANNEL_ACK = "passly:passkey-provider:ack";
  const CHANNEL_REQUEST = "passly:passkey-provider:request";
  const CHANNEL_RESPONSE = "passly:passkey-provider:response";
  const MESSAGE_CREATE = "passly.passkey-provider.content-create";
  const MESSAGE_GET = "passly.passkey-provider.content-get";
  const MESSAGE_UVPAA = "passly.passkey-provider.content-uvpaa";
  const MESSAGE_CONFIRM = "passly.passkey-provider.confirm";
  const MESSAGE_SUSPEND = "passly.passkey-provider.suspend";
  const MESSAGE_RESUME = "passly.passkey-provider.resume";
  const PORT_NAME = "passly.passkey-provider.port";
  const PAGE_SCRIPT_PATH = "contentScripts/js/passkey-provider/passkeyProviderPageScript.js";
  const THEME_STORAGE_KEY = "_passbolt_data";
  const THEME_CONFIG_KEY = "user.settings.theme";
  const VALID_THEMES = ["default", "midgar", "solarized_light", "solarized_dark"];
  const ALLOWED_MESSAGES = new Set([
    MESSAGE_CREATE,
    MESSAGE_GET,
    MESSAGE_UVPAA,
    MESSAGE_CONFIRM,
    MESSAGE_SUSPEND,
    MESSAGE_RESUME,
  ]);

  injectPageScriptFallback();

  let token = null;

  window.addEventListener(CHANNEL_INIT, (event) => {
    if (event.source && event.source !== window) {
      return;
    }

    const nextToken = event.detail?.token;
    if (typeof nextToken !== "string" || !nextToken) {
      return;
    }

    token = nextToken;
    window.dispatchEvent(new CustomEvent(CHANNEL_ACK, { detail: { token } }));
  });

  window.addEventListener(CHANNEL_REQUEST, async (event) => {
    if (event.source && event.source !== window) {
      return;
    }
    if (!token || event.detail?.token !== token) {
      return;
    }

    const requestId = event.detail?.requestId;
    const name = event.detail?.name;
    if (typeof requestId !== "string" || typeof name !== "string") {
      return;
    }
    if (!ALLOWED_MESSAGES.has(name)) {
      dispatchResponse(requestId, {
        ok: false,
        error: {
          name: "NotAllowedError",
          message: "Passly passkey bridge rejected an unsupported request.",
        },
      });
      return;
    }

    try {
      if (name === MESSAGE_CONFIRM) {
        dispatchResponse(requestId, {
          ok: true,
          result: await showConfirmation(event.detail.requestDetails),
        });
        return;
      }

      const runtimeMessage = {
        name,
        requestDetails: event.detail.requestDetails,
      };
      const response = await sendRuntimeMessage(runtimeMessage);
      if (!response) {
        dispatchResponse(requestId, {
          ok: false,
          error: {
            name: "UnknownError",
            message: "Passly passkey provider did not return a runtime response.",
          },
        });
        return;
      }
      dispatchResponse(requestId, response);
    } catch (error) {
      dispatchResponse(requestId, {
        ok: false,
        error: {
          name: error?.name || "UnknownError",
          message: error?.message || "Passly passkey request failed.",
        },
      });
    }
  });

  /**
   * @param {string} requestId
   * @param {object} response
   */
  function dispatchResponse(requestId, response) {
    window.dispatchEvent(
      new CustomEvent(CHANNEL_RESPONSE, {
        detail: {
          token,
          requestId,
          response,
        },
      }),
    );
  }

  /**
   * Manifest MAIN-world content scripts should load the page script. This
   * fallback covers browsers/profiles where that path is blocked or the tab
   * was already open before the manifest script ran.
   */
  function injectPageScriptFallback() {
    const script = document.createElement("script");
    script.src = chrome.runtime.getURL(PAGE_SCRIPT_PATH);
    script.async = false;
    script.onload = () => script.remove();
    script.onerror = () => script.remove();
    (document.documentElement || document.head || document.body)?.appendChild(script);
  }

  /**
   * @param {object} requestDetails The request details sent by the page script.
   * @returns {Promise<{confirmed: boolean}>}
   */
  function showConfirmation(requestDetails = {}) {
    return new Promise((resolve) => {
      const copy = getConfirmationCopy(requestDetails);
      const host = document.createElement("div");
      const root = host.attachShadow({ mode: "closed" });
      const style = document.createElement("style");
      const backdrop = document.createElement("div");
      const dialog = document.createElement("section");
      const header = document.createElement("header");
      const logo = document.createElement("img");
      const title = document.createElement("h2");
      const content = document.createElement("div");
      const body = document.createElement("p");
      const footer = document.createElement("footer");
      const actions = document.createElement("div");
      const cancelButton = document.createElement("button");
      const confirmButton = document.createElement("button");

      style.textContent = `
        :host {
          all: initial;
          --passly-passkey-main-text: hsl(0, 0%, 0%);
          --passly-passkey-secondary-text: hsl(0, 0%, 43%);
          --passly-passkey-primary-background: hsl(212, 66%, 54%);
          --passly-passkey-primary-text: hsl(0, 0%, 100%);
          --passly-passkey-action-background: hsl(0, 0%, 97%);
          --passly-passkey-action-border: hsl(0, 0%, 92%);
          --passly-passkey-dialog-fill: hsl(0, 0%, 100%);
          --passly-passkey-dialog-chrome: hsl(0, 0%, 97%);
          --passly-passkey-dialog-background: hsl(0, 0%, 75%);
          --passly-passkey-shadow: hsla(0, 0%, 0%, 0.1);
          --passly-passkey-highlight: hsla(0, 0%, 100%, 0.75);
          --passly-passkey-focus: hsl(212, 66%, 54%);
          --passly-passkey-radius: 0.4rem;
          font-size: 62.5%;
        }
        :host([data-theme="midgar"]) {
          --passly-passkey-main-text: hsl(0, 0%, 100%);
          --passly-passkey-secondary-text: hsl(0, 0%, 83%);
          --passly-passkey-primary-background: hsl(212, 66%, 54%);
          --passly-passkey-primary-text: hsl(0, 0%, 100%);
          --passly-passkey-action-background: hsl(0, 0%, 15%);
          --passly-passkey-action-border: hsl(0, 0%, 25%);
          --passly-passkey-dialog-fill: hsl(0, 0%, 10%);
          --passly-passkey-dialog-chrome: hsl(0, 0%, 15%);
          --passly-passkey-dialog-background: hsl(0, 0%, 35%);
          --passly-passkey-shadow: hsla(0, 0%, 0%, 0.75);
          --passly-passkey-highlight: hsla(0, 0%, 100%, 0.35);
          --passly-passkey-focus: hsl(212, 66%, 54%);
        }
        :host([data-theme="solarized_dark"]) {
          --passly-passkey-main-text: hsl(44, 85%, 97%);
          --passly-passkey-secondary-text: hsl(51, 19%, 79%);
          --passly-passkey-primary-background: hsl(43, 72%, 50%);
          --passly-passkey-primary-text: hsl(200, 10%, 17%);
          --passly-passkey-action-background: hsl(191, 6%, 35%);
          --passly-passkey-action-border: hsl(196, 10%, 30%);
          --passly-passkey-dialog-fill: hsl(200, 10%, 17%);
          --passly-passkey-dialog-chrome: hsl(199, 13%, 25%);
          --passly-passkey-dialog-background: hsl(173, 4%, 40%);
          --passly-passkey-shadow: hsla(200, 11%, 8%, 0.85);
          --passly-passkey-highlight: hsla(72, 5%, 62%, 0.5);
          --passly-passkey-focus: hsl(43, 72%, 50%);
        }
        :host([data-theme="solarized_light"]) {
          --passly-passkey-main-text: hsl(200, 53%, 17%);
          --passly-passkey-secondary-text: hsl(140, 5%, 46%);
          --passly-passkey-primary-background: hsl(201, 54%, 43%);
          --passly-passkey-primary-text: hsl(44, 85%, 97%);
          --passly-passkey-action-background: hsl(45, 47%, 93%);
          --passly-passkey-action-border: hsl(46, 45%, 85%);
          --passly-passkey-dialog-fill: hsl(44, 85%, 97%);
          --passly-passkey-dialog-chrome: hsl(45, 47%, 93%);
          --passly-passkey-dialog-background: hsl(50, 16%, 65%);
          --passly-passkey-shadow: hsla(49, 16%, 65%, 0.75);
          --passly-passkey-highlight: hsla(44, 85%, 97%, 0.75);
          --passly-passkey-focus: hsl(201, 54%, 43%);
        }
        .backdrop {
          align-items: center;
          background: rgba(0, 0, 0, .38);
          background: color-mix(in srgb, var(--passly-passkey-dialog-background) 68%, transparent);
          box-sizing: border-box;
          display: flex;
          inset: 0;
          justify-content: center;
          padding: 20px;
          position: fixed;
          z-index: 2147483647;
        }
        .dialog {
          background: var(--passly-passkey-dialog-fill);
          border-radius: var(--passly-passkey-radius);
          box-shadow:
            0 0 0 .1rem var(--passly-passkey-action-border),
            .2rem .4rem 1.6rem var(--passly-passkey-shadow);
          box-sizing: border-box;
          color: var(--passly-passkey-main-text);
          display: flex;
          flex-direction: column;
          font-family: "Open Sans", Verdana, sans-serif;
          max-width: 42rem;
          overflow: hidden;
          width: min(42rem, calc(100vw - 4rem));
        }
        .header {
          align-items: center;
          background: var(--passly-passkey-dialog-chrome);
          border-bottom: .1rem solid var(--passly-passkey-action-border);
          box-sizing: border-box;
          display: flex;
          gap: 1.2rem;
          min-height: 5.6rem;
          padding: 1.2rem 1.6rem;
        }
        .logo {
          border-radius: .6rem;
          flex: 0 0 auto;
          height: 3.2rem;
          width: 3.2rem;
        }
        .content {
          padding: 1.6rem;
        }
        h2 {
          color: var(--passly-passkey-main-text);
          font-size: 1.8rem;
          font-weight: 600;
          letter-spacing: 0;
          line-height: 2.4rem;
          margin: 0;
        }
        p {
          color: var(--passly-passkey-secondary-text);
          font-size: 1.5rem;
          line-height: 2rem;
          margin: 0;
          overflow-wrap: break-word;
        }
        .footer {
          background: var(--passly-passkey-dialog-chrome);
          border-top: .1rem solid var(--passly-passkey-action-border);
          padding: 1.2rem 1.6rem;
        }
        .actions {
          display: flex;
          gap: .8rem;
          justify-content: flex-end;
        }
        button {
          align-items: center;
          border: none;
          border-radius: var(--passly-passkey-radius);
          box-sizing: border-box;
          cursor: pointer;
          font-family: inherit;
          font-size: 1.5rem;
          font-weight: 600;
          justify-content: center;
          letter-spacing: 0;
          line-height: 2rem;
          min-height: 3.6rem;
          min-width: 7rem;
          padding: .8rem 1.6rem;
          text-align: center;
        }
        button.secondary {
          background: var(--passly-passkey-action-background);
          box-shadow: inset 0 0 0 .1rem var(--passly-passkey-action-border);
          color: var(--passly-passkey-main-text);
        }
        button.primary {
          background: var(--passly-passkey-primary-background);
          box-shadow: inset 0 0 0 .1rem var(--passly-passkey-primary-background);
          color: var(--passly-passkey-primary-text);
        }
        button:hover {
          box-shadow:
            inset .1rem .1rem 0 0 var(--passly-passkey-highlight),
            inset -.1rem -.1rem 0 0 var(--passly-passkey-shadow),
            inset 0 0 0 .1rem currentColor;
        }
        button:focus-visible {
          box-shadow:
            0 0 .4rem var(--passly-passkey-focus),
            inset 0 0 0 .1rem var(--passly-passkey-focus);
          outline: 0;
        }
      `;
      host.dataset.theme = "default";
      backdrop.className = "backdrop";
      dialog.className = "dialog";
      dialog.setAttribute("role", "dialog");
      dialog.setAttribute("aria-modal", "true");
      header.className = "header";
      logo.className = "logo";
      logo.alt = "";
      logo.src = chrome.runtime.getURL("webAccessibleResources/img/logo/icon-48.png");
      title.textContent = copy.title;
      content.className = "content";
      body.textContent = copy.body;
      footer.className = "footer";
      actions.className = "actions";
      cancelButton.className = "secondary";
      cancelButton.type = "button";
      cancelButton.textContent = copy.cancel;
      confirmButton.className = "primary";
      confirmButton.type = "button";
      confirmButton.textContent = copy.confirm;

      header.append(logo, title);
      content.append(body);
      actions.append(cancelButton, confirmButton);
      footer.append(actions);
      dialog.append(header, content, footer);
      backdrop.append(dialog);
      root.append(style, backdrop);
      (document.documentElement || document.body).append(host);
      getCurrentTheme()
        .then((theme) => {
          host.dataset.theme = theme;
          return theme;
        })
        .catch(() => null);

      const timeoutId = setTimeout(() => finish(false), 55_000);

      function finish(confirmed) {
        clearTimeout(timeoutId);
        window.removeEventListener("keydown", handleKeydown, true);
        host.remove();
        resolve({ confirmed });
      }

      function handleKeydown(event) {
        if (event.key === "Escape") {
          event.stopPropagation();
          finish(false);
        }
      }

      cancelButton.addEventListener("click", () => finish(false));
      confirmButton.addEventListener("click", () => finish(true));
      window.addEventListener("keydown", handleKeydown, true);
      setTimeout(() => confirmButton.focus(), 0);
    });
  }

  /**
   * @param {object} requestDetails
   * @returns {{title: string, body: string, confirm: string, cancel: string}}
   */
  function getConfirmationCopy(requestDetails = {}) {
    const operation = requestDetails.operation === "create" ? "create" : "get";
    const site = getPasskeyRequestSiteLabel(requestDetails);
    const isUkrainian = (navigator.language || "").toLowerCase().startsWith("uk");

    if (isUkrainian) {
      if (operation === "create") {
        return {
          title: "Зберегти passkey у Passly?",
          body: `Сайт ${site} хоче створити passkey. Підтвердьте, що Passly може зберегти його у вашому сховищі.`,
          confirm: "Зберегти",
          cancel: "Скасувати",
        };
      }

      return {
        title: "Використати passkey з Passly?",
        body: `Сайт ${site} запитує вхід через passkey. Підтвердьте використання ключа з вашого сховища.`,
        confirm: "Використати",
        cancel: "Скасувати",
      };
    }

    if (operation === "create") {
      return {
        title: "Save this passkey in Passly?",
        body: `${site} wants to create a passkey. Confirm that Passly can save it in your vault.`,
        confirm: "Save",
        cancel: "Cancel",
      };
    }

    return {
      title: "Use a Passly passkey?",
      body: `${site} is requesting passkey sign-in. Confirm using a key from your vault.`,
      confirm: "Use passkey",
      cancel: "Cancel",
    };
  }

  /**
   * @param {object} requestDetails
   * @returns {string}
   */
  function getPasskeyRequestSiteLabel(requestDetails = {}) {
    const value = requestDetails.rp?.name || requestDetails.rpId || requestDetails.origin || location.origin;
    try {
      return new URL(value).hostname || value;
    } catch {
      return String(value).slice(0, 100);
    }
  }

  /**
   * @returns {Promise<string>}
   */
  async function getCurrentTheme() {
    const storedTheme = await getStoredTheme();
    if (isValidTheme(storedTheme)) {
      return storedTheme;
    }

    return getOsTheme();
  }

  /**
   * @returns {Promise<string|null>}
   */
  function getStoredTheme() {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get([THEME_STORAGE_KEY], (result) => {
          const theme = result?.[THEME_STORAGE_KEY]?.config?.[THEME_CONFIG_KEY] || null;
          resolve(theme);
        });
      } catch {
        resolve(null);
      }
    });
  }

  /**
   * @param {string|null} theme
   * @returns {boolean}
   */
  function isValidTheme(theme) {
    return VALID_THEMES.includes(theme);
  }

  /**
   * @returns {string}
   */
  function getOsTheme() {
    try {
      return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "midgar" : "default";
    } catch {
      return "default";
    }
  }

  /**
   * @param {object} message The message to send.
   * @returns {Promise<object|undefined>}
   */
  function sendRuntimeMessage(message) {
    if (chrome.runtime.connect) {
      return sendRuntimePortMessage(message);
    }

    return sendRuntimeOneOffMessage(message);
  }

  /**
   * Send a message through a dedicated passkey runtime port. The port keeps the
   * MV3 service worker alive for the duration of the passkey request and avoids
   * competing with unrelated runtime.onMessage listeners.
   *
   * @param {object} message The message to send.
   * @returns {Promise<object|undefined>}
   */
  function sendRuntimePortMessage(message) {
    const requestId = randomId();
    const port = chrome.runtime.connect({ name: PORT_NAME });

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        cleanup();
        reject({
          name: "NotAllowedError",
          message: "Passly passkey provider did not respond.",
        });
      }, 60_000);

      function cleanup() {
        clearTimeout(timeoutId);
        port.onMessage.removeListener(handleMessage);
        port.onDisconnect.removeListener(handleDisconnect);
        try {
          port.disconnect();
        } catch {
          // The port can already be disconnected by Chrome.
        }
      }

      function handleMessage(responseMessage) {
        if (responseMessage?.requestId !== requestId) {
          return;
        }

        cleanup();
        resolve(responseMessage.response);
      }

      function handleDisconnect() {
        cleanup();
        const lastError = chrome.runtime.lastError;
        reject({
          name: "UnknownError",
          message: lastError?.message || "Passly passkey provider runtime port disconnected.",
        });
      }

      port.onMessage.addListener(handleMessage);
      port.onDisconnect.addListener(handleDisconnect);
      port.postMessage({
        ...message,
        requestId,
      });
    });
  }

  /**
   * @param {object} message The message to send.
   * @returns {Promise<object|undefined>}
   */
  function sendRuntimeOneOffMessage(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        const lastError = chrome.runtime.lastError;
        if (lastError) {
          reject({
            name: "UnknownError",
            message: lastError.message || "Passly passkey provider runtime message failed.",
          });
          return;
        }

        resolve(response);
      });
    });
  }

  /**
   * @returns {string}
   */
  function randomId() {
    if (crypto.randomUUID) {
      return crypto.randomUUID();
    }

    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }
})();
