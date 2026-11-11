import test from "node:test";
import assert from "node:assert/strict";
import { verifyCinetPayPayment } from "../api/cinetpay-verification.js";

const expected = {
  transactionId: "provider-123",
  merchantTransactionId: "SP123456789",
  amount: 1500,
  currency: "XAF",
  apiKey: "sk_test_key",
  apiPassword: "test-password"
};
function fakeFetch(payloads) {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, options });
    const payload = payloads.shift();
    return { ok: true, json: async () => payload };
  };
  fetchImpl.calls = calls;
  return fetchImpl;
}

test("accepts only exact successful amount, XAF and transaction identifiers", async () => {
  const fetchImpl = fakeFetch([
    { access_token: "jwt" },
    { status: "SUCCESS", transaction_id: "provider-123", merchant_transaction_id: "SP123456789", amount: 1500, currency: "XAF" }
  ]);
  const result = await verifyCinetPayPayment({ ...expected, fetchImpl });
  assert.equal(result.ok, true);
  assert.equal(fetchImpl.calls.length, 2);
  assert.equal(fetchImpl.calls[1].url, "https://api.cinetpay.net/v1/payment/provider-123");
});

for (const [name, patch] of [
  ["wrong amount", { amount: 3000 }],
  ["wrong currency", { currency: "XOF" }],
  ["wrong provider amount", { providerAmount: 1499 }],
  ["wrong provider currency", { providerCurrency: "XOF" }],
  ["wrong transaction id", { transactionId: "other" }],
  ["wrong merchant reference", { merchant_transaction_id: "OTHER" }],
  ["non-success status", { status: "PENDING" }]
]) {
  test("rejects " + name, async () => {
    const provider = {
      status: "SUCCESS", transaction_id: "provider-123",
      merchant_transaction_id: "SP123456789", amount: 1500, currency: "XAF"
    };
    if (patch.providerAmount !== undefined) provider.amount = patch.providerAmount;
    if (patch.providerCurrency !== undefined) provider.currency = patch.providerCurrency;
    if (patch.status) provider.status = patch.status;
    if (patch.transactionId) provider.transaction_id = patch.transactionId;
    if (patch.merchant_transaction_id) provider.merchant_transaction_id = patch.merchant_transaction_id;
    const result = await verifyCinetPayPayment({
      ...expected, ...(patch.amount !== undefined ? { amount: patch.amount } : {}),
      ...(patch.currency ? { currency: patch.currency } : {}),
      fetchImpl: fakeFetch([{ access_token: "jwt" }, provider])
    });
    assert.equal(result.ok, false);
  });
}

test("fails closed when provider omits amount or currency", async () => {
  const result = await verifyCinetPayPayment({
    ...expected,
    fetchImpl: fakeFetch([{ access_token: "jwt" }, {
      status: "SUCCESS", transaction_id: "provider-123", merchant_transaction_id: "SP123456789"
    }])
  });
  assert.equal(result.ok, false);
});

test("rejects credentials with an unknown environment prefix", async () => {
  const result = await verifyCinetPayPayment({
    ...expected, apiKey: "not-a-cinetpay-key",
    fetchImpl: async () => { throw new Error("must not fetch"); }
  });
  assert.equal(result.ok, false);
});
