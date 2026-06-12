const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const legacyBrand = "Pass" + "bolt";
const legacyBrandLower = legacyBrand.toLowerCase();
const legacyLogoTitle = `${legacyBrand} logo`;
const legacyLogoDescription = `This is the logo of ${legacyBrandLower}.`;
const consoleDebug = "console" + ".debug";
const consoleError = "console" + ".error";
const consoleLog = "console" + ".log";
const quickAccessVaultTranslations = {
  "cs-CZ": {
    edit: "Upravit v trezoru",
    view: "Zobrazit v trezoru",
  },
  "de-DE": {
    edit: "Im Tresor bearbeiten",
    view: "Im Tresor anzeigen",
  },
  "en-UK": {
    edit: "Edit in the vault",
    view: "View in the vault",
  },
  "es-ES": {
    edit: "Editar en la bóveda",
    view: "Ver en la bóveda",
  },
  "fr-FR": {
    edit: "Modifier dans le coffre",
    view: "Afficher dans le coffre",
  },
  "it-IT": {
    edit: "Modifica nella cassaforte",
    view: "Visualizza nella cassaforte",
  },
  "ja-JP": {
    edit: "保管庫で編集",
    view: "保管庫で表示",
  },
  "ko-KR": {
    edit: "보관소에서 수정",
    view: "보관소에서 보기",
  },
  "lt-LT": {
    edit: "Redaguoti saugykloje",
    view: "Peržiūrėti saugykloje",
  },
  "nl-NL": {
    edit: "Bewerken in de kluis",
    view: "Bekijken in de kluis",
  },
  "pl-PL": {
    edit: "Edytuj w skarbcu",
    view: "Zobacz w skarbcu",
  },
  "pt-BR": {
    edit: "Editar no cofre",
    view: "Ver no cofre",
  },
  "ro-RO": {
    edit: "Editați în seif",
    view: "Vizualizați în seif",
  },
  "ru-RU": {
    edit: "Редактировать в хранилище",
    view: "Посмотреть в хранилище",
  },
  "sl-SI": {
    edit: "Uredi v sefu",
    view: "Prikaži v sefu",
  },
  "sv-SE": {
    edit: "Redigera i valvet",
    view: "Visa i valvet",
  },
  "uk-UA": {
    edit: "Редагувати в сховищі",
    view: "Переглянути в сховищі",
  },
};
const trashTranslations = {
  "en-UK": "Trash",
  "uk-UA": "Кошик",
};
const restoreActionTranslations = {
  "en-UK": {
    restore: "Restore",
    recoverableDeleteSingle: "Once the resource is deleted, it will be removed from the vault until it is restored.",
    recoverableDeleteMultiple:
      "Please confirm you really want to delete the resources. After clicking ok, the resources will be removed from the vault until they are restored.",
    permanentDeleteSingle: "Once the resource is deleted, it will be removed permanently and will not be recoverable.",
    permanentDeleteMultiple:
      "Please confirm you really want to delete the resources. After clicking ok, the resources will be deleted permanently.",
    successOne: "The resource has been restored successfully.",
    successOther: "The resources have been restored successfully.",
  },
  "uk-UA": {
    restore: "Відновити",
    recoverableDeleteSingle: "Після видалення ресурс буде прибрано зі сховища, доки його не буде відновлено.",
    recoverableDeleteMultiple:
      "Будь ласка, підтвердьте, що ви дійсно хочете видалити ресурси. Після натискання OK ресурси буде прибрано зі сховища, доки їх не буде відновлено.",
    permanentDeleteSingle: "Після видалення ресурсу його буде видалено назавжди та неможливо відновити.",
    permanentDeleteMultiple:
      "Будь ласка, підтвердьте, що ви дійсно хочете видалити ресурси. Після натискання \"OK\" ресурси буде видалено назавжди.",
    successOne: "Ресурс успішно відновлено.",
    successOther: "Ресурси успішно відновлено.",
  },
};

const passlyInlineLogo = `<svg xmlns="http://www.w3.org/2000/svg" aria-labelledby="logo-title logo-description" width="151" height="27" viewBox="0 0 151 27" fill="none">
  <title id="logo-title">Passly logo</title>
  <desc id="logo-description">This is the logo of Passly.</desc>
  <path fill="#17413F" d="M12.5 1L22.273 4.864V18.159L18.295 23.045L12.5 26L6.705 23.045L2.727 18.159V4.864Z"/>
  <path fill="#FAFBF7" d="M7.727 11.568L12.5 7.932L17.273 11.568L12.5 19.295Z"/>
  <circle cx="7.727" cy="11.568" r="1.705" fill="#17413F"/>
  <circle cx="12.5" cy="7.932" r="1.705" fill="#17413F"/>
  <circle cx="17.273" cy="11.568" r="1.705" fill="#17413F"/>
  <circle cx="12.5" cy="19.295" r="1.705" fill="#17413F"/>
  <path fill="none" stroke="#8BBF45" stroke-linecap="round" stroke-linejoin="round" stroke-width=".91" d="M7.727 11.568L12.5 7.932L17.273 11.568M7.727 11.568L12.5 19.295L17.273 11.568"/>
  <text x="31" y="20.5" font-family="Arial, Avenir Next, Segoe UI, sans-serif" font-size="18" font-weight="700" fill="var(--icon-color)">Passly</text>
</svg>
`;

const passkeyDefaultResourceTypeIcon = `<svg width="40" height="40" viewBox="0 0 40 40" fill="none">
<path stroke="var(--icon-color)" stroke-linecap="round" stroke-linejoin="round" stroke-width="var(--icon-stroke-width)" d="M11.436 22.385a3.397 3.397 0 1 0 0-6.793 3.397 3.397 0 0 0 0 6.793M21.475 8.95l-7.64 7.64M20.209 13.33l1.954-1.955M30.507 31.049v-1.607a3.213 3.213 0 0 0-3.213-3.212h-6.426a3.213 3.213 0 0 0-3.213 3.212v1.607M24.08 23.017a3.213 3.213 0 1 0 0-6.426 3.213 3.213 0 0 0 0 6.426"></path>
</svg>
`;

function writeIfChanged(file, content) {
  if (!fs.existsSync(file)) {
    return false;
  }

  const previous = fs.readFileSync(file, "utf8");
  if (previous === content) {
    return false;
  }

  fs.writeFileSync(file, content);
  return true;
}

function copyFileIfChanged(source, destination) {
  if (!fs.existsSync(source) || !fs.existsSync(destination)) {
    return false;
  }

  const sourceContent = fs.readFileSync(source);
  const destinationContent = fs.readFileSync(destination);
  if (sourceContent.equals(destinationContent)) {
    return false;
  }

  fs.writeFileSync(destination, sourceContent);
  return true;
}

function replaceIfExists(file, replacements) {
  if (!fs.existsSync(file)) {
    return false;
  }

  let content = fs.readFileSync(file, "utf8");
  const previous = content;

  for (const [search, replacement] of replacements) {
    content = content.split(search).join(replacement);
  }

  if (content === previous) {
    return false;
  }

  fs.writeFileSync(file, content);
  return true;
}

function replaceIfMissing(file, marker, replacements) {
  if (!fs.existsSync(file)) {
    return false;
  }

  const content = fs.readFileSync(file, "utf8");
  if (content.includes(marker)) {
    return false;
  }

  return replaceIfExists(file, replacements);
}

function updateQuickAccessVaultLocale(file, locale) {
  if (!fs.existsSync(file)) {
    return false;
  }

  const translations = quickAccessVaultTranslations[locale] || quickAccessVaultTranslations["en-UK"];
  const content = fs.readFileSync(file, "utf8");
  const common = JSON.parse(content);
  delete common["Edit in passbolt"];
  delete common["View it in passbolt"];
  common["Edit in the vault"] = translations.edit;
  common["View in the vault"] = translations.view;
  common["Trash"] = trashTranslations[locale] || "Trash";
  const restoreActionTranslation = restoreActionTranslations[locale] || restoreActionTranslations["en-UK"];
  common["Restore"] = restoreActionTranslation.restore;
  common["Once the resource is deleted, it will be removed from the vault until it is restored."] =
    restoreActionTranslation.recoverableDeleteSingle;
  common[
    "Please confirm you really want to delete the resources. After clicking ok, the resources will be removed from the vault until they are restored."
  ] = restoreActionTranslation.recoverableDeleteMultiple;
  common["Once the resource is deleted, it will be removed permanently and will not be recoverable."] =
    restoreActionTranslation.permanentDeleteSingle;
  common[
    "Please confirm you really want to delete the resources. After clicking ok, the resources will be deleted permanently."
  ] = restoreActionTranslation.permanentDeleteMultiple;
  common["The resource has been restored successfully._one"] = restoreActionTranslation.successOne;
  common["The resource has been restored successfully._other"] = restoreActionTranslation.successOther;

  const nextContent = `${JSON.stringify(common, null, 2)}\n`;
  if (content === nextContent) {
    return false;
  }

  fs.writeFileSync(file, nextContent);
  return true;
}

function patchQuickAccessVaultLocales() {
  const localeBases = [
    "src/all/locales",
    "node_modules/passbolt-styleguide/src/locales",
    "build/all/webAccessibleResources/locales",
    "build/chromium-mv3-unpacked/webAccessibleResources/locales",
    "build/firefox-unpacked/webAccessibleResources/locales",
  ];
  let changed = 0;

  for (const base of localeBases.map(localeBase => path.join(root, localeBase))) {
    if (!fs.existsSync(base)) {
      continue;
    }

    for (const locale of Object.keys(quickAccessVaultTranslations)) {
      changed += updateQuickAccessVaultLocale(path.join(base, locale, "common.json"), locale) ? 1 : 0;
    }
  }

  return changed;
}

function rebrandStyleguideSource() {
  const logoSvg = path.join(root, "node_modules/passbolt-styleguide/src/img/svg/logo.svg");
  const logoComponent = path.join(root, "node_modules/passbolt-styleguide/src/react-extension/components/Common/Navigation/Header/Logo.js");
  let changed = 0;

  changed += writeIfChanged(logoSvg, passlyInlineLogo) ? 1 : 0;
  changed += syncStyleguideLogoAssets();
  changed += replaceIfExists(logoComponent, [
    [`title="${legacyLogoTitle}"`, 'title="Passly logo"'],
    [`<span>${legacyBrand}</span>`, "<span>Passly</span>"],
  ]) ? 1 : 0;

  return changed;
}

function syncStyleguideLogoAssets() {
  const styleguideLogoPath = path.join(root, "node_modules/passbolt-styleguide/src/img/logo");
  const passlyLogoPath = path.join(root, "src/all/webAccessibleResources/img/logo");
  const passlyIconPath = path.join(root, "src/all/webAccessibleResources/img/icons");
  const generatedBases = [
    "build/all/webAccessibleResources",
    "build/chromium-mv3-unpacked/webAccessibleResources",
    "build/firefox-unpacked/webAccessibleResources",
  ];
  const logoAssets = [
    "icon-48.png",
    "logo.svg",
    "logo_white.svg",
    "icon-without-badge.svg",
    "icon-inactive.svg",
    "icon-badge-1.svg",
    "icon-badge-2.svg",
    "icon-badge-3.svg",
    "icon-badge-4.svg",
    "icon-badge-5.svg",
    "icon-badge-5+.svg",
  ];
  const iconAssets = [
    "icon-16.png",
    "icon-32.png",
    "icon-32-signout.png",
    "icon-32-badge-1.png",
    "icon-32-badge-2.png",
    "icon-32-badge-3.png",
    "icon-32-badge-4.png",
    "icon-32-badge-5.png",
    "icon-32-badge-5+.png",
    "icon-48.png",
    "icon-128.png",
  ];
  let changed = 0;

  for (const asset of logoAssets) {
    changed += copyFileIfChanged(path.join(passlyLogoPath, asset), path.join(styleguideLogoPath, asset)) ? 1 : 0;
  }
  for (const asset of iconAssets) {
    changed += copyFileIfChanged(path.join(passlyIconPath, asset), path.join(styleguideLogoPath, asset)) ? 1 : 0;
  }
  for (const base of generatedBases.map(generatedBase => path.join(root, generatedBase))) {
    for (const asset of logoAssets) {
      changed += copyFileIfChanged(path.join(passlyLogoPath, asset), path.join(base, "img/logo", asset)) ? 1 : 0;
    }
    for (const asset of iconAssets) {
      changed += copyFileIfChanged(path.join(passlyIconPath, asset), path.join(base, "img/icons", asset)) ? 1 : 0;
    }
  }

  return changed;
}

function patchStyleguideRuntimeLogs() {
  const apiTriageContext = path.join(root, "node_modules/passbolt-styleguide/src/react-extension/contexts/ApiTriageContext.js");
  const inFormManager = path.join(root, "node_modules/passbolt-styleguide/src/react-web-integration/lib/InForm/InFormManager.js");
  const apiClient = path.join(root, "node_modules/passbolt-styleguide/src/shared/lib/apiClient/apiClient.js");
  const gridResourceUserSettingService = path.join(root, "node_modules/passbolt-styleguide/src/shared/services/serviceWorker/gridResourceUserSetting/GridResourceUserSettingServiceWorkerService.js");
  const logger = path.join(root, "node_modules/passbolt-styleguide/src/shared/utils/logger.js");
  const customFieldsCollection = path.join(root, "node_modules/passbolt-styleguide/src/shared/models/entity/customField/customFieldsCollection.js");
  const confirmMetadataKeyEntryEvents = path.join(root, "node_modules/passbolt-styleguide/src/react-extension/components/Metadata/HandleConfirmMetadataKeyEntryEvents/HandleConfirmMetadataKeyEntryEvents.js");
  const extQuickAccess = path.join(root, "node_modules/passbolt-styleguide/src/react-quickaccess/ExtQuickAccess.js");
  let changed = 0;

  changed += replaceIfExists(apiTriageContext, [
    [`      ${consoleLog}("Recover processes with this SSO provider is not supported");\n`, ""],
    [
      `     * @todo handle unexpected error.
     * else {
     *   ${consoleLog}(error);
     *   await this.props.actionFeedbackContext.displayError("There was an unexpected error, please retry later...");
     *   await this.toggleProcessing();
     * }`,
      `     * @todo handle unexpected error.
     * else {
     *   await this.props.actionFeedbackContext.displayError("There was an unexpected error, please retry later...");
     *   await this.toggleProcessing();
     * }`,
    ],
  ]) ? 1 : 0;

  changed += replaceIfExists(inFormManager, [
    [`      ${consoleDebug}("Cannot insert the in-form menu manager into a page that is not visible.");\n`, ""],
    [`        ${consoleDebug}("Someone has moved the host of the shadow root");\n`, ""],
  ]) ? 1 : 0;

  changed += replaceIfExists(apiClient, [
    [`      ${consoleDebug}(response.url.toString(), error);\n`, ""],
  ]) ? 1 : 0;

  changed += replaceIfExists(gridResourceUserSettingService, [
    [
      `    } catch (error) {
      // If an error occurred then return a null settings
      ${consoleDebug}(error);
      return null;
    }`,
      `    } catch {
      // If an error occurred then return a null settings
      return null;
    }`,
    ],
  ]) ? 1 : 0;

  changed += replaceIfExists(logger, [
    [
      `
    // Avoid an additional accident.
    try {
      // If the provided value is an Error, output additional properties not shown by the console API.
      if (error instanceof Error && typeof error.toJSON === "function") {
        ${consoleLog}(\`Error: \${error.message}\\nError structure: \${JSON.stringify(Logger.serializeError(error))}\`);
      }
    } catch (error) {
      ${consoleError}("The logger was unable to extract additional error information", error);
    }`,
      "",
    ],
  ]) ? 1 : 0;

  changed += replaceIfExists(customFieldsCollection, [
    [
      `
    const length = collectionMetadata.length;
    if (length !== collectionSecret.length) {
      ${consoleDebug}("Collections are corrupted, some data is missing");
    }
`,
      "\n",
    ],
  ]) ? 1 : 0;

  changed += replaceIfExists(confirmMetadataKeyEntryEvents, [
    [`      ${consoleLog}(error);\n`, `      ${consoleError}(error);\n`],
  ]) ? 1 : 0;

  changed += replaceIfExists(extQuickAccess, [
    [`      ${consoleLog}(error);\n`, `      ${consoleError}(error);\n`],
  ]) ? 1 : 0;

  return changed;
}

