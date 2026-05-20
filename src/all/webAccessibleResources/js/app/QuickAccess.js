/**
 * Passbolt ~ Open source password manager for teams
 * Copyright (c) 2020 Passbolt SA (https://www.passbolt.com)
 *
 * Licensed under GNU Affero General Public License version 3 of the or any later version.
 * For full copyright and license information, please see the LICENSE.txt
 * Redistributions of files must retain the above copyright notice.
 *
 * @copyright     Copyright (c) 2020 Passbolt SA (https://www.passbolt.com)
 * @license       https://opensource.org/licenses/AGPL-3.0 AGPL License
 * @link          https://www.passbolt.com Passbolt(tm)
 * @since         3.2.0
 */
import React from "react";
import { createPortal } from "react-dom";
import { createRoot } from "react-dom/client";
import ExtQuickAccess from "passbolt-styleguide/src/react-quickaccess/ExtQuickAccess";
import Port from "../lib/port";
import BiometricAuthRuntimeService from "../service/biometricAuthRuntimeService";

function createBiometricAwareQuickAccessPort(port, options) {
  const biometricAwarePort = Object.create(port);
  biometricAwarePort.request = async (message, ...args) => {
    const result = await port.request(message, ...args);
    if (message === "passbolt.auth.login" && options.enableOnLogin) {
      try {
        const [passphrase] = args;
        const configuration = await BiometricAuthRuntimeService.createConfiguration(port, passphrase);
        await port.request("passbolt.biometric-auth.save-configuration", configuration);
      } catch (error) {
        if (BiometricAuthRuntimeService.isUnavailableError(error)) {
          console.debug(error);
        } else {
          console.error(error);
        }
      }
    }
    return result;
  };
  return biometricAwarePort;
}

function submitQuickAccessPassphrase(passphrase) {
  const passphraseInput = document.querySelector(".quickaccess-login #passphrase");
  const submitButton = document.querySelector(".quickaccess-login .submit-wrapper button[type='submit']");
  if (!passphraseInput || !submitButton) {
    throw new Error("The quickaccess passphrase form is not available.");
  }

  passphraseInput.value = passphrase;
  passphraseInput.dispatchEvent(new Event("input", { bubbles: true }));
  submitButton.click();
}

function BiometricQuickAccessActions({ port, options }) {
  const [configuration, setConfiguration] = React.useState(null);
  const [enableOnLogin, setEnableOnLogin] = React.useState(false);
  const [error, setError] = React.useState("");
  const [isUnlocking, setIsUnlocking] = React.useState(false);
  const [portalTarget, setPortalTarget] = React.useState(null);

  React.useEffect(() => {
    let isMounted = true;
    const init = async () => {
      const storedConfiguration = await port.request("passbolt.biometric-auth.get-configuration");
      if (isMounted) {
        setConfiguration(storedConfiguration);
      }
    };
    init().catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [port]);

  React.useEffect(() => {
    const findTarget = () => {
      const target = document.querySelector(".quickaccess-login .form-container");
      if (target) {
        setPortalTarget(target);
        return true;
      }
      return false;
    };
    if (findTarget()) {
      return undefined;
    }
    const observer = new MutationObserver(() => {
      if (findTarget()) {
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    options.enableOnLogin = enableOnLogin;
  }, [enableOnLogin, options]);

  const handleLogin = async () => {
    setError("");
    setIsUnlocking(true);
    try {
      const passphrase = await BiometricAuthRuntimeService.unlock(port, configuration);
      submitQuickAccessPassphrase(passphrase);
    } catch (error) {
      console.error(error);
      setError("Не вдалося виконати вхід за відбитком.");
      setIsUnlocking(false);
    }
  };

  if (!portalTarget) {
    return null;
  }

  return createPortal(
    <div className="biometric-login-actions">
      {configuration ? (
        <button type="button" className="button primary big full-width" disabled={isUnlocking} onClick={handleLogin}>
          {isUnlocking ? "Розблокування..." : "Вхід за відбитком"}
        </button>
      ) : (
        <div className="input checkbox biometric-login-enable">
          <input
            type="checkbox"
            name="biometric-login-enable"
            id="biometric-login-enable"
            checked={enableOnLogin}
            onChange={(event) => setEnableOnLogin(event.target.checked)}
          />
          <label htmlFor="biometric-login-enable">Увімкнути вхід за відбитком на цьому пристрої</label>
        </div>
      )}
      {error && <div className="error-message">{error}</div>}
    </div>,
    portalTarget,
  );
}

async function main() {
  const query = new URLSearchParams(window.location.search);
  const portname = query.get("passbolt");
  const port = new Port(portname);
  await port.connect();
  const biometricOptions = { enableOnLogin: false };
  const biometricAwarePort = createBiometricAwareQuickAccessPort(port, biometricOptions);

  // Emit a success if the port is still connected
  port.on("passbolt.port.check", (requestId) => port.emit(requestId, "SUCCESS"));

  const storage = browser.storage;
  const domContainer = document.querySelector("#quickaccess-container");
  // Extract parameters from the url.
  const urlSearchParams = new URLSearchParams(window.location.search);
  const bootstrapFeature = urlSearchParams.get("feature");
  const bootstrapRequestId = urlSearchParams.get("requestId");
  const openerTabId = urlSearchParams.get("tabId");
  const detached = urlSearchParams.get("uiMode") === "detached";

  const root = createRoot(domContainer);
  root.render(
    <>
      <ExtQuickAccess
        port={biometricAwarePort}
        storage={storage}
        bootstrapFeature={bootstrapFeature}
        bootstrapRequestId={bootstrapRequestId}
        openerTabId={openerTabId}
        detached={detached}
      />
      <BiometricQuickAccessActions port={port} options={biometricOptions} />
    </>,
  );
}

main();
