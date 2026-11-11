// STUDYPRO — contenu Premium privé
import { canAccessContent, hasActivePaidSubscription } from "./content-access.js";
const env = name => String(process.env[name] || "").trim();
const json = (res, status, data) => res.status(status).json(data);
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, private");
  if (req.method !== "GET") return json(res, 405, { error: "Méthode non autorisée." });
  const url = env("SUPABASE_URL").replace(/\/$/, "");
  const anon = env("SUPABASE_ANON_KEY");
  const service = env("SUPABASE_SERVICE_ROLE_KEY");
  const bearer = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!url || !anon || !service || !bearer) return json(res, 401, { error: "Connecte-toi avec un compte étudiant." });
  try {
    const auth = await fetch(url + "/auth/v1/user", { headers: { apikey: anon, Authorization: "Bearer " + bearer } });
    if (!auth.ok) return json(res, 401, { error: "Session invalide." });
    const user = await auth.json();
    const headers = { apikey: service, Authorization: "Bearer " + service };
    const subRes = await fetch(url + "/rest/v1/studypro_subscriptions?select=plan,status,current_period_end&user_id=eq." +
      encodeURIComponent(user.id) + "&limit=1", { headers });
    if (!subRes.ok) throw new Error("Impossible de vérifier l'abonnement.");
    const subscriptions = await subRes.json();
    const sub = subscriptions[0];
    if (!hasActivePaidSubscription(sub)) {
      return json(res, 403, { error: "Un abonnement Premium actif est nécessaire pour consulter ce contenu." });
    }
    const contentRes = await fetch(url + "/rest/v1/studypro_premium_content?select=content_key,title,required_plan,body&published=eq.true&order=updated_at.desc", { headers });
    if (!contentRes.ok) throw new Error("Impossible de charger les contenus Premium.");
    const contents = await contentRes.json();
    const allowed = contents.filter(item => canAccessContent(sub, item));
    return json(res, 200, { plan: sub.plan, contents: allowed });
  } catch (error) {
    console.error("STUDYPRO premium content:", error?.message || "unknown");
    return json(res, 502, { error: "Le contenu Premium est momentanément indisponible." });
  }
}
