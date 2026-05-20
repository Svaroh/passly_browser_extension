/**
 * Returns whether an error is raised because the extension has no configured account yet.
 * @param {Error} error The error to check.
 * @returns {boolean}
 */
export default function isMissingAccountError(error) {
  return ["The user is not set", "The user id cannot be empty"].includes(error?.message);
}
