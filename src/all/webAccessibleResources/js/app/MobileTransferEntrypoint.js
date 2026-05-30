/**
 * Passbolt ~ Open source password manager for teams
 * Copyright (c) 2026 Passbolt SA (https://www.passbolt.com)
 *
 * Licensed under GNU Affero General Public License version 3 of the or any later version.
 * For full copyright and license information, please see the LICENSE.txt
 * Redistributions of files must retain the above copyright notice.
 *
 * @copyright     Copyright (c) 2026 Passbolt SA (https://www.passbolt.com)
 * @license       https://opensource.org/licenses/AGPL-3.0 AGPL License
 * @link          https://www.passbolt.com Passbolt(tm)
 */
import React from "react";
import { createRoot } from "react-dom/client";
import { Html5Qrcode } from "html5-qrcode";
import QRCode from "qrcode";
import Port from "../lib/port";
import { MobileTransferQrParser } from "../../../contentScripts/js/service/mobileTransferImportPageService";

const PORT_NAME = "mobile-transfer-entrypoint";
const READER_ID = "mobile-transfer-entrypoint-reader";
const IMPORT_MODE = "import";
const FIRST_LOGIN_MODE = "first-login";
const DEFAULT_BROWSER_FIRST_LOGIN_DOMAIN = "https://pass.66ton99.org.ua";
const TRANSFER_STATUS_IN_PROGRESS = "in progress";
const TRANSFER_STATUS_COMPLETE = "complete";
const TRANSFER_STATUS_ERROR = "error";
const TRANSFER_STATUS_CANCEL = "cancel";
const BROWSER_FIRST_LOGIN_FETCH_INTERVAL = 1000;
const BROWSER_FIRST_LOGIN_STATUS_RESPONSE_READY = "response_ready";
const BROWSER_FIRST_LOGIN_STATUS_COMPLETE = "complete";
const BROWSER_FIRST_LOGIN_STATUS_EXPIRED = "expired";
const BROWSER_FIRST_LOGIN_REQUEST_EXPIRED_ERROR = "The browser first-login request has expired.";
const BROWSER_FIRST_LOGIN_DEEP_LINK_SCHEME = "passbolt";
const BROWSER_FIRST_LOGIN_DEEP_LINK_HOST = "browser-first-login";
const QRCODE_VERSION = 27;
const QRCODE_ERROR_CORRECTION = "L";
const QRCODE_MARGIN = 4;
const DEFAULT_MOBILE_TRANSFER_LOCALE = "en";

