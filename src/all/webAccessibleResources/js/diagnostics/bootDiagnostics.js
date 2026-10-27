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
 * @since         6.0.18
 */

/**
 * Says why the workspace did not start, instead of leaving a blank page.
 *
 * The application renders nothing at all until everything it asks for has answered, so a single failure - a request
 * with no local fallback, a value it will not start without - looks exactly like a broken extension. On a page whose
 * whole purpose is working without a server, that is the least helpful thing it could do. What went wrong is
 * collected here and shown on the page itself.
 */
(function () {
  const MOUNT_GRACE_PERIOD_MS = 10000;
  const problems = [];
  let panel = null;

  const describe = (value) => {
    if (!value) {
      return "unknown";
    }
    return value.message || value.reason?.message || String(value);
  };

  const render = () => {
    if (!panel) {
      panel = document.createElement("div");
      panel.setAttribute("data-passly-boot-diagnostics", "");
      panel.style.cssText = [
        "position:fixed",
        "inset:0",
        "z-index:2147483647",
        "overflow:auto",
        "padding:32px",
        "background:#1c1c1c",
        "color:#ececec",
        "font:14px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
      ].join(";");
      document.body.appendChild(panel);
    }

    panel.innerHTML = "";
    const title = document.createElement("h1");
    title.style.cssText = "font-size:18px;margin:0 0 8px";
    title.textContent = "The vault could not start";
    const intro = document.createElement("p");
    intro.style.cssText = "margin:0 0 16px;opacity:.8";
    intro.textContent = "Your data is untouched. What stopped the application from rendering:";
    const list = document.createElement("ul");
    list.style.cssText = "margin:0;padding-left:20px";
    problems.forEach((problem) => {
      const item = document.createElement("li");
      item.style.cssText = "margin-bottom:8px;white-space:pre-wrap;word-break:break-word";
      item.textContent = problem;
      list.appendChild(item);
    });

    panel.append(title, intro, list);
  };

  const record = (problem) => {
    problems.push(problem);
    console.error(`[Passly] ${problem}`);
    if (document.body) {
      render();
    }
  };

  window.addEventListener("error", (event) => record(`Error while starting: ${describe(event.error || event)}`));
  window.addEventListener("unhandledrejection", (event) =>
    record(`Request never completed: ${describe(event.reason)}`),
  );

  /**
   * Whether the application put anything on the page.
   * @returns {boolean}
   */
  const hasMounted = () =>
    Array.from(document.body?.children || []).some(
      (child) =>
        child.id !== "temporary-skeleton" &&
        !child.hasAttribute("data-passly-boot-diagnostics") &&
        child.childElementCount > 0,
    );

  /**
   * A quiet, permanent reminder of which of the two states the vault is in.
   *
   * Errors about an unreachable server are not shown any more - the vault is held here and goes on working - so this
   * says the same thing once, without interrupting anything, and takes itself away when the network returns.
   */
  const offlineIndicator = () => {
    let pill = null;

    const paint = () => {
      if (navigator.onLine) {
        pill?.remove();
        pill = null;
        return;
      }
      if (pill || !document.body) {
        return;
      }
      pill = document.createElement("div");
      pill.style.cssText = [
        "position:fixed",
        "right:16px",
        "bottom:16px",
        "z-index:2147483646",
        "padding:6px 12px",
        "border-radius:16px",
        "background:rgba(28,28,28,.92)",
        "color:#ececec",
        "font:12px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
        "pointer-events:none",
      ].join(";");
      pill.textContent = "Offline - showing the data held on this device";
      document.body.appendChild(pill);
    };

    window.addEventListener("online", paint);
    window.addEventListener("offline", paint);
    paint();
  };

  offlineIndicator();

  window.setTimeout(() => {
    if (!hasMounted()) {
      record(
        "The application asked for data it will not start without, and something did not answer. " +
          "The requests it makes on start are: the signed in user, the role based access control rules, the user " +
          "settings, the organization settings and the locale.",
      );
    }
  }, MOUNT_GRACE_PERIOD_MS);
})();
