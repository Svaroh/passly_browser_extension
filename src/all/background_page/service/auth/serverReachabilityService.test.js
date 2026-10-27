/**
 * Passly - Open source password manager for teams
 * Copyright (c) 2026 Svaroh
 *
 * Licensed under GNU Affero General Public License version 3 of the or any later version.
 * For full copyright and license information, please see the LICENSE.txt
 * Redistributions of files must retain the above copyright notice.
 *
 * @copyright     Copyright (c) Svaroh
 * @license       https://opensource.org/licenses/AGPL-3.0 AGPL License
 * @link          https://passly.svaroh.net Passly
 * @since         6.0.25
 */
import ServerReachabilityService from "./serverReachabilityService";

const domain = "https://passly.local";

beforeEach(() => {
  jest.clearAllMocks();
});

describe("ServerReachabilityService::isReachable", () => {
  it("Should count any answer as reachable", async () => {
    expect.assertions(1);
    jest.spyOn(global, "fetch").mockImplementation(async () => ({ status: 405 }));

    expect(await ServerReachabilityService.isReachable(domain)).toBe(true);
  });

  it("Should count a refused request as unreachable", async () => {
    expect.assertions(1);
    jest.spyOn(global, "fetch").mockImplementation(async () => {
      throw new TypeError("Failed to fetch");
    });

    expect(await ServerReachabilityService.isReachable(domain)).toBe(false);
  });

  it("Should count a slow answer as reachable", async () => {
    expect.assertions(1);
    const timeout = new Error("The operation timed out");
    timeout.name = "TimeoutError";
    jest.spyOn(global, "fetch").mockImplementation(async () => {
      throw timeout;
    });

    expect(await ServerReachabilityService.isReachable(domain)).toBe(true);
  });
});
