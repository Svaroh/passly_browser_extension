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
import BiometricAuthFormService from "../service/biometricAuthFormService";

const isPassboltDataRequested = (keys) => {
  if (!keys) {
    return true;
  }
  if (keys === "_passbolt_data") {
    return true;
  }
  if (Array.isArray(keys)) {
    return keys.includes("_passbolt_data");
  }
  if (typeof keys === "object") {
    return Object.prototype.hasOwnProperty.call(keys, "_passbolt_data");
  }
  return false;
};

const hasLegacyConfig = (storageData) => {
  const config = storageData?._passbolt_data?.config;
  return Boolean(config && Object.keys(config).length);
};

const normalizeTextColor = (securityToken) => securityToken?.textcolor || securityToken?.textColor || "#000000";

const buildLegacyConfigFromAccount = async (port) => {
  const account = await port.request("passbolt.account.get");
  const securityToken = account.security_token || {};
  return {
    "user.id": account.user_id,
    "user.firstname": account.first_name,
    "user.lastname": account.last_name,
    "user.username": account.username,
    "user.settings.trustedDomain": account.domain,
    "user.settings.securityToken.code": securityToken.code,
    "user.settings.securityToken.color": securityToken.color,
    "user.settings.securityToken.textColor": normalizeTextColor(securityToken),
    "user.settings.locale": account.locale || "uk-UA",
  };
};

const createLoginStorage = (port, storage) => {
  const localStorage = storage.local;
  const get = async (keys) => {
    const storageData = await localStorage.get(keys);
    if (!isPassboltDataRequested(keys) || hasLegacyConfig(storageData)) {
      return storageData;
    }

    try {
      const config = await buildLegacyConfigFromAccount(port);
      const passboltData = { ...(storageData._passbolt_data || {}), config };
      await localStorage.set({ _passbolt_data: passboltData });
      return { ...storageData, _passbolt_data: passboltData };
    } catch {
      return storageData;
    }
  };

  return {
    ...storage,
    local: {
      ...localStorage,
      get,
      set: (...args) => localStorage.set(...args),
      remove: (...args) => localStorage.remove(...args),
      clear: (...args) => localStorage.clear(...args),
    },
  };
};

class LoginErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  componentDidCatch(error) {
    this.setState({ error });
  }

  render() {
    if (this.state.error) {
      return <p className="error-message">Не вдалося завантажити форму входу.</p>;
    }
    return this.props.children;
  }
}

function usePasskeyAutoLoginRequest(port) {
  const [autoLoginRequested, setAutoLoginRequested] = React.useState(false);

  React.useEffect(() => {
    let isMounted = true;
    const consumeRequest = async () => {
      const trustedDomain = await port.request("passbolt.addon.get-domain");
      return BiometricAuthFormService.consumePasskeyAutoLoginRequest(browser.storage, globalThis.location, {
        allowPendingRequestWithoutUrlToken: true,
        expectedOrigin: trustedDomain,
      });
    };
    const init = async () => {
      const requested = await consumeRequest();
      if (isMounted) {
        setAutoLoginRequested(requested);
      }
    };
    init().catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [port]);

  return autoLoginRequested;
}

function BiometricLoginActions({ port, options }) {
  const [configuration, setConfiguration] = React.useState(null);
  const [enableOnLogin, setEnableOnLogin] = React.useState(false);
  const [error, setError] = React.useState("");
  const [isUnlocking, setIsUnlocking] = React.useState(false);
  const [portalTarget, setPortalTarget] = React.useState(null);
  const autoLoginRequested = usePasskeyAutoLoginRequest(port);
  const autoLoginStartedRef = React.useRef(false);

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
      const rememberMe = BiometricAuthFormService.getRememberMeChoice();
      await port.request("passbolt.auth.login", passphrase, rememberMe);
      await port.request("passbolt.auth.post-login-redirect");
    } catch (error) {
      console.error(error);
      setError("Не вдалося виконати вхід по відбитку пальця.");
    } finally {
      setIsUnlocking(false);
    }
  }, [configuration, port]);

  React.useEffect(() => {
    if (!autoLoginRequested || autoLoginStartedRef.current || !configuration || !portalTarget) {
      return;
    }
    autoLoginStartedRef.current = true;
    handleLogin();
  }, [autoLoginRequested, configuration, handleLogin, portalTarget]);

  if (!portalTarget) {
    return null;
  }

  return createPortal(
    <div className="biometric-login-actions">
      {configuration ? (
        <button type="button" className="button primary big full-width" disabled={isUnlocking} onClick={handleLogin}>
          {isUnlocking ? "Розблокування..." : "Вхід по відбитку пальця"}
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
  const storage = createLoginStorage(port, browser.storage);
  const biometricOptions = { enableOnLogin: false };
  const biometricAwarePort = BiometricAuthFormService.createBiometricAwarePort(port, biometricOptions, {
    requestMessage: "passbolt.auth.login",
    option: "enableOnLogin",
  });
  const domContainer = document.createElement("div");
  document.body.appendChild(domContainer);

  const root = createRoot(domContainer);
  root.render(
    <LoginErrorBoundary>
      <ExtAuthenticationLogin port={biometricAwarePort} storage={storage} />
      <BiometricLoginActions port={port} options={biometricOptions} />
    </LoginErrorBoundary>,
  );
}

main().catch((error) => {
  console.error(error);
});
