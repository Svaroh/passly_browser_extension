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

import BiometricAuthRuntimeService from "./biometricAuthRuntimeService";

const PASSKEY_AUTO_LOGIN_PARAMETER = "passbolt_auto_passkey";
const PASSKEY_AUTO_LOGIN_STORAGE_KEY = "passbolt.quickaccess.passkeyAutoLogin";
const PASSKEY_AUTO_LOGIN_TTL = 2 * 60 * 1000;

class BiometricAuthFormService {
  /**
   * Generate a random token for a one-time PassKey auto-login request.
   * @returns {string}
   */
  static generatePasskeyAutoLoginToken() {
    const bytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  /**
   * Store a one-time PassKey auto-login request and append its token to a URL.
   * @param {object} storage The browser storage API.
   * @param {URL} url The trusted login URL to mutate.
   * @returns {Promise<URL>}
   */
  static async preparePasskeyAutoLoginUrl(storage, url) {
    const token = this.generatePasskeyAutoLoginToken();
    url.searchParams.set(PASSKEY_AUTO_LOGIN_PARAMETER, token);
    await storage.local.set({
      [PASSKEY_AUTO_LOGIN_STORAGE_KEY]: {
        token,
        origin: url.origin,
        created: Date.now(),
      },
    });
    return url;
  }

  /**
   * Consume a one-time PassKey auto-login request from storage.
   * @param {object} storage The browser storage API.
   * @param {Location|URL} [location=globalThis.location] The current location.
   * @param {object} [options={}] The consumption options.
   * @param {boolean} [options.allowPendingRequestWithoutUrlToken=false] Whether an extension iframe may consume a pending request without the URL token.
   * @param {string|null} [options.expectedOrigin=null] The expected Passbolt HTTPS origin.
   * @returns {Promise<boolean>}
   */
  static async consumePasskeyAutoLoginRequest(storage, location = globalThis.location, options = {}) {
    const url = new URL(location.href);
    const token = url.searchParams.get(PASSKEY_AUTO_LOGIN_PARAMETER);
    if (!token && !options.allowPendingRequestWithoutUrlToken) {
      return false;
    }

    const data = await storage.local.get(PASSKEY_AUTO_LOGIN_STORAGE_KEY);
    const request = data[PASSKEY_AUTO_LOGIN_STORAGE_KEY];
    if (!request) {
      return false;
    }

    const isExpired = Date.now() - request.created > PASSKEY_AUTO_LOGIN_TTL;
    if (isExpired) {
      await storage.local.remove(PASSKEY_AUTO_LOGIN_STORAGE_KEY);
      return false;
    }

    const expectedOrigin = options.expectedOrigin ? new URL(options.expectedOrigin).origin : url.origin;
    const isValidOrigin = request.origin === expectedOrigin;
    const isValidToken = token ? request.token === token : options.allowPendingRequestWithoutUrlToken;
    const isValid = isValidToken && isValidOrigin;
    if (isValid) {
      await storage.local.remove(PASSKEY_AUTO_LOGIN_STORAGE_KEY);
    }

    return isValid;
  }

  /**
   * Create a port wrapper that saves a PassKey configuration after a successful passphrase request.
   * @param {Port} port The extension port.
   * @param {object} options The mutable biometric options.
   * @param {object|object[]} settings The wrapper settings.
   * @param {string} settings.requestMessage The message that carries the user passphrase.
   * @param {string} settings.option The option flag to check before enrolling.
   * @param {number} [settings.passphraseArgumentIndex=0] The argument index that carries the passphrase.
   * @returns {Port}
   */
  static createBiometricAwarePort(port, options, settings) {
    const rules = Array.isArray(settings) ? settings : [settings];
    const biometricAwarePort = Object.create(port);
    biometricAwarePort.request = async (message, ...args) => {
      const result = await port.request(message, ...args);
      const matchingRule = rules.find(({ requestMessage, option }) => message === requestMessage && options[option]);
      if (matchingRule) {
        const passphrase = args[matchingRule.passphraseArgumentIndex || 0];
        await this.savePasskeyConfiguration(port, passphrase);
      }
      return result;
    };
    return biometricAwarePort;
  }

  /**
   * Create and store the encrypted PassKey configuration.
   * @param {Port} port The extension port.
   * @param {string} passphrase The passphrase to protect with WebAuthn.
   * @returns {Promise<void>}
   */
  static async savePasskeyConfiguration(port, passphrase) {
    try {
      const configuration = await BiometricAuthRuntimeService.createConfiguration(port, passphrase);
      await port.request("passbolt.biometric-auth.save-configuration", configuration);
    } catch (error) {
      if (!BiometricAuthRuntimeService.isUnavailableError(error)) {
        console.error(error);
      }
    }
  }

  /**
   * Set a React-managed input value and dispatch the events React listens to.
   * @param {HTMLInputElement} input The input to update.
   * @param {string} value The value to set.
   * @returns {void}
   */
  static setInputValue(input, value) {
    const valueSetter = Object.getOwnPropertyDescriptor(input, "value")?.set;
    const prototypeValueSetter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), "value")?.set;
    const setter = prototypeValueSetter && valueSetter !== prototypeValueSetter ? prototypeValueSetter : valueSetter;