export const MOBILE_TRANSFER_TRANSLATIONS = {
  en: {
    browserFirstLoginGeneratingQrCode: "Generating QR code...",
    browserFirstLoginQrAlt: "Passbolt browser first-login QR code",
    browserFirstLoginPrivateKeyPayloadInvalid: "Could not read the private key from the phone. Refresh the QR code and try again.",
    browserFirstLoginRefreshQrCode: "Refresh QR code",
    browserFirstLoginRequestExpired: "The browser first-login request has expired.",
    mobileTransferImportCancelTransfer: "Cancel transfer",
    mobileTransferImportConnectedOpeningPassbolt: "Account connected. Opening Passbolt...",
    mobileTransferImportHeading: "Connect your Passbolt account",
    mobileTransferImportPasteQrPayloadFirst: "Paste a QR code payload first.",
    mobileTransferImportProcessQrPage: "Process QR page",
    mobileTransferImportQrPayloadAriaLabel: "QR code payload",
    mobileTransferImportScanWithCamera: "Scan with camera",
    mobileTransferImportScannedFirstPage: "Scanned page 1 of {{totalPages}}. Scan page {{nextPage}}.",
    mobileTransferImportScannedPage: "Scanned page {{page}} of {{totalPages}}. Scan page {{nextPage}}.",
    mobileTransferImportStopCamera: "Stop camera",
    mobileTransferImportWaitingFirstQr: "Waiting for the first QR code.",
    errorDifferentPassboltServer: "The QR code belongs to a different Passbolt server.",
    errorDifferentPassboltUser: "The QR code belongs to a different Passbolt user.",
    errorFirstTransferQrAlreadyScanned: "The first transfer QR code has already been scanned.",
    errorInvalidPassboltServerUrl: "The transfer QR code has an invalid Passbolt server URL.",
    errorInvalidQrCode: "This is not a valid Passbolt transfer QR code.",
    errorInvalidTransferPageCount: "The transfer QR code has an invalid page count.",
    errorMissingTransferField: "The transfer QR code is missing {{field}}.",
    errorMissingTransferPage: "The transfer is missing QR code page {{page}}.",
    errorNotPassboltTransferQrCode: "This is not a Passbolt account transfer QR code.",
    errorScanFirstQrBeforeKeyPages: "Scan the first transfer QR code before scanning the key pages.",
    errorScanQrCodePageNext: "Scan QR code page {{page}} next.",
    errorTransferKeyChecksumMismatch: "The transferred private key checksum does not match.",
    errorTransferKeyInvalid: "The transferred key is not an armored OpenPGP private key.",
    errorTransferKeyMissing: "The transferred key is missing {{field}}.",
    errorTransferKeyUserMismatch: "The transferred key does not belong to the scanned transfer user.",
    errorTransferPageOutOfRange: "The scanned transfer QR code page is outside the expected range.",
    errorTransferUserMismatch: "The transfer user does not match the scanned QR code.",
    errorTransferUserProfileMissing: "The Passbolt server did not return the transfer user profile.",
  },
  uk: {
    browserFirstLoginGeneratingQrCode: "Створення QR-коду...",
    browserFirstLoginQrAlt: "QR-код першого входу Passbolt у браузері",
    browserFirstLoginPrivateKeyPayloadInvalid: "Не вдалося прочитати приватний ключ із телефону. Оновіть QR-код і спробуйте ще раз.",
    browserFirstLoginRefreshQrCode: "Оновити QR-код",
    browserFirstLoginRequestExpired: "Запит першого входу в браузері застарів.",
    mobileTransferImportCancelTransfer: "Скасувати перенесення",
    mobileTransferImportConnectedOpeningPassbolt: "Обліковий запис підключено. Відкриваю Passbolt...",
    mobileTransferImportHeading: "Підключіть обліковий запис Passbolt",
    mobileTransferImportPasteQrPayloadFirst: "Спочатку вставте дані QR-коду.",
    mobileTransferImportProcessQrPage: "Обробити сторінку QR",
    mobileTransferImportQrPayloadAriaLabel: "Дані QR-коду",
    mobileTransferImportScanWithCamera: "Сканувати камерою",
    mobileTransferImportScannedFirstPage: "Сторінку 1 з {{totalPages}} скановано. Скануйте сторінку {{nextPage}}.",
    mobileTransferImportScannedPage: "Сторінку {{page}} з {{totalPages}} скановано. Скануйте сторінку {{nextPage}}.",
    mobileTransferImportStopCamera: "Зупинити камеру",
    mobileTransferImportWaitingFirstQr: "Очікування першого QR-коду.",
    errorDifferentPassboltServer: "QR-код належить іншому серверу Passbolt.",
    errorDifferentPassboltUser: "QR-код належить іншому користувачу Passbolt.",
    errorFirstTransferQrAlreadyScanned: "Перший QR-код перенесення вже скановано.",
    errorInvalidPassboltServerUrl: "QR-код перенесення містить некоректну адресу сервера Passbolt.",
    errorInvalidQrCode: "Це некоректний QR-код перенесення Passbolt.",
    errorInvalidTransferPageCount: "QR-код перенесення містить некоректну кількість сторінок.",
    errorMissingTransferField: "У QR-коді перенесення немає поля {{field}}.",
    errorMissingTransferPage: "У перенесенні немає сторінки QR-коду {{page}}.",
    errorNotPassboltTransferQrCode: "Це не QR-код перенесення облікового запису Passbolt.",
    errorScanFirstQrBeforeKeyPages: "Спочатку скануйте перший QR-код перенесення, потім сторінки ключа.",
    errorScanQrCodePageNext: "Далі скануйте сторінку QR-коду {{page}}.",
    errorTransferKeyChecksumMismatch: "Контрольна сума перенесеного приватного ключа не збігається.",
    errorTransferKeyInvalid: "Перенесений ключ не є armored OpenPGP приватним ключем.",
    errorTransferKeyMissing: "У перенесеному ключі немає поля {{field}}.",
    errorTransferKeyUserMismatch: "Перенесений ключ не належить користувачу зі сканованого QR-коду.",
    errorTransferPageOutOfRange: "Сканована сторінка QR-коду перенесення поза очікуваним діапазоном.",
    errorTransferUserMismatch: "Користувач перенесення не збігається з користувачем у QR-коді.",
    errorTransferUserProfileMissing: "Сервер Passbolt не повернув профіль користувача перенесення.",
  },
};

