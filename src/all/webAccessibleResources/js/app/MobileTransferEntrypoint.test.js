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
import QRCode from "qrcode";
import {
  buildBrowserFirstLoginDeepLink,
  BrowserFirstLoginEntrypoint,
  createBrowserFirstLoginQrCode,
  isBrowserFirstLoginRequestExpired,
  MobileTransferEntrypoint,
  translateMobileTransferError,
  translateMobileTransferMessage,
} from "./MobileTransferEntrypoint";

jest.mock("qrcode", () => ({
  __esModule: true,
  default: {
    toDataURL: jest.fn(
      async (segments) => `data:image/jpeg;base64,${Buffer.from(segments[0].data).toString("base64")}`,
    ),
  },
}));

describe("MobileTransferEntrypoint", () => {
  beforeEach(() => {
    QRCode.toDataURL.mockClear();
  });

  it("Should render a QR-only first-login entrypoint without scanner/import controls by default.", () => {
    expect.assertions(6);

    const html = renderToString(<MobileTransferEntrypoint port={{ request: jest.fn() }} />);

    expect(html).toContain("Generating QR code...");
    expect(html).not.toContain("Start QR scanner");
    expect(html).not.toContain("Scan with camera");
    expect(html).not.toContain("Paste QR payload");
    expect(html).not.toContain("Please enter your passphrase");
    expect(html).not.toContain("mobile-transfer-entrypoint-reader");
  });

  it("Should preserve the legacy scanner/import entrypoint in import mode.", () => {
    expect.assertions(3);

    const html = renderToString(<MobileTransferEntrypoint port={{ request: jest.fn() }} mode="import" />);

    expect(html).toContain("mobile-transfer-entrypoint-reader");
    expect(html).toContain("Scan with camera");
    expect(html).toContain("Process QR page");
  });

  it("Should create a browser first-login deep-link QR code without private key data.", async () => {
    expect.assertions(5);

    const domain = "https://pass.66ton99.org.ua";
    const request = {
      id: "79dce172-8b3c-4be5-a258-3129230996dd",
      secret: "pairing-secret",
      status: "pending",
    };
    const port = {
      request: jest.fn(async (message) => {
        if (message === "passbolt.browser-first-login.create") {
          return request;
        }
        throw new Error(`Unexpected message ${message}`);
      }),
    };

    const result = await createBrowserFirstLoginQrCode(port, domain);
    const payload = QRCode.toDataURL.mock.calls[0][0][0].data;
    const qrData = new URL(payload);

    expect(port.request).toHaveBeenCalledWith("passbolt.browser-first-login.create", domain);
    expect(payload.startsWith("passbolt://browser-first-login?")).toBe(true);
    expect(Object.fromEntries(qrData.searchParams.entries())).toEqual({
      type: "browser_first_login",
      version: "1",
      domain,
      request_id: request.id,
      secret: request.secret,
    });
    expect(qrData.search).not.toContain("armored_key");
    expect(result.request.id).toBe(request.id);
  });

  it("Should build the browser first-login deep link.", () => {
    expect.assertions(1);

    const payload = buildBrowserFirstLoginDeepLink({
      domain: "https://pass.66ton99.org.ua",
      requestId: "79dce172-8b3c-4be5-a258-3129230996dd",
      secret: "pairing-secret",
    });

    expect(payload).toBe(
      "passbolt://browser-first-login?type=browser_first_login&version=1&domain=https%3A%2F%2Fpass.66ton99.org.ua&request_id=79dce172-8b3c-4be5-a258-3129230996dd&secret=pairing-secret",
    );
  });

  it("Should render the browser first-login QR component without private-key wording.", () => {
    expect.assertions(2);

    const html = renderToString(
      <BrowserFirstLoginEntrypoint port={{ request: jest.fn() }} domain="https://pass.66ton99.org.ua" />,
    );

    expect(html).toContain("Generating QR code...");
    expect(html).not.toContain("private key");
  });

  it("Should translate first-login messages to Ukrainian.", () => {
    expect.assertions(3);

    expect(translateMobileTransferMessage("browserFirstLoginGeneratingQrCode", {}, "uk-UA")).toBe(
      "Створення QR-коду...",
    );
    expect(translateMobileTransferMessage("browserFirstLoginRefreshQrCode", {}, "uk-UA")).toBe("Оновити QR-код");
    expect(translateMobileTransferError(new Error("The browser first-login request has expired."), "uk-UA")).toBe(
      "Запит першого входу в браузері застарів.",
    );
  });

  it("Should identify expired first-login requests.", () => {
    expect.assertions(2);

    expect(isBrowserFirstLoginRequestExpired(new Error("The browser first-login request has expired."))).toBe(true);
    expect(isBrowserFirstLoginRequestExpired({ status: "expired" })).toBe(true);
  });
});
