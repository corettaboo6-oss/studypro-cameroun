import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Netlify imports private lessons before deployment", async () => {
  const config = await readFile(new URL("../netlify.toml", import.meta.url), "utf8");
  assert.match(config, /command\s*=\s*"node scripts\/import-private-content\.mjs --apply"/);
  assert.match(config, /functions\s*=\s*"netlify\/functions"/);
});

test("Netlify blocks direct access to all detailed lesson source files", async () => {
  const config = await readFile(new URL("../netlify.toml", import.meta.url), "utf8");
  for (const year of [1, 2, 3]) {
    assert.match(config, new RegExp('from\\s*=\\s*"/lessons-year' + year + '\\.js"'));
  }
  assert.equal((config.match(/status\s*=\s*404/g) || []).length >= 3, true);
  assert.equal((config.match(/force\s*=\s*true/g) || []).length >= 3, true);
});