const MOBILE_TRANSFER_ERROR_MESSAGE_KEYS = {
  "The browser first-login private key payload is invalid.": "browserFirstLoginPrivateKeyPayloadInvalid",
  [BROWSER_FIRST_LOGIN_REQUEST_EXPIRED_ERROR]: "browserFirstLoginRequestExpired",
  "The transfer user does not match the scanned QR code.": "errorTransferUserMismatch",
  "The Passbolt server did not return the transfer user profile.": "errorTransferUserProfileMissing",
  "This is not a valid Passbolt transfer QR code.": "errorInvalidQrCode",
  "This is not a Passbolt account transfer QR code.": "errorNotPassboltTransferQrCode",
  "The first transfer QR code has already been scanned.": "errorFirstTransferQrAlreadyScanned",
  "Scan the first transfer QR code before scanning the key pages.": "errorScanFirstQrBeforeKeyPages",
  "The scanned transfer QR code page is outside the expected range.": "errorTransferPageOutOfRange",
  "The transferred private key checksum does not match.": "errorTransferKeyChecksumMismatch",
  "The QR code belongs to a different Passbolt user.": "errorDifferentPassboltUser",
  "The QR code belongs to a different Passbolt server.": "errorDifferentPassboltServer",
  "The transfer QR code has an invalid page count.": "errorInvalidTransferPageCount",
  "The transfer QR code has an invalid Passbolt server URL.": "errorInvalidPassboltServerUrl",
  "The transferred key does not belong to the scanned transfer user.": "errorTransferKeyUserMismatch",
  "The transferred key is not an armored OpenPGP private key.": "errorTransferKeyInvalid",
};

export function normalizeMobileTransferLocale(locale) {
  if (typeof locale === "string" && locale.toLowerCase().startsWith("uk")) {
    return "uk";
  }
  return DEFAULT_MOBILE_TRANSFER_LOCALE;
}

export function getBrowserUiLocale() {
  try {
    if (typeof browser !== "undefined" && browser.i18n?.getUILanguage) {
      return browser.i18n.getUILanguage();
    }
  } catch (error) {
    console.error(error);
  }
  return DEFAULT_MOBILE_TRANSFER_LOCALE;
}

export function translateMobileTransferMessage(key, replacements = {}, locale = getBrowserUiLocale()) {
  const normalizedLocale = normalizeMobileTransferLocale(locale);
  const message =
    MOBILE_TRANSFER_TRANSLATIONS[normalizedLocale]?.[key] ||
    MOBILE_TRANSFER_TRANSLATIONS[DEFAULT_MOBILE_TRANSFER_LOCALE][key] ||
    key;

  return Object.entries(replacements).reduce(
    (translatedMessage, [replacementKey, replacementValue]) =>
      translatedMessage.replaceAll(`{{${replacementKey}}}`, String(replacementValue)),
    message,
  );
}

export function isBrowserFirstLoginRequestExpired(errorOrRequest) {
  return (
    errorOrRequest?.status === BROWSER_FIRST_LOGIN_STATUS_EXPIRED ||
    errorOrRequest?.message === BROWSER_FIRST_LOGIN_REQUEST_EXPIRED_ERROR
  );
}

export function translateMobileTransferError(error, locale = getBrowserUiLocale()) {
  const message = error?.message || String(error);
  const exactMessageKey = MOBILE_TRANSFER_ERROR_MESSAGE_KEYS[message];
  if (exactMessageKey) {
    return translateMobileTransferMessage(exactMessageKey, {}, locale);
  }

  const scanNextPageMatch = message.match(/^Scan QR code page (\d+) next\.$/);
  if (scanNextPageMatch) {
    return translateMobileTransferMessage("errorScanQrCodePageNext", { page: scanNextPageMatch[1] }, locale);
  }

  const missingTransferPageMatch = message.match(/^The transfer is missing QR code page (\d+)\.$/);
  if (missingTransferPageMatch) {
    return translateMobileTransferMessage("errorMissingTransferPage", { page: missingTransferPageMatch[1] }, locale);
  }

  const missingTransferFieldMatch = message.match(/^The transfer QR code is missing (.+)\.$/);
  if (missingTransferFieldMatch) {
    return translateMobileTransferMessage("errorMissingTransferField", { field: missingTransferFieldMatch[1] }, locale);
  }

  const missingTransferKeyFieldMatch = message.match(/^The transferred key is missing (.+)\.$/);
  if (missingTransferKeyFieldMatch) {
    return translateMobileTransferMessage(
      "errorTransferKeyMissing",
      { field: missingTransferKeyFieldMatch[1] },
      locale,
    );
  }

  return message;
}

