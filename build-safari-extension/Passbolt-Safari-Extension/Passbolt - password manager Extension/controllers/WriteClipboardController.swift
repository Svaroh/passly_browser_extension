//
// Passbolt - Open source password manager for teams
// Copyright (c) Passbolt SA
//
// This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General
// Public License (AGPL) as published by the Free Software Foundation version 3.
//
// The name "Passbolt" is a registered trademark of Passbolt SA, and Passbolt SA hereby declines to grant a trademark
// license to "Passbolt" pursuant to the GNU Affero General Public License version 3 Section 7(e), without a separate
// agreement with Passbolt SA.
//
// This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied
// warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License along with this program. If not,
// see GNU Affero General Public License v3 (http://www.gnu.org/licenses/agpl-3.0.html).
//
// @copyright     Copyright (c) Passbolt SA (https://www.passbolt.com)
// @license       https://opensource.org/licenses/AGPL-3.0 AGPL License
// @link          https://www.passbolt.com Passbolt (tm)
// @since         v5.16.0
//

import AppKit
import Foundation

// Writes the given data to the system pasteboard.
// Webkit denies programmatic clipboard writes performed without user activation, which the extension
// background page never has when it processes a port request, hence the delegation to the app.
class WriteClipboardController: AbstractController {
    required init() {}

    func run(_ context: NSExtensionContext, _ payload: [String: Any], profileUUID: String) -> Void {
        guard let data = payload["data"] as? String else {
            self.respondAsError(context, locatedNSError(
                domain: "WriteClipboardController",
                code: SafariExtensionError.unknownError.rawValue,
                description: "No data is provided, cannot write the clipboard"
            ))
            return
        }

        let pasteboard = NSPasteboard.general
        pasteboard.clearContents()

        if pasteboard.setString(data, forType: .string) {
            self.respondAsSuccess(context, nil)
        } else {
            self.respondAsError(context, locatedNSError(
                domain: "WriteClipboardController",
                code: SafariExtensionError.controllerExecutionFailed.rawValue,
                description: "The pasteboard refused the given data"
            ))
        }
    }
}
