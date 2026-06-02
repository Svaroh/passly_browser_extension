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
const changedBundles = rebrandGeneratedBundles();
console.log(`Passly styleguide rebrand applied (${changedSources} source files, ${changedBundles} generated files changed).`);