export async function processMobileTransferQrScan({
  parser,
  port,
  decodedText,
  redirect,
  stopScanner,
  setDomain,
  setStatus,
  localize = translateMobileTransferMessage,
}) {
  const result = parser.accept(decodedText);
  if (result.type === "duplicate") {
    return;
  }

  if (result.type === "first-page") {
    setDomain(result.metadata.domain);
    const transfer = await updateTransfer(port, parser.metadata, result.nextPage, TRANSFER_STATUS_IN_PROGRESS);
    assertTransferMatchesMetadata(transfer, result.metadata);
    setStatus(
      localize("mobileTransferImportScannedFirstPage", {
        totalPages: result.totalPages,
        nextPage: result.nextPage + 1,
      }),
    );
  } else if (result.type === "page") {
    await updateTransfer(port, parser.metadata, result.nextPage, TRANSFER_STATUS_IN_PROGRESS);
    setStatus(
      localize("mobileTransferImportScannedPage", {
        page: result.page + 1,
        totalPages: result.totalPages,
        nextPage: result.nextPage + 1,
      }),
    );
  } else if (result.type === "last-page") {
    const assembledKey = parser.assembleKeyData();
    const transfer = await updateTransfer(port, parser.metadata, result.page, TRANSFER_STATUS_COMPLETE);
    await importAccount(port, parser.metadata, assembledKey, transfer);
    setStatus(localize("mobileTransferImportConnectedOpeningPassbolt"));
    await stopScanner();
    redirect(parser.metadata.domain);
  }
}

export const updateTransfer = async (port, metadata, page, status) =>
  port.request(
    "passbolt.mobile-transfer-entrypoint.update-transfer",
    metadata.domain,
    metadata.transfer_id,
    metadata.authentication_token,
    {
      current_page: page,
      status,
    },
  );

export const importAccount = async (port, metadata, assembledKey, transfer) => {
  assertTransferMatchesMetadata(transfer, metadata);
  await port.request("passbolt.mobile-transfer-entrypoint.import-account", {
    metadata,
    assembled_key: assembledKey,
    transfer,
  });
};

export const assertTransferMatchesMetadata = (transfer, metadata) => {
  if (transfer.user_id !== metadata.user_id || transfer.user?.id !== metadata.user_id) {
    throw new Error("The transfer user does not match the scanned QR code.");
  }
  if (!transfer.user?.profile) {
    throw new Error("The Passbolt server did not return the transfer user profile.");
  }
};

export function buildBrowserFirstLoginDeepLink({ domain, requestId, secret }) {
  const params = new URLSearchParams({
    type: "browser_first_login",
    version: "1",
    domain,
    request_id: requestId,
    secret,
  });

  return `${BROWSER_FIRST_LOGIN_DEEP_LINK_SCHEME}://${BROWSER_FIRST_LOGIN_DEEP_LINK_HOST}?${params.toString()}`;
}

export async function getQrCode(payload) {
  return QRCode.toDataURL(
    [
      {
        data: payload,
        mode: "byte",
      },
    ],
    {
      version: QRCODE_VERSION,
      errorCorrectionLevel: QRCODE_ERROR_CORRECTION,
      type: "image/jpeg",
      quality: 1,
      margin: QRCODE_MARGIN,
    },
  );
}

export async function createBrowserFirstLoginQrCode(port, domain) {
  const request = await port.request("passbolt.browser-first-login.create", domain);
  const payload = buildBrowserFirstLoginDeepLink({
    domain,
    requestId: request.id,
    secret: request.secret,
  });
  return {
    qrCodes: [await getQrCode(payload)],
    request,
  };
}

export async function pollBrowserFirstLogin(port, { domain, requestId, secret }) {
  const request = await port.request("passbolt.browser-first-login.view", domain, requestId, secret);
  switch (request.status) {
    case BROWSER_FIRST_LOGIN_STATUS_RESPONSE_READY:
      return port.request("passbolt.browser-first-login.complete", domain, requestId, secret);
    default:
      return request;
  }
}