function patchQuickAccessResourceViewPage() {
  const resourceViewPage = path.join(root, "node_modules/passbolt-styleguide/src/react-quickaccess/components/ResourceViewPage/ResourceViewPage.js");
  let changed = 0;

  changed += replaceIfExists(resourceViewPage, [
    ["?passlyAction=edit", "?action=edit"],
  ]) ? 1 : 0;
  changed += replaceIfMissing(resourceViewPage, 'import EditSVG from "../../../img/svg/edit.svg";', [
    [
      `import GoSVG from "../../../img/svg/go.svg";
import CopySVG from "../../../img/svg/copy.svg";`,
      `import GoSVG from "../../../img/svg/go.svg";
import EditSVG from "../../../img/svg/edit.svg";
import CopySVG from "../../../img/svg/copy.svg";`,
    ],
  ]) ? 1 : 0;
  changed += replaceIfMissing(resourceViewPage, 'import DeleteSVG from "../../../img/svg/delete.svg";', [
    [
      `import EditSVG from "../../../img/svg/edit.svg";
import CopySVG from "../../../img/svg/copy.svg";`,
      `import EditSVG from "../../../img/svg/edit.svg";
import DeleteSVG from "../../../img/svg/delete.svg";
import CopySVG from "../../../img/svg/copy.svg";`,
    ],
  ]) ? 1 : 0;
  changed += replaceIfMissing(resourceViewPage, 'import DialogWrapper from "../../../react-extension/components/Common/Dialog/DialogWrapper/DialogWrapper";', [
    [
      `import ClipboardServiceWorkerService from "../../../shared/services/serviceWorker/clipboard/clipboardServiceWorkerService";`,
      `import ClipboardServiceWorkerService from "../../../shared/services/serviceWorker/clipboard/clipboardServiceWorkerService";
import DialogWrapper from "../../../react-extension/components/Common/Dialog/DialogWrapper/DialogWrapper";
import FormCancelButton from "../../../react-extension/components/Common/Inputs/FormSubmitButton/FormCancelButton";
import FormSubmitButton from "../../../react-extension/components/Common/Inputs/FormSubmitButton/FormSubmitButton";`,
    ],
  ]) ? 1 : 0;
  changed += replaceIfMissing(resourceViewPage, "RESOURCE_TYPE_V5_PASSKEY_SLUG", [
    [
      `import ResourceTypesCollection from "../../../shared/models/entity/resourceType/resourceTypesCollection";`,
      `import ResourceTypesCollection from "../../../shared/models/entity/resourceType/resourceTypesCollection";
import { RESOURCE_TYPE_V5_PASSKEY_SLUG } from "../../../shared/models/entity/resourceType/resourceTypeSchemasDefinition";`,
    ],
  ]) ? 1 : 0;
  changed += replaceIfMissing(resourceViewPage, "deleteDialogOpen: false", [
    [
      `      resource: {},
      passphrase: "",
      usingOnThisTab: false,
      copyPasswordState: "default",`,
      `      resource: {},
      passphrase: "",
      usingOnThisTab: false,
      deleteDialogOpen: false,
      deletingResource: false,
      deleteError: "",
      copyPasswordState: "default",`,
    ],
  ]) ? 1 : 0;
  changed += replaceIfMissing(resourceViewPage, "this.handleDeleteResourceClick = this.handleDeleteResourceClick.bind(this);", [
    [
      `    this.handleGoToUrlClick = this.handleGoToUrlClick.bind(this);
    this.handleUseOnThisTabClick = this.handleUseOnThisTabClick.bind(this);
    this.handleViewPasswordButtonClick = this.handleViewPasswordButtonClick.bind(this);`,
      `    this.handleGoToUrlClick = this.handleGoToUrlClick.bind(this);
    this.handleUseOnThisTabClick = this.handleUseOnThisTabClick.bind(this);
    this.handleDeleteResourceClick = this.handleDeleteResourceClick.bind(this);
    this.handleDeleteResourceCancel = this.handleDeleteResourceCancel.bind(this);
    this.handleDeleteResourceSubmit = this.handleDeleteResourceSubmit.bind(this);
    this.handleViewPasswordButtonClick = this.handleViewPasswordButtonClick.bind(this);`,
    ],
  ]) ? 1 : 0;
  changed += replaceIfMissing(resourceViewPage, "async handleDeleteResourceSubmit(event)", [
    [
      `  async handleUseOnThisTabClick(event) {
    event.preventDefault();`,
      `  handleDeleteResourceClick(event) {
    event.preventDefault();
    this.setState({ deleteDialogOpen: true, deleteError: "" });
  }

  handleDeleteResourceCancel() {
    if (!this.state.deletingResource) {
      this.setState({ deleteDialogOpen: false, deleteError: "" });
    }
  }

  async handleDeleteResourceSubmit(event) {
    event.preventDefault();
    if (this.state.deletingResource) {
      return;
    }

    this.setState({ deletingResource: true, deleteError: "" });
    try {
      await this.props.context.port.request("passbolt.resources.delete-all", [this.state.resource.id]);
      this.props.history.replace("/webAccessibleResources/quickaccess/home");
    } catch (error) {
      console.error(error);
      this.setState({
        deletingResource: false,
        deleteError: error?.message || this.translate("An unexpected error occurred"),
      });
    }
  }

  async handleUseOnThisTabClick(event) {
    event.preventDefault();`,
    ],
  ]) ? 1 : 0;
  changed += replaceIfMissing(resourceViewPage, "canUpdateResource", [
    [
      `  get isStandaloneTotpResource() {
    return (
      Boolean(this.state.resource.resource_type_id) &&
      this.props.resourceTypes?.getFirstById(this.state.resource.resource_type_id)?.isStandaloneTotp()
    );
  }

  render() {`,
      `  get isStandaloneTotpResource() {
    return (
      Boolean(this.state.resource.resource_type_id) &&
      this.props.resourceTypes?.getFirstById(this.state.resource.resource_type_id)?.isStandaloneTotp()
    );
  }

  /**
   * Can update the resource.
   * @returns {boolean}
   */
  get canUpdateResource() {
    return this.state.resource.permission?.type >= 7;
  }

  render() {`,
    ],
  ]) ? 1 : 0;
  changed += replaceIfMissing(resourceViewPage, "get isPasskeyResource()", [
    [
      `  get isStandaloneTotpResource() {
    return (
      Boolean(this.state.resource.resource_type_id) &&
      this.props.resourceTypes?.getFirstById(this.state.resource.resource_type_id)?.isStandaloneTotp()
    );
  }

  /**
   * Can update the resource.`,
      `  get isStandaloneTotpResource() {
    return (
      Boolean(this.state.resource.resource_type_id) &&
      this.props.resourceTypes?.getFirstById(this.state.resource.resource_type_id)?.isStandaloneTotp()
    );
  }

  /**
   * Is passkey resource.
   * @returns {boolean}
   */
  get isPasskeyResource() {
    return (
      Boolean(this.state.resource.resource_type_id) &&
      this.props.resourceTypes?.getFirstById(this.state.resource.resource_type_id)?.slug === RESOURCE_TYPE_V5_PASSKEY_SLUG
    );
  }

  /**
   * Can update the resource.`,
    ],
  ]) ? 1 : 0;
  changed += replaceIfMissing(resourceViewPage, "{!this.isPasskeyResource && (", [
    [
      `              <li className="property">
                <div className="information">
                  <span className="property-name">
                    <Trans>Password</Trans>`,
      `              {!this.isPasskeyResource && (
                <li className="property">
                  <div className="information">
                    <span className="property-name">
                      <Trans>Password</Trans>`,
    ],
    [
      `                {canCopySecret && (
                  <>
                    <a
                      role="button"
                      className="button button-transparent property-action copy-password"
                      onClick={this.handleCopyPasswordClick}
                      title={this.translate("Copy to clipboard")}`,
      `                  {canCopySecret && (
                    <>
                      <a
                        role="button"
                        className="button button-transparent property-action copy-password"
                        onClick={this.handleCopyPasswordClick}
                        title={this.translate("Copy to clipboard")}`,
    ],
    [
      `                )}
              </li>
            </>`,
      `                  )}
                </li>
              )}
            </>`,
    ],
  ]) ? 1 : 0;
  changed += replaceIfMissing(resourceViewPage, "{!this.isPasskeyResource && <div className=\"submit-wrapper input\">", [
    [
      `        <div className="submit-wrapper input">
          <a
            href="#"
            id="popupAction"
            className={\`button primary big full-width \${this.state.usingOnThisTab ? "disabled" : ""}\`}
            role="button"
            onClick={this.handleUseOnThisTabClick}
          >
            {this.state.usingOnThisTab && <SpinnerSVG />}
            {!this.state.usingOnThisTab && <Trans>Use on this page</Trans>}
          </a>
          {this.state.error && <div className="error-message">{this.state.error}</div>}
        </div>`,
      `        {!this.isPasskeyResource && <div className="submit-wrapper input">
          <a
            href="#"
            id="popupAction"
            className={\`button primary big full-width \${this.state.usingOnThisTab ? "disabled" : ""}\`}
            role="button"
            onClick={this.handleUseOnThisTabClick}
          >
            {this.state.usingOnThisTab && <SpinnerSVG />}
            {!this.state.usingOnThisTab && <Trans>Use on this page</Trans>}
          </a>
          {this.state.error && <div className="error-message">{this.state.error}</div>}
        </div>}`,
    ],
  ]) ? 1 : 0;
  changed += replaceIfMissing(resourceViewPage, "onClick={this.handleDeleteResourceClick}", [
    [
      `          <a
            href={\`\${this.props.context.userSettings.getTrustedDomain()}/app/passwords/view/\${this.props.match.params.id}\`}
            className="secondary-action button-transparent button"
            target="_blank"
            rel="noopener noreferrer"
            title={this.translate("View in the vault")}
          >`,
      `          {this.canUpdateResource && (
            <a
              href="#"
              role="button"
              className="secondary-action button-transparent button"
              onClick={this.handleDeleteResourceClick}
              title={this.translate("Delete")}
            >
              <DeleteSVG />
              <span className="visually-hidden">
                <Trans>Delete</Trans>
              </span>
            </a>
          )}
          <a
            href={\`\${this.props.context.userSettings.getTrustedDomain()}/app/passwords/view/\${this.props.match.params.id}\`}
            className="secondary-action button-transparent button"
            target="_blank"
            rel="noopener noreferrer"
            title={this.translate("View in the vault")}
          >`,
    ],
  ]) ? 1 : 0;
  changed += replaceIfMissing(resourceViewPage, "action=edit", [
    [
      `          <a
            href={\`\${this.props.context.userSettings.getTrustedDomain()}/app/passwords/view/\${this.props.match.params.id}\`}
            className="secondary-action button-transparent button"
            target="_blank"
            rel="noopener noreferrer"
            title={this.translate("View it in passbolt")}
          >
            <GoSVG />
            <span className="visually-hidden">
              <Trans>Edit in passbolt</Trans>
            </span>
          </a>`,
      `          {this.canUpdateResource && (
            <a
              href="#"
              role="button"
              className="secondary-action button-transparent button"
              onClick={this.handleDeleteResourceClick}
              title={this.translate("Delete")}
            >
              <DeleteSVG />
              <span className="visually-hidden">
                <Trans>Delete</Trans>
              </span>
            </a>
          )}
          <a
            href={\`\${this.props.context.userSettings.getTrustedDomain()}/app/passwords/view/\${this.props.match.params.id}\`}
            className="secondary-action button-transparent button"
            target="_blank"
            rel="noopener noreferrer"
            title={this.translate("View in the vault")}
          >
            <GoSVG />
            <span className="visually-hidden">
              <Trans>View in the vault</Trans>
            </span>
          </a>
          {this.canUpdateResource && (
            <a
              href={\`\${this.props.context.userSettings.getTrustedDomain()}/app/passwords/view/\${this.props.match.params.id}?action=edit\`}
              className="secondary-action button-transparent button"
              target="_blank"
              rel="noopener noreferrer"
              title={this.translate("Edit in the vault")}
            >
              <EditSVG />
              <span className="visually-hidden">
                <Trans>Edit in the vault</Trans>
              </span>
            </a>
          )}`,
    ],
  ]) ? 1 : 0;
  changed += replaceIfMissing(resourceViewPage, "this.state.deleteDialogOpen && (", [
    [
      `        <ul className="properties">`,
      `        {this.state.deleteDialogOpen && (
          <DialogWrapper
            title={this.translate("Delete resource?", { count: 1 })}
            onClose={this.handleDeleteResourceCancel}
            disabled={this.state.deletingResource}
            className="delete-password-dialog"
          >
            <form onSubmit={this.handleDeleteResourceSubmit} noValidate>
              <div className="form-content">
                <p>
                  <Trans>
                    Are you sure you want to delete the resource{" "}
                    <strong className="dialog-variable">{{ resourceName: this.state.resource.metadata?.name }}</strong>?
                  </Trans>
                </p>
                <p>
                  <Trans>
                    Once the resource is deleted, it will be removed from the vault until it is restored.
                  </Trans>
                </p>
                {this.state.deleteError && <div className="error-message">{this.state.deleteError}</div>}
              </div>
              <div className="submit-wrapper clearfix">
                <FormCancelButton disabled={this.state.deletingResource} onClick={this.handleDeleteResourceCancel} />
                <FormSubmitButton
                  disabled={this.state.deletingResource}
                  processing={this.state.deletingResource}
                  value={this.translate("Delete")}
                  warning={true}
                />
              </div>
            </form>
          </DialogWrapper>
        )}
        <ul className="properties">`,
    ],
  ]) ? 1 : 0;

  return changed;
}

function patchWorkspaceEditFromQueryAction() {
  const workspaceMenu = path.join(root, "node_modules/passbolt-styleguide/src/react-extension/components/Resource/DisplayResourcesWorkspace/DisplayResourcesWorkspaceMenu.js");
  let changed = 0;

  changed += replaceIfExists(workspaceMenu, [
    ["openPasslyEditResourceFromQuery", "openEditResourceFromQuery"],
    ["removePasslyEditResourceQuery", "removeEditResourceQuery"],
    ['queryParameters.get("passlyAction")', 'queryParameters.get("action")'],
    ['queryParameters.delete("passlyAction")', 'queryParameters.delete("action")'],
  ]) ? 1 : 0;
  changed += replaceIfMissing(workspaceMenu, 'import { withRouter } from "react-router-dom";', [
    [
      `import React from "react";
import { withActionFeedback } from "../../../contexts/ActionFeedbackContext";`,
      `import React from "react";
import { withRouter } from "react-router-dom";
import { withActionFeedback } from "../../../contexts/ActionFeedbackContext";`,
    ],
  ]) ? 1 : 0;
  changed += replaceIfMissing(workspaceMenu, "openEditResourceFromQuery()", [
    [
      `  /**
   * handle delete one or more resources
   */
  handleDeleteClickEvent() {`,
      `  /**
   * ComponentDidMount
   */
  componentDidMount() {
    this.openEditResourceFromQuery();
  }

  /**
   * ComponentDidUpdate
   */
  componentDidUpdate() {
    this.openEditResourceFromQuery();
  }

  /**
   * Open the edit resource dialog when requested from the URL action parameter.
   */
  openEditResourceFromQuery() {
    const queryParameters = new URLSearchParams(this.props.location.search);
    if (queryParameters.get("action") !== "edit" || !this.hasOneResourceSelected()) {
      return;
    }

    const resource = this.selectedResources[0];
    const selectedResourceId = this.props.match.params.selectedResourceId;
    if (selectedResourceId && selectedResourceId !== resource.id) {
      return;
    }

    if (!this.canUpdate()) {
      this.removeEditResourceQuery(queryParameters);
      return;
    }

    if (!this.props.resourceTypes) {
      return;
    }

    this.removeEditResourceQuery(queryParameters);
    if (this.canEditResource()) {
      this.props.dialogContext.open(EditResource, { resource });
    } else {
      this.displayActionAborted();
    }
  }

  /**
   * Remove consumed QuickAccess edit query parameters.
   * @param {URLSearchParams} queryParameters The current query parameters.
   */
  removeEditResourceQuery(queryParameters) {
    queryParameters.delete("action");
    const search = queryParameters.toString();
    this.props.history.replace({
      pathname: this.props.location.pathname,
      search: search ? \`?\${search}\` : "",
      state: this.props.location.state,
    });
  }

  /**
   * handle delete one or more resources
   */
  handleDeleteClickEvent() {`,
    ],
  ]) ? 1 : 0;
  changed += replaceIfMissing(workspaceMenu, "location: PropTypes.object", [
    [
      `  resourceWorkspaceContext: PropTypes.any, // the resource workspace context
  resourceTypes: PropTypes.instanceOf(ResourceTypesCollection), // The resource types collection`,
      `  resourceWorkspaceContext: PropTypes.any, // the resource workspace context
  resourceTypes: PropTypes.instanceOf(ResourceTypesCollection), // The resource types collection
  location: PropTypes.object, // The router location
  match: PropTypes.object, // The router match
  history: PropTypes.object, // The router history`,
    ],
  ]) ? 1 : 0;
  changed += replaceIfMissing(workspaceMenu, "withRouter(withTranslation", [
    [
      `                  withResourceTypesLocalStorage(
                    withActionFeedback(withTranslation("common")(DisplayResourcesWorkspaceMenu)),
                  ),`,
      `                  withResourceTypesLocalStorage(
                    withActionFeedback(withRouter(withTranslation("common")(DisplayResourcesWorkspaceMenu))),
                  ),`,
    ],
  ]) ? 1 : 0;

  return changed;
}

