// Verify CinetPay status using the raw API response. The SDK's PaymentStatus
// mapper currently drops amount and currency, so it cannot safely authorize delivery.
export async function verifyCinetPayPayment({
  transactionId, merchantTransactionId, amount, currency = "XAF",
  apiKey, apiPassword, fetchImpl = fetch
}) {
  if (!transactionId || !merchantTransactionId || !Number.isSafeInteger(Number(amount)) ||
      !apiKey || !apiPassword || currency !== "XAF") return { ok: false, reason: "invalid_expected_values" };

  const baseUrl = apiKey.startsWith("sk_test_")
    ? "https://api.cinetpay.net"
    : apiKey.startsWith("sk_live_")
      ? "https://api.cinetpay.co"
      : null;
  if (!baseUrl) return { ok: false, reason: "unknown_credentials_environment" };

  const authResponse = await fetchImpl(baseUrl + "/v1/oauth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: apiKey, api_password: apiPassword })
  });
  const auth = await authResponse.json().catch(() => ({}));
  if (!authResponse.ok || !auth.access_token) throw new Error("Authentification CinetPay impossible.");

  const statusResponse = await fetchImpl(baseUrl + "/v1/payment/" + encodeURIComponent(transactionId), {
    headers: { Authorization: "Bearer " + auth.access_token }
  });
  const status = await statusResponse.json().catch(() => ({}));
  if (!statusResponse.ok) throw new Error("Vérification du paiement CinetPay impossible.");

  const receivedAmount = Number(status.amount);
  const expectedAmount = Number(amount);
  const ok = status.status === "SUCCESS" &&
    status.transaction_id === transactionId &&
    status.merchant_transaction_id === merchantTransactionId &&
    Number.isFinite(receivedAmount) && receivedAmount === expectedAmount &&
    String(status.currency || "").toUpperCase() === currency;
  return {
    ok,
    reason: ok ? "verified" : "provider_details_mismatch",
    status: status.status || null,
    transactionId: status.transaction_id || null,
    merchantTransactionId: status.merchant_transaction_id || null,
    amount: Number.isFinite(receivedAmount) ? receivedAmount : null,
    currency: status.currency || null
  };
}