export function buildBrowserFirstLoginAuthUrl(domain, redirect = "/") {
  const url = new URL("/auth/login", domain);
  url.searchParams.set("redirect", redirect);
  return url.toString();
}

export function BrowserFirstLoginEntrypoint({ port, domain = DEFAULT_BROWSER_FIRST_LOGIN_DOMAIN, locale }) {
  const activeLocale = locale || getBrowserUiLocale();
  const localize = React.useCallback(
    (key, replacements) => translateMobileTransferMessage(key, replacements, activeLocale),
    [activeLocale],
  );
  const [qrCodes, setQrCodes] = React.useState(null);
  const [error, setError] = React.useState("");
  const [isExpired, setIsExpired] = React.useState(false);
  const [refreshCounter, setRefreshCounter] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    let intervalId = null;
    let requestInProgress = false;
    let browserFirstLoginRequest = null;

    const clearPolling = () => {
      if (intervalId) {
        window.clearInterval(intervalId);
        intervalId = null;
      }
    };

    const pollBrowserFirstLoginRequest = async () => {
      if (requestInProgress || !browserFirstLoginRequest) {
        return;
      }

      requestInProgress = true;
      try {
        const updatedRequest = await pollBrowserFirstLogin(port, {
          domain,
          requestId: browserFirstLoginRequest.id,
          secret: browserFirstLoginRequest.secret,
        });
        if (cancelled) {
          return;
        }
        browserFirstLoginRequest = { ...browserFirstLoginRequest, ...updatedRequest };
        if (updatedRequest.status === BROWSER_FIRST_LOGIN_STATUS_COMPLETE) {
          clearPolling();
          window.location.href = buildBrowserFirstLoginAuthUrl(domain);
        } else if (isBrowserFirstLoginRequestExpired(updatedRequest)) {
          clearPolling();
          setIsExpired(true);
        }
      } catch (error) {
        console.error(error);
        clearPolling();
        if (!cancelled) {
          if (isBrowserFirstLoginRequestExpired(error)) {
            setIsExpired(true);
          } else {
            setError(translateMobileTransferError(error, activeLocale));
          }
        }
      } finally {
        requestInProgress = false;
      }
    };

    const init = async () => {
      setQrCodes(null);
      setError("");
      setIsExpired(false);
      try {
        const result = await createBrowserFirstLoginQrCode(port, domain);
        if (cancelled) {
          return;
        }
        setQrCodes(result.qrCodes);
        browserFirstLoginRequest = result.request;
        intervalId = window.setInterval(pollBrowserFirstLoginRequest, BROWSER_FIRST_LOGIN_FETCH_INTERVAL);
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          if (isBrowserFirstLoginRequestExpired(error)) {
            setIsExpired(true);
          } else {
            setError(translateMobileTransferError(error, activeLocale));
          }
        }
      }
    };

    init();

    return () => {
      cancelled = true;
      clearPolling();
    };
  }, [activeLocale, domain, port, refreshCounter]);

  const currentQrCode = qrCodes?.[0] || "";
  const refreshQrCode = () => setRefreshCounter((counter) => counter + 1);

  return (
    <div className="mobile-transfer-entrypoint">
      <style>{`
        body {
          background: #fff;
          color: #222;
          margin: 0;
        }
        .mobile-transfer-entrypoint {
          align-items: center;
          display: flex;
          min-height: 100vh;
          justify-content: center;
          padding: 1.6rem;
        }
        .mobile-transfer-entrypoint .qr-stage {
          align-items: center;
          display: flex;
          justify-content: center;
          min-height: 35.7rem;
          min-width: 35.7rem;
        }
        .mobile-transfer-entrypoint .qr-code {
          display: block;
          height: 32.5rem;
          width: 32.5rem;
        }
        .mobile-transfer-entrypoint .loading,
        .mobile-transfer-entrypoint .error-message {
          font: 1.4rem/2rem Arial, sans-serif;
          margin: 0;
          max-width: 32.5rem;
          text-align: center;
        }
        .mobile-transfer-entrypoint .error-message {
          color: #b00020;
        }
        .mobile-transfer-entrypoint .qr-refresh-button {
          background: #2f855a;
          border: .1rem solid #276749;
          border-radius: .4rem;
          color: #fff;
          cursor: pointer;
          font: 1.4rem/2rem Arial, sans-serif;
          padding: .9rem 1.4rem;
        }
        .mobile-transfer-entrypoint .qr-refresh-button:hover,
        .mobile-transfer-entrypoint .qr-refresh-button:focus {
          background: #276749;
        }
      `}</style>
      <main className="qr-stage" aria-live="polite">
        {isExpired ? (
          <button type="button" className="qr-refresh-button" onClick={refreshQrCode}>
            {localize("browserFirstLoginRefreshQrCode")}
          </button>
        ) : error ? (
          <p className="error-message">{error}</p>
        ) : currentQrCode ? (
          <img
            id="mobile-transfer-entrypoint-qr-code"
            className="qr-code"
            src={currentQrCode}
            alt={localize("browserFirstLoginQrAlt")}
          />
        ) : (
          <p className="loading">{localize("browserFirstLoginGeneratingQrCode")}</p>
        )}
      </main>
    </div>
  );
}

