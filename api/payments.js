import { randomUUID } from "node:crypto";
import { CinetPayClient } from "cinetpay-js";
import { verifyCinetPayPayment } from "./cinetpay-verification.js";

const PLANS = {
  premium: { name: "Premium", amount: 1500, days: 30 },
  premium_plus: { name: "Premium Plus", amount: 3000, days: 30 }
};
const json = (res, status, data) => res.status(status).json(data);
const env = name => String(process.env[name] || "").trim();
const supabaseUrl = () => env("SUPABASE_URL").replace(/\/$/, "");
const anonKey = () => env("SUPABASE_ANON_KEY");
const serviceKey = () => env("SUPABASE_SERVICE_ROLE_KEY");

function cinetpay() {
  const apiKey = env("CINETPAY_API_KEY_CM") || env("CINETPAY_API_KEY");
  const apiPassword = env("CINETPAY_API_PASSWORD_CM") || env("CINETPAY_API_PASSWORD");
  if (!apiKey || !apiPassword) throw new Error("CinetPay n'est pas configuré côté serveur.");
  return new CinetPayClient({ credentials: { CM: { apiKey, apiPassword } }, timeout: 20000 });
}
async function db(path, options = {}) {
  const key = serviceKey();
  if (!key || !supabaseUrl()) throw new Error("La base Supabase de monétisation n'est pas configurée.");
  const response = await fetch(supabaseUrl() + path, {
    ...options,
    headers: {
      apikey: key,
      Authorization: "Bearer " + key,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || data.msg || data.error || "Erreur de base de données.");
  return data;
}
async function authenticate(req) {
  const bearer = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!bearer || bearer.length > 4096 || !supabaseUrl() || !anonKey()) return null;
  const response = await fetch(supabaseUrl() + "/auth/v1/user", {
    headers: { apikey: anonKey(), Authorization: "Bearer " + bearer }
  });
  if (!response.ok) return null;
  return response.json();
}
async function orderByReference(reference) {
  const rows = await db("/rest/v1/studypro_payment_orders?select=*&merchant_transaction_id=eq." +
    encodeURIComponent(reference) + "&limit=1");
  return rows[0] || null;
}
async function activateVerifiedOrder(order) {
  if (!order || !order.provider_transaction_id) return false;
  const apiKey = env("CINETPAY_API_KEY_CM") || env("CINETPAY_API_KEY");
  const apiPassword = env("CINETPAY_API_PASSWORD_CM") || env("CINETPAY_API_PASSWORD");
  const verification = await verifyCinetPayPayment({
    transactionId: order.provider_transaction_id,
    merchantTransactionId: order.merchant_transaction_id,
    amount: Number(order.amount),
    currency: order.currency,
    apiKey,
    apiPassword
  });
  if (!verification.ok) return verification;
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
  return { ok: true, status: "SUCCESS" };
}
function siteOrigin() {
  const configured = env("STUDYPRO_ALLOWED_ORIGIN").replace(/\/+$/, "");
  if (!configured) return "";
  try {
    const parsed = new URL(configured);
    if (parsed.protocol !== "https:" || parsed.origin !== configured) return "";
    return parsed.origin;
  } catch {
    return "";
  }
}
async function handleCreate(req, res, user) {
  const planId = String(req.body?.plan || "");
  const plan = PLANS[planId];
  if (!plan) return json(res, 400, { error: "Formule inconnue." });
  const origin = siteOrigin();
  if (!origin) return json(res, 503, { error: "URL publique HTTPS non configurée." });
  const email = String(user.email || "");
  if (!email) return json(res, 400, { error: "Adresse e-mail du compte introuvable." });
  const reference = "SP" + randomUUID().replace(/-/g, "").slice(0, 28);
  const displayName = String(user.user_metadata?.display_name || "Étudiant").trim().slice(0, 32);
  const names = displayName.split(/\s+/);
  const firstNameRaw = (names.shift() || "Etudiant").slice(0, 80);
  const firstName = firstNameRaw.length >= 2 ? firstNameRaw : "Etudiant";
  const lastName = (names.join(" ") || "Studypro").slice(0, 80);
  await db("/rest/v1/studypro_payment_orders", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      merchant_transaction_id: reference,
      user_id: user.id,
      plan: planId,
      amount: plan.amount,
      currency: "XAF",
      status: "pending"
    })
  });
  try {
    const payment = await cinetpay().payment.initialize({
      currency: "XAF",
      merchantTransactionId: reference,
      amount: plan.amount,
      lang: "fr",
      designation: "STUDYPRO " + plan.name + " - 30 jours",
      clientEmail: email,
      clientFirstName: firstName,
      clientLastName: lastName,
      successUrl: origin + "/?paiement=retour&reference=" + reference,
      failedUrl: origin + "/?paiement=echec&reference=" + reference,
      notifyUrl: origin + "/api/payment-webhook",
      channel: "PUSH"
    }, "CM");
    await db("/rest/v1/studypro_payment_orders?merchant_transaction_id=eq." + encodeURIComponent(reference), {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        provider_transaction_id: payment.transactionId,
        payment_token: payment.paymentToken,
        notify_token: payment.notifyToken,
        status: "pending"
      })
    });
    if (!payment.paymentUrl) throw new Error("CinetPay n'a pas fourni de lien de paiement.");
    return json(res, 200, { checkout_url: payment.paymentUrl, reference, status: payment.details?.status || "PENDING" });
  } catch (error) {
    await db("/rest/v1/studypro_payment_orders?merchant_transaction_id=eq." + encodeURIComponent(reference), {
      method: "PATCH", headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ status: "failed" })
    }).catch(() => {});
    throw error;
  }
}
async function handleStatus(req, res, user) {
  const reference = String(req.body?.reference || "").slice(0, 40);
  if (!reference) return json(res, 400, { error: "Référence de paiement manquante." });
  const order = await orderByReference(reference);
  if (!order || order.user_id !== user.id) return json(res, 404, { error: "Paiement introuvable." });
  if (order.status === "succeeded") return json(res, 200, { status: "SUCCESS", plan: order.plan });
  if (!order.provider_transaction_id) return json(res, 200, { status: order.status.toUpperCase() });
  const activated = await activateVerifiedOrder(order);
  if (activated.ok) return json(res, 200, { status: "SUCCESS", plan: order.plan });
  if (activated.status === "SUCCESS") {
    return json(res, 409, { error: "Le montant, la devise ou les identifiants confirmés par CinetPay ne correspondent pas à cette commande." });
  }
  return json(res, 200, { status: activated.status || "PENDING" });
}
async function handleSubscription(res, user) {
  const rows = await db("/rest/v1/studypro_subscriptions?select=plan,status,current_period_start,current_period_end&user_id=eq." +
    encodeURIComponent(user.id) + "&limit=1");
  const row = rows[0];
  if (!row || row.current_period_end && new Date(row.current_period_end) <= new Date()) {
    return json(res, 200, { subscription: { plan: "free", status: "active", current_period_end: null } });
  }
  return json(res, 200, { subscription: row });
}
async function handleAdmin(res, user) {
  const allowed = env("STUDYPRO_ADMIN_EMAILS").split(",").map(x => x.trim().toLowerCase()).filter(Boolean);
  if (!allowed.includes(String(user.email || "").toLowerCase())) return json(res, 403, { error: "Accès administrateur réservé." });
  const summary = await db("/rest/v1/rpc/studypro_admin_revenue_summary", { method: "POST", body: "{}" });
  const rows = await db("/rest/v1/studypro_payment_orders?select=merchant_transaction_id,plan,amount,currency,status,created_at,paid_at&order=created_at.desc&limit=100");
  return json(res, 200, {
    total_xaf: Number(summary.total_xaf || 0),
    successful_payments: Number(summary.successful_payments || 0),
    pending_payments: Number(summary.pending_payments || 0),
    by_plan: summary.by_plan || {},
    recent: rows.map(({ merchant_transaction_id, plan, amount, currency, status, created_at, paid_at }) =>
      ({ reference: merchant_transaction_id, plan, amount, currency, status, created_at, paid_at }))
  });
}
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return json(res, 405, { error: "Méthode non autorisée." });
  const user = await authenticate(req);
  if (!user?.id) return json(res, 401, { error: "Connecte-toi avec ton compte étudiant." });
  try {
    const action = String(req.body?.action || "");
    if (action === "create") return await handleCreate(req, res, user);
    if (action === "status") return await handleStatus(req, res, user);
    if (action === "subscription") return await handleSubscription(res, user);
    if (action === "admin") return await handleAdmin(res, user);
    return json(res, 400, { error: "Action inconnue." });
  } catch (error) {
    console.error("STUDYPRO payment error:", error?.message || "unknown");
    return json(res, 502, { error: error?.message || "Le service de paiement est momentanément indisponible." });
  }
}
