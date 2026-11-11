/* STUDYPRO — authentification Supabase et lecture du plan actif.
 * Aucun droit Premium n'est accordé par le navigateur.
 * Les paiements et changements d'abonnement restent réservés au backend.
 */
(function () {
  'use strict';
  const config = window.STUDYPRO_SUPABASE_CONFIG || {};
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
    if (!row) {
      planEl.textContent = 'Offre actuelle : Gratuit. Aucun abonnement payant confirmé.';
      return;
    }
    const label = row.plan_code === 'premium_plus' ? 'Premium Plus' : 'Premium';
    const date = new Date(row.ends_at);
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
    const { data: { user }, error: userError } = await client.auth.getUser();
    if (userError) throw userError;
    if (!user) { setSignedIn(null); return; }
    setSignedIn(user);
    const { data, error } = await client
      .from('billing_subscriptions')
      .select('plan_code,status,starts_at,ends_at')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .gt('ends_at', new Date().toISOString())
      .order('ends_at', { ascending: false })
      .limit(1);
    if (error) throw error;
    displayPlan(data && data.length ? data[0] : null);
  }

  async function init() {
    if (!config.url || !config.anonKey) {
      say('Connexion Supabase en attente : ajoute l’URL du projet et la clé publique anon dans supabase-config.js.');
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
    get currentSubscription() { return activeSubscription; }
  });
  init();
})();
