/**
 * Passbolt ~ Open source password manager for teams
 * Copyright (c) 2022 Passbolt SA (https://www.passbolt.com)
 *
 * Licensed under GNU Affero General Public License version 3 of the or any later version.
 * For full copyright and license information, please see the LICENSE.txt
 * Redistributions of files must retain the above copyright notice.
 *
 * @copyright     Copyright (c) 2022 Passbolt SA (https://www.passbolt.com)
 * @license       https://opensource.org/licenses/AGPL-3.0 AGPL License
 * @link          https://www.passbolt.com Passbolt(tm)
 * @since         3.6.0
 */

import React from "react";
import { createPortal } from "react-dom";
import { createRoot } from "react-dom/client";
import ExtAuthenticationAccountRecovery from "passbolt-styleguide/src/react-extension/ExtAuthenticationAccountRecovery";
import Port from "../lib/port";
import BiometricAuthRuntimeService from "../service/biometricAuthRuntimeService";
import BiometricAuthFormService from "../service/biometricAuthFormService";

function submitAccountRecoveryPassphrase(passphrase) {
  BiometricAuthFormService.fillPassphraseAndSubmit(
    "#container .login .enter-passphrase #passphrase",
    "#container .login .enter-passphrase .form-actions button[type='submit']",
    passphrase,
    "The account recovery passphrase form is not available.",
  );
}

function BiometricAccountRecoveryActions({ port, options }) {
  const [configuration, setConfiguration] = React.useState(null);
  const [enableOnRecover, setEnableOnRecover] = React.useState(false);
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
        id: "biometric-account-recovery-actions-anchor",
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
    options.enableOnRecover = enableOnRecover;
  }, [enableOnRecover, options]);

  const handleRecover = async () => {
    setError("");
    setIsUnlocking(true);
    try {
      const passphrase = await BiometricAuthRuntimeService.unlock(port, configuration);
      submitAccountRecoveryPassphrase(passphrase);
    } catch (error) {
      console.error(error);
      setError("Не вдалося виконати вхід по відбитку пальця.");
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
          {isUnlocking ? "Розблокування..." : "Вхід по відбитку пальця"}
        </button>
      ) : (
        <div className="input checkbox biometric-login-enable">
          <input
            type="checkbox"
            name="biometric-login-enable"
            id="biometric-login-enable"
            checked={enableOnRecover}
            onChange={(event) => setEnableOnRecover(event.target.checked)}
          />
          <label htmlFor="biometric-login-enable">Увімкнути вхід по відбитку пальця на цьому пристрої</label>
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
  const biometricOptions = { enableOnRecover: false };
  const biometricAwarePort = BiometricAuthFormService.createBiometricAwarePort(port, biometricOptions, {
    requestMessage: "passbolt.account-recovery.recover-account",
    option: "enableOnRecover",
  });
  const domContainer = document.createElement("div");

  document.body.appendChild(domContainer);

  const root = createRoot(domContainer);
  root.render(
    <>
      <ExtAuthenticationAccountRecovery port={biometricAwarePort} />
      <BiometricAccountRecoveryActions port={port} options={biometricOptions} />
    </>,
  );
}

main();
