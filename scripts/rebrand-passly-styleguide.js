#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const legacyBrand = "Pass" + "bolt";
const legacyBrandLower = legacyBrand.toLowerCase();
const legacyLogoTitle = `${legacyBrand} logo`;
const legacyLogoDescription = `This is the logo of ${legacyBrandLower}.`;

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

function rebrandStyleguideSource() {
  const logoSvg = path.join(root, "node_modules/passbolt-styleguide/src/img/svg/logo.svg");
  const logoComponent = path.join(root, "node_modules/passbolt-styleguide/src/react-extension/components/Common/Navigation/Header/Logo.js");
  let changed = 0;

  changed += writeIfChanged(logoSvg, passlyInlineLogo) ? 1 : 0;
  changed += replaceIfExists(logoComponent, [
    [`title="${legacyLogoTitle}"`, 'title="Passly logo"'],
    [`<span>${legacyBrand}</span>`, "<span>Passly</span>"],
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
  return patchQuickAccessHomePage() + patchQuickAccessPrepareResourceContext() + patchQuickAccessGeneratePasswordPage();
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
    ]) ? 1 : 0;
  }

  return changed;
}

const changedSources = rebrandStyleguideSource();
const changedQuickAccessPatches = patchQuickAccessPasswordGeneratorSource();
const changedBundles = rebrandGeneratedBundles();
console.log(`Passly styleguide rebrand applied (${changedSources} source files, ${changedQuickAccessPatches} quickaccess patches, ${changedBundles} generated files changed).`);