function patchRecoverableDeleteDialogSource() {
  const deleteResource = path.join(root, "node_modules/passbolt-styleguide/src/react-extension/components/Resource/DeleteResource/DeleteResource.js");
  let changed = 0;

  if (!fs.existsSync(deleteResource)) {
    return changed;
  }

  const deleteResourceContent = fs.readFileSync(deleteResource, "utf8");
  if (!deleteResourceContent.includes("isRecoverableDelete()")) {
    changed += replaceIfExists(deleteResource, [
      [
        `Once the resource is deleted, it will be removed permanently and will not be recoverable.`,
        `Once the resource is deleted, it will be removed from the vault until it is restored.`,
      ],
      [
        `Please confirm you really want to delete the resources. After clicking ok, the resources will be
                  deleted permanently.`,
        `Please confirm you really want to delete the resources. After clicking ok, the resources will be
                  removed from the vault until they are restored.`,
      ],
    ]) ? 1 : 0;
  }

  changed += replaceIfMissing(deleteResource, "isRecoverableDelete()", [
    [
      `    await this.props.actionFeedbackContext.displaySuccess(
      this.translate("The resource has been deleted successfully.", { count: this.resources.length }),
    );
    this.props.onClose();`,
      `    await this.props.actionFeedbackContext.displaySuccess(
      this.translate("The resource has been deleted successfully.", { count: this.resources.length }),
    );
    await this.props.resourceWorkspaceContext.onResourcesDeleted?.(this.resources, {
      recoverable: this.isRecoverableDelete(),
    });
    this.props.onClose();`,
    ],
    [
      `      await this.props.context.port.request("passbolt.resources.delete-all", resourcesIds);`,
      `      await this.props.context.port.request("passbolt.resources.delete-all", resourcesIds, {
        recoverable: this.isRecoverableDelete(),
      });`,
    ],
    [
      `  /**
   * has multiple resources
   * @returns {boolean}
   */
  hasMultipleResources() {`,
      `  /**
   * Is the delete action recoverable.
   * @returns {boolean}
   */
  isRecoverableDelete() {
    return this.props.recoverable !== false;
  }

  /**
   * has multiple resources
   * @returns {boolean}
   */
  hasMultipleResources() {`,
    ],
    [
      `                <p>
                  <Trans>
                    Once the resource is deleted, it will be removed from the vault until it is restored.
                  </Trans>
                </p>`,
      `                {this.isRecoverableDelete() ? (
                  <p>
                    <Trans>
                      Once the resource is deleted, it will be removed from the vault until it is restored.
                    </Trans>
                  </p>
                ) : (
                  <p>
                    <Trans>
                      Once the resource is deleted, it will be removed permanently and will not be recoverable.
                    </Trans>
                  </p>
                )}`,
    ],
    [
      `            {this.hasMultipleResources() && (
              <p>
                <Trans>
                  Please confirm you really want to delete the resources. After clicking ok, the resources will be
                  removed from the vault until they are restored.
                </Trans>
              </p>
            )}`,
      `            {this.hasMultipleResources() && (
              <p>
                {this.isRecoverableDelete() ? (
                  <Trans>
                    Please confirm you really want to delete the resources. After clicking ok, the resources will be
                    removed from the vault until they are restored.
                  </Trans>
                ) : (
                  <Trans>
                    Please confirm you really want to delete the resources. After clicking ok, the resources will be
                    deleted permanently.
                  </Trans>
                )}
              </p>
            )}`,
    ],
    [
      `  resources: PropTypes.array, // The resources to delete
  t: PropTypes.func, // The translation function`,
      `  resources: PropTypes.array, // The resources to delete
  recoverable: PropTypes.bool, // Whether the delete action is recoverable
  t: PropTypes.func, // The translation function`,
    ],
  ]) ? 1 : 0;
  changed += replaceIfExists(deleteResource, [
    [
      `  isRecoverableDelete() {
    return this.props.recoverable !== false;
  }`,
      `  isRecoverableDelete() {
    const resources = this.resources || [];
    const isTrashSelection = resources.length > 0 && resources.every((resource) => Boolean(resource.deleted));
    const isTrashFilter = this.props.resourceWorkspaceContext?.filter?.type === "FILTER-BY-TRASH";

    return this.props.recoverable !== false && !isTrashSelection && !isTrashFilter;
  }`,
    ],
  ]) ? 1 : 0;
  changed += replaceIfExists(deleteResource, [
    [
      `                {this.isRecoverableDelete() ? (
                  <p>
                    <Trans>
                      Once the resource is deleted, it will be removed from the vault until it is restored.
                    </Trans>
                  </p>
                ) : (
                  <p>
                    <Trans>
                      Once the resource is deleted, it will be removed from the vault until it is restored.
                    </Trans>
                  </p>
                )}`,
      `                {this.isRecoverableDelete() ? (
                  <p>
                    <Trans>
                      Once the resource is deleted, it will be removed from the vault until it is restored.
                    </Trans>
                  </p>
                ) : (
                  <p>
                    <Trans>
                      Once the resource is deleted, it will be removed permanently and will not be recoverable.
                    </Trans>
                  </p>
                )}`,
    ],
    [
      `                {this.isRecoverableDelete() ? (
                  <p>
                    <Trans>
                      Once the resource is deleted, it will be removed permanently and will not be recoverable.
                    </Trans>
                  </p>
                ) : (
                  <p>
                    <Trans>
                      Once the resource is deleted, it will be removed permanently and will not be recoverable.
                    </Trans>
                  </p>
                )}`,
      `                {this.isRecoverableDelete() ? (
                  <p>
                    <Trans>
                      Once the resource is deleted, it will be removed from the vault until it is restored.
                    </Trans>
                  </p>
                ) : (
                  <p>
                    <Trans>
                      Once the resource is deleted, it will be removed permanently and will not be recoverable.
                    </Trans>
                  </p>
                )}`,
    ],
  ]) ? 1 : 0;

  return changed;
}

function patchTrashFilterSource() {
  const filters = path.join(root, "node_modules/passbolt-styleguide/src/react-extension/components/Resource/DisplayResourcesWorkspace/DisplayResourcesWorkspaceFilters.js");
  const workspaceContext = path.join(root, "node_modules/passbolt-styleguide/src/react-extension/contexts/ResourceWorkspaceContext.js");
  const resourcesList = path.join(root, "node_modules/passbolt-styleguide/src/react-extension/components/Resource/DisplayResourcesList/DisplayResourcesList.js");
  const breadcrumb = path.join(root, "node_modules/passbolt-styleguide/src/react-extension/components/Resource/FilterResourcesByBreadcrumb/FilterResourcesByBreadcrumb.js");
  const filtersTest = path.join(root, "node_modules/passbolt-styleguide/src/react-extension/components/Resource/DisplayResourcesWorkspace/DisplayResourcesWorkspaceFilters.test.js");
  const breadcrumbTest = path.join(root, "node_modules/passbolt-styleguide/src/react-extension/components/Resource/FilterResourcesByBreadcrumb/FilterResourcesByBreadcrumb.test.js");
  const workspaceContextTest = path.join(root, "node_modules/passbolt-styleguide/src/react-extension/contexts/ResourceWorkspaceContext.test.js");
  const workspaceContextTestPage = path.join(root, "node_modules/passbolt-styleguide/src/react-extension/contexts/ResourceWorkspaceContext.test.page.js");
  let changed = 0;

  changed += replaceIfMissing(filters, "ResourceWorkspaceFilterTypes.TRASH", [
    [
      `import FavoriteSVG from "../../../../img/svg/favorite.svg";
import OwnedByMeSVG from "../../../../img/svg/owned_by_me.svg";`,
      `import FavoriteSVG from "../../../../img/svg/favorite.svg";
import OwnedByMeSVG from "../../../../img/svg/owned_by_me.svg";
import DeleteSVG from "../../../../img/svg/delete.svg";`,
    ],
    [
      `    this.handleSharedWithMeClick = this.handleSharedWithMeClick.bind(this);
    this.handleResourcesExpiredClick = this.handleResourcesExpiredClick.bind(this);
    this.handleRemoveFilterClick = this.handleRemoveFilterClick.bind(this);`,
      `    this.handleSharedWithMeClick = this.handleSharedWithMeClick.bind(this);
    this.handleResourcesExpiredClick = this.handleResourcesExpiredClick.bind(this);
    this.handleTrashClick = this.handleTrashClick.bind(this);
    this.handleRemoveFilterClick = this.handleRemoveFilterClick.bind(this);`,
    ],
    [
      `      case ResourceWorkspaceFilterTypes.ITEMS_I_OWN:
        return (`,
      `      case ResourceWorkspaceFilterTypes.TRASH:
        return (
          <>
            <DeleteSVG />
            <span>
              <Trans>Trash</Trans>
            </span>
          </>
        );
      case ResourceWorkspaceFilterTypes.ITEMS_I_OWN:
        return (`,
    ],
    [
      `  handleResourcesExpiredClick() {
    const filter = { type: ResourceWorkspaceFilterTypes.EXPIRED };
    this.props.history.push({ pathname: "/app/passwords/filter/expired", state: { filter } });
  }

  /**
   * Whenever a filter has been removed go back to all items filter
   */`,
      `  handleResourcesExpiredClick() {
    const filter = { type: ResourceWorkspaceFilterTypes.EXPIRED };
    this.props.history.push({ pathname: "/app/passwords/filter/expired", state: { filter } });
  }

  /**
   * Whenever the filter "Trash" has been selected
   */
  handleTrashClick() {
    const filter = { type: ResourceWorkspaceFilterTypes.TRASH };
    this.props.history.push({ pathname: "/app/passwords/filter/trash", state: { filter } });
  }

  /**
   * Whenever a filter has been removed go back to all items filter
   */`,
    ],
    [
      `              {this.props.passwordExpiryContext.isFeatureEnabled() && (
                <DropdownMenuItem>
                  <button type="button" className="no-border" onClick={this.handleResourcesExpiredClick}>
                    <CalendarClockSVG />
                    <span>
                      <Trans>Expired</Trans>
                    </span>
                  </button>
                </DropdownMenuItem>
              )}
            </DropdownMenu>`,
      `              {this.props.passwordExpiryContext.isFeatureEnabled() && (
                <DropdownMenuItem>
                  <button type="button" className="no-border" onClick={this.handleResourcesExpiredClick}>
                    <CalendarClockSVG />
                    <span>
                      <Trans>Expired</Trans>
                    </span>
                  </button>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem>
                <button type="button" className="no-border" onClick={this.handleTrashClick}>
                  <DeleteSVG />
                  <span>
                    <Trans>Trash</Trans>
                  </span>
                </button>
              </DropdownMenuItem>
            </DropdownMenu>`,
    ],
  ]) ? 1 : 0;

  changed += replaceIfMissing(workspaceContext, 'TRASH: "FILTER-BY-TRASH"', [
    [
      `  get resources() {
    return this.props.context.resources;
  }

  /**
   * Get the folders`,
      `  get resources() {
    return this.props.context.resources;
  }

  /**
   * Get the resources not marked as deleted.
   * @return {*}
   */
  get activeResources() {
    return this.resources.filter((resource) => !resource.deleted);
  }

  /**
   * Get the folders`,
    ],
    [
      `      const isExpiredResourceLocation = this.props.match.params?.filterType === ResourceWorkspaceFilterTypes.EXPIRED;
      if (isExpiredResourceLocation) {
        return { type: ResourceWorkspaceFilterTypes.EXPIRED };
      } else if (this.props.match.params.selectedResourceId) {`,
      `      const routeFilterType = {
        expired: ResourceWorkspaceFilterTypes.EXPIRED,
        trash: ResourceWorkspaceFilterTypes.TRASH,
      }[this.props.match.params?.filterType];
      if (routeFilterType) {
        return { type: routeFilterType };
      } else if (this.props.match.params.selectedResourceId) {`,
    ],
    [
      `      [ResourceWorkspaceFilterTypes.SHARED_WITH_ME]: this.searchBySharedWithMe.bind(this),
      [ResourceWorkspaceFilterTypes.EXPIRED]: this.searchByExpired.bind(this),
      [ResourceWorkspaceFilterTypes.ALL]: this.searchAll.bind(this),`,
      `      [ResourceWorkspaceFilterTypes.SHARED_WITH_ME]: this.searchBySharedWithMe.bind(this),
      [ResourceWorkspaceFilterTypes.EXPIRED]: this.searchByExpired.bind(this),
      [ResourceWorkspaceFilterTypes.TRASH]: this.searchByTrash.bind(this),
      [ResourceWorkspaceFilterTypes.ALL]: this.searchAll.bind(this),`,
    ],
    [
      `    this.sort(this.resources);
    this.setState({ filter, filteredResources: this.resources });`,
      `    const activeResources = this.activeResources;
    this.sort(activeResources);
    this.setState({ filter, filteredResources: activeResources });`,
    ],
    [`this.resources.filter((resource) => !resource.folder_parent_id)`, `this.activeResources.filter((resource) => !resource.folder_parent_id)`],
    [`this.resources.filter((resource) => resource.folder_parent_id === folderId)`, `this.activeResources.filter((resource) => resource.folder_parent_id === folderId)`],
    [`const tagResources = this.resources.filter(`, `const tagResources = this.activeResources.filter(`],
    [`const filteredResources = this.resources.filter(matchText);`, `const filteredResources = this.activeResources.filter(matchText);`],
    [`const groupResources = this.resources.filter((resource) => resourceIds.includes(resource.id));`, `const groupResources = this.activeResources.filter((resource) => resourceIds.includes(resource.id));`],
    [`const filteredResources = this.resources.filter((resource) => resource.permission.type === 15);`, `const filteredResources = this.activeResources.filter((resource) => resource.permission.type === 15);`],
    [`const filteredResources = this.resources.filter((resource) => Boolean(resource.personal));`, `const filteredResources = this.activeResources.filter((resource) => Boolean(resource.personal));`],
    [`const filteredResources = this.resources.filter((resource) => resource.favorite !== null);`, `const filteredResources = this.activeResources.filter((resource) => resource.favorite !== null);`],
    [`const filteredResources = this.resources.filter((resource) => resource.permission.type < 15);`, `const filteredResources = this.activeResources.filter((resource) => resource.permission.type < 15);`],
    [`const filteredResources = this.resources.filter(
      (resource) => resource.expired && new Date(resource.expired) <= new Date(),
    );`, `const filteredResources = this.activeResources.filter(
      (resource) => resource.expired && new Date(resource.expired) <= new Date(),
    );`],
    [
      `  /** RESOURCE SELECTION */`,
      `  /**
   * Keep the deleted resources.
   * @param filter A "trash" filter
   */
  searchByTrash(filter) {
    this.props.loadingContext.add();
    this.setState({ filter, selectedResources: [] }, async () => {
      try {
        const deletedResources =
          (await this.props.context.port.request("passbolt.resources.find-deleted-for-local-storage")) || [];
        const filteredResources =
          deletedResources.length > 0 ? deletedResources : this.resources.filter((resource) => resource.deleted);
        this.sort(filteredResources);
        this.setState({ filteredResources });
      } catch (error) {
        await this.props.actionFeedbackContext.displayError(error.message);
      } finally {
        this.props.loadingContext.remove();
      }
    });
  }

  /** RESOURCE SELECTION */`,
    ],
    [
      `    // Case of resources
    const mustRedirect = this.props.location.pathname !== "/app/passwords";`,
      `    // Case of resources filtered by trash
    const isTrashFilter = filter.type === ResourceWorkspaceFilterTypes.TRASH;
    if (isTrashFilter) {
      const mustRedirect = this.props.location.pathname !== \`/app/passwords/filter/trash\`;
      if (mustRedirect) {
        this.props.history.push({ pathname: \`/app/passwords/filter/trash\` });
      }
      return;
    }

    // Case of resources
    const mustRedirect = this.props.location.pathname !== "/app/passwords";`,
    ],
    [
      `  SHARED_WITH_ME: "FILTER-BY-SHARED-WITH-ME", // Resources shared with the current user (who is not the owner)
  EXPIRED: "FILTER-BY-EXPIRED", // Resources recently modified
};`,
      `  SHARED_WITH_ME: "FILTER-BY-SHARED-WITH-ME", // Resources shared with the current user (who is not the owner)
  EXPIRED: "FILTER-BY-EXPIRED", // Resources recently modified
  TRASH: "FILTER-BY-TRASH", // Deleted resources
};`,
    ],
  ]) ? 1 : 0;

  changed += replaceIfExists(workspaceContext, [
    [
      `      const isExpiredResourceLocation = this.props.match.params?.filterType === ResourceWorkspaceFilterTypes.EXPIRED;
      const isTrashResourceLocation = this.props.match.params?.filterType === "trash";
      if (isExpiredResourceLocation) {
        return { type: ResourceWorkspaceFilterTypes.EXPIRED };
      } else if (isTrashResourceLocation) {
        return { type: ResourceWorkspaceFilterTypes.TRASH };
      } else if (this.props.match.params.selectedResourceId) {`,
      `      const routeFilterType = {
        expired: ResourceWorkspaceFilterTypes.EXPIRED,
        trash: ResourceWorkspaceFilterTypes.TRASH,
      }[this.props.match.params?.filterType];
      if (routeFilterType) {
        return { type: routeFilterType };
      } else if (this.props.match.params.selectedResourceId) {`,
    ],
  ]) ? 1 : 0;

  changed += replaceIfMissing(resourcesList, "No passwords in the trash.", [
    [
      `            {(filterType === ResourceWorkspaceFilterTypes.ITEMS_I_OWN ||
              filterType === ResourceWorkspaceFilterTypes.ALL) && (`,
      `            {filterType === ResourceWorkspaceFilterTypes.TRASH && (
              <div className="empty-content">
                <CircleOffSVG />
                <div className="message">
                  <h1>
                    <Trans>No passwords in the trash.</Trans>
                  </h1>
                  <p>
                    <Trans>Deleted passwords will appear here until they are restored.</Trans>
                  </p>
                </div>
              </div>
            )}
            {(filterType === ResourceWorkspaceFilterTypes.ITEMS_I_OWN ||
              filterType === ResourceWorkspaceFilterTypes.ALL) && (`,
    ],
  ]) ? 1 : 0;

  changed += replaceIfMissing(breadcrumb, 'this.translate("Trash")', [
    [
      `      case ResourceWorkspaceFilterTypes.EXPIRED:
        return [...items, this.getBreadcrumb(this.translate("Expired"))];
      case ResourceWorkspaceFilterTypes.ITEMS_I_OWN:`,
      `      case ResourceWorkspaceFilterTypes.EXPIRED:
        return [...items, this.getBreadcrumb(this.translate("Expired"))];
      case ResourceWorkspaceFilterTypes.TRASH:
        return [...items, this.getBreadcrumb(this.translate("Trash"))];
      case ResourceWorkspaceFilterTypes.ITEMS_I_OWN:`,
    ],
  ]) ? 1 : 0;

  changed += replaceIfMissing(filtersTest, "ResourceWorkspaceFilterTypes.TRASH", [
    [`expect(page.filterItemsLength).toBe(5);`, `expect(page.filterItemsLength).toBe(6);`],
    [
      `      itemIndex: 5,
    },
  ])("I should be able to filter", (scenario) => {`,
      `      itemIndex: 5,
    },
    {
      filter: ResourceWorkspaceFilterTypes.TRASH,
      itemSelected: "Trash",
      pathname: "/app/passwords/filter/trash",
      itemIndex: 6,
    },
  ])("I should be able to filter", (scenario) => {`,
    ],
    [
      `    { filter: ResourceWorkspaceFilterTypes.PRIVATE, itemSelected: "Private" },
    { filter: ResourceWorkspaceFilterTypes.EXPIRED, itemSelected: "Expired" },
  ])("I should be able to identify the filters", (scenario) => {`,
      `    { filter: ResourceWorkspaceFilterTypes.PRIVATE, itemSelected: "Private" },
    { filter: ResourceWorkspaceFilterTypes.EXPIRED, itemSelected: "Expired" },
    { filter: ResourceWorkspaceFilterTypes.TRASH, itemSelected: "Trash" },
  ])("I should be able to identify the filters", (scenario) => {`,
    ],
  ]) ? 1 : 0;

  changed += replaceIfMissing(breadcrumbTest, "breadcrumb for trash", [
    [
      `  it("As LU I should see a breadcrumb for resources favorite", () => {`,
      `  it("As LU I should see a breadcrumb for trash", () => {
    const props = defaultResourceWorkspaceContext(ResourceWorkspaceFilterTypes.TRASH); // The props to pass
    page = new FilterResourcesByBreadcrumbPage(context, props);
    expect(page.displayBreadcrumb.exists()).toBeTruthy();
    expect(page.displayBreadcrumb.count).toBe(2);
    expect(page.displayBreadcrumb.item(1)).toBe("Home");
    expect(page.displayBreadcrumb.item(2)).toBe("Trash");
    expect(page.displayBreadcrumb.itemNumberDisplayed).toContain("0");
  });

  it("As LU I should see a breadcrumb for resources favorite", () => {`,
    ],
  ]) ? 1 : 0;

  changed += replaceIfMissing(workspaceContextTestPage, "goToTrashDirect", [
    [
      `  /**
   * Select all resources
   */`,
      `  /**
   * Go directly to the trash route without relying on router location state.
   */
  async goToTrashDirect() {
    this.setup(this.context, this.props, { initialEntry: "/app/passwords/filter/trash" });
    await waitForTrue(() => this.filter.type === ResourceWorkspaceFilterTypes.TRASH);
  }

  /**
   * Select all resources
   */`,
    ],
    [
      `          history={createMemoryHistory({
            initialEntries: [
              "/app/folders/view/:filterByFolderId",
              "/app/passwords/view/:selectedResourceId",
              "/app/passwords/filter/:filterType",
              "/app/passwords",
            ],
          })}`,
      `          history={createMemoryHistory({
            initialEntries: [args.initialEntry || "/app/passwords"],
          })}`,
    ],
  ]) ? 1 : 0;

  changed += replaceIfMissing(workspaceContextTest, "went directly to /app/passwords/filter/trash", [
    [
      `    it("AS LU I should have an ITEMS-I-OWN filter when I went to /app/passwords with such a filter", async () => {`,
      `    it("AS LU I should have a TRASH filter when I went directly to /app/passwords/filter/trash", async () => {
      await page.goToTrashDirect();
      expect(page.filter.type).toBe(ResourceWorkspaceFilterTypes.TRASH);
    });

    it("AS LU I should have an ITEMS-I-OWN filter when I went to /app/passwords with such a filter", async () => {`,
    ],
  ]) ? 1 : 0;

  return changed;
}

