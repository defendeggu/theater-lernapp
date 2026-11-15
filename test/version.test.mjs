import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { VERSION } from "../public/js/version.js";

test("Version ist SemVer", () => {
  assert.match(VERSION, /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(-[0-9A-Za-z.-]+)?$/);
});

test("CHANGELOG beginnt mit der aktuellen Version", async () => {
  const log = await readFile(new URL("../CHANGELOG.md", import.meta.url), "utf8");
  const erste = log.match(/^## \[([^\]]+)\]/m)?.[1];
  assert.equal(erste, VERSION, "CHANGELOG.md nachführen");
});
