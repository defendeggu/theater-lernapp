// Prüft den Service Worker: Version passt zur App, alle App-Dateien sind im Offline-Cache.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { VERSION } from "../public/js/version.js";

const PUBLIC = new URL("../public/", import.meta.url);
const sw = await readFile(new URL("sw.js", PUBLIC), "utf8");
const shell = [...sw.match(/const SHELL = \[([\s\S]*?)\];/)[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);

async function dateien(dir, basis = "") {
  const out = [];
  for (const e of await readdir(new URL(dir, PUBLIC), { withFileTypes: true })) {
    const rel = join(basis || dir, e.name).replaceAll("\\", "/");
    if (e.isDirectory()) out.push(...(await dateien(rel + "/", rel)));
    else out.push(rel);
  }
  return out;
}

test("Service-Worker-Version = App-Version", () => {
  assert.equal(sw.match(/const VERSION = "([^"]+)"/)[1], VERSION);
});

test("alle JS-, CSS- und Icon-Dateien sind im Offline-Cache", async () => {
  const noetig = [...(await dateien("js/")), ...(await dateien("css/")), ...(await dateien("icons/"))];
  for (const f of noetig) assert.ok(shell.includes(f), `fehlt in sw.js SHELL: ${f}`);
  for (const f of ["index.html", "manifest.webmanifest", "./"]) assert.ok(shell.includes(f), f);
});

test("alle Einträge im Offline-Cache existieren", async () => {
  for (const f of shell.filter((x) => x !== "./")) {
    const s = await stat(new URL(f, PUBLIC)).catch(() => null);
    assert.ok(s?.isFile(), `existiert nicht: ${f}`);
  }
});

test("index.html: noindex, Manifest, Apple-Icon", async () => {
  const html = await readFile(new URL("index.html", PUBLIC), "utf8");
  assert.match(html, /name="robots" content="noindex/);
  assert.match(html, /rel="manifest"/);
  assert.match(html, /rel="apple-touch-icon"/);
});
