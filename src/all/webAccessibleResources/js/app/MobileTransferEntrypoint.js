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
import Port from "../lib/port";
import { MobileTransferQrParser } from "../../../contentScripts/js/service/mobileTransferImportPageService";

const PORT_NAME = "mobile-transfer-entrypoint";
const READER_ID = "mobile-transfer-entrypoint-reader";
const TRANSFER_STATUS_IN_PROGRESS = "in progress";
const TRANSFER_STATUS_COMPLETE = "complete";
const TRANSFER_STATUS_ERROR = "error";
const TRANSFER_STATUS_CANCEL = "cancel";

export async function processMobileTransferQrScan({
  parser,
  port,
  decodedText,
  redirect,
  stopScanner,
  setDomain,
  setStatus,
}) {
  const result = parser.accept(decodedText);
  if (result.type === "duplicate") {
    return;
  }

  if (result.type === "first-page") {
    setDomain(result.metadata.domain);
    const transfer = await updateTransfer(port, parser.metadata, result.nextPage, TRANSFER_STATUS_IN_PROGRESS);
    assertTransferMatchesMetadata(transfer, result.metadata);
    setStatus(`Scanned page 1 of ${result.totalPages}. Scan page ${result.nextPage + 1}.`);
  } else if (result.type === "page") {
    await updateTransfer(port, parser.metadata, result.nextPage, TRANSFER_STATUS_IN_PROGRESS);
    setStatus(`Scanned page ${result.page + 1} of ${result.totalPages}. Scan page ${result.nextPage + 1}.`);
  } else if (result.type === "last-page") {
    const assembledKey = parser.assembleKeyData();
    const transfer = await updateTransfer(port, parser.metadata, result.page, TRANSFER_STATUS_COMPLETE);
    await importAccount(port, parser.metadata, assembledKey, transfer);
    setStatus("Account connected. Opening Passbolt...");
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

export function MobileTransferEntrypoint({ port, redirect = (url) => window.location.assign(url) }) {
  const parserRef = React.useRef(
    new MobileTransferQrParser(window.location.href, { assertCurrentUrlMatchesMetadata: false }),
  );
  const scannerRef = React.useRef(null);
  const manualQrPayloadRef = React.useRef(null);
  const processingScanRef = React.useRef(false);
  const completedRef = React.useRef(false);
  const [status, setStatus] = React.useState("Waiting for the first QR code.");
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
      });
      if (parserRef.current.lastAcceptedPage === parserRef.current.metadata?.total_pages - 1) {
        completedRef.current = true;
      }
      return true;
    } catch (error) {
      setError(error.message);
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
      setError("Paste a QR code payload first.");
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
    setStatus("Waiting for the first QR code.");
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
        <h1>Connect your Passbolt account</h1>
        <div id={READER_ID} className="reader" />
        <p className="status">{status}</p>
        {domain && <p className="domain">{domain}</p>}
        {error && <p className="error-message">{error}</p>}
        <form className="manual-transfer" onSubmit={handleManualQrPayloadSubmit}>
          <textarea ref={manualQrPayloadRef} aria-label="QR code payload" spellCheck="false" />
          <div className="actions">
            <button type="submit" className="button">
              Process QR page
            </button>
          </div>
        </form>
        <div className="actions">
          {isScanning ? (
            <button
              type="button"
              className="button"
              onClick={() => stopScanner().catch((error) => setError(error.message))}
            >
              Stop camera
            </button>
          ) : (
            <button
              type="button"
              className="button"
              onClick={() => startScanner().catch((error) => setError(error.message))}
            >
              Scan with camera
            </button>
          )}
          <button type="button" className="button cancel" onClick={cancel}>
            Cancel transfer
          </button>
        </div>
      </main>
    </div>
  );
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
