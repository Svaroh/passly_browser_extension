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
  /* eslint-disable security/detect-possible-timing-attacks */
  if (window.__passlyPasskeyProviderPageScriptLoaded) {
    return;
  }
  window.__passlyPasskeyProviderPageScriptLoaded = true;

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
  const BRIDGE_TIMEOUT = 500;
  const CONDITIONAL_MEDIATION = "conditional";

  const token = randomId();
  let bridgeReady = false;

  const originalCredentialsCreate = navigator.credentials?.create?.bind(navigator.credentials);
  const originalCredentialsGet = navigator.credentials?.get?.bind(navigator.credentials);
  const originalIsUvpaa =
    typeof PublicKeyCredential !== "undefined"
      ? PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable?.bind(PublicKeyCredential)
      : null;

  if (!originalCredentialsCreate && !originalCredentialsGet && !originalIsUvpaa) {
    return;
  }

  window.addEventListener(CHANNEL_ACK, (event) => {
    if (event.source && event.source !== window) {
      return;
    }
    if (event.detail?.token === token) {
      bridgeReady = true;
    }
  });

  const initIntervalId = setInterval(() => {
    if (bridgeReady) {
      clearInterval(initIntervalId);
      return;
    }
    window.dispatchEvent(new CustomEvent(CHANNEL_INIT, { detail: { token } }));
  }, 25);
  window.dispatchEvent(new CustomEvent(CHANNEL_INIT, { detail: { token } }));

  if (originalCredentialsCreate) {
    navigator.credentials.create = async function (options = {}) {
      if (!options?.publicKey) {
        return originalCredentialsCreate(options);
      }

      try {
        const requestDetails = serializeCreateOptions(options.publicKey);
        if (!(await confirmPasslyRequest("create", requestDetails))) {
          return runNativeCredentialsCreate(options);
        }

        const result = await requestPassly(MESSAGE_CREATE, requestDetails);
        if (result?.skipped) {
          return runNativeCredentialsCreate(options);
        }
        return buildCredential(result);
      } catch (error) {
        throw toDomException(error);
      }
    };
  }

  if (originalCredentialsGet) {
    navigator.credentials.get = async function (options = {}) {
      if (!options?.publicKey) {
        return originalCredentialsGet(options);
      }
      if (options.mediation === CONDITIONAL_MEDIATION) {
        return runNativeCredentialsGet(options);
      }

      try {
        const requestDetails = serializeGetOptions(options.publicKey);
        if (!(await confirmPasslyRequest("get", requestDetails))) {
          return runNativeCredentialsGet(options);
        }

        const result = await requestPassly(MESSAGE_GET, requestDetails);
        if (result?.skipped) {
          return runNativeCredentialsGet(options);
        }
        return buildCredential(result);
      } catch (error) {
        throw toDomException(error);
      }
    };
  }

  if (originalIsUvpaa) {
    PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable = async function () {
      try {
        const result = await requestPassly(MESSAGE_UVPAA, { origin: location.origin });
        if (result?.skipped) {
          return originalIsUvpaa();
        }
        return Boolean(result?.available);
      } catch {
        return originalIsUvpaa();
      }
    };
  }

  async function confirmPasslyRequest(operation, requestDetails) {
    try {
      const result = await requestPassly(MESSAGE_CONFIRM, {
        operation,
        ...requestDetails,
      });
      return result?.confirmed === true;
    } catch {
      return false;
    }
  }

  async function runNativeCredentialsCreate(options) {
    return runNativeCredentialsOperation(() => originalCredentialsCreate(options));
  }

  async function runNativeCredentialsGet(options) {
    return runNativeCredentialsOperation(() => originalCredentialsGet(options));
  }

  async function runNativeCredentialsOperation(callback) {
    const suspended = await suspendPasslyProvider();
    try {
      return await callback();
    } finally {
      if (suspended) {
        await resumePasslyProvider();
      }
    }
  }

  async function suspendPasslyProvider() {
    try {
      return Boolean(await requestPassly(MESSAGE_SUSPEND, { reason: "native-webauthn" }));
    } catch {
      return false;
    }
  }

  async function resumePasslyProvider() {
    try {
      await requestPassly(MESSAGE_RESUME, { reason: "native-webauthn" });
    } catch {
      // Ignore resume failures and keep native WebAuthn fallback behavior.
    }
  }

  function requestPassly(name, requestDetails) {
    if (!bridgeReady) {
      return waitForBridge().then(() => requestPassly(name, requestDetails));
    }

    const requestId = randomId();

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        window.removeEventListener(CHANNEL_RESPONSE, handleResponse);
        reject({
          name: "NotAllowedError",
          message: "Passly passkey provider did not respond.",
        });
      }, 60_000);

      function handleResponse(event) {
        if (event.source && event.source !== window) {
          return;
        }
        if (event.detail?.token !== token || event.detail?.requestId !== requestId) {
          return;
        }

        clearTimeout(timeoutId);
        window.removeEventListener(CHANNEL_RESPONSE, handleResponse);
        const response = event.detail.response;
        if (response?.ok) {
          resolve(response.result);
        } else {
          reject(response?.error || { name: "UnknownError", message: "Passly passkey request failed." });
        }
      }

      window.addEventListener(CHANNEL_RESPONSE, handleResponse);
      window.dispatchEvent(
        new CustomEvent(CHANNEL_REQUEST, {
          detail: {
            token,
            requestId,
            name,
            requestDetails: {
              ...requestDetails,
              origin: location.origin,
            },
          },
        }),
      );
    });
  }

  function waitForBridge() {
    if (bridgeReady) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        window.removeEventListener(CHANNEL_ACK, handleAck);
        reject({
          name: "NotAllowedError",
          message: "Passly passkey provider bridge is not available.",
        });
      }, BRIDGE_TIMEOUT);

      function handleAck(event) {
        if (event.source && event.source !== window) {
          return;
        }
        if (event.detail?.token !== token) {
          return;
        }

        clearTimeout(timeoutId);
        window.removeEventListener(CHANNEL_ACK, handleAck);
        bridgeReady = true;
        resolve();
      }

      window.addEventListener(CHANNEL_ACK, handleAck);
      window.dispatchEvent(new CustomEvent(CHANNEL_INIT, { detail: { token } }));
    });
  }

  function serializeCreateOptions(publicKey) {
    return {
      challenge: toBase64Url(publicKey.challenge),
      rp: clonePlain(publicKey.rp),
      user: {
        ...clonePlain(publicKey.user),
        id: toBase64Url(publicKey.user?.id),
      },
      pubKeyCredParams: clonePlain(publicKey.pubKeyCredParams || []),
      timeout: publicKey.timeout,
      excludeCredentials: serializeCredentialDescriptors(publicKey.excludeCredentials),
      authenticatorSelection: clonePlain(publicKey.authenticatorSelection),
      attestation: publicKey.attestation,
      extensions: clonePlain(publicKey.extensions || {}),
    };
  }

  function serializeGetOptions(publicKey) {
    return {
      challenge: toBase64Url(publicKey.challenge),
      rpId: publicKey.rpId,
      timeout: publicKey.timeout,
      allowCredentials: serializeCredentialDescriptors(publicKey.allowCredentials),
      userVerification: publicKey.userVerification,
      extensions: clonePlain(publicKey.extensions || {}),
    };
  }

  function serializeCredentialDescriptors(descriptors = []) {
    return Array.from(descriptors || []).map((descriptor) => ({
      ...clonePlain(descriptor),
      id: toBase64Url(descriptor.id),
      transports: descriptor.transports ? Array.from(descriptor.transports) : undefined,
    }));
  }

  function buildCredential(dto) {
    const responseDto = dto.response || {};
    const credential = {
      id: dto.id,
      rawId: fromBase64Url(dto.rawId || dto.id).buffer,
      type: dto.type || "public-key",
      authenticatorAttachment: dto.authenticatorAttachment || null,
      getClientExtensionResults: () => clonePlain(dto.clientExtensionResults || {}),
      toJSON: () => clonePlain(dto),
    };

    if (responseDto.attestationObject) {
      const authenticatorData = responseDto.authenticatorData
        ? fromBase64Url(responseDto.authenticatorData).buffer
        : null;
      const publicKey = responseDto.publicKey ? fromBase64Url(responseDto.publicKey).buffer : null;
      credential.response = {
        attestationObject: fromBase64Url(responseDto.attestationObject).buffer,
        clientDataJSON: fromBase64Url(responseDto.clientDataJSON).buffer,
        getAuthenticatorData: () => authenticatorData,
        getPublicKey: () => publicKey,
        getPublicKeyAlgorithm: () => responseDto.publicKeyAlgorithm,
        getTransports: () => Array.from(responseDto.transports || []),
      };
      setPrototypeIfAvailable(credential.response, "AuthenticatorAttestationResponse");
    } else {
      credential.response = {
        authenticatorData: fromBase64Url(responseDto.authenticatorData).buffer,
        clientDataJSON: fromBase64Url(responseDto.clientDataJSON).buffer,
        signature: fromBase64Url(responseDto.signature).buffer,
        userHandle: responseDto.userHandle ? fromBase64Url(responseDto.userHandle).buffer : null,
      };
      setPrototypeIfAvailable(credential.response, "AuthenticatorAssertionResponse");
    }

    setPrototypeIfAvailable(credential, "PublicKeyCredential");

    return credential;
  }

  function setPrototypeIfAvailable(object, constructorName) {
    const constructor = window[constructorName];
    if (typeof constructor === "function" && constructor.prototype) {
      Object.setPrototypeOf(object, constructor.prototype);
    }
  }

  function toDomException(error) {
    const name = error?.name || "UnknownError";
    const message = error?.message || "Passly passkey request failed.";
    try {
      return new DOMException(message, name);
    } catch {
      const domError = new Error(message);
      domError.name = name;
      return domError;
    }
  }

  function toBase64Url(value) {
    const bytes = toUint8Array(value);
    let binary = "";
    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }
    return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
  }

  function fromBase64Url(value) {
    const base64 = value
      .replaceAll("-", "+")
      .replaceAll("_", "/")
      .padEnd(Math.ceil(value.length / 4) * 4, "=");
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  function toUint8Array(value) {
    if (value instanceof Uint8Array) {
      return value;
    }
    if (value instanceof ArrayBuffer) {
      return new Uint8Array(value);
    }
    if (ArrayBuffer.isView(value)) {
      return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    }
    throw new TypeError("The WebAuthn binary value should be an ArrayBuffer or typed array.");
  }

  function clonePlain(value) {
    if (value === null || typeof value === "undefined") {
      return value;
    }
    return JSON.parse(JSON.stringify(value));
  }

  function randomId() {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
})();
