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
import BiometricAuthFormService from "../service/biometricAuthFormService";

export async function ensureQuickAccessConfigured(port, { detached = false, closeWindow = () => window.close() } = {}) {
  const isConfigured = await port.request("passbolt.addon.is-configured");
  if (isConfigured) {
    return true;
  }

  await port.request("passbolt.tabs.open-website-getting-started-page");
  if (detached) {
    await port.request("passbolt.active-tab.close");
  } else {
    closeWindow();
  }
  return false;
}

export function shouldOpenPassboltPageForQuickAccessPasskey() {
  return globalThis.location?.protocol === "moz-extension:";
}

export async function openPassboltLoginPageForPasskey(port, { closeWindow = () => window.close() } = {}) {
  const trustedDomain = await port.request("passbolt.addon.get-domain");
  let locale = "uk-UA";
  try {
    locale = (await port.request("passbolt.locale.get"))?.locale || locale;
  } catch {
    // Keep the default locale if the background page cannot provide one.
  }
  const url = new URL("/auth/login", trustedDomain);
  url.searchParams.set("redirect", "/");
  url.searchParams.set("locale", locale || "uk-UA");
  await BiometricAuthFormService.preparePasskeyAutoLoginUrl(browser.storage, url);
  await browser.tabs.create({ url: url.toString(), active: true });
  closeWindow();
}

function submitQuickAccessPassphrase(passphrase) {
  BiometricAuthFormService.fillPassphraseAndSubmit(
    ".quickaccess-login #passphrase",
    ".quickaccess-login .submit-wrapper button[type='submit']",
    passphrase,
    "The quickaccess passphrase form is not available.",
  );
}

function submitPassphraseDialog(passphrase) {
  BiometricAuthFormService.fillPassphraseAndSubmit(
    ".passphrase #passphrase",
    ".passphrase .submit-wrapper button[type='submit']",
    passphrase,
    "The passphrase dialog form is not available.",
  );
}

function BiometricQuickAccessActions({ port, options, detached }) {
  const [configuration, setConfiguration] = React.useState(null);
  const [enableOnLogin, setEnableOnLogin] = React.useState(false);
  const [error, setError] = React.useState("");
  const [isUnlocking, setIsUnlocking] = React.useState(false);
  const [portal, setPortal] = React.useState(null);

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
      const passphraseDialogTarget = document.querySelector(".passphrase .form-container");
      if (passphraseDialogTarget) {
        setPortal({ target: passphraseDialogTarget, type: "passphrase-dialog" });
        return;
      }

      const quickAccessLoginTarget = document.querySelector(".quickaccess-login .form-container");
      if (quickAccessLoginTarget) {
        setPortal({ target: quickAccessLoginTarget, type: "quickaccess-login" });
        return;
      }

      setPortal(null);
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

  const handleLogin = async () => {
    setError("");
    setIsUnlocking(true);
    try {
      if (shouldOpenPassboltPageForQuickAccessPasskey()) {
        await openPassboltLoginPageForPasskey(port, {
          closeWindow: detached ? () => {} : () => window.close(),
        });
        return;
      }
      const passphrase = await BiometricAuthRuntimeService.unlock(port, configuration);
      if (portal?.type === "passphrase-dialog") {
        submitPassphraseDialog(passphrase);
      } else {
        submitQuickAccessPassphrase(passphrase);
      }
    } catch (error) {
      console.error(error);
      setError("Не вдалося виконати вхід через PassKey.");
      setIsUnlocking(false);
    }
  };

  if (!portal) {
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
      {error && <div className="error-message">{error}</div>}
    </div>,
    portal.target,
  );
}

export async function main() {
  const query = new URLSearchParams(window.location.search);
  const portname = query.get("passbolt");
  const port = new Port(portname);
  await port.connect();
  const biometricOptions = { enableOnLogin: false };
  const biometricAwarePort = BiometricAuthFormService.createBiometricAwarePort(port, biometricOptions, [
    {
      requestMessage: "passbolt.auth.login",
      option: "enableOnLogin",
    },
    {
      requestMessage: "passbolt.keyring.private.checkpassphrase",
      option: "enableOnLogin",
    },
  ]);

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

  const isConfigured = await ensureQuickAccessConfigured(port, { detached });
  if (!isConfigured) {
    return;
  }

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
      <BiometricQuickAccessActions port={port} options={biometricOptions} detached={detached} />
    </>,
  );
}

if (typeof document !== "undefined" && document.querySelector("#quickaccess-container")) {
  main();
}