function patchTrashRestoreActionsSource() {
  const workspaceContext = path.join(root, "node_modules/passbolt-styleguide/src/react-extension/contexts/ResourceWorkspaceContext.js");
  const workspaceContextTestData = path.join(root, "node_modules/passbolt-styleguide/src/react-extension/contexts/ResourceWorkspaceContext.test.data.js");
  const workspaceMenu = path.join(root, "node_modules/passbolt-styleguide/src/react-extension/components/Resource/DisplayResourcesWorkspace/DisplayResourcesWorkspaceMenu.js");
  const workspaceMenuTest = path.join(root, "node_modules/passbolt-styleguide/src/react-extension/components/Resource/DisplayResourcesWorkspace/DisplayResourcesWorkspaceMenu.test.js");
  const workspaceMenuTestPage = path.join(root, "node_modules/passbolt-styleguide/src/react-extension/components/Resource/DisplayResourcesWorkspace/DisplayResourcesWorkspaceMenu.test.page.js");
  const workspaceMenuTestData = path.join(root, "node_modules/passbolt-styleguide/src/react-extension/components/Resource/DisplayResourcesWorkspace/DisplayResourcesWorkspaceMenu.test.data.js");
  const contextualMenu = path.join(root, "node_modules/passbolt-styleguide/src/react-extension/components/Resource/DisplayResourcesList/DisplayResourcesListContextualMenu.js");
  const contextualMenuTest = path.join(root, "node_modules/passbolt-styleguide/src/react-extension/components/Resource/DisplayResourcesList/DisplayResourcesListContextualMenu.test.js");
  const contextualMenuTestPage = path.join(root, "node_modules/passbolt-styleguide/src/react-extension/components/Resource/DisplayResourcesList/DisplayResourcesListContextualMenu.test.page.js");
  const contextualMenuTestData = path.join(root, "node_modules/passbolt-styleguide/src/react-extension/components/Resource/DisplayResourcesList/DisplayResourcesListContextualMenu.test.data.js");
  let changed = 0;

  changed += replaceIfMissing(workspaceContext, "onResourcesRestored: () => {}", [
    [
      `  onResourcesToExport: () => {}, // Whenever resources and/or folder will be exported
  onGoToResourceUriRequested: () => {}, // Whenever the users wants to follow a resource uri`,
      `  onResourcesToExport: () => {}, // Whenever resources and/or folder will be exported
  onResourcesRestored: () => {}, // Whenever resources have been restored
  onGoToResourceUriRequested: () => {}, // Whenever the users wants to follow a resource uri`,
    ],
    [
      `      onResourcesToExport: this.handleResourcesToExportChange.bind(this), // Whenever resources and/or folder have to be exported
      onGoToResourceUriRequested: this.onGoToResourceUriRequested.bind(this), // Whenever the users wants to follow a resource uri`,
      `      onResourcesToExport: this.handleResourcesToExportChange.bind(this), // Whenever resources and/or folder have to be exported
      onResourcesRestored: this.handleResourcesRestored.bind(this), // Whenever resources have been restored
      onGoToResourceUriRequested: this.onGoToResourceUriRequested.bind(this), // Whenever the users wants to follow a resource uri`,
    ],
    [
      `  /** Resource export */`,
      `  /**
   * Refresh the current filter after resources have been restored.
   */
  handleResourcesRestored() {
    this.setState({ selectedResources: [] }, () => this.search(this.state.filter));
  }

  /** Resource export */`,
    ],
  ]) ? 1 : 0;

  changed += replaceIfMissing(workspaceContextTestData, "onResourcesRestored: jest.fn()", [
    [
      `    onResourcesToExport: jest.fn(),
    onResourceFileImportResult: jest.fn(),`,
      `    onResourcesToExport: jest.fn(),
    onResourcesRestored: jest.fn(),
    onResourceFileImportResult: jest.fn(),`,
    ],
  ]) ? 1 : 0;
  changed += replaceIfMissing(workspaceContext, "onResourcesDeleted: () => {}", [
    [
      `  onResourcesRestored: () => {}, // Whenever resources have been restored
  onGoToResourceUriRequested: () => {}, // Whenever the users wants to follow a resource uri`,
      `  onResourcesRestored: () => {}, // Whenever resources have been restored
  onResourcesDeleted: () => {}, // Whenever resources have been deleted
  onGoToResourceUriRequested: () => {}, // Whenever the users wants to follow a resource uri`,
    ],
    [
      `      onResourcesRestored: this.handleResourcesRestored.bind(this), // Whenever resources have been restored
      onGoToResourceUriRequested: this.onGoToResourceUriRequested.bind(this), // Whenever the users wants to follow a resource uri`,
      `      onResourcesRestored: this.handleResourcesRestored.bind(this), // Whenever resources have been restored
      onResourcesDeleted: this.handleResourcesDeleted.bind(this), // Whenever resources have been deleted
      onGoToResourceUriRequested: this.onGoToResourceUriRequested.bind(this), // Whenever the users wants to follow a resource uri`,
    ],
    [
      `  /**
   * Refresh the current filter after resources have been restored.
   */
  handleResourcesRestored() {
    this.setState({ selectedResources: [] }, () => this.search(this.state.filter));
  }

  /** Resource export */`,
      `  /**
   * Refresh the current filter after resources have been restored.
   */
  handleResourcesRestored() {
    this.setState({ selectedResources: [] }, () => this.search(this.state.filter));
  }

  /**
   * Refresh the current filter after resources have been deleted.
   */
  handleResourcesDeleted() {
    this.setState({ selectedResources: [] }, () => this.search(this.state.filter));
  }

  /** Resource export */`,
    ],
  ]) ? 1 : 0;
  changed += replaceIfMissing(workspaceContextTestData, "onResourcesDeleted: jest.fn()", [
    [
      `    onResourcesRestored: jest.fn(),
    onResourceFileImportResult: jest.fn(),`,
      `    onResourcesRestored: jest.fn(),
    onResourcesDeleted: jest.fn(),
    onResourceFileImportResult: jest.fn(),`,
    ],
  ]) ? 1 : 0;

  changed += replaceIfMissing(workspaceMenu, "handleRestoreClickEvent", [
    [
      `import { withResourceWorkspace } from "../../../contexts/ResourceWorkspaceContext";`,
      `import { ResourceWorkspaceFilterTypes, withResourceWorkspace } from "../../../contexts/ResourceWorkspaceContext";`,
    ],
    [
      `import SecretHistorySVG from "../../../../img/svg/history.svg";`,
      `import SecretHistorySVG from "../../../../img/svg/history.svg";
import RestoreSVG from "../../../../img/svg/reply.svg";`,
    ],
    [
      `    this.handleDeleteClickEvent = this.handleDeleteClickEvent.bind(this);
    this.handleEditClickEvent = this.handleEditClickEvent.bind(this);`,
      `    this.handleDeleteClickEvent = this.handleDeleteClickEvent.bind(this);
    this.handleRestoreClickEvent = this.handleRestoreClickEvent.bind(this);
    this.handleEditClickEvent = this.handleEditClickEvent.bind(this);`,
    ],
    [
      `  /**
   * Handle mark as expired
   * @returns {Promise<void>}
   */
  async handleMarkAsExpiredClick() {`,
      `  /**
   * Restore one or more resources.
   * @returns {Promise<void>}
   */
  async handleRestoreClickEvent() {
    const resourcesIds = this.selectedResources.map((resource) => resource.id);
    try {
      await this.props.context.port.request("passbolt.resources.restore-all", resourcesIds);
      await this.props.actionFeedbackContext.displaySuccess(
        this.translate("The resource has been restored successfully.", { count: resourcesIds.length }),
      );
      this.props.resourceWorkspaceContext.onResourcesRestored();
    } catch (error) {
      Logger.error(error);
      await this.props.actionFeedbackContext.displayError(error.message);
    }
  }

  /**
   * Handle mark as expired
   * @returns {Promise<void>}
   */
  async handleMarkAsExpiredClick() {`,
    ],
    [
      `  /**
   * Can share the selected resources
   * @return {boolean}
   */
  canShare() {`,
      `  /**
   * Is the current filter the trash.
   * @return {boolean}
   */
  isTrashFilter() {
    return this.props.resourceWorkspaceContext.filter.type === ResourceWorkspaceFilterTypes.TRASH;
  }

  /**
   * Can share the selected resources
   * @return {boolean}
   */
  canShare() {`,
    ],
    [
      `    // Main actions
    const canViewShare = this.canShare();
    const canViewCopy = hasOneResourceSelected;
    const canUpdate = this.canUpdate();
    const canViewEdit = hasOneResourceSelected && canUpdate;
    const canViewDelete = canUpdate;
    const hasMoreActionAllowed = this.hasMoreActionAllowed();`,
      `    // Main actions
    const isTrashFilter = this.isTrashFilter();
    const canUpdate = this.canUpdate();
    const canViewRestore = isTrashFilter && canUpdate;
    const canViewShare = !isTrashFilter && this.canShare();
    const canViewCopy = !isTrashFilter && hasOneResourceSelected;
    const canViewEdit = !isTrashFilter && hasOneResourceSelected && canUpdate;
    const canViewDelete = !isTrashFilter && canUpdate;
    const hasMoreActionAllowed = !isTrashFilter && this.hasMoreActionAllowed();`,
    ],
    [
      `          <ul>
            {canViewShare && (`,
      `          <ul>
            {canViewRestore && (
              <li id="restore_action">
                <button type="button" className="button-action-contextual" onClick={this.handleRestoreClickEvent}>
                  <RestoreSVG />
                  <span>
                    <Trans>Restore</Trans>
                  </span>
                </button>
              </li>
            )}
            {canViewShare && (`,
    ],
  ]) ? 1 : 0;
  changed += replaceIfExists(workspaceMenu, [
    [
      `  handleDeleteClickEvent() {
    this.props.dialogContext.open(DeleteResource, { resources: this.selectedResources });
  }`,
      `  handleDeleteClickEvent() {
    this.props.dialogContext.open(DeleteResource, {
      resources: this.selectedResources,
      recoverable: !this.isTrashFilter(),
    });
  }`,
    ],
    [
      `    const canViewDelete = !isTrashFilter && canUpdate;`,
      `    const canViewDelete = canUpdate;`,
    ],
    [
      `  isTrashFilter() {
    return this.props.resourceWorkspaceContext.filter.type === ResourceWorkspaceFilterTypes.TRASH;
  }`,
      `  isTrashFilter() {
    const selectedResources = this.selectedResources || [];
    return (
      this.props.resourceWorkspaceContext.filter?.type === ResourceWorkspaceFilterTypes.TRASH ||
      this.props.location?.pathname?.includes("/app/passwords/filter/trash") ||
      (selectedResources.length > 0 && selectedResources.every((resource) => Boolean(resource.deleted)))
    );
  }`,
    ],
  ]) ? 1 : 0;
  changed += replaceIfExists(workspaceMenuTest, [
    [
      `  describe("As LU I can restore a resource from the workspace menu in trash", () => {
    it("As LU I should see only the restore action for trash resources", () => {
      expect.assertions(6);
      const props = defaultPropsOneResourceInTrash();
      page = new DisplayResourcesWorkspaceMenuPage(props.context, props);

      expect(page.displayMenu.exists()).toBeTruthy();
      expect(page.displayMenu.restoreMenu).not.toBeNull();
      expect(page.displayMenu.shareMenu).toBeNull();
      expect(page.displayMenu.copyMenuDropdown).toBeNull();
      expect(page.displayMenu.editMenu).toBeNull();
      expect(page.displayMenu.deleteMenu).toBeNull();
    });`,
      `  describe("As LU I can restore or delete a resource from the workspace menu in trash", () => {
    it("As LU I should see only the restore and delete actions for trash resources", () => {
      expect.assertions(6);
      const props = defaultPropsOneResourceInTrash();
      page = new DisplayResourcesWorkspaceMenuPage(props.context, props);

      expect(page.displayMenu.exists()).toBeTruthy();
      expect(page.displayMenu.restoreMenu).not.toBeNull();
      expect(page.displayMenu.shareMenu).toBeNull();
      expect(page.displayMenu.copyMenuDropdown).toBeNull();
      expect(page.displayMenu.editMenu).toBeNull();
      expect(page.displayMenu.deleteMenu).not.toBeNull();
    });`,
    ],
  ]) ? 1 : 0;

  changed += replaceIfMissing(workspaceMenuTestData, "defaultPropsOneResourceInTrash", [
    [
      `import { defaultResourceWorkspaceContext } from "../../../contexts/ResourceWorkspaceContext.test.data";`,
      `import { defaultResourceWorkspaceContext } from "../../../contexts/ResourceWorkspaceContext.test.data";
import { ResourceWorkspaceFilterTypes } from "../../../contexts/ResourceWorkspaceContext";`,
    ],
    [
      `export const defaultPropsOneResourceNotOwned = (data = {}) =>`,
      `export const defaultPropsOneResourceInTrash = (data = {}) =>
  defaultProps({
    resourceWorkspaceContext: defaultResourceWorkspaceContext({
      filter: { type: ResourceWorkspaceFilterTypes.TRASH },
      selectedResources: [resourcesMock[0]],
      lockDisplayDetail: true,
    }),
    ...data,
  });

export const defaultPropsOneResourceNotOwned = (data = {}) =>`,
    ],
  ]) ? 1 : 0;

  changed += replaceIfMissing(workspaceMenuTestPage, "restoreMenu", [
    [
      `  get shareMenu() {
    return this._container.querySelector("#share_action button");
  }`,
      `  get shareMenu() {
    return this._container.querySelector("#share_action button");
  }

  /**
   * Returns the restore menu elements of password workspace menu
   * @returns {HTMLElement}
   */
  get restoreMenu() {
    return this._container.querySelector("#restore_action button");
  }`,
    ],
  ]) ? 1 : 0;

  changed += replaceIfMissing(workspaceMenuTest, "workspace menu in trash", [
    [
      `  defaultPropsOneResourceOwned,
  defaultPropsOneResourceV5Private,`,
      `  defaultPropsOneResourceOwned,
  defaultPropsOneResourceInTrash,
  defaultPropsOneResourceV5Private,`,
    ],
    [
      `  describe("As LU I cannot use the password expiry feature if the feature flag is disabled", () => {`,
      `  describe("As LU I can restore or delete a resource from the workspace menu in trash", () => {
    it("As LU I should see only the restore and delete actions for trash resources", () => {
      expect.assertions(6);
      const props = defaultPropsOneResourceInTrash();
      page = new DisplayResourcesWorkspaceMenuPage(props.context, props);

      expect(page.displayMenu.exists()).toBeTruthy();
      expect(page.displayMenu.restoreMenu).not.toBeNull();
      expect(page.displayMenu.shareMenu).toBeNull();
      expect(page.displayMenu.copyMenuDropdown).toBeNull();
      expect(page.displayMenu.editMenu).toBeNull();
      expect(page.displayMenu.deleteMenu).not.toBeNull();
    });

    it("As LU I can restore a resource via the workspace main menu", async () => {
      expect.assertions(4);
      const props = defaultPropsOneResourceInTrash();
      jest.spyOn(props.context.port, "request").mockImplementationOnce(() => []);
      jest.spyOn(ActionFeedbackContext._currentValue, "displaySuccess").mockImplementation(() => {});
      page = new DisplayResourcesWorkspaceMenuPage(props.context, props);

      await page.displayMenu.clickOnMenu(page.displayMenu.restoreMenu);

      expect(props.context.port.request).toHaveBeenCalledWith("passbolt.resources.restore-all", [
        props.resourceWorkspaceContext.selectedResources[0].id,
      ]);
      expect(ActionFeedbackContext._currentValue.displaySuccess).toHaveBeenCalledWith(
        "The resource has been restored successfully.",
      );
      expect(props.resourceWorkspaceContext.onResourcesRestored).toHaveBeenCalled();
      expect(props.resourceWorkspaceContext.onResourceSelected.none).not.toHaveBeenCalled();
    });
  });

  describe("As LU I cannot use the password expiry feature if the feature flag is disabled", () => {`,
    ],
  ]) ? 1 : 0;

  changed += replaceIfMissing(contextualMenu, "handleRestoreClickEvent", [
    [
      `import { resourceLinkAuthorizedProtocols, withResourceWorkspace } from "../../../contexts/ResourceWorkspaceContext";`,
      `import {
  ResourceWorkspaceFilterTypes,
  resourceLinkAuthorizedProtocols,
  withResourceWorkspace,
} from "../../../contexts/ResourceWorkspaceContext";`,
    ],
    [
      `import HistoryIcon from "../../../../img/svg/history.svg";`,
      `import HistoryIcon from "../../../../img/svg/history.svg";
import RestoreIcon from "../../../../img/svg/reply.svg";`,
    ],
    [
      `    this.handleDeleteClickEvent = this.handleDeleteClickEvent.bind(this);
    this.handleGoToResourceUriClick = this.handleGoToResourceUriClick.bind(this);`,
      `    this.handleDeleteClickEvent = this.handleDeleteClickEvent.bind(this);
    this.handleRestoreClickEvent = this.handleRestoreClickEvent.bind(this);
    this.handleGoToResourceUriClick = this.handleGoToResourceUriClick.bind(this);`,
    ],
    [
      `  /**
   * handle open the uri in a new tab
   */
  handleGoToResourceUriClick() {`,
      `  /**
   * Restore the resource.
   * @returns {Promise<void>}
   */
  async handleRestoreClickEvent() {
    try {
      await this.props.context.port.request("passbolt.resources.restore-all", [this.resource.id]);
      await this.props.actionFeedbackContext.displaySuccess(
        this.translate("The resource has been restored successfully.", { count: 1 }),
      );
      this.props.resourceWorkspaceContext.onResourcesRestored();
    } catch (error) {
      Logger.error(error);
      await this.props.actionFeedbackContext.displayError(error.message);
    } finally {
      this.props.hide();
    }
  }

  /**
   * handle open the uri in a new tab
   */
  handleGoToResourceUriClick() {`,
    ],
    [
      `  /**
   * Can update the resource
   */
  canUpdate() {`,
      `  /**
   * Is the current filter the trash.
   * @return {boolean}
   */
  isTrashFilter() {
    return this.props.resourceWorkspaceContext.filter.type === ResourceWorkspaceFilterTypes.TRASH;
  }

  /**
   * Can update the resource
   */
  canUpdate() {`,
    ],
    [
      `    return (
      <ContextualMenuWrapper hide={this.props.hide} left={this.props.left} top={this.props.top} className="floating">
        {!this.isStandaloneTotpResource && (`,
      `    if (this.isTrashFilter()) {
      return (
        <ContextualMenuWrapper hide={this.props.hide} left={this.props.left} top={this.props.top} className="floating">
          {this.canUpdate() && (
            <li key="option-restore-resource" className="ready">
              <div className="row">
                <div className="main-cell-wrapper">
                  <div className="main-cell">
                    <button type="button" id="restore" className="link no-border" onClick={this.handleRestoreClickEvent}>
                      <RestoreIcon />
                      <span>
                        <Trans>Restore</Trans>
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </li>
          )}
          {this.canUpdate() && (
            <li key="option-delete-resource" className="ready">
              <div className="row">
                <div className="main-cell-wrapper">
                  <div className="main-cell">
                    <button type="button" id="delete" className="link no-border" onClick={this.handleDeleteClickEvent}>
                      <DeleteIcon />
                      <span>
                        <Trans>Delete</Trans>
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </li>
          )}
        </ContextualMenuWrapper>
      );
    }

    return (
      <ContextualMenuWrapper hide={this.props.hide} left={this.props.left} top={this.props.top} className="floating">
        {!this.isStandaloneTotpResource && (`,
    ],
  ]) ? 1 : 0;
  changed += replaceIfExists(contextualMenu, [
    [
      `  handleDeleteClickEvent() {
    const resources = [this.resource];
    this.props.dialogContext.open(DeleteResource, { resources });
    this.props.hide();
  }`,
      `  handleDeleteClickEvent() {
    const resources = [this.resource];
    this.props.dialogContext.open(DeleteResource, {
      resources,
      recoverable: !this.isTrashFilter(),
    });
    this.props.hide();
  }`,
    ],
    [
      `  isTrashFilter() {
    return this.props.resourceWorkspaceContext.filter.type === ResourceWorkspaceFilterTypes.TRASH;
  }`,
      `  isTrashFilter() {
    return (
      this.props.resourceWorkspaceContext.filter?.type === ResourceWorkspaceFilterTypes.TRASH ||
      Boolean(this.resource.deleted)
    );
  }`,
    ],
  ]) ? 1 : 0;
  changed += replaceIfExists(contextualMenu, [
    [
      `          {this.canUpdate() && (
            <li key="option-restore-resource" className="ready">
              <div className="row">
                <div className="main-cell-wrapper">
                  <div className="main-cell">
                    <button type="button" id="restore" className="link no-border" onClick={this.handleRestoreClickEvent}>
                      <RestoreIcon />
                      <span>
                        <Trans>Restore</Trans>
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </li>
          )}
        </ContextualMenuWrapper>`,
      `          {this.canUpdate() && (
            <li key="option-restore-resource" className="ready">
              <div className="row">
                <div className="main-cell-wrapper">
                  <div className="main-cell">
                    <button type="button" id="restore" className="link no-border" onClick={this.handleRestoreClickEvent}>
                      <RestoreIcon />
                      <span>
                        <Trans>Restore</Trans>
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </li>
          )}
          {this.canUpdate() && (
            <li key="option-delete-resource" className="ready">
              <div className="row">
                <div className="main-cell-wrapper">
                  <div className="main-cell">
                    <button type="button" id="delete" className="link no-border" onClick={this.handleDeleteClickEvent}>
                      <DeleteIcon />
                      <span>
                        <Trans>Delete</Trans>
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </li>
          )}
        </ContextualMenuWrapper>`,
    ],
  ]) ? 1 : 0;
  changed += replaceIfExists(contextualMenuTest, [
    [
      `  describe("As LU I can restore a resource from the contextual menu in trash", () => {
    const props = propsResourceInTrash();
    jest.spyOn(ActionFeedbackContext._currentValue, "displaySuccess").mockImplementation(() => {});

    beforeEach(() => {
      page = new DisplayResourcesListContextualMenuPage(props);
    });

    it("As LU I should see only the restore action for trash resources", () => {
      expect.assertions(12);
      expect(page.restoreItem).not.toBeNull();
      expect(page.copyUsernameItem).toBeNull();
      expect(page.copyPasswordItem).toBeNull();
      expect(page.copyUriItem).toBeNull();
      expect(page.copyPermalinkItem).toBeNull();
      expect(page.copyTotpItem).toBeNull();
      expect(page.openUriItem).toBeNull();
      expect(page.editItem).toBeNull();
      expect(page.shareItem).toBeNull();
      expect(page.deleteItem).toBeNull();
      expect(page.markAsExpiredItem).toBeNull();
      expect(page.setExpiryDateItem).toBeNull();
    });`,
      `  describe("As LU I can restore or delete a resource from the contextual menu in trash", () => {
    const props = propsResourceInTrash();
    jest.spyOn(ActionFeedbackContext._currentValue, "displaySuccess").mockImplementation(() => {});

    beforeEach(() => {
      page = new DisplayResourcesListContextualMenuPage(props);
    });

    it("As LU I should see only the restore and delete actions for trash resources", () => {
      expect.assertions(12);
      expect(page.restoreItem).not.toBeNull();
      expect(page.copyUsernameItem).toBeNull();
      expect(page.copyPasswordItem).toBeNull();
      expect(page.copyUriItem).toBeNull();
      expect(page.copyPermalinkItem).toBeNull();
      expect(page.copyTotpItem).toBeNull();
      expect(page.openUriItem).toBeNull();
      expect(page.editItem).toBeNull();
      expect(page.shareItem).toBeNull();
      expect(page.deleteItem).not.toBeNull();
      expect(page.markAsExpiredItem).toBeNull();
      expect(page.setExpiryDateItem).toBeNull();
    });`,
    ],
  ]) ? 1 : 0;

  changed += replaceIfMissing(contextualMenuTestData, "propsResourceInTrash", [
    [
      `import { defaultResourceWorkspaceContext } from "../../../contexts/ResourceWorkspaceContext.test.data";`,
      `import { defaultResourceWorkspaceContext } from "../../../contexts/ResourceWorkspaceContext.test.data";
import { ResourceWorkspaceFilterTypes } from "../../../contexts/ResourceWorkspaceContext";`,
    ],
    [
      `export function propsResourceWithReadOnlyPermission() {`,
      `export function propsResourceInTrash() {
  return {
    ...defaultProps({
      resourceWorkspaceContext: defaultResourceWorkspaceContext({
        filter: { type: ResourceWorkspaceFilterTypes.TRASH },
      }),
    }),
  };
}

export function propsResourceWithReadOnlyPermission() {`,
    ],
  ]) ? 1 : 0;

  changed += replaceIfMissing(contextualMenuTestPage, "restoreItem", [
    [
      `  get editItem() {
    return this.menu.querySelector("li .row .main-cell-wrapper .main-cell button#edit");
  }`,
      `  get editItem() {
    return this.menu.querySelector("li .row .main-cell-wrapper .main-cell button#edit");
  }

  /**
   * Returns the item.
   * @return {HTMLElement}
   */
  get restoreItem() {
    return this.menu.querySelector("li .row .main-cell-wrapper .main-cell button#restore");
  }`,
    ],
    [
      `  /**
   * Click on the menu edit folder
   */
  async edit() {`,
      `  /**
   * Click on the menu restore resource
   */
  async restore() {
    await this.click(this.restoreItem);
  }

  /**
   * Click on the menu edit folder
   */
  async edit() {`,
    ],
  ]) ? 1 : 0;

  changed += replaceIfMissing(contextualMenuTest, "contextual menu in trash", [
    [
      `  propsResourceExpired,
  propsResourceStandaloneTotp,`,
      `  propsResourceExpired,
  propsResourceInTrash,
  propsResourceStandaloneTotp,`,
    ],
    [
      `  describe("As LU I should be able to access all the offered capabilities on totp resources I have owner access", () => {`,
      `  describe("As LU I can restore or delete a resource from the contextual menu in trash", () => {
    const props = propsResourceInTrash();
    jest.spyOn(ActionFeedbackContext._currentValue, "displaySuccess").mockImplementation(() => {});

    beforeEach(() => {
      page = new DisplayResourcesListContextualMenuPage(props);
    });

    it("As LU I should see only the restore and delete actions for trash resources", () => {
      expect.assertions(12);
      expect(page.restoreItem).not.toBeNull();
      expect(page.copyUsernameItem).toBeNull();
      expect(page.copyPasswordItem).toBeNull();
      expect(page.copyUriItem).toBeNull();
      expect(page.copyPermalinkItem).toBeNull();
      expect(page.copyTotpItem).toBeNull();
      expect(page.openUriItem).toBeNull();
      expect(page.editItem).toBeNull();
      expect(page.shareItem).toBeNull();
      expect(page.deleteItem).not.toBeNull();
      expect(page.markAsExpiredItem).toBeNull();
      expect(page.setExpiryDateItem).toBeNull();
    });

    it("As LU I can restore a resource", async () => {
      expect.assertions(4);
      jest.spyOn(props.context.port, "request").mockImplementationOnce(() => []);

      await page.restore();

      expect(props.context.port.request).toHaveBeenCalledWith("passbolt.resources.restore-all", [props.resource.id]);
      expect(ActionFeedbackContext._currentValue.displaySuccess).toHaveBeenCalledWith(
        "The resource has been restored successfully.",
      );
      expect(props.resourceWorkspaceContext.onResourcesRestored).toHaveBeenCalled();
      expect(props.hide).toHaveBeenCalled();
    });
  });

  describe("As LU I should be able to access all the offered capabilities on totp resources I have owner access", () => {`,
    ],
  ]) ? 1 : 0;

  return changed;
}

