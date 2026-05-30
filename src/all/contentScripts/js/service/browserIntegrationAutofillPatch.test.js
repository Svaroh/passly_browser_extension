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
 */

import { Autofill } from "passbolt-styleguide/src/react-web-integration/Autofill/Autofill";
import InFormCallToActionField from "passbolt-styleguide/src/react-web-integration/lib/InForm/InFormCallToActionField";
import InFormFieldSelector from "passbolt-styleguide/src/react-web-integration/lib/InForm/InFormFieldSelector";
import UserEventsService from "passbolt-styleguide/src/react-web-integration/lib/User/UserEventsService";
import MockPort from "passbolt-styleguide/src/react-extension/test/mock/MockPort";
import { applyBrowserIntegrationAutofillPatch } from "./browserIntegrationAutofillPatch";

const originalPasswordFieldSelector = InFormFieldSelector.PASSWORD_FIELD_SELECTOR;
const originalFindAll = InFormCallToActionField.findAll;

class TestElement {
  constructor(tagName = "div") {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.parentElement = null;
  }

  appendChild(child) {
    child.parentElement = this;
    this.children.push(child);
  }

  contains(element) {
    return element === this || this.children.some((child) => child.contains(element));
  }

  querySelector(selector) {
    if (selector.startsWith("#")) {
      return this.getDescendants().find((element) => element.id === selector.slice(1)) || null;
    }

    return this.querySelectorAll(selector)[0] || null;
  }

  querySelectorAll(selector) {
    return this.getDescendants().filter((element) => element.matches(selector));
  }

  getDescendants() {
    return this.children.reduce((descendants, child) => [...descendants, child, ...child.getDescendants()], []);
  }

  matches() {
    return false;
  }
}

class TestInputElement extends TestElement {
  constructor({ id, type = "text", name = "", className = "", attributes = {} }) {
    super("input");
    this.id = id;
    this.type = type;
    this.name = name;
    this.className = className;
    this.attributes = attributes;
    this.disabled = false;
    this.hidden = false;
    this.offsetWidth = 100;
    this.value = "";
  }

  matches(selector) {
    return selector.split(",").some((selectorPart) => this.matchesSelectorPart(selectorPart.trim()));
  }

  matchesSelectorPart(selector) {
    if (!selector.startsWith("input") || selector.includes(":has(")) {
      return false;
    }

    if (selector.includes(":not([type])") && this.type) {
      return false;
    }

    const typeMatch = selector.match(/\[type='([^']+)' i\]/);
    if (typeMatch && this.type.toLowerCase() !== typeMatch[1].toLowerCase()) {
      return false;
    }

    if (selector.includes("[data-pwd]") && typeof this.attributes["data-pwd"] === "undefined") {
      return false;
    }

    const exactMatches = Array.from(
      selector.matchAll(/\[(id|name|class|autocomplete|pattern|minlength|maxlength)='([^']+)'(?: i)?\]/g),
    );
    const hasMatchingExactAttributes = exactMatches.every(
      ([, attribute, value]) => this.getAttributeValue(attribute).toLowerCase() === value.toLowerCase(),
    );
    if (!hasMatchingExactAttributes) {
      return false;
    }

    const containsMatches = Array.from(
      selector.matchAll(/\[(id|name|class|autocomplete|placeholder|pattern)\*='([^']+)' i\]/g),
    );
    return containsMatches.every(([, attribute, value]) =>
      this.getAttributeValue(attribute).toLowerCase().includes(value.toLowerCase()),
    );
  }

  getAttributeValue(attribute) {
    switch (attribute) {
      case "id":
        return this.id || "";
      case "name":
        return this.name || "";
      case "class":
        return this.className || "";
      case "autocomplete":
      case "placeholder":
      case "pattern":
      case "minlength":
      case "maxlength":
        return this.attributes[attribute] || "";
      default:
        return "";
    }
  }
}

class TestDocument {
  constructor() {
    this.location = {
      href: "https://camera.example.test/",
      origin: "https://camera.example.test",
    };
    this.body = new TestElement("body");
  }

  querySelector(selector) {
    return this.body.querySelector(selector);
  }

  querySelectorAll(selector) {
    return this.body.querySelectorAll(selector);
  }

  createTreeWalker() {
    return {
      nextNode: () => false,
    };
  }
}

function setLoginForm() {
  const form = new TestElement("form");
  const usernameField = new TestInputElement({ id: "login_user" });
  const passwordField = new TestInputElement({
    id: "login_psw",
    attributes: {
      onpaste: "return false",
    },
  });

  form.appendChild(usernameField);
  form.appendChild(passwordField);
  document.body.appendChild(form);
}

beforeEach(() => {
  jest.clearAllMocks();
  global.document = new TestDocument();
  global.window.location = document.location;
  global.HTMLElement = TestElement;
  global.HTMLInputElement = TestInputElement;
  global.NodeFilter = {
    FILTER_ACCEPT: 1,
    FILTER_SKIP: 3,
    SHOW_ELEMENT: 1,
  };
  InFormFieldSelector.PASSWORD_FIELD_SELECTOR = originalPasswordFieldSelector;
  InFormCallToActionField.findAll = originalFindAll;

  Object.defineProperty(window, "port", {
    writable: true,
    value: new MockPort(),
  });
  global.port = window.port;

  Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
    configurable: true,
    writable: true,
    value: 100,
  });

  jest.spyOn(UserEventsService, "autofill").mockReturnValue();
  jest.spyOn(window.port, "emit").mockResolvedValue();
});

describe("browserIntegrationAutofillPatch", () => {
  it("detects psw text inputs as password fields for quickaccess autofill", () => {
    expect.assertions(4);
    setLoginForm();
    applyBrowserIntegrationAutofillPatch();

    const formData = {
      requestId: "request-id",
      username: "admin",
      secret: "password-secret",
      url: document.location.href,
    };
    Autofill.fillForm(formData);

    const usernameField = document.querySelector("#login_user");
    const passwordField = document.querySelector("#login_psw");

    expect(UserEventsService.autofill).toHaveBeenCalledTimes(2);
    expect(UserEventsService.autofill).toHaveBeenCalledWith(usernameField, formData.username);
    expect(UserEventsService.autofill).toHaveBeenCalledWith(passwordField, formData.secret);
    expect(window.port.emit).toHaveBeenCalledWith(formData.requestId, "SUCCESS");
  });

  it("does not expose psw text inputs as username fields to the in-form integration", () => {
    expect.assertions(2);
    setLoginForm();
    applyBrowserIntegrationAutofillPatch();

    const usernameFields = InFormCallToActionField.findAll(InFormFieldSelector.USERNAME_FIELD_SELECTOR);
    const passwordFields = InFormCallToActionField.findAll(InFormFieldSelector.PASSWORD_FIELD_SELECTOR);

    expect(usernameFields).toEqual([document.querySelector("#login_user")]);
    expect(passwordFields).toEqual([document.querySelector("#login_psw")]);
  });
});
