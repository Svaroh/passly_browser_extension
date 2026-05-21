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
import { renderToString } from "react-dom/server";
import jsSHA from "jssha";
import { Html5Qrcode } from "html5-qrcode";
import { MobileTransferEntrypoint, processMobileTransferQrScan } from "./MobileTransferEntrypoint";
import { MobileTransferQrParser } from "../../../contentScripts/js/service/mobileTransferImportPageService";

jest.mock("html5-qrcode", () => ({
  Html5Qrcode: jest.fn(),
}));

describe("MobileTransferEntrypoint", () => {
  it("Should not request camera access when the entrypoint is opened.", () => {
    expect.assertions(3);

    const html = renderToString(<MobileTransferEntrypoint port={{ request: jest.fn() }} />);

    expect(Html5Qrcode).not.toHaveBeenCalled();
    expect(html).toContain("Waiting for the first QR code.");
    expect(html).toContain("Scan with camera");
  });

  it("Should process a complete QR transfer and import the account.", async () => {
    expect.assertions(8);

    const redirect = jest.fn();
    const stopScanner = jest.fn().mockResolvedValue();
    const setDomain = jest.fn();
    const setStatus = jest.fn();
    const transfer = buildTransfer();
    const port = {
      request: jest.fn(async (message) => {
        if (message === "passbolt.mobile-transfer-entrypoint.update-transfer") {
          return transfer;
        }
        if (message === "passbolt.mobile-transfer-entrypoint.import-account") {
          return null;
        }
        throw new Error(`Unexpected message ${message}`);
      }),
    };
    const parser = new MobileTransferQrParser(window.location.href, { assertCurrentUrlMatchesMetadata: false });
    const qrPages = buildQrPages(transfer);

    await processMobileTransferQrScan({
      parser,
      port,
      decodedText: qrPages.first,
      redirect,
      stopScanner,
      setDomain,
      setStatus,
    });

    expect(setDomain).toHaveBeenCalledWith(qrPages.metadata.domain);
    expect(port.request).toHaveBeenCalledWith(
      "passbolt.mobile-transfer-entrypoint.update-transfer",
      qrPages.metadata.domain,
      qrPages.metadata.transfer_id,
      qrPages.metadata.authentication_token,
      { current_page: 1, status: "in progress" },
    );
    expect(setStatus).toHaveBeenCalledWith("Scanned page 1 of 2. Scan page 2.");

    await processMobileTransferQrScan({
      parser,
      port,
      decodedText: qrPages.last,
      redirect,
      stopScanner,
      setDomain,
      setStatus,
    });

    expect(port.request).toHaveBeenCalledWith(
      "passbolt.mobile-transfer-entrypoint.update-transfer",
      qrPages.metadata.domain,
      qrPages.metadata.transfer_id,
      qrPages.metadata.authentication_token,
      { current_page: 1, status: "complete" },
    );
    expect(port.request).toHaveBeenCalledWith("passbolt.mobile-transfer-entrypoint.import-account", {
      metadata: qrPages.metadata,
      assembled_key: qrPages.assembledKey,
      transfer,
    });
    expect(stopScanner).toHaveBeenCalledTimes(1);
    expect(redirect).toHaveBeenCalledWith(qrPages.metadata.domain);
    expect(setStatus).toHaveBeenCalledWith("Account connected. Opening Passbolt...");
  });

  function buildTransfer() {
    const userId = "1c8e5d7a-0d27-4f39-a4a3-0db6fc9a7a30";
    return {
      user_id: userId,
      user: {
        id: userId,
        username: "ada@passbolt.com",
        profile: {
          first_name: "Ada",
          last_name: "Lovelace",
        },
      },
    };
  }

  function buildQrPages(transfer) {
    const assembledKey = {
      armored_key: "-----BEGIN PGP PRIVATE KEY BLOCK-----\nkey\n-----END PGP PRIVATE KEY BLOCK-----",
      user_id: transfer.user_id,
      fingerprint: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    };
    const keyPayload = JSON.stringify(assembledKey);
    const metadata = {
      transfer_id: "79dce172-8b3c-4be5-a258-3129230996dd",
      user_id: transfer.user_id,
      total_pages: 2,
      authentication_token: "962c7349-96f7-4395-8b0e-3f026c6fe599",
      hash: sha512(keyPayload),
      domain: "https://pass.66ton99.org.ua/",
    };

    return {
      metadata,
      assembledKey,
      first: `100${JSON.stringify(metadata)}`,
      last: `101${keyPayload}`,
    };
  }

  function sha512(value) {
    const sha = new jsSHA("SHA-512", "TEXT");
    sha.update(value);
    return sha.getHash("HEX").toLowerCase();
  }
});
