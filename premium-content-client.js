// STUDYPRO — chargement des contenus privés après contrôle serveur de l'abonnement.
(function () {
  'use strict';
  let loaded = false, loading = null;

  const status = message => {
    const el = document.getElementById('mockExamStatus');
    if (el) el.textContent = message;
  };

  function normalizeQuestion(question) {
    if (Array.isArray(question)) {
      return { text: question[0], choices: question[1], answer: Number(question[2]) };
    }
    if (!question || typeof question !== 'object') return null;
    return {
      text: question.question || question.text || question.prompt || '',
      choices: question.choices || question.options || [],
      answer: Number(question.answerIndex ?? question.answer)
    };
  }

  function startExam(exam, mount) {
    const questions = (Array.isArray(exam.questions) ? exam.questions : [])
      .map(normalizeQuestion)
      .filter(q => typeof q.text === 'string' && q.text && Array.isArray(q.choices) &&
        q.choices.length >= 2 && Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.choices.length);
    mount.replaceChildren();
    if (!questions.length) {
      const p = document.createElement('p');
      p.textContent = 'Cet examen ne contient pas encore de questions valides.';
      mount.appendChild(p);
      return;
    }
    let index = 0, score = 0, answered = false;
    const title = document.createElement('h4');
    title.textContent = exam.title || 'Examen blanc';
    const progress = document.createElement('p');
    const question = document.createElement('p');
    question.className = 'quiz-q';
    const answers = document.createElement('div');
    answers.className = 'answers';
    const feedback = document.createElement('p');
    feedback.className = 'feedback';
    const next = document.createElement('button');
    next.type = 'button';
    next.textContent = 'Question suivante';
    next.hidden = true;
    const render = () => {
      answered = false;
      const item = questions[index];
      progress.textContent = 'Question ' + (index + 1) + ' / ' + questions.length + ' · Score : ' + score;
      question.textContent = item.text;
      feedback.textContent = '';
      answers.replaceChildren();
      next.hidden = true;
      item.choices.forEach((choice, choiceIndex) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = String(choice);
        button.addEventListener('click', () => {
          if (answered) return;
          answered = true;
          const correct = choiceIndex === item.answer;
          if (correct) score++;
          feedback.textContent = correct ? 'Bonne réponse !' : 'Réponse incorrecte.';
          answers.querySelectorAll('button').forEach((entry, i) => {
            entry.disabled = true;
            if (i === item.answer) entry.textContent += ' ✓';
          });
          next.hidden = false;
          next.textContent = index === questions.length - 1 ? 'Voir mon résultat' : 'Question suivante';
        });
        answers.appendChild(button);
      });
    };
    next.addEventListener('click', () => {
      if (!answered) return;
      if (index < questions.length - 1) {
        index++;
        render();
      } else {
        mount.replaceChildren();
        const result = document.createElement('p');
        result.className = 'quiz-q';
        result.textContent = 'Résultat : ' + score + ' / ' + questions.length;
        const restart = document.createElement('button');
        restart.type = 'button';
        restart.textContent = 'Recommencer';
        restart.addEventListener('click', () => { index = 0; score = 0; mount.replaceChildren(title, progress, question, answers, feedback, next); render(); });
        mount.append(result, restart);
      }
    });
    mount.append(title, progress, question, answers, feedback, next);
    render();
  }

  function renderExams(plan, exams) {
    const list = document.getElementById('mockExamList');
    if (!list) return;
    list.replaceChildren();
    if (plan !== 'premium_plus') {
      status('Les examens blancs sont exclusivement réservés à Premium Plus. Passe à Premium Plus pour y accéder.');
      return;
    }
    if (!exams.length) {
      status('Ton abonnement Premium Plus est reconnu, mais aucun examen blanc n’a encore été importé. Les examens apparaîtront ici après leur ajout dans private-content-source/mock-exams.json et le prochain déploiement.');
      return;
    }
    status(exams.length + ' examen(s) blanc(s) disponible(s) avec ton abonnement Premium Plus.');
    exams.forEach(exam => {
      const card = document.createElement('article');
      card.className = 'course';
      const heading = document.createElement('h3');
      heading.textContent = exam.title || 'Examen blanc';
      const count = document.createElement('p');
      count.textContent = (Array.isArray(exam.questions) ? exam.questions.length : 0) + ' question(s)';
      const mount = document.createElement('div');
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = 'Commencer cet examen';
      button.addEventListener('click', () => startExam(exam, mount));
      card.append(heading, count, button, mount);
      list.appendChild(card);
    });
  }

  async function load() {
    if (loaded) return true;
    if (loading) return loading;
    loading = (async () => {
      const token = window.studyproBilling && await window.studyproBilling.getAccessToken();
      if (!token) {
        status('Connecte-toi à ton compte étudiant pour vérifier ton abonnement Premium Plus.');
        return false;
      }
      const response = await fetch('/api/premium-content', {
        method: 'GET', headers: { Authorization: 'Bearer ' + token }, cache: 'no-store'
      });
      if (response.status === 401) status('Ta session a expiré. Reconnecte-toi puis réessaie.');
      else if (response.status === 403) status('Un abonnement Premium actif est nécessaire. Les examens blancs exigent Premium Plus.');
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
      window.STUDYPRO_MOCK_EXAMS = exams;
      renderExams(payload.plan, exams);
      loaded = true;
      return true;
    })().finally(() => { loading = null; });
    return loading;
  }

  window.studyproPremiumContent = Object.freeze({ load, get loaded() { return loaded; } });
  const button = document.getElementById('loadMockExams');
  if (button) button.addEventListener('click', async () => {
    button.disabled = true;
    status('Vérification de ton abonnement et chargement des examens…');
    try { await load(); }
    catch (error) { status('Impossible de charger les examens pour le moment. Réessaie plus tard.'); }
    finally { button.disabled = false; }
  });
})();