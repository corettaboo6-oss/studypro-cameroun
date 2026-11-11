// STUDYPRO — chargement des contenus privés après contrôle serveur de l'abonnement.
(function () {
  'use strict';
  let loaded = false, loading = null;
  async function load() {
    if (loaded) return true;
    if (loading) return loading;
    loading = (async () => {
      const token = window.studyproBilling && await window.studyproBilling.getAccessToken();
      if (!token) return false;
      const response = await fetch('/api/premium-content', {
        method: 'GET', headers: { Authorization: 'Bearer ' + token }, cache: 'no-store'
      });
      if (!response.ok) return false;
      const payload = await response.json();
      const libs = { 1: [], 2: [], 3: [] }, exams = [];
      (Array.isArray(payload.contents) ? payload.contents : []).forEach(item => {
        const body = item && item.body;
        if (!body || typeof body !== 'object') return;
        if (body.kind === 'exam' || String(item.content_key || '').startsWith('exam:')) {
          exams.push({ ...body, title: item.title || body.title }); return;
        }
        const year = Number(body.year);
        if ([1, 2, 3].includes(year) && typeof body.course === 'string' && Array.isArray(body.lessons)) {
          libs[year].push({ course: body.course, lessons: body.lessons });
        }
      });
      window.LESSONS_Y1 = libs[1]; window.LESSONS_Y2 = libs[2]; window.LESSONS_Y3 = libs[3];
      window.STUDYPRO_MOCK_EXAMS = exams; loaded = true; return true;
    })().finally(() => { loading = null; });
    return loading;
  }
  window.studyproPremiumContent = Object.freeze({ load, get loaded() { return loaded; } });
})();
