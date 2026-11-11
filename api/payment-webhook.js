import { CinetPayClient, verifyNotification, parseNotification } from "cinetpay-js";

const env = name => String(process.env[name] || "").trim();
const base = () => env("SUPABASE_URL").replace(/\/$/, "");
async function db(path, options = {}) {
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!key || !base()) throw new Error("Supabase service configuration missing.");
  const response = await fetch(base() + path, {
    ...options,
    headers: { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json", ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Database error");
  return data;
}
function client() {
  const apiKey = env("CINETPAY_API_KEY_CM") || env("CINETPAY_API_KEY");
  const apiPassword = env("CINETPAY_API_PASSWORD_CM") || env("CINETPAY_API_PASSWORD");
  if (!apiKey || !apiPassword) throw new Error("CinetPay credentials missing.");
  return new CinetPayClient({ credentials: { CM: { apiKey, apiPassword } }, timeout: 20000 });
}
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).send("Method not allowed");
  try {
    const notification = parseNotification(req.body);
    const rows = await db("/rest/v1/studypro_payment_orders?select=*&merchant_transaction_id=eq." +
      encodeURIComponent(notification.merchantTransactionId) + "&limit=1");
    const order = rows[0];
    if (!order || !order.notify_token || !verifyNotification(order.notify_token, notification.notifyToken)) {
      return res.status(401).send("Invalid notification");
    }
    if (order.status === "succeeded") return res.status(200).send("Already processed");
    if (order.provider_transaction_id !== notification.transactionId) return res.status(409).send("Transaction mismatch");
    const status = await client().payment.getStatus(notification.transactionId, "CM");
    if (status.status !== "SUCCESS") {
      if (["FAILED", "EXPIRED", "INSUFFICIENT_BALANCE"].includes(status.status)) {
        await db("/rest/v1/studypro_payment_orders?merchant_transaction_id=eq." + encodeURIComponent(order.merchant_transaction_id), {
          method: "PATCH", headers: { Prefer: "return=minimal" },
          body: JSON.stringify({ status: "failed" })
        });
      }
      return res.status(200).send("Payment not successful");
    }
    if (status.merchantTransactionId !== order.merchant_transaction_id ||
        status.transactionId !== order.provider_transaction_id) return res.status(409).send("Provider verification mismatch");
    await db("/rest/v1/rpc/studypro_activate_subscription", {
      method: "POST",
      body: JSON.stringify({
        p_merchant_transaction_id: order.merchant_transaction_id,
        p_provider_transaction_id: order.provider_transaction_id,
        p_user_id: order.user_id,
        p_plan: order.plan,
        p_amount: order.amount,
        p_currency: "XAF"
      })
    });
    return res.status(200).send("OK");
  } catch (error) {
    console.error("STUDYPRO CinetPay webhook:", error?.message || "unknown");
    return res.status(400).send("Invalid webhook");
  }
}
