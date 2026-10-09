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
 * @since         5.15.0
 */
import { v4 as uuidv4 } from "uuid";

export const minimumPermissionChangeDto = (data = {}) => ({
  aco: "Resource",
  aco_foreign_key: uuidv4(),
  aro: "User",
  aro_foreign_key: uuidv4(),
  type: 15,
  ...data,
});

export const defaultPermissionChangeDto = (data = {}) =>
  minimumPermissionChangeDto({
    id: uuidv4(),
    ...data,
  });

export const deletePermissionChangeDto = (data = {}) =>
  minimumPermissionChangeDto({
    id: uuidv4(),
    delete: true,
    ...data,
  });