function patchAppIframeActionParameter() {
  const appIframe = path.join(root, "node_modules/passbolt-styleguide/src/react-extension/components/InsertAppIframe.js");
  const firstLoadRoute = path.join(root, "node_modules/passbolt-styleguide/src/react-extension/components/Common/Route/HandleApplicationFirstLoadRoute.js");
  let changed = 0;

  changed += replaceIfMissing(appIframe, "getPageAction()", [
    [
      `    if (pathname && pathname !== "/") {
      url.searchParams.append("pathname", pathname);
    }

    this.iframeRef.current.contentWindow.location = url.toString();`,
      `    if (pathname && pathname !== "/") {
      url.searchParams.append("pathname", pathname);
    }

    const action = this.getPageAction();
    if (action) {
      url.searchParams.append("action", action);
    }

    this.iframeRef.current.contentWindow.location = url.toString();`,
    ],
    [
      `  /**
   * Render the component
   * @return {JSX}
   */`,
      `  /**
   * Get the action from url.
   *
   * @returns {string|null} Return null if the action doesn't validate
   */
  getPageAction() {
    const action = new URLSearchParams(this.props.location.search).get("action");
    if (!this.validatePageAction(action)) {
      return null;
    }

    return action;
  }

  /**
   * Validate an action.
   * @param {string|null} action The action to test
   * @returns {boolean}
   */
  validatePageAction(action) {
    return action === "edit";
  }

  /**
   * Render the component
   * @return {JSX}
   */`,
    ],
  ]) ? 1 : 0;

  changed += replaceIfMissing(firstLoadRoute, "getActionFromUrlParameter()", [
    [
      `  /**
   * Validate a pathname.
   * A valid pathname contains only alphabetical, numerical, / and - characters
   * @param {string} pathname The pathname to test
   * @returns {boolean}
   */`,
      `  /**
   * Get the action from the url parameter.
   * @returns {string} If the action does not validate return an empty string.
   */
  getActionFromUrlParameter() {
    const action = new URLSearchParams(this.props.location.search).get("action");

    if (!this.validateAction(action)) {
      return "";
    }

    return action;
  }

  /**
   * Validate an action.
   * @param {string|null} action The action to test
   * @returns {boolean}
   */
  validateAction(action) {
    return action === "edit";
  }

  /**
   * Validate a pathname.
   * A valid pathname contains only alphabetical, numerical, / and - characters
   * @param {string} pathname The pathname to test
   * @returns {boolean}
   */`,
    ],
    [
      `  /**
   * Render the component
   * @return {JSX}
   */`,
      `  /**
   * The first search query to redirect to.
   * @returns {string}
   */
  get searchToRedirectTo() {
    const action = this.getActionFromUrlParameter();
    if (!action) {
      return "";
    }

    return \`?action=\${action}\`;
  }

  /**
   * Render the component
   * @return {JSX}
   */`,
    ],
    [
      `    return <Redirect to={this.pathnameToRedirectTo} />;`,
      `    return <Redirect to={{ pathname: this.pathnameToRedirectTo, search: this.searchToRedirectTo }} />;`,
    ],
  ]) ? 1 : 0;

  return changed;
}

