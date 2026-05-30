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

import InFormCallToActionField from "passbolt-styleguide/src/react-web-integration/lib/InForm/InFormCallToActionField";
import InFormFieldSelector from "passbolt-styleguide/src/react-web-integration/lib/InForm/InFormFieldSelector";

const PASSWORD_ALIAS_FIELD_SELECTORS = [
  "input[type='text' i][name*='pwd' i]:not([hidden]):not([disabled])",
  "input[type='text' i][id*='pwd' i]:not([hidden]):not([disabled])",
  "input[type='text' i][class*='pwd' i]:not([hidden]):not([disabled])",
  "input[type='text' i][name*='psw' i]:not([hidden]):not([disabled])",
  "input[type='text' i][id*='psw' i]:not([hidden]):not([disabled])",
  "input[type='text' i][class*='psw' i]:not([hidden]):not([disabled])",
  "input[type='text' i][name*='passwd' i]:not([hidden]):not([disabled])",
  "input[type='text' i][id*='passwd' i]:not([hidden]):not([disabled])",
  "input[type='text' i][class*='passwd' i]:not([hidden]):not([disabled])",
  "input[type='text' i][data-pwd]:not([hidden]):not([disabled])",
];

const PATCH_MARKER = "passboltPasswordAliasPatch";

function extendPasswordFieldSelector() {
  const aliasSelector = PASSWORD_ALIAS_FIELD_SELECTORS.join(",\n  ");

  if (!InFormFieldSelector.PASSWORD_FIELD_SELECTOR.includes(aliasSelector)) {
    InFormFieldSelector.PASSWORD_FIELD_SELECTOR = `${InFormFieldSelector.PASSWORD_FIELD_SELECTOR},\n  ${aliasSelector}`;
  }
}

function isPasswordField(field) {
  return field instanceof HTMLInputElement && field.matches(InFormFieldSelector.PASSWORD_FIELD_SELECTOR);
}

function patchUsernameFieldDetection() {
  if (InFormCallToActionField.findAll[PATCH_MARKER]) {
    return;
  }

  const originalFindAll = InFormCallToActionField.findAll.bind(InFormCallToActionField);
  const patchedFindAll = (selector) => {
    const fields = originalFindAll(selector);

    if (selector === InFormFieldSelector.USERNAME_FIELD_SELECTOR) {
      return fields.filter((field) => !isPasswordField(field));
    }

    return fields;
  };
  patchedFindAll[PATCH_MARKER] = true;

  InFormCallToActionField.findAll = patchedFindAll;
}

/**
 * Applies browser-integration autofill patches for sites using password aliases such as "psw" or "pwd".
 */
export function applyBrowserIntegrationAutofillPatch() {
  extendPasswordFieldSelector();
  patchUsernameFieldDetection();
}
