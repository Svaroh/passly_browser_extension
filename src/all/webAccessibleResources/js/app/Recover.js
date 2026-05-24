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
import ExtAuthenticationRecover from "passbolt-styleguide/src/react-extension/ExtAuthenticationRecover";
import Port from "../lib/port";
import BiometricAuthRuntimeService from "../service/biometricAuthRuntimeService";
import BiometricAuthFormService from "../service/biometricAuthFormService";

function submitRecoveredPassphrase(passphrase) {
  BiometricAuthFormService.fillPassphraseAndSubmit(
    "#container .check-passphrase #passphrase",
    "#container .check-passphrase .enter-passphrase .form-actions button[type='submit']",
    passphrase,
    "The recover passphrase form is not available.",
  );
}

function BiometricRecoverActions({ port, options }) {
  const [configuration, setConfiguration] = React.useState(null);
  const [enableOnVerify, setEnableOnVerify] = React.useState(false);
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
      const target = BiometricAuthFormService.createPortalAnchor({
        id: "biometric-recover-actions-anchor",
        formSelector: "#container .check-passphrase .enter-passphrase",
        afterSelector: ".form-content > .input.checkbox",
        fallbackContainerSelector: ".form-content",
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
    options.enableOnVerify = enableOnVerify;
  }, [enableOnVerify, options]);

  const handleRecover = async () => {
    setError("");
    setIsUnlocking(true);
    try {
      const passphrase = await BiometricAuthRuntimeService.unlock(port, configuration);
      submitRecoveredPassphrase(passphrase);
    } catch (error) {
      console.error(error);
      setError("Не вдалося виконати вхід через PassKey.");
      setIsUnlocking(false);
    }
  };

  if (!portalTarget) {
    return null;
  }

  return createPortal(
    <div className="biometric-login-actions">
      {configuration ? (
        <button type="button" className="button primary big full-width" disabled={isUnlocking} onClick={handleRecover}>
          {isUnlocking ? "Розблокування..." : "Вхід через PassKey"}
        </button>
      ) : (
        <div className="input checkbox biometric-login-enable">
          <input
            type="checkbox"
            name="biometric-login-enable"
            id="biometric-login-enable"
            checked={enableOnVerify}
            onChange={(event) => setEnableOnVerify(event.target.checked)}
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
  const query = new URLSearchParams(window.location.search);
  const portname = query.get("passbolt");
  const port = new Port(portname);
  await port.connect();
  const biometricOptions = { enableOnVerify: false };
  const biometricAwarePort = BiometricAuthFormService.createBiometricAwarePort(port, biometricOptions, {
    requestMessage: "passbolt.recover.verify-passphrase",
    option: "enableOnVerify",
  });
  const domContainer = document.createElement("div");
  document.body.appendChild(domContainer);

  const root = createRoot(domContainer);
  root.render(
    <>
      <ExtAuthenticationRecover port={biometricAwarePort} />
      <BiometricRecoverActions port={port} options={biometricOptions} />
    </>,
  );
}

main();