function patchQuickAccessHomePage() {
  const homePage = path.join(root, "node_modules/passbolt-styleguide/src/react-quickaccess/components/HomePage/HomePage.js");
  let changed = 0;

  changed += replaceIfExists(homePage, [
    [
      `import TagV2SVG from "../../../img/svg/tag_v2.svg";
import MetadataKeysSettingsEntity from "../../../shared/models/entity/metadata/metadataKeysSettingsEntity";`,
      `import TagV2SVG from "../../../img/svg/tag_v2.svg";
import DiceSVG from "../../../img/svg/dice.svg";
import MetadataKeysSettingsEntity from "../../../shared/models/entity/metadata/metadataKeysSettingsEntity";`,
    ],
  ]) ? 1 : 0;
  changed += replaceIfMissing(homePage, "canUsePasswordGenerator()", [
    [
      `  /**
   * User has missing keys
   * @return {boolean}
   */
  get userHasMissingKeys() {`,
      `  /**
   * Can use password generator
   * @returns {boolean}
   */
  canUsePasswordGenerator() {
    return this.props.context.siteSettings.canIUse("passwordGenerator");
  }

  /**
   * User has missing keys
   * @return {boolean}
   */
  get userHasMissingKeys() {`,
    ],
  ]) ? 1 : 0;
  changed += replaceIfMissing(homePage, "state: { standalone: true }", [
    [
      `        {this.hasMetadataTypesSettings() && this.canCreatePassword() && (
          <div className="submit-wrapper button-after-list input">
            <Link
              to={\`/webAccessibleResources/quickaccess/resources/\${this.shouldDisplayActionAbortedMissingMetadataKeys ? "action-aborted-missing-metadata-keys" : "create"}\`}
              id="popupAction"
              className="button primary big full-width"
              role="button"
            >
              <Trans>Create new</Trans>
            </Link>
            {this.state.useOnThisTabError && <div className="error-message">{this.state.useOnThisTabError}</div>}
          </div>
        )}`,
      `        {(this.canUsePasswordGenerator() || (this.hasMetadataTypesSettings() && this.canCreatePassword())) && (
          <div className="submit-wrapper button-after-list input">
            {this.canUsePasswordGenerator() && (
              <Link
                to={{
                  pathname: "/webAccessibleResources/quickaccess/resources/generate-password",
                  state: { standalone: true },
                }}
                className="button secondary big full-width"
                role="button"
              >
                <DiceSVG />
                <span>
                  <Trans>Generate password</Trans>
                </span>
              </Link>
            )}
            {this.hasMetadataTypesSettings() && this.canCreatePassword() && (
              <Link
                to={\`/webAccessibleResources/quickaccess/resources/\${this.shouldDisplayActionAbortedMissingMetadataKeys ? "action-aborted-missing-metadata-keys" : "create"}\`}
                id="popupAction"
                className="button primary big full-width"
                role="button"
              >
                <Trans>Create new</Trans>
              </Link>
            )}
            {this.state.useOnThisTabError && <div className="error-message">{this.state.useOnThisTabError}</div>}
          </div>
        )}`,
    ],
  ]) ? 1 : 0;
  changed += replaceIfMissing(homePage, `marginBottom: ".8rem"`, [
    [
      `                className="button secondary big full-width"
                role="button"`,
      `                className="button secondary big full-width"
                style={this.hasMetadataTypesSettings() && this.canCreatePassword() ? { marginBottom: ".8rem" } : null}
                role="button"`,
    ],
  ]) ? 1 : 0;

  return changed;
}

function patchQuickAccessPasskeyResourceLists() {
  const homePage = path.join(root, "node_modules/passbolt-styleguide/src/react-quickaccess/components/HomePage/HomePage.js");
  const quickAccessListPages = [
    "HomePage/HomePage.js",
    "FilterResourcesByFavoritePage/FilterResourcesByFavoritePage.js",
    "FilterResourcesByGroupPage/FilterResourcesByGroupPage.js",
    "FilterResourcesByItemsIOwnPage/FilterResourcesByItemsIOwnPage.js",
    "FilterResourcesByRecentlyModifiedPage/FilterResourcesByRecentlyModifiedPage.js",
    "FilterResourcesBySharedWithMePage/FilterResourcesBySharedWithMePage.js",
    "FilterResourcesByTagPage/FilterResourcesByTagPage.js",
  ].map(file => path.join(root, "node_modules/passbolt-styleguide/src/react-quickaccess/components", file));

  let changed = 0;

  quickAccessListPages.forEach(file => {
    changed += replaceIfMissing(file, "RESOURCE_TYPE_V5_PASSKEY_SLUG", [
      [
        `  RESOURCE_TYPE_PASSWORD_AND_DESCRIPTION_SLUG,
  RESOURCE_TYPE_V5_DEFAULT_SLUG,`,
        `  RESOURCE_TYPE_PASSWORD_AND_DESCRIPTION_SLUG,
  RESOURCE_TYPE_V5_DEFAULT_SLUG,
  RESOURCE_TYPE_V5_PASSKEY_SLUG,`,
      ],
    ]) ? 1 : 0;

    changed += replaceIfMissing(file, "isPasskeyResource(resourceTypeId)", [
      [
        `  isOTPResource(resourceTypeId) {
    return this.props.resourceTypes?.getFirstById(resourceTypeId)?.hasTotp();
  }

  /**
   * Get resource filtered by resource type to have only resource with password and totp`,
        `  isOTPResource(resourceTypeId) {
    return this.props.resourceTypes?.getFirstById(resourceTypeId)?.hasTotp();
  }

  /**
   * Is passkey resource
   * @param {string} resourceTypeId
   * @returns {boolean}
   */
  isPasskeyResource(resourceTypeId) {
    return this.props.resourceTypes?.getFirstById(resourceTypeId)?.slug === RESOURCE_TYPE_V5_PASSKEY_SLUG;
  }

  /**
   * Get resource filtered by resource type to have only resource with password, totp and passkey`,
      ],
      [
        `    const keepOnlyResourcesPasswordAndTotp = (resource) =>
      this.isPasswordResource(resource.resource_type_id) || this.isOTPResource(resource.resource_type_id);`,
        `    const keepOnlyResourcesPasswordAndTotp = (resource) =>
      this.isPasswordResource(resource.resource_type_id) ||
      this.isOTPResource(resource.resource_type_id) ||
      this.isPasskeyResource(resource.resource_type_id);`,
      ],
    ]) ? 1 : 0;
  });

  changed += replaceIfMissing(homePage, "history.push(`/webAccessibleResources/quickaccess/resources/view/${resource.id}`)", [
    [
      `  async handleUseOnThisTabClick(resource) {
    this.setState({ usingOnThisTab: true });
    try {`,
      `  async handleUseOnThisTabClick(resource) {
    if (this.isPasskeyResource(resource.resource_type_id)) {
      this.props.history.push(\`/webAccessibleResources/quickaccess/resources/view/\${resource.id}\`);
      return;
    }

    this.setState({ usingOnThisTab: true });
    try {`,
    ],
  ]) ? 1 : 0;

  return changed;
}

function patchQuickAccessPrepareResourceContext() {
  const prepareResourceContext = path.join(root, "node_modules/passbolt-styleguide/src/react-quickaccess/contexts/PrepareResourceContext.js");
  let changed = 0;

  changed += replaceIfMissing(prepareResourceContext, "USER_GENERATOR_SETTINGS_STORAGE_KEY_PREFIX", [
    [
      `import { withAppContext } from "../../shared/context/AppContext/AppContext";

/**
 * Context related to prepare a resource ( name, url, username, password.)
 */`,
      `import { withAppContext } from "../../shared/context/AppContext/AppContext";

const USER_GENERATOR_SETTINGS_STORAGE_KEY_PREFIX = "passlyQuickAccessPasswordGeneratorSettings";
const GENERATOR_TYPES = ["password", "passphrase"];
const PASSWORD_GENERATOR_MASKS = [
  "mask_upper",
  "mask_lower",
  "mask_digit",
  "mask_parenthesis",
  "mask_emoji",
  "mask_char1",
  "mask_char2",
  "mask_char3",
  "mask_char4",
  "mask_char5",
];
const PASSWORD_GENERATOR_BOOLEAN_FIELDS = [...PASSWORD_GENERATOR_MASKS, "exclude_look_alike_chars"];
const PASSPHRASE_WORD_CASES = ["lowercase", "uppercase", "camelcase"];

function cloneGeneratorSettings(settings) {
  return settings ? JSON.parse(JSON.stringify(settings)) : settings;
}

function toInteger(value, fallback) {
  const parsedValue = Number.parseInt(value, 10);
  return Number.isFinite(parsedValue) ? parsedValue : fallback;
}

function clampInteger(value, min, max, fallback) {
  return Math.min(Math.max(toInteger(value, fallback), min), max);
}

function getUserGeneratorSettingsStorageKey(context) {
  const userId = context.userSettings?.id || context.account?.id || "default";
  return \`\${USER_GENERATOR_SETTINGS_STORAGE_KEY_PREFIX}-\${userId}\`;
}

function mergeSavedPasswordGeneratorSettings(settings, savedSettings) {
  if (!settings || !savedSettings || typeof savedSettings !== "object") {
    return;
  }

  PASSWORD_GENERATOR_BOOLEAN_FIELDS.forEach(field => {
    if (typeof savedSettings[field] === "boolean") {
      settings[field] = savedSettings[field];
    }
  });

  const minLength = toInteger(settings.min_length, 8);
  const maxLength = toInteger(settings.max_length, 128);
  settings.length = clampInteger(savedSettings.length, minLength, maxLength, settings.length);

  if (!PASSWORD_GENERATOR_MASKS.some(mask => settings[mask])) {
    settings.mask_lower = true;
  }
}

function mergeSavedPassphraseGeneratorSettings(settings, savedSettings) {
  if (!settings || !savedSettings || typeof savedSettings !== "object") {
    return;
  }

  const minWords = toInteger(settings.min_words, 4);
  const maxWords = toInteger(settings.max_words, 40);
  settings.words = clampInteger(savedSettings.words, minWords, maxWords, settings.words);

  if (typeof savedSettings.word_separator === "string") {
    settings.word_separator = savedSettings.word_separator.substring(0, 10);
  }

  if (PASSPHRASE_WORD_CASES.includes(savedSettings.word_case)) {
    settings.word_case = savedSettings.word_case;
  }
}

function applySavedGeneratorSettings(passwordPolicies, savedSettings) {
  const settings = cloneGeneratorSettings(passwordPolicies);
  if (!settings || !savedSettings || typeof savedSettings !== "object") {
    return settings;
  }

  if (GENERATOR_TYPES.includes(savedSettings.default_generator)) {
    settings.default_generator = savedSettings.default_generator;
  }

  mergeSavedPasswordGeneratorSettings(settings.password_generator_settings, savedSettings.password_generator_settings);
  mergeSavedPassphraseGeneratorSettings(
    settings.passphrase_generator_settings,
    savedSettings.passphrase_generator_settings,
  );

  return settings;
}

/**
 * Context related to prepare a resource ( name, url, username, password.)
 */`,
    ],
  ]) ? 1 : 0;
  changed += replaceIfMissing(prepareResourceContext, "onGeneratorSettingsChanged: () => {}", [
    [
      `  onPasswordGenerated: () => {}, // Whenever the a password has been generated with the generator
  getSettings: () => {}, // Whenever the settings must be get`,
      `  onPasswordGenerated: () => {}, // Whenever the a password has been generated with the generator
  onGeneratorSettingsChanged: () => {}, // Whenever generator settings have been changed
  getSettings: () => {}, // Whenever the settings must be get`,
    ],
  ]) ? 1 : 0;
  changed += replaceIfMissing(prepareResourceContext, "onGeneratorSettingsChanged: this.onGeneratorSettingsChanged.bind(this)", [
    [
      `      onPasswordGenerated: this.onPasswordGenerated.bind(this), // Whenever the a password has been generated with the generator
      consumePreparedResource: this.consumePreparedResource.bind(this), // Whenever the prepared resource must be get`,
      `      onPasswordGenerated: this.onPasswordGenerated.bind(this), // Whenever the a password has been generated with the generator
      onGeneratorSettingsChanged: this.onGeneratorSettingsChanged.bind(this), // Whenever generator settings have been changed
      consumePreparedResource: this.consumePreparedResource.bind(this), // Whenever the prepared resource must be get`,
    ],
  ]) ? 1 : 0;
  changed += replaceIfMissing(prepareResourceContext, "getSavedSecretGeneratorSettings", [
    [
      `  async resetSecretGeneratorSettings() {
    const passwordPolicies = await this.props.passwordPoliciesContext.loadPolicies();
    this.setState({ settings: passwordPolicies });
  }

  /**
   * Whenever a password has been generated with the generator
   * @param password The generated password
   */
  onPasswordGenerated(newPassword, newGeneratorSettings) {
    this.setState({
      lastGeneratedPassword: newPassword,
      settings: newGeneratorSettings,
    });
  }`,
      `  async resetSecretGeneratorSettings() {
    const passwordPolicies = await this.props.passwordPoliciesContext.loadPolicies();
    const savedSettings = await this.getSavedSecretGeneratorSettings();
    const settings = applySavedGeneratorSettings(passwordPolicies, savedSettings);
    this.setState({ settings });
  }

  /**
   * Returns the user saved generator settings.
   * @returns {Promise<object|null>}
   */
  async getSavedSecretGeneratorSettings() {
    const storage = this.props.context.storage?.local;
    if (!storage) {
      return null;
    }

    try {
      const storageKey = getUserGeneratorSettingsStorageKey(this.props.context);
      const storageData = await storage.get([storageKey]);
      return storageData[storageKey] || null;
    } catch (error) {
      console.error(error);
      return null;
    }
  }

  /**
   * Saves the user generator settings locally.
   * @param {object} generatorSettings The current generator settings.
   * @returns {Promise<void>}
   */
  async saveSecretGeneratorSettings(generatorSettings) {
    const storage = this.props.context.storage?.local;
    if (!storage || !generatorSettings) {
      return;
    }

    try {
      const storageKey = getUserGeneratorSettingsStorageKey(this.props.context);
      await storage.set({ [storageKey]: cloneGeneratorSettings(generatorSettings) });
    } catch (error) {
      console.error(error);
    }
  }

  /**
   * Whenever generator settings have been changed.
   * @param {object} newGeneratorSettings The updated generator settings.
   */
  onGeneratorSettingsChanged(newGeneratorSettings) {
    this.setState({ settings: newGeneratorSettings });
    this.saveSecretGeneratorSettings(newGeneratorSettings);
  }

  /**
   * Whenever a password has been generated with the generator
   * @param password The generated password
   */
  onPasswordGenerated(newPassword, newGeneratorSettings) {
    this.setState({
      lastGeneratedPassword: newPassword,
      settings: newGeneratorSettings,
    });
    this.saveSecretGeneratorSettings(newGeneratorSettings);
  }`,
    ],
  ]) ? 1 : 0;

  return changed;
}

