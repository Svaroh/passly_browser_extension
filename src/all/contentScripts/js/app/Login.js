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
 * @since        3.0.0
 */
import React from "react";
import { createPortal } from "react-dom";
import { createRoot } from "react-dom/client";
import ExtBootstrapLogin from "passbolt-styleguide/src/react-extension/ExtBootstrapLogin";
import Port from "../../../webAccessibleResources/js/lib/port";
import MessageService from "../service/messageService";
import MessageEventHandler from "../message/messageEventHandler";
import ConnectPortController from "../controller/connectPortController";
import BiometricAuthPageService from "../service/biometricAuthPageService";
import BiometricAuthRuntimeService from "../../../webAccessibleResources/js/service/biometricAuthRuntimeService";
import BiometricAuthFormService from "../../../webAccessibleResources/js/service/biometricAuthFormService";

const sendBootstrapDiagnostic = (stage, extra = {}) => {
  try {
    browser.runtime.sendMessage({
      name: "passbolt.content-script.bootstrap-diagnostic",
      app: "Login",
      stage,
      url: document.location.href,
      hasSelfPortname: Boolean(self.portname),
      domPortname: document.documentElement.getAttribute("data-passbolt-portname"),
      htmlClass: document.documentElement.className,
      ...extra,
    });
  } catch (error) {
    console.debug("Could not send Login bootstrap diagnostic.", error);
  }
};

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
      const compatibleConfiguration = await BiometricAuthRuntimeService.getCompatibleConfiguration(
        port,
        storedConfiguration,
      );
      if (isMounted) {
        setConfiguration(compatibleConfiguration);
      }
    };
    init().catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [port]);

  React.useEffect(() => {
    const findTarget = () => {
      const target = BiometricAuthFormService.createPortalAnchor({
        id: "biometric-login-actions-anchor",
        formSelector: "#container .login .enter-passphrase",
        afterSelector: ".input.checkbox",
        beforeSelector: ".form-actions",
      });
      setPortalTarget(target);
    };
    findTarget();
    const observer = new MutationObserver(() => {
      findTarget();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    options.enableOnLogin = enableOnLogin;
  }, [enableOnLogin, options]);

  const handleLogin = React.useCallback(async () => {
    setError("");
    setIsUnlocking(true);
    try {
      const passphrase = await BiometricAuthRuntimeService.unlock(port, configuration);
      await port.request("passbolt.auth.login", passphrase, false);
      await port.request("passbolt.auth.post-login-redirect");
    } catch (error) {
      console.error(error);
      setError("Не вдалося виконати вхід через PassKey.");
    } finally {
      setIsUnlocking(false);
    }
  }, [configuration, port]);

  if (!portalTarget) {
    return null;
  }

  return createPortal(
    <div className="biometric-login-actions">
      {configuration ? (
        <button type="button" className="button primary big full-width" disabled={isUnlocking} onClick={handleLogin}>
          {isUnlocking ? "Розблокування..." : "Вхід через PassKey"}
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
          <label htmlFor="biometric-login-enable">Увімкнути вхід через PassKey на цьому пристрої</label>
        </div>
      )}
      {error && <p className="error-message">{error}</p>}
    </div>,
    portalTarget,
  );
}

async function main() {
  sendBootstrapDiagnostic("main:start");
  // Port connection
  const portname = self.portname || document.documentElement.getAttribute("data-passbolt-portname");
  sendBootstrapDiagnostic("main:portname", { hasPortname: Boolean(portname) });
  const port = new Port(portname);
  // Emit a success if the port is still connected
  port.on("passbolt.port.check", (requestId) => port.emit(requestId, "SUCCESS"));
  sendBootstrapDiagnostic("main:before-port-connect");
  await port.connect();
  sendBootstrapDiagnostic("main:after-port-connect");
  // Message listener
  const messageService = new MessageService();
  const messageEventHandler = new MessageEventHandler(messageService);
  messageEventHandler.listen("passbolt.port.connect", ConnectPortController, port);
  BiometricAuthPageService.listen(port);
  const biometricOptions = { enableOnLogin: false };
  const biometricAwarePort = BiometricAuthFormService.createBiometricAwarePort(port, biometricOptions, {
    requestMessage: "passbolt.auth.login",
    option: "enableOnLogin",
  });
  // Start ExtBootstrapLogin
  const browserExtensionUrl = chrome.runtime.getURL("/");
  const domContainer = document.createElement("div");
  document.body.appendChild(domContainer);
  sendBootstrapDiagnostic("main:dom-container-appended", {
    isPassboltHtml: document.documentElement.classList.contains("passbolt"),
    bodyChildren: document.body.children.length,
  });

  /*
   * Empty unload handler to prevent Chrome from caching this page in BFCache.
   * Without this, navigating away and back to an API-served page may restore
   * it from BFCache with a dead extension message port, preventing the
   * extension from re-initializing.
   *
   * Temporary: Chrome is deprecating unload, replace with proper BFCache handling.
   * See: PB-50644
   */
  window.addEventListener("unload", () => {});

  const root = createRoot(domContainer);
  root.render(
    <>
      <ExtBootstrapLogin port={biometricAwarePort} browserExtensionUrl={browserExtensionUrl} />
      <BiometricLoginActions port={port} options={biometricOptions} />
    </>,
  );
  sendBootstrapDiagnostic("main:render-called");
}

main().catch((error) => {
  sendBootstrapDiagnostic("main:error", {
    errorName: error?.name,
    errorMessage: error?.message,
    errorStack: error?.stack,
  });
  console.error(error);
});
