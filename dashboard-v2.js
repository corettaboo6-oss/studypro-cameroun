/* STUDYPRO CAMEROUN — tableau de bord V2
 * Les données restent sur l'appareil de l'étudiant (localStorage).
 * Ce module ne crée pas de compte et n'envoie aucune donnée à un serveur.
 */
(() => {
  'use strict';
  const STORAGE_KEY = 'studyproV2Profile';
  const REWARDS_KEY = 'studyproRewards';
  const read = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch (_) { return fallback; }
  };
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const styles = `
    #dashboard-v2{padding:28px 7%;scroll-margin-top:90px}
    #dashboard-v2 .dash-shell{background:linear-gradient(145deg,#1b2850,#111a37);border:1px solid #40558b;border-radius:18px;padding:20px;box-shadow:0 12px 30px #0003}
    #dashboard-v2 .dash-head{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
    #dashboard-v2 .dash-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px;margin-top:16px}
    #dashboard-v2 .dash-card{background:#101a38;border:1px solid #344879;border-radius:13px;padding:15px}
    #dashboard-v2 .dash-value{display:block;color:#5ce8e0;font-size:1.65rem;font-weight:800}
    #dashboard-v2 .dash-muted{color:#b9c8e8;font-size:.9rem}
    #dashboard-v2 label{display:block;margin:12px 0 5px;font-weight:700}
    #dashboard-v2 input{width:100%;max-width:360px;padding:11px;border-radius:9px;border:1px solid #52679a;background:#0d1733;color:#fff;font:inherit}
    #dashboard-v2 button,#dashboard-v2 .dash-link{display:inline-block;margin:8px 8px 0 0;padding:10px 14px;border:1px solid #6cebe2;border-radius:9px;background:linear-gradient(110deg,#00cbbd,#377bff);color:#07162d;font-weight:800;text-decoration:none;cursor:pointer}
    #dashboard-v2 .dash-secondary{background:#18274a;color:#eaf2ff;border-color:#52679a}
    #dashboard-v2 .dash-progress{height:11px;border-radius:20px;background:#0a1229;overflow:hidden;margin-top:10px}
    #dashboard-v2 .dash-progress span{display:block;height:100%;background:linear-gradient(90deg,#00d4c7,#8b5cf6);width:0}
    #dashboard-v2 .dash-status{min-height:1.4em;color:#9cebe4}
  `;
  const style = el('style');
  style.textContent = styles;
  document.head.appendChild(style);

  function render() {
    if (document.getElementById('dashboard-v2')) return;
    const anchor = document.getElementById('programme');
    if (!anchor) return;
    const section = el('section');
    section.id = 'dashboard-v2';
    section.setAttribute('aria-labelledby', 'dashboard-v2-title');
    const shell = el('div', 'dash-shell');
    const head = el('div', 'dash-head');
    const heading = el('div');
    heading.append(el('h2', '', '🎓 Mon espace étudiant'), el('p', 'dash-muted', 'Un aperçu de tes révisions sur cet appareil.'));
    head.append(heading);
    const refresh = el('button', 'dash-secondary', '↻ Actualiser');
    refresh.type = 'button';
    refresh.addEventListener('click', updateStats);
    head.append(refresh);
    shell.append(head);

    const profileCard = el('div', 'dash-card');
    const profileTitle = el('h3', '', 'Mon profil');
    const profileLabel = el('label', '', 'Prénom ou pseudonyme');
    profileLabel.htmlFor = 'studypro-student-name';
    const profileInput = el('input');
    profileInput.id = 'studypro-student-name';
    profileInput.name = 'student-name';
    profileInput.maxLength = 40;
    profileInput.autocomplete = 'nickname';
    profileInput.placeholder = 'Ex. : Étudiant(e) IDE';
    const save = el('button', '', 'Enregistrer mon profil');
    save.type = 'button';
    const status = el('p', 'dash-status', '');
    status.setAttribute('aria-live', 'polite');
    const profile = read(STORAGE_KEY, { name: '' });
    profileInput.value = typeof profile.name === 'string' ? profile.name : '';
    save.addEventListener('click', () => {
      const value = profileInput.value.trim().slice(0, 40);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ name: value }));
      status.textContent = value ? 'Profil enregistré sur cet appareil.' : 'Nom effacé.';
    });
    profileCard.append(profileTitle, profileLabel, profileInput, save, status);
    shell.append(profileCard);

    const grid = el('div', 'dash-grid');
    const pointsCard = el('div', 'dash-card');
    pointsCard.append(el('span', 'dash-muted', 'Mes points'), el('strong', 'dash-value', '0'));
    pointsCard.dataset.metric = 'points';
    const lessonsCard = el('div', 'dash-card');
    lessonsCard.append(el('span', 'dash-muted', 'Leçons terminées'), el('strong', 'dash-value', '0'));
    lessonsCard.dataset.metric = 'lessons';
    const levelCard = el('div', 'dash-card');
    levelCard.append(el('span', 'dash-muted', 'Niveau actuel'), el('strong', 'dash-value', '1'));
    levelCard.dataset.metric = 'level';
    grid.append(pointsCard, lessonsCard, levelCard);
    shell.append(grid);

    const goalCard = el('div', 'dash-card');
    goalCard.style.marginTop = '12px';
    goalCard.append(el('h3', '', '🎯 Objectif de progression'));
    const goalLabel = el('label', '', 'Objectif de points à atteindre');
    goalLabel.htmlFor = 'studypro-goal';
    const goalInput = el('input');
    goalInput.id = 'studypro-goal';
    goalInput.type = 'number';
    goalInput.min = '10';
    goalInput.max = '5000';
    goalInput.step = '10';
    goalInput.value = String(Math.max(10, Number(profile.goal) || 100));
    const progress = el('div', 'dash-progress');
    const fill = el('span');
    progress.append(fill);
    const goalText = el('p', 'dash-muted', '');
    goalText.id = 'studypro-goal-text';
    goalInput.addEventListener('change', () => {
      const next = Math.min(5000, Math.max(10, Number(goalInput.value) || 100));
      goalInput.value = String(next);
      const saved = read(STORAGE_KEY, { name: '' });
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ name: saved.name || '', goal: next }));
      updateStats();
    });
    goalCard.append(goalLabel, goalInput, progress, goalText);
    shell.append(goalCard);

    const actions = el('div');
    actions.append(
      Object.assign(el('a', 'dash-link', '📚 Reprendre les cours'), { href: '#cours' }),
      Object.assign(el('a', 'dash-link', '📝 Faire un QCM'), { href: '#evaluation' })
    );
    const exportButton = el('button', 'dash-secondary', 'Exporter mes données');
    exportButton.type = 'button';
    exportButton.addEventListener('click', () => {
      const payload = {
        exportedAt: new Date().toISOString(),
        profile: read(STORAGE_KEY, {}),
        rewards: read(REWARDS_KEY, { points: 0, completed: [], quizDone: [] })
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = el('a');
      link.href = url;
      link.download = 'studypro-mes-donnees.json';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    });
    actions.append(exportButton);
    shell.append(actions);
    shell.append(el('p', 'dash-muted', 'Confidentialité : ton profil et ta progression sont enregistrés uniquement dans le stockage local de ce navigateur. Ils ne sont pas synchronisés entre appareils et peuvent être perdus si les données du navigateur sont effacées.'));
    section.append(shell);
    anchor.insertAdjacentElement('afterend', section);
    updateStats();
  }

  function updateStats() {
    const section = document.getElementById('dashboard-v2');
    if (!section) return;
    const rewards = read(REWARDS_KEY, { points: 0, completed: [] });
    const points = Number(rewards.points) || 0;
    const completed = Array.isArray(rewards.completed) ? rewards.completed.length : 0;
    const level = Math.floor(points / 50) + 1;
    section.querySelector('[data-metric="points"] .dash-value').textContent = String(points);
    section.querySelector('[data-metric="lessons"] .dash-value').textContent = String(completed);
    section.querySelector('[data-metric="level"] .dash-value').textContent = String(level);
    const goal = Math.max(10, Number(section.querySelector('#studypro-goal').value) || 100);
    const percent = Math.min(100, Math.round(points / goal * 100));
    section.querySelector('.dash-progress span').style.width = percent + '%';
    section.querySelector('.dash-progress').setAttribute('role', 'progressbar');
    section.querySelector('.dash-progress').setAttribute('aria-valuemin', '0');
    section.querySelector('.dash-progress').setAttribute('aria-valuemax', String(goal));
    section.querySelector('.dash-progress').setAttribute('aria-valuenow', String(Math.min(points, goal)));
    section.querySelector('#studypro-goal-text').textContent =
      points + ' / ' + goal + ' points · ' + percent + ' % de ton objectif';
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render);
  else render();
})();
