/**
 * Passbolt ~ Open source password manager for teams
 * Copyright (c) 2022 Passbolt SA (https://www.passbolt.com)
 *
 * Licensed under GNU Affero General Public License version 3 of the or any later version.
 * For full copyright and license information, please see the LICENSE.txt
 * Redistributions of files must retain the above copyright notice.
 *
 * @copyright     Copyright (c) 2023 Passbolt SA (https://www.passbolt.com)
 * @license       https://opensource.org/licenses/AGPL-3.0 AGPL License
 * @link          https://www.passbolt.com Passbolt(tm)
 * @since         3.10.0
 */

import ParseAuthUrlService from "./parseAuthUrlService";
import { Config } from "../../model/config";

describe("ParseAuthUrlService", () => {
  const domain = "https://passbolt.dev";

  beforeEach(() => {
    Config.write("user.settings.trustedDomain", domain);
  });

  describe("ParseAuthUrlService:test", () => {
    describe.each([
      { scenario: "Passbolt login page", url: `${domain}/auth/login` },
      { scenario: "Passbolt login page with parameters", url: `${domain}/auth/login?locale=en-UK` },
      { scenario: "Passbolt login page with anchors", url: `${domain}/auth/login#test` },
    ])("should parse", (_props) => {
      it(`should match: ${_props.scenario}`, () => {
        const parseResult = ParseAuthUrlService.regex.test(_props.url);
        expect.assertions(1);
        expect(parseResult).toBeTruthy();
      });
    });

    it("Should parse the login page when the stored domain has a trailing slash.", () => {
      expect.assertions(1);
      Config.write("user.settings.trustedDomain", `${domain}/`);

      const parseResult = ParseAuthUrlService.regex.test(`${domain}/auth/login?redirect=%2F&locale=uk-UA`);

      expect(parseResult).toBeTruthy();
    });

    it("Should parse the login page against an explicit trusted domain.", () => {
      expect.assertions(2);

      expect(ParseAuthUrlService.testForDomain(`${domain}/auth/login?redirect=%2F&locale=uk-UA`, domain)).toBeTruthy();
      expect(
        ParseAuthUrlService.testForDomain("https://attacker.passbolt.dev/auth/login?redirect=%2F&locale=uk-UA", domain),
      ).toBeFalsy();
    });

    it("Should detect the intermediate login URL waiting for the server locale redirect.", () => {
      expect.assertions(2);

      expect(ParseAuthUrlService.isAwaitingLocaleRedirect(`${domain}/auth/login?redirect=%2F`, domain)).toBeTruthy();
      expect(
        ParseAuthUrlService.isAwaitingLocaleRedirect(`${domain}/auth/login?redirect=%2F&locale=uk-UA`, domain),
      ).toBeFalsy();
    });

    describe.each([
      { scenario: "No domain given", url: "https://auth/login" },
      { scenario: "No protocol given", url: "passbolt.dev/auth/login" },
      { scenario: "Wrong protocol given", url: "http://passbolt.dev/auth/login" },
      { scenario: "Domain look alike attack", url: `https://passbolt.dev.attacker.com/auth/login` },
      { scenario: "Sub domain look alike attack", url: `https://attacker.passbolt.dev.com/auth/login` },
      { scenario: "Regex wild mark attack", url: "https://passboltxdev/auth/login" },
      { scenario: "Domain look alike as hash attack", url: `https://www.attacker.com#${domain}` },
      { scenario: "Wrong entry point", url: `${domain}/auth/login/wrong-entry-point` },
    ])("should not parse", (_props) => {
      it(`should not match: ${_props.scenario}`, () => {
        const parseResult = ParseAuthUrlService.regex.test(_props.url);
        expect.assertions(1);
        expect(parseResult).toBeFalsy();
      });
    });
  });
});
