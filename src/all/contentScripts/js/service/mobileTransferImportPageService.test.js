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
import { MobileTransferQrParser } from "./mobileTransferImportPageService";

describe("MobileTransferQrParser", () => {
  const currentUrl =
    "https://pass.66ton99.org.ua/setup/recover/start/571bec7e-6cce-451d-b53a-f8c93e147228/5ea0fc9c-b180-4873-8e00-9457862e43e0";
  const userId = "571bec7e-6cce-451d-b53a-f8c93e147228";
  const transferId = "0682ab8f-ecba-4336-a628-8b6cac609f49";
  const authenticationToken = "5ea0fc9c-b180-4873-8e00-9457862e43e0";
  const armoredKey = [
    "-----BEGIN PGP PRIVATE KEY BLOCK-----",
    "Version: OpenPGP.js",
    "",
    "private key",
    "-----END PGP PRIVATE KEY BLOCK-----",
  ].join("\n");

  const qrPage = (page, payload) => `1${page.toString(16).padStart(2, "0")}${payload}`;

  function buildTransfer(parser, overrides = {}) {
    const keyPayload = JSON.stringify({
      armored_key: armoredKey,
      user_id: userId,
      fingerprint: "ABCDEF",
    });
    const firstPagePayload = JSON.stringify({
      transfer_id: transferId,
      user_id: userId,
      total_pages: 2,
      authentication_token: authenticationToken,
      hash: parser.hash(keyPayload),
      domain: "https://pass.66ton99.org.ua",
      ...overrides,
    });

    return {
      firstPage: qrPage(0, firstPagePayload),
      keyPage: qrPage(1, keyPayload),
    };
  }

  it("assembles and verifies a private key transferred over QR pages", () => {
    expect.assertions(4);

    const parser = new MobileTransferQrParser(currentUrl);
    const transfer = buildTransfer(parser);

    expect(parser.accept(transfer.firstPage)).toMatchObject({ type: "first-page", nextPage: 1 });
    expect(parser.accept(transfer.keyPage)).toMatchObject({ type: "last-page", page: 1 });
    expect(parser.assembleKey()).toStrictEqual(armoredKey);
    expect(parser.metadata.transfer_id).toStrictEqual(transferId);
  });

  it("rejects a QR transfer for another user", () => {
    expect.assertions(1);

    const parser = new MobileTransferQrParser(currentUrl);
    const transfer = buildTransfer(parser, { user_id: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa" });

    expect(() => parser.accept(transfer.firstPage)).toThrow("different Passbolt user");
  });

  it("rejects a key payload with a mismatching hash", () => {
    expect.assertions(1);

    const parser = new MobileTransferQrParser(currentUrl);
    const transfer = buildTransfer(parser, { hash: "bad-hash" });

    parser.accept(transfer.firstPage);
    parser.accept(transfer.keyPage);

    expect(() => parser.assembleKey()).toThrow("checksum does not match");
  });
});
