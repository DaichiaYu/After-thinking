"use strict";
// Checks the string files: same keys and placeholders in every locale, every key used in code exists,
// and formatting (arguments, plural choice, stored language) behaves as documented in i18n.js.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const dir = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(dir, f), "utf8");
const LOCALES = ["zh-TW", "en"];
const SOURCES = ["tag.js", "tag-ai.js", "tag-review.js", "tag-workspace.js", "tag-workspace-data.js", "tag-attachments.js", "list.js", "labels.js"];

function load(sandbox) {
  const dicts = {};
  const context = Object.assign({}, sandbox);
  vm.createContext(context);
  vm.runInContext(read("i18n.js") + "\nglobalThis.ATI18n = ATI18n;", context);
  const add = context.ATI18n.add;
  context.ATI18n.add = (lang, strings) => { dicts[lang] = Object.assign(dicts[lang] || {}, strings); add(lang, strings); };
  for (const lang of LOCALES) vm.runInContext(read("locales/" + lang + ".js"), context);
  return { i18n: context.ATI18n, dicts };
}
const placeholders = (s) => [...new Set((s.match(/\{(\d+)/g) || []).map((x) => x.slice(1)))].sort().join(",");

test("every locale has the same keys and the same placeholders", () => {
  const { dicts } = load();
  const base = Object.keys(dicts["zh-TW"]).sort();
  for (const lang of LOCALES) {
    assert.deepEqual(Object.keys(dicts[lang]).sort(), base, lang + " keys differ from zh-TW");
    for (const k of base) assert.equal(placeholders(dicts[lang][k]), placeholders(dicts["zh-TW"][k]), lang + " placeholders differ for " + k);
  }
});

test("every key used in scripts and tag.html exists", () => {
  const { dicts } = load();
  const used = new Set();
  for (const f of SOURCES) for (const m of read(f).matchAll(/\bT\(\s*"([^"]+)"/g)) used.add(m[1]);
  for (const m of read("tag.html").matchAll(/data-i18n(?:-[a-z-]+)?="([^"]+)"/g)) used.add(m[1]);
  assert.ok(used.size > 400, "expected the scripts to use the string files");
  const missing = [...used].filter((k) => !(k in dicts["zh-TW"]));
  assert.deepEqual(missing, []);
});

test("language follows the saved choice, then the browser language", () => {
  assert.equal(load().i18n.lang, "zh-TW");
  assert.equal(load({ navigator: { language: "en-US" } }).i18n.lang, "en");
  assert.equal(load({ navigator: { language: "zh-CN" } }).i18n.lang, "zh-TW");
  assert.equal(load({ navigator: { language: "en-US" }, localStorage: { getItem: () => "zh-TW" } }).i18n.lang, "zh-TW");
});

test("arguments, plural choice and the stored language", () => {
  const { i18n } = load({ navigator: { language: "en-US" } });
  assert.equal(i18n.t("tag.n_messages", 1), "1 message");
  assert.equal(i18n.t("tag.n_messages", 3), "3 messages");
  assert.equal(i18n.stored(() => i18n.t("tag.n_messages", 3)), "3 則");
  assert.equal(i18n.lang, "en");
  assert.equal(i18n.t("no.such.key"), "no.such.key");
});
