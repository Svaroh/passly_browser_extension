/**
 * Passly ~ Open source password manager for teams
 * Copyright (c) Svaroh (https://passly.svaroh.net)
 *
 * Licensed under GNU Affero General Public License version 3 of the or any later version.
 * For full copyright and license information, please see the LICENSE.txt
 * Redistributions of files must retain the above copyright notice.
 *
 * @copyright     Copyright (c) Svaroh (https://passly.svaroh.net)
 * @license       https://opensource.org/licenses/AGPL-3.0 AGPL License
 * @link          https://passly.svaroh.net Passly
 */

/**
 * Returns whether an error is an expected control-flow error (unauthenticated session,
 * user-aborted prompt, or closed extension port) that should not be logged via console.error.
 *
 * @param {Error|object} error
 * @returns {boolean}
 */
export function isExpectedControllerError(error) {
  if (!error) {
    return false;
  }
  const code = error?.data?.code ?? error?.data?.header?.code ?? error?.code;
  const message = typeof error?.message === "string" ? error.message : "";
  return (
    code === 401 ||
    code === 403 ||
    message.includes("Authentication is required") ||
    error?.name === "UserAbortsOperationError" ||
    message.includes("disconnected port")
  );
}

/**
 * Safely emit a response on a worker port if the port is still connected.
 *
 * @param {object} worker
 * @param {string} requestId
 * @param {string} status
 * @param {...*} args
 * @returns {void}
 */
export function safePortEmit(worker, requestId, status, ...args) {
  if (worker?.port && typeof worker.port.isConnected === "function" && !worker.port.isConnected()) {
    return;
  }
  worker?.port?.emit?.(requestId, status, ...args);
}