function patchQuickAccessGeneratePasswordPage() {
  const generatePasswordPage = path.join(root, "node_modules/passbolt-styleguide/src/react-quickaccess/components/GeneratePasswordPage/GeneratePasswordPage.js");
  let changed = 0;

  changed += replaceIfMissing(generatePasswordPage, "onGeneratorSettingsChanged?.(generatorSettings)", [
    [
      `  handleGeneratorConfigurationChanged(generatorSettings) {
    const password = this.generatePassword(generatorSettings);
    this.setState({ generatorSettings, password });
  }`,
      `  handleGeneratorConfigurationChanged(generatorSettings) {
    const password = this.generatePassword(generatorSettings);
    this.props.prepareResourceContext.onGeneratorSettingsChanged?.(generatorSettings);
    this.setState({ generatorSettings, password });
  }`,
    ],
  ]) ? 1 : 0;
  changed += replaceIfMissing(generatePasswordPage, "if (this.isStandalone)", [
    [
      `  handleSubmit(event) {
    event.preventDefault();
    this.setState({ processing: true });
    this.props.prepareResourceContext.onPasswordGenerated(this.state.password, this.state.generatorSettings);
    this.props.history.goBack();
  }`,
      `  async handleSubmit(event) {
    event.preventDefault();
    this.setState({ processing: true });

    if (this.isStandalone) {
      await this.handleCopyPassword();
      this.setState({ processing: false });
      return;
    }

    this.props.prepareResourceContext.onPasswordGenerated(this.state.password, this.state.generatorSettings);
    this.props.history.goBack();
  }`,
    ],
  ]) ? 1 : 0;
  changed += replaceIfMissing(generatePasswordPage, "get isStandalone()", [
    [
      `  get translate() {
    return this.props.t;
  }`,
      `  get isStandalone() {
    return Boolean(this.props.location?.state?.standalone);
  }

  get translate() {
    return this.props.t;
  }`,
    ],
  ]) ? 1 : 0;
  changed += replaceIfMissing(generatePasswordPage, "Copy password", [
    [
      `              <Trans>Apply</Trans>
              {this.state.processing && <SpinnerSVG />}`,
      `              {this.isStandalone ? <Trans>Copy password</Trans> : <Trans>Apply</Trans>}
              {this.state.processing && <SpinnerSVG />}`,
    ],
  ]) ? 1 : 0;
  changed += replaceIfMissing(generatePasswordPage, "location: PropTypes.any", [
    [
      `  history: PropTypes.any, // The history router
  t: PropTypes.func, // The translation function`,
      `  history: PropTypes.any, // The history router
  location: PropTypes.any, // The router location
  t: PropTypes.func, // The translation function`,
    ],
  ]) ? 1 : 0;

  return changed;
}

function patchQuickAccessPasswordGeneratorSource() {
  return patchQuickAccessHomePage()
    + patchQuickAccessPasskeyResourceLists()
    + patchQuickAccessPrepareResourceContext()
    + patchQuickAccessGeneratePasswordPage()
    + patchQuickAccessResourceViewPage()
    + patchWorkspaceEditFromQueryAction()
    + patchRecoverableDeleteDialogSource()
    + patchTrashFilterSource()
    + patchTrashRestoreActionsSource()
    + patchAppIframeActionParameter();
}

function patchPasskeyResourceTypeSchemasDefinition() {
  const resourceTypeSchemasDefinition = path.join(root, "node_modules/passbolt-styleguide/src/shared/models/entity/resourceType/resourceTypeSchemasDefinition.js");
  let changed = 0;

  changed += replaceIfMissing(resourceTypeSchemasDefinition, 'RESOURCE_TYPE_V5_PASSKEY_SLUG = "v5-passkey";', [
    [
      `export const RESOURCE_TYPE_V5_STANDALONE_NOTE_SLUG = "v5-note";
export const RESOURCE_TYPE_V5_STANDALONE_PIN_CODE_SLUG = "v5-pin-code";`,
      `export const RESOURCE_TYPE_V5_STANDALONE_NOTE_SLUG = "v5-note";
export const RESOURCE_TYPE_V5_STANDALONE_PIN_CODE_SLUG = "v5-pin-code";
export const RESOURCE_TYPE_V5_PASSKEY_SLUG = "v5-passkey";`,
    ],
  ]) ? 1 : 0;

  changed += replaceIfMissing(resourceTypeSchemasDefinition, "RESOURCE_TYPE_V5_PASSKEY_DEFINITION_SCHEMA", [
    [
      `export const V4_TO_V5_RESOURCE_TYPE_MAPPING = {`,
      `// Plaintext secret schema for slug: "v5-passkey"
const RESOURCE_TYPE_V5_PASSKEY_DEFINITION_SCHEMA = {
  resource: {
    type: "object",
    required: ["name"],
    properties: {
      name: {
        type: "string",
        maxLength: 255,
      },
      username: {
        anyOf: [
          {
            type: "string",
            maxLength: 255,
          },
          {
            type: "null",
          },
        ],
      },
      uris: {
        type: "array",
        items: {
          anyOf: [
            {
              type: "string",
              maxLength: 1024,
            },
            {
              type: "null",
            },
          ],
        },
        maxItems: 32,
      },
      description: {
        anyOf: [
          {
            type: "string",
            maxLength: 10000,
          },
          {
            type: "null",
          },
        ],
      },
      icon: {
        type: "object",
        required: [],
        properties: {
          type: {
            type: "string",
            enum: [ICON_TYPE_KEEPASS_ICON_SET, ICON_TYPE_PASSBOLT_ICON_SET],
          },
          value: {
            type: "integer",
            minimum: 0,
          },
          background_color: {
            anyOf: [
              {
                type: "string",
                pattern: "^#(?:[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$",
              },
              {
                type: "null",
              },
            ],
          },
        },
      },
    },
  },
  secret: {
    type: "object",
    required: [
      "object_type",
      "schema_version",
      "credential_id",
      "rp_id",
      "user_handle",
      "user_name",
      "cose_alg",
      "public_key_cose",
      "private_key_pkcs8",
      "aaguid",
      "backup_eligible",
      "backup_state",
      "sign_count",
    ],
    properties: {
      object_type: {
        type: "string",
        enum: ["PASSLY_PASSKEY"],
      },
      schema_version: {
        type: "integer",
        enum: [1],
      },
      credential_id: {
        type: "string",
        maxLength: 8192,
        pattern: "^[A-Za-z0-9_-]+$",
      },
      rp_id: {
        type: "string",
        maxLength: 253,
      },
      origin: {
        anyOf: [
          {
            type: "string",
            maxLength: 1024,
          },
          {
            type: "null",
          },
        ],
      },
      user_handle: {
        type: "string",
        maxLength: 8192,
        pattern: "^[A-Za-z0-9_-]+$",
      },
      user_name: {
        type: "string",
        maxLength: 255,
      },
      user_display_name: {
        anyOf: [
          {
            type: "string",
            maxLength: 255,
          },
          {
            type: "null",
          },
        ],
      },
      cose_alg: {
        type: "integer",
        enum: [-7],
      },
      public_key_cose: {
        type: "string",
        maxLength: 8192,
        pattern: "^[A-Za-z0-9_-]+$",
      },
      private_key_pkcs8: {
        type: "string",
        maxLength: 8192,
        pattern: "^[A-Za-z0-9_-]+$",
      },
      aaguid: {
        type: "string",
        format: "uuid",
      },
      backup_eligible: {
        type: "boolean",
      },
      backup_state: {
        type: "boolean",
      },
      sign_count: {
        type: "integer",
        minimum: 0,
      },
      transports: {
        type: "array",
        maxItems: 8,
        items: {
          type: "string",
          enum: ["ble", "hybrid", "internal", "nfc", "usb"],
        },
      },
      extensions: {
        type: "object",
        required: [],
        properties: {},
      },
      description: {
        anyOf: [
          {
            type: "string",
            maxLength: 50000,
          },
          {
            type: "null",
          },
        ],
      },
    },
  },
};

export const V4_TO_V5_RESOURCE_TYPE_MAPPING = {`,
    ],
  ]) ? 1 : 0;

  changed += replaceIfMissing(
    resourceTypeSchemasDefinition,
    "[RESOURCE_TYPE_V5_PASSKEY_SLUG]: RESOURCE_TYPE_V5_PASSKEY_DEFINITION_SCHEMA",
    [
      [
        `      [RESOURCE_TYPE_V5_STANDALONE_NOTE_SLUG]: RESOURCE_TYPE_V5_STANDALONE_NOTE_DEFINITION_SCHEMA,
      [RESOURCE_TYPE_V5_STANDALONE_PIN_CODE_SLUG]: RESOURCE_TYPE_V5_STANDALONE_PIN_CODE_DEFINITION_SCHEMA,`,
        `      [RESOURCE_TYPE_V5_STANDALONE_NOTE_SLUG]: RESOURCE_TYPE_V5_STANDALONE_NOTE_DEFINITION_SCHEMA,
      [RESOURCE_TYPE_V5_STANDALONE_PIN_CODE_SLUG]: RESOURCE_TYPE_V5_STANDALONE_PIN_CODE_DEFINITION_SCHEMA,
      [RESOURCE_TYPE_V5_PASSKEY_SLUG]: RESOURCE_TYPE_V5_PASSKEY_DEFINITION_SCHEMA,`,
      ],
    ],
  ) ? 1 : 0;

  return changed;
}

function patchPasskeyDefaultResourceTypeIcon() {
  const defaultIcon = path.join(root, "node_modules/passbolt-styleguide/src/img/passbolt-default-resource-type-icons/passkey.svg");
  const defaultResourceTypeIcons = path.join(root, "node_modules/passbolt-styleguide/src/react-extension/components/Resource/ResourceForm/passboltDefaultResourceTypeIcons.data.js");
  let changed = 0;

  changed += writeIfChanged(defaultIcon, passkeyDefaultResourceTypeIcon) ? 1 : 0;

  changed += replaceIfMissing(defaultResourceTypeIcons, "RESOURCE_TYPE_V5_PASSKEY_SLUG,", [
    [
      `  RESOURCE_TYPE_V5_PASSWORD_STRING_SLUG,
  RESOURCE_TYPE_V5_STANDALONE_NOTE_SLUG,`,
      `  RESOURCE_TYPE_V5_PASSWORD_STRING_SLUG,
  RESOURCE_TYPE_V5_PASSKEY_SLUG,
  RESOURCE_TYPE_V5_STANDALONE_NOTE_SLUG,`,
    ],
  ]) ? 1 : 0;

  changed += replaceIfMissing(defaultResourceTypeIcons, 'import PasskeySVG from "../../../../img/passbolt-default-resource-type-icons/passkey.svg";', [
    [
      `import PasswordWithTotpSVG from "../../../../img/passbolt-default-resource-type-icons/password-with-totp.svg";
import KeyValueSVG from "../../../../img/passbolt-default-resource-type-icons/key-value.svg";`,
      `import PasswordWithTotpSVG from "../../../../img/passbolt-default-resource-type-icons/password-with-totp.svg";
import PasskeySVG from "../../../../img/passbolt-default-resource-type-icons/passkey.svg";
import KeyValueSVG from "../../../../img/passbolt-default-resource-type-icons/key-value.svg";`,
    ],
  ]) ? 1 : 0;

  changed += replaceIfMissing(defaultResourceTypeIcons, "[RESOURCE_TYPE_V5_PASSKEY_SLUG]: <PasskeySVG />", [
    [
      `  [RESOURCE_TYPE_V5_PASSWORD_STRING_SLUG]: <PasswordSVG />,
  [RESOURCE_TYPE_TOTP_SLUG]: <TotpSVG />,`,
      `  [RESOURCE_TYPE_V5_PASSWORD_STRING_SLUG]: <PasswordSVG />,
  [RESOURCE_TYPE_V5_PASSKEY_SLUG]: <PasskeySVG />,
  [RESOURCE_TYPE_TOTP_SLUG]: <TotpSVG />,`,
    ],
  ]) ? 1 : 0;

  return changed;
}

