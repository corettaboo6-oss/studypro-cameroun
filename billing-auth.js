/* STUDYPRO — authentification Supabase et lecture du plan actif.
 * Aucun droit Premium n'est accordé par le navigateur.
 * Les paiements et changements d'abonnement restent réservés au backend.
 */
(function () {
  'use strict';
  let config = window.STUDYPRO_SUPABASE_CONFIG || {};
  const statusEl = document.getElementById('billingAuthStatus');
  const form = document.getElementById('billingAuthForm');
  const fields = document.getElementById('billingAuthFields');
  const logged = document.getElementById('billingLoggedIn');
  const emailEl = document.getElementById('billingEmail');
  const passwordEl = document.getElementById('billingPassword');
  const nameEl = document.getElementById('billingDisplayName');
  const welcomeEl = document.getElementById('billingWelcome');
  const planEl = document.getElementById('billingCurrentPlan');
  const logoutBtn = document.getElementById('billingLogout');
  if (!statusEl || !form) return;

  let client = null;
  let activeSubscription = null;
  const say = message => { statusEl.textContent = message; };

  function displayPlan(row) {
    activeSubscription = row || null;
    if (!planEl) return;
    const plan = row && (row.plan || row.plan_code);
    if (!row || plan === 'free' || row.status !== 'active') {
      planEl.textContent = 'Offre actuelle : Gratuit. Aucun abonnement payant confirmé.';
      return;
    }
    const label = plan === 'premium_plus' ? 'Premium Plus' : 'Premium';
    const date = new Date(row.current_period_end || row.ends_at);
    planEl.textContent = 'Offre actuelle : ' + label + ' · échéance ' +
      (Number.isNaN(date.getTime()) ? 'à confirmer' : date.toLocaleDateString('fr-FR'));
  }

  function setSignedIn(user) {
    const signedIn = !!user;
    fields.hidden = signedIn;
    logged.hidden = !signedIn;
    if (signedIn) {
      const name = user.user_metadata && user.user_metadata.display_name;
      welcomeEl.textContent = 'Compte connecté : ' + (name || user.email || 'étudiant');
    } else {
      welcomeEl.textContent = '';
      displayPlan(null);
    }
  }

  async function refreshPlan() {
    const { data, error: sessionError } = await client.auth.getSession();
    if (sessionError) throw sessionError;
    const session = data && data.session;
    const user = session && session.user;
    if (!user) { setSignedIn(null); return; }
    setSignedIn(user);
    const response = await fetch('/api/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
      body: JSON.stringify({ action: 'subscription' })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Lecture de l’abonnement impossible.');
    displayPlan(payload.subscription || null);
  }

  async function init() {
    // La configuration publique peut être injectée par Vercel sans commiter de clés.
    try {
      const response = await fetch('/api/config', { cache: 'no-store' });
      if (response.ok) {
        const remote = await response.json();
        if (remote && typeof remote.url === 'string' && typeof remote.anonKey === 'string') {
          config = { url: remote.url, anonKey: remote.anonKey };
        }
      }
    } catch (_) { /* GitHub Pages / hors ligne : conserver la configuration locale */ }
    if (!config.url || !config.anonKey) {
      say('Connexion Supabase en attente : configure SUPABASE_URL et SUPABASE_ANON_KEY dans les variables Vercel.');
      form.querySelectorAll('input,button').forEach(node => { node.disabled = true; });
      return;
    }
    if (!window.supabase || typeof window.supabase.createClient !== 'function') {
      say('La bibliothèque Supabase n’a pas pu être chargée. Vérifie la connexion Internet.');
      return;
    }
    try {
      client = window.supabase.createClient(config.url, config.anonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });
      const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
        if (session && session.user) {
          setSignedIn(session.user);
          // Defer DB access to avoid running queries inside the auth callback.
          Promise.resolve().then(() => refreshPlan()).catch(error => say('Compte connecté, mais lecture de l’abonnement impossible : ' + error.message));
        } else {
          setSignedIn(null);
        }
      });
      window.addEventListener('beforeunload', () => subscription.unsubscribe(), { once: true });
      await refreshPlan();
      say('Connexion Supabase établie. Ton statut est vérifié dans la base de données.');
    } catch (error) {
      say('Connexion Supabase impossible : ' + error.message);
    }
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!client) return;
    const action = event.submitter && event.submitter.value;
    const email = emailEl.value.trim();
    const password = passwordEl.value;
    if (!email || password.length < 8) { say('Saisis un e-mail valide et un mot de passe de 8 caractères minimum.'); return; }
    try {
      say('Connexion sécurisée en cours…');
      if (action === 'signup') {
        const displayName = nameEl.value.trim();
        if (displayName.length < 2) { say('Indique ton nom affiché (2 caractères minimum).'); return; }
        const { data, error } = await client.auth.signUp({
          email, password, options: { data: { display_name: displayName } }
        });
        if (error) throw error;
        if (data.session) {
          await refreshPlan();
          say('Compte créé et connecté. Ton offre actuelle est affichée ci-dessous.');
        } else {
          say('Compte créé. Consulte tes e-mails pour confirmer ton adresse avant de te connecter.');
        }
      } else {
        const { error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await refreshPlan();
        say('Connexion réussie.');
      }
    } catch (error) {
      say(error.message || 'Opération impossible. Réessaie.');
    }
  });

  if (logoutBtn) logoutBtn.addEventListener('click', async () => {
    if (!client) return;
    const { error } = await client.auth.signOut();
    if (error) say('Déconnexion impossible : ' + error.message);
    else { displayPlan(null); say('Tu es déconnecté(e).'); }
  });

  window.studyproBilling = Object.freeze({
    refresh: () => client ? refreshPlan() : Promise.reject(new Error('Supabase non configuré')),
    getAccessToken: async () => {
      if (!client) return null;
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      return data && data.session ? data.session.access_token : null;
    },
    get currentSubscription() { return activeSubscription; }
  });
  init();
})();
