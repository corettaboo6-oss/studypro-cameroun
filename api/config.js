// Configuration publique du client Supabase. Aucune clé privée n'est exposée ici.
export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") return res.status(405).json({ error: "Méthode non autorisée." });
  const url = String(process.env.SUPABASE_URL || "").trim().replace(/\/$/, "");
  const anonKey = String(process.env.SUPABASE_ANON_KEY || "").trim();
  if (!url || !anonKey) return res.status(503).json({ error: "Supabase n'est pas encore configuré." });
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || !parsed.hostname.endsWith(".supabase.co")) {
      return res.status(503).json({ error: "URL Supabase invalide." });
    }
  } catch {
    return res.status(503).json({ error: "URL Supabase invalide." });
  }
  return res.status(200).json({ url, anonKey });
}
