import test from "node:test";
import assert from "node:assert/strict";
import { adaptVercelHandler } from "../netlify/functions/_adapter.mjs";

test("Netlify adapter maps JSON requests and Vercel response helpers", async () => {
  const handler = adaptVercelHandler(async (req, res) => {
    assert.equal(req.method, "POST");
    assert.equal(req.headers.authorization, "Bearer test");
    assert.deepEqual(req.body, { action: "subscription" });
    res.setHeader("Cache-Control", "no-store");
    res.status(201).json({ ok: true });
  });
  const result = await handler({
    httpMethod: "POST",
    headers: { Authorization: "Bearer test" },
    body: JSON.stringify({ action: "subscription" })
  });
  assert.equal(result.statusCode, 201);
  assert.equal(result.headers["Cache-Control"], "no-store");
  assert.deepEqual(JSON.parse(result.body), { ok: true });
});

test("Netlify adapter decodes base64 webhook payloads and preserves plain text", async () => {
  const payload = Buffer.from("notify=abc").toString("base64");
  const handler = adaptVercelHandler(async (req, res) => {
    assert.equal(req.body, "notify=abc");
    res.status(200).send("OK");
  });
  const result = await handler({ httpMethod: "POST", body: payload, isBase64Encoded: true });
  assert.equal(result.statusCode, 200);
  assert.equal(result.body, "OK");
});