export function MobileTransferImportEntrypoint({ port, redirect = (url) => window.location.assign(url), locale }) {
  const activeLocale = locale || getBrowserUiLocale();
  const localize = React.useCallback(
    (key, replacements) => translateMobileTransferMessage(key, replacements, activeLocale),
    [activeLocale],
  );
  const parserRef = React.useRef(
    new MobileTransferQrParser(window.location.href, { assertCurrentUrlMatchesMetadata: false }),
  );
  const scannerRef = React.useRef(null);
  const manualQrPayloadRef = React.useRef(null);
  const processingScanRef = React.useRef(false);
  const completedRef = React.useRef(false);
  const [status, setStatus] = React.useState(() => localize("mobileTransferImportWaitingFirstQr"));
  const [error, setError] = React.useState("");
  const [isScanning, setIsScanning] = React.useState(false);
  const [domain, setDomain] = React.useState("");

  React.useEffect(() => {
    return () => {
      stopScanner().catch(() => {});
    };
  }, []);

  const startScanner = async () => {
    if (scannerRef.current) {
      return;
    }
    const scanner = new Html5Qrcode(READER_ID);
    scannerRef.current = scanner;
    setIsScanning(true);
    await scanner.start(
      { facingMode: "environment" },
      { fps: 8, qrbox: { width: 260, height: 260 } },
      (decodedText) => handleScan(decodedText),
      () => {},
    );
  };

  const stopScanner = async () => {
    if (!scannerRef.current) {
      return;
    }
    try {
      await scannerRef.current.stop();
    } finally {
      scannerRef.current.clear();
      scannerRef.current = null;
      setIsScanning(false);
    }
  };

  const handleScan = async (decodedText) => {
    if (processingScanRef.current || completedRef.current) {
      return;
    }

    processingScanRef.current = true;
    setError("");
    try {
      await processMobileTransferQrScan({
        parser: parserRef.current,
        port,
        decodedText,
        redirect,
        stopScanner,
        setDomain,
        setStatus,
        localize,
      });
      if (parserRef.current.lastAcceptedPage === parserRef.current.metadata?.total_pages - 1) {
        completedRef.current = true;
      }
      return true;
    } catch (error) {
      setError(translateMobileTransferError(error, activeLocale));
      await updateTransferErrorIfInitialized();
      return false;
    } finally {
      processingScanRef.current = false;
    }
  };

  const updateTransferErrorIfInitialized = async () => {
    const parser = parserRef.current;
    if (!parser.metadata) {
      return;
    }
    try {
      await updateTransfer(port, parser.metadata, parser.lastAcceptedPage, TRANSFER_STATUS_ERROR);
    } catch (error) {
      console.error(error);
    }
  };

  const handleManualQrPayloadSubmit = async (event) => {
    event.preventDefault();
    const payload = manualQrPayloadRef.current?.value.trim();
    if (!payload) {
      setError(localize("mobileTransferImportPasteQrPayloadFirst"));
      return;
    }
    const success = await handleScan(payload);
    if (success && manualQrPayloadRef.current) {
      manualQrPayloadRef.current.value = "";
    }
  };

  const cancel = async () => {
    const parser = parserRef.current;
    if (parser.metadata) {
      try {
        await updateTransfer(port, parser.metadata, parser.lastAcceptedPage, TRANSFER_STATUS_CANCEL);
      } catch (error) {
        console.error(error);
      }
    }
    parser.reset();
    setDomain("");
    setStatus(localize("mobileTransferImportWaitingFirstQr"));
    setError("");
  };

  return (
    <div className="mobile-transfer-entrypoint">
      <style>{`
        body {
          background: #f7f7f4;
          color: #222;
          margin: 0;
        }
        .mobile-transfer-entrypoint {
          align-items: center;
          display: flex;
          min-height: 100vh;
          justify-content: center;
          padding: 3.2rem 1.6rem;
        }
        .mobile-transfer-entrypoint .panel {
          background: #fff;
          border: .1rem solid #d7d7d2;
          border-radius: .8rem;
          box-shadow: 0 1.2rem 3rem rgba(0, 0, 0, .08);
          max-width: 52rem;
          padding: 2.4rem;
          width: 100%;
        }
        .mobile-transfer-entrypoint h1 {
          font-size: 2.4rem;
          line-height: 1.25;
          margin: 0 0 1.2rem;
        }
        .mobile-transfer-entrypoint .reader {
          background: #f0f0ed;
          border-radius: .6rem;
          min-height: 30rem;
          overflow: hidden;
        }
        .mobile-transfer-entrypoint .status {
          margin: 1.6rem 0 0;
        }
        .mobile-transfer-entrypoint .manual-transfer {
          margin-top: 1.6rem;
        }
        .mobile-transfer-entrypoint textarea {
          border: .1rem solid #d7d7d2;
          border-radius: .4rem;
          box-sizing: border-box;
          font-family: inherit;
          min-height: 7.2rem;
          padding: .8rem;
          resize: vertical;
          width: 100%;
        }
        .mobile-transfer-entrypoint .domain {
          color: #555;
          margin: .8rem 0 0;
          overflow-wrap: anywhere;
        }
        .mobile-transfer-entrypoint .error-message {
          color: #b00020;
          margin: 1.2rem 0 0;
        }
        .mobile-transfer-entrypoint .actions {
          column-gap: .8rem;
          display: flex;
          justify-content: flex-end;
          margin-top: 2rem;
        }
      `}</style>
      <main className="panel">
        <h1>{localize("mobileTransferImportHeading")}</h1>
        <div id={READER_ID} className="reader" />
        <p className="status">{status}</p>
        {domain && <p className="domain">{domain}</p>}
        {error && <p className="error-message">{error}</p>}
        <form className="manual-transfer" onSubmit={handleManualQrPayloadSubmit}>
          <textarea
            ref={manualQrPayloadRef}
            aria-label={localize("mobileTransferImportQrPayloadAriaLabel")}
            spellCheck="false"
          />
          <div className="actions">
            <button type="submit" className="button">
              {localize("mobileTransferImportProcessQrPage")}
            </button>
          </div>
        </form>
        <div className="actions">
          {isScanning ? (
            <button
              type="button"
              className="button"
              onClick={() =>
                stopScanner().catch((error) => setError(translateMobileTransferError(error, activeLocale)))
              }
            >
              {localize("mobileTransferImportStopCamera")}
            </button>
          ) : (
            <button
              type="button"
              className="button"
              onClick={() =>
                startScanner().catch((error) => setError(translateMobileTransferError(error, activeLocale)))
              }
            >
              {localize("mobileTransferImportScanWithCamera")}
            </button>
          )}
          <button type="button" className="button cancel" onClick={cancel}>
            {localize("mobileTransferImportCancelTransfer")}
          </button>
        </div>
      </main>
    </div>
  );
}

export function MobileTransferEntrypoint({ port, mode, redirect, locale }) {
  const query = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const entrypointMode = mode || query.get("mode") || FIRST_LOGIN_MODE;
  const domain = query.get("domain") || DEFAULT_BROWSER_FIRST_LOGIN_DOMAIN;
  const entrypointLocale = locale || query.get("locale") || undefined;

  if (entrypointMode === IMPORT_MODE) {
    return <MobileTransferImportEntrypoint port={port} redirect={redirect} locale={entrypointLocale} />;
  }

  return <BrowserFirstLoginEntrypoint port={port} domain={domain} locale={entrypointLocale} />;
}

export async function main() {
  const query = new URLSearchParams(window.location.search);
  const portname = query.get("passbolt") || PORT_NAME;
  const port = new Port(portname);
  await port.connect();

  const domContainer = document.getElementById("mobile-transfer-entrypoint-root");
  const root = createRoot(domContainer);
  root.render(<MobileTransferEntrypoint port={port} />);
}

if (typeof document !== "undefined" && document.getElementById("mobile-transfer-entrypoint-root")) {
  main();
}
