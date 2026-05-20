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
 * @since         3.0.0
 */
import React from "react";
import { createPortal } from "react-dom";
import { createRoot } from "react-dom/client";
import ExtAuthenticationLogin from "passbolt-styleguide/src/react-extension/ExtAuthenticationLogin";
import Port from "../lib/port";
import BiometricAuthRuntimeService from "../service/biometricAuthRuntimeService";

function createBiometricAwarePort(port, options) {
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

function BiometricLoginActions({ port, options }) {
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
      const target = document.querySelector("#container .enter-passphrase .form-actions");
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
      await port.request("passbolt.auth.login", passphrase, false);
      await port.request("passbolt.auth.post-login-redirect");
    } catch (error) {
      console.error(error);
      setError("Не вдалося виконати вхід за відбитком.");
    } finally {
      setIsUnlocking(false);
    }
  };

  if (!portalTarget) {
    return null;
  }

  return createPortal(
    <div className="biometric-login-actions">
      {configuration ? (
        <button type="button" className="button primary" disabled={isUnlocking} onClick={handleLogin}>
          {isUnlocking ? "Розблокування..." : "Вхід за відбитком"}
        </button>
      ) : (
        <label className="biometric-login-enable">
          <input type="checkbox" checked={enableOnLogin} onChange={(event) => setEnableOnLogin(event.target.checked)} />
          Увімкнути вхід за відбитком на цьому пристрої
        </label>
      )}
      {error && <p className="error-message">{error}</p>}
    </div>,
    portalTarget,
  );
}

async function main() {
  const query = new URLSearchParams(window.location.search);
  const portname = query.get("passbolt");
  const port = new Port(portname);
  await port.connect();
  const storage = browser.storage;
  const biometricOptions = { enableOnLogin: false };
  const biometricAwarePort = createBiometricAwarePort(port, biometricOptions);
  const domContainer = document.createElement("div");
  document.body.appendChild(domContainer);

  const root = createRoot(domContainer);
  root.render(
    <>
      <ExtAuthenticationLogin port={biometricAwarePort} storage={storage} />
      <BiometricLoginActions port={port} options={biometricOptions} />
    </>,
  );
}

main();