function patchPasskeyResourceTypeEntity() {
  const resourceTypeEntity = path.join(root, "node_modules/passbolt-styleguide/src/shared/models/entity/resourceType/resourceTypeEntity.js");
  let changed = 0;

  changed += replaceIfExists(resourceTypeEntity, [
    [
      `  RESOURCE_TYPE_V5_PASSWORD_STRING_SLUG,
  RESOURCE_TYPE_V5_PASSKEY_SLUG,
];`,
      `  RESOURCE_TYPE_V5_PASSWORD_STRING_SLUG,
];`,
    ],
  ]) ? 1 : 0;

  changed += replaceIfExists(resourceTypeEntity, [
    [
      `  RESOURCE_TYPE_V5_STANDALONE_PIN_CODE_SLUG,
  RESOURCE_TYPE_V5_PASSKEY_SLUG,
];

export const METADATA_DESCRIPTION_RESOURCE_TYPES = [`,
      `  RESOURCE_TYPE_V5_STANDALONE_PIN_CODE_SLUG,
];

export const METADATA_DESCRIPTION_RESOURCE_TYPES = [`,
    ],
  ]) ? 1 : 0;

  changed += replaceIfMissing(resourceTypeEntity, "RESOURCE_TYPE_V5_PASSKEY_SLUG,", [
    [
      `  RESOURCE_TYPE_V5_STANDALONE_NOTE_SLUG,
  RESOURCE_TYPE_V5_STANDALONE_PIN_CODE_SLUG,`,
      `  RESOURCE_TYPE_V5_STANDALONE_NOTE_SLUG,
  RESOURCE_TYPE_V5_STANDALONE_PIN_CODE_SLUG,
  RESOURCE_TYPE_V5_PASSKEY_SLUG,`,
    ],
  ]) ? 1 : 0;

  changed += replaceIfMissing(resourceTypeEntity, "  RESOURCE_TYPE_V5_PASSKEY_SLUG,\n];\n\n// All v5 resource types except PIN code have URIs metadata", [
    [
      `export const METADATA_DESCRIPTION_RESOURCE_TYPES = [
  RESOURCE_TYPE_PASSWORD_STRING_SLUG,
  RESOURCE_TYPE_V5_DEFAULT_SLUG,
  RESOURCE_TYPE_V5_DEFAULT_TOTP_SLUG,
  RESOURCE_TYPE_V5_PASSWORD_STRING_SLUG,
  RESOURCE_TYPE_V5_TOTP_SLUG,
  RESOURCE_TYPE_V5_CUSTOM_FIELDS_SLUG,
  RESOURCE_TYPE_V5_STANDALONE_NOTE_SLUG,
  RESOURCE_TYPE_V5_STANDALONE_PIN_CODE_SLUG,
];`,
      `export const METADATA_DESCRIPTION_RESOURCE_TYPES = [
  RESOURCE_TYPE_PASSWORD_STRING_SLUG,
  RESOURCE_TYPE_V5_DEFAULT_SLUG,
  RESOURCE_TYPE_V5_DEFAULT_TOTP_SLUG,
  RESOURCE_TYPE_V5_PASSWORD_STRING_SLUG,
  RESOURCE_TYPE_V5_TOTP_SLUG,
  RESOURCE_TYPE_V5_CUSTOM_FIELDS_SLUG,
  RESOURCE_TYPE_V5_STANDALONE_NOTE_SLUG,
  RESOURCE_TYPE_V5_STANDALONE_PIN_CODE_SLUG,
  RESOURCE_TYPE_V5_PASSKEY_SLUG,
];`,
    ],
  ]) ? 1 : 0;

  changed += replaceIfMissing(resourceTypeEntity, "  RESOURCE_TYPE_V5_PASSKEY_SLUG,\n];\n\nexport const CUSTOM_FIELDS_RESOURCE_TYPES", [
    [
      `export const METADATA_URIS_RESOURCE_TYPES = [
  RESOURCE_TYPE_V5_DEFAULT_SLUG,
  RESOURCE_TYPE_V5_PASSWORD_STRING_SLUG,
  RESOURCE_TYPE_V5_DEFAULT_TOTP_SLUG,
  RESOURCE_TYPE_V5_TOTP_SLUG,
  RESOURCE_TYPE_V5_CUSTOM_FIELDS_SLUG,
  RESOURCE_TYPE_V5_STANDALONE_NOTE_SLUG,
];`,
      `export const METADATA_URIS_RESOURCE_TYPES = [
  RESOURCE_TYPE_V5_DEFAULT_SLUG,
  RESOURCE_TYPE_V5_PASSWORD_STRING_SLUG,
  RESOURCE_TYPE_V5_DEFAULT_TOTP_SLUG,
  RESOURCE_TYPE_V5_TOTP_SLUG,
  RESOURCE_TYPE_V5_CUSTOM_FIELDS_SLUG,
  RESOURCE_TYPE_V5_STANDALONE_NOTE_SLUG,
  RESOURCE_TYPE_V5_PASSKEY_SLUG,
];`,
    ],
  ]) ? 1 : 0;

  return changed;
}

function patchPasskeySecretDataEntity() {
  const secretDataPasskeyEntity = path.join(root, "node_modules/passbolt-styleguide/src/shared/models/entity/secretData/secretDataV5PasskeyEntity.js");
  const content = `/**
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
 * @since         5.12.0
 */

import SecretDataEntity from "./secretDataEntity";

export const PASSKEY_SECRET_OBJECT_TYPE = "PASSLY_PASSKEY";
export const PASSKEY_SECRET_SCHEMA_VERSION = 1;

class SecretDataV5PasskeyEntity extends SecretDataEntity {
  /**
   * Get the secret data v5 passkey schema
   * @returns {object}
   */
  static getSchema() {
    return {
      type: "object",
      required: [
        "object_type",
        "schema_version",
        "credential_id",
        "rp_id",
        "user_handle",
        "user_name",
        "cose_alg",
        "public_key_cose",
        "private_key_pkcs8",
        "aaguid",
        "backup_eligible",
        "backup_state",
        "sign_count",
      ],
      properties: {
        object_type: {
          type: "string",
          enum: [PASSKEY_SECRET_OBJECT_TYPE],
        },
        schema_version: {
          type: "integer",
          enum: [PASSKEY_SECRET_SCHEMA_VERSION],
        },
        credential_id: {
          type: "string",
          maxLength: 8192,
          pattern: /^[A-Za-z0-9_-]+$/,
        },
        rp_id: {
          type: "string",
          maxLength: 253,
        },
        origin: {
          type: "string",
          maxLength: 1024,
          nullable: true,
        },
        user_handle: {
          type: "string",
          maxLength: 8192,
          pattern: /^[A-Za-z0-9_-]+$/,
        },
        user_name: {
          type: "string",
          maxLength: 255,
        },
        user_display_name: {
          type: "string",
          maxLength: 255,
          nullable: true,
        },
        cose_alg: {
          type: "integer",
          enum: [-7],
        },
        public_key_cose: {
          type: "string",
          maxLength: 8192,
          pattern: /^[A-Za-z0-9_-]+$/,
        },
        private_key_pkcs8: {
          type: "string",
          maxLength: 8192,
          pattern: /^[A-Za-z0-9_-]+$/,
        },
        aaguid: {
          type: "string",
          format: "uuid",
        },
        backup_eligible: {
          type: "boolean",
        },
        backup_state: {
          type: "boolean",
        },
        sign_count: {
          type: "integer",
          minimum: 0,
        },
        transports: {
          type: "array",
          maxItems: 8,
          items: {
            type: "string",
            enum: ["ble", "hybrid", "internal", "nfc", "usb"],
          },
        },
        extensions: {
          type: "object",
          required: [],
          properties: {},
        },
        description: {
          type: "string",
          maxLength: 50000,
          nullable: true,
        },
      },
    };
  }

  /**
   * Return the default secret data v5 passkey.
   * This is only a fallback; passkeys are normally created by the WebAuthn provider.
   * @param {object} data the data to override the default with
   * @param {object} [options] Options.
   * @returns {SecretDataV5PasskeyEntity}
   */
  static createFromDefault(data = {}, options) {
    const defaultData = {
      object_type: PASSKEY_SECRET_OBJECT_TYPE,
      schema_version: PASSKEY_SECRET_SCHEMA_VERSION,
      credential_id: "",
      rp_id: "",
      user_handle: "",
      user_name: "",
      cose_alg: -7,
      public_key_cose: "",
      private_key_pkcs8: "",
      aaguid: "00000000-0000-0000-0000-000000000000",
      backup_eligible: false,
      backup_state: false,
      sign_count: 0,
      transports: ["internal"],
      extensions: {},
    };

    return new SecretDataV5PasskeyEntity({ ...defaultData, ...data }, options);
  }

  /**
   * Are secret different
   * @param secretDto
   * @returns {boolean}
   */
  areSecretsDifferent(secretDto = {}) {
    const current = this.toDto();
    const keys = Array.from(new Set([...Object.keys(current), ...Object.keys(secretDto)])).sort();
    return keys.some((key) => JSON.stringify(current[key] ?? null) !== JSON.stringify(secretDto[key] ?? null));
  }
}

export default SecretDataV5PasskeyEntity;
`;

  const previous = fs.existsSync(secretDataPasskeyEntity) ? fs.readFileSync(secretDataPasskeyEntity, "utf8") : null;
  if (previous === content) {
    return 0;
  }

  fs.writeFileSync(secretDataPasskeyEntity, content);
  return 1;
}

function patchPasskeyResourceFormEntity() {
  const resourceFormEntity = path.join(root, "node_modules/passbolt-styleguide/src/shared/models/entity/resource/resourceFormEntity.js");
  let changed = 0;

  changed += replaceIfMissing(resourceFormEntity, "RESOURCE_TYPE_V5_PASSKEY_SLUG,", [
    [
      `  RESOURCE_TYPE_V5_PASSWORD_STRING_SLUG,
  RESOURCE_TYPE_V5_TOTP_SLUG,`,
      `  RESOURCE_TYPE_V5_PASSWORD_STRING_SLUG,
  RESOURCE_TYPE_V5_PASSKEY_SLUG,
  RESOURCE_TYPE_V5_TOTP_SLUG,`,
    ],
  ]) ? 1 : 0;

  changed += replaceIfMissing(resourceFormEntity, 'import SecretDataV5PasskeyEntity from "../secretData/secretDataV5PasskeyEntity";', [
    [
      `import SecretDataV5StandalonePinCodeEntity from "../secretData/secretDataV5StandalonePinCodeEntity";`,
      `import SecretDataV5StandalonePinCodeEntity from "../secretData/secretDataV5StandalonePinCodeEntity";
import SecretDataV5PasskeyEntity from "../secretData/secretDataV5PasskeyEntity";`,
    ],
  ]) ? 1 : 0;

  changed += replaceIfMissing(resourceFormEntity, "SecretDataV5PasskeyEntity.getSchema()", [
    [
      `            SecretDataV5StandalonePinCodeEntity.getSchema(),
          ],`,
      `            SecretDataV5StandalonePinCodeEntity.getSchema(),
            SecretDataV5PasskeyEntity.getSchema(),
          ],`,
    ],
  ]) ? 1 : 0;

  changed += replaceIfMissing(resourceFormEntity, "case RESOURCE_TYPE_V5_PASSKEY_SLUG:", [
    [
      `      case RESOURCE_TYPE_V5_PASSWORD_STRING_SLUG:
        return SecretDataV5PasswordStringEntity;
      case RESOURCE_TYPE_PASSWORD_AND_DESCRIPTION_SLUG:`,
      `      case RESOURCE_TYPE_V5_PASSWORD_STRING_SLUG:
        return SecretDataV5PasswordStringEntity;
      case RESOURCE_TYPE_V5_PASSKEY_SLUG:
        return SecretDataV5PasskeyEntity;
      case RESOURCE_TYPE_PASSWORD_AND_DESCRIPTION_SLUG:`,
    ],
  ]) ? 1 : 0;

  return changed;
}

function patchPasskeySelectResourceForm() {
  const selectResourceForm = path.join(root, "node_modules/passbolt-styleguide/src/react-extension/components/Resource/ResourceForm/SelectResourceForm.js");
  let changed = 0;

  changed += replaceIfMissing(selectResourceForm, "RESOURCE_TYPE_V5_PASSKEY_SLUG", [
    [
      `import { V4_TO_V5_RESOURCE_TYPE_MAPPING } from "../../../../shared/models/entity/resourceType/resourceTypeSchemasDefinition";`,
      `import {
  RESOURCE_TYPE_V5_PASSKEY_SLUG,
  V4_TO_V5_RESOURCE_TYPE_MAPPING,
} from "../../../../shared/models/entity/resourceType/resourceTypeSchemasDefinition";`,
    ],
  ]) ? 1 : 0;

  changed += replaceIfMissing(selectResourceForm, "get isResourceTypePasskey()", [
    [
      `  get isResourceTypeV5() {
    return this.props.resourceType?.isV5();
  }

  /**
   * Should the 'Metadata' section be displayed`,
      `  get isResourceTypeV5() {
    return this.props.resourceType?.isV5();
  }

  /**
   * Is resource type passkey
   * @returns {boolean}
   */
  get isResourceTypePasskey() {
    return this.props.resourceType?.slug === RESOURCE_TYPE_V5_PASSKEY_SLUG;
  }

  /**
   * Should the 'Metadata' section be displayed`,
    ],
  ]) ? 1 : 0;

  changed += replaceIfMissing(selectResourceForm, "!this.isResourceTypePasskey &&", [
    [
      `    return (
      this.canAddSecretPassword ||`,
      `    return (
      !this.isResourceTypePasskey &&
      (this.canAddSecretPassword ||`,
    ],
    [
      `      this.canAddSecretCustomFields ||
      this.canAddSecretPinCode
    );`,
      `      this.canAddSecretCustomFields ||
      this.canAddSecretPinCode)
    );`,
    ],
  ]) ? 1 : 0;

  return changed;
}

function patchPasskeyResourceTypesCollection() {
  const resourceTypesCollection = path.join(root, "node_modules/passbolt-styleguide/src/shared/models/entity/resourceType/resourceTypesCollection.js");
  let changed = 0;

  changed += replaceIfMissing(resourceTypesCollection, "RESOURCE_TYPE_V5_PASSKEY_SLUG,", [
    [
      `  RESOURCE_TYPE_V5_TOTP_SLUG,
  RESOURCE_TYPE_V5_STANDALONE_NOTE_SLUG,
  RESOURCE_TYPE_V5_STANDALONE_PIN_CODE_SLUG,`,
      `  RESOURCE_TYPE_V5_TOTP_SLUG,
  RESOURCE_TYPE_V5_STANDALONE_NOTE_SLUG,
  RESOURCE_TYPE_V5_STANDALONE_PIN_CODE_SLUG,
  RESOURCE_TYPE_V5_PASSKEY_SLUG,`,
    ],
  ]) ? 1 : 0;

  changed += replaceIfMissing(resourceTypesCollection, "  RESOURCE_TYPE_V5_PASSKEY_SLUG,\n];", [
    [
      `  RESOURCE_TYPE_V5_CUSTOM_FIELDS_SLUG,
  RESOURCE_TYPE_V5_STANDALONE_NOTE_SLUG,
  RESOURCE_TYPE_V5_STANDALONE_PIN_CODE_SLUG,
];`,
      `  RESOURCE_TYPE_V5_CUSTOM_FIELDS_SLUG,
  RESOURCE_TYPE_V5_STANDALONE_NOTE_SLUG,
  RESOURCE_TYPE_V5_STANDALONE_PIN_CODE_SLUG,
  RESOURCE_TYPE_V5_PASSKEY_SLUG,
];`,
    ],
  ]) ? 1 : 0;

  return changed;
}

function patchPasskeyResourceTypeSupport() {
  return patchPasskeySecretDataEntity()
    + patchPasskeyResourceTypeSchemasDefinition()
    + patchPasskeyDefaultResourceTypeIcon()
    + patchPasskeyResourceTypeEntity()
    + patchPasskeyResourceFormEntity()
    + patchPasskeySelectResourceForm()
    + patchPasskeyResourceTypesCollection();
}

function rebrandGeneratedBundles() {
  const generatedBases = [
    "build/all",
    "build/chromium-mv3-unpacked",
    "build/firefox-unpacked",
  ];
  const generatedEntries = [
    "webAccessibleResources/js/dist/app.js",
    "webAccessibleResources/js/dist/login.js",
    "webAccessibleResources/js/dist/setup.js",
    "webAccessibleResources/js/dist/recover.js",
    "webAccessibleResources/js/dist/account-recovery.js",
    "webAccessibleResources/js/dist/quickaccess.js",
  ];
  const generatedFiles = generatedBases.flatMap(base => generatedEntries.map(entry => path.join(root, base, entry)));

  let changed = 0;
  for (const file of generatedFiles) {
    changed += replaceIfExists(file, [
      [`title:"${legacyLogoTitle}"`, 'title:"Passly logo"'],
      [`"${legacyLogoTitle}"`, '"Passly logo"'],
      [`"${legacyLogoDescription}"`, '"This is the logo of Passly."'],
      [`title:"${legacyBrand}"`, 'title:"Passly"'],
      [`"${legacyBrand}"))))`, '"Passly"))))'],
      ['"View it in passbolt"', '"View in the vault"'],
      ['"Edit in passbolt"', '"Edit in the vault"'],
      ["?passlyAction=edit", "?action=edit"],
      ['"passlyAction"', '"action"'],
      ["openPasslyEditResourceFromQuery", "openEditResourceFromQuery"],
      ["removePasslyEditResourceQuery", "removeEditResourceQuery"],
    ]) ? 1 : 0;
  }

  return changed;
}

rebrandStyleguideSource();
patchQuickAccessPasswordGeneratorSource();
patchPasskeyResourceTypeSupport();
patchStyleguideRuntimeLogs();
patchQuickAccessVaultLocales();
rebrandGeneratedBundles();