    if (setter) {
      setter.call(input, value);
    } else {
      input.value = value;
    }

    const InputEventConstructor = globalThis.InputEvent || Event;
    input.dispatchEvent(new InputEventConstructor("input", { bubbles: true, inputType: "insertText", data: value }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  /**
   * Fill a passphrase input and submit its form.
   * @param {string} inputSelector The passphrase input selector.
   * @param {string} submitButtonSelector The submit button selector.
   * @param {string} passphrase The passphrase to fill.
   * @param {string} unavailableMessage The error message if the form cannot be found.
   * @returns {void}
   */
  static fillPassphraseAndSubmit(inputSelector, submitButtonSelector, passphrase, unavailableMessage) {
    const passphraseInput = document.querySelector(inputSelector);
    const submitButton = document.querySelector(submitButtonSelector);
    if (!passphraseInput || !submitButton) {
      throw new Error(unavailableMessage);
    }

    this.setInputValue(passphraseInput, passphrase);
    submitButton.click();
  }

  /**
   * Read the remember-until-logout choice from an authentication form.
   * @param {string} [formSelector="#container .login .enter-passphrase"] The form selector.
   * @returns {boolean}
   */
  static getRememberMeChoice(formSelector = "#container .login .enter-passphrase") {
    if (typeof document === "undefined") {
      return false;
    }

    const form = document.querySelector(formSelector);
    const rememberMeInput = form?.querySelector("#remember-me, input[name='remember-me'], input[name='rememberMe']");

    return Boolean(rememberMeInput?.checked);
  }

  /**
   * Create or return an anchor used to render biometric controls in a form.
   * @param {object} options The anchor options.
   * @param {string} options.id The anchor id.
   * @param {string} options.formSelector The form selector.
   * @param {string} [options.afterSelector] Selector for the element after which the anchor is inserted.
   * @param {string} [options.beforeSelector] Selector for the element before which the anchor is inserted.
   * @param {string} [options.fallbackContainerSelector] Selector for a fallback container to append to.
   * @returns {HTMLElement|null}
   */
  static createPortalAnchor({ id, formSelector, afterSelector, beforeSelector, fallbackContainerSelector }) {
    const existingAnchor = document.getElementById(id);
    if (existingAnchor) {
      return existingAnchor;
    }

    const form = document.querySelector(formSelector);
    if (!form) {
      return null;
    }

    const anchor = document.createElement("div");
    anchor.id = id;
    anchor.className = "biometric-login-actions-anchor";

    const afterElement = afterSelector ? form.querySelector(afterSelector) : null;
    if (afterElement?.parentNode) {
      afterElement.insertAdjacentElement("afterend", anchor);
      return anchor;
    }

    const fallbackContainer = fallbackContainerSelector ? form.querySelector(fallbackContainerSelector) : null;
    if (fallbackContainer) {
      fallbackContainer.appendChild(anchor);
      return anchor;
    }

    const beforeElement = beforeSelector ? form.querySelector(beforeSelector) : null;
    if (beforeElement?.parentNode === form) {
      form.insertBefore(anchor, beforeElement);
      return anchor;
    }

    form.appendChild(anchor);
    return anchor;
  }
}

export default BiometricAuthFormService;
