(function(){
 const el=id=>document.getElementById(id),status=el('weeklyAuthStatus');
 if(!status)return;
 const key='studyproCollectiveSession';
 let session=null;
 try{session=JSON.parse(sessionStorage.getItem(key)||'null')}catch(e){}
 function say(text){status.textContent=text}
 function show(){
  el('weeklyAuthFields').hidden=!!session;
  el('weeklyLoggedIn').hidden=!session;
  if(session)el('weeklyWelcome').textContent='Connecté(e) : '+((session.user&&session.user.user_metadata&&session.user.user_metadata.display_name)||session.user.email)+'. Tes résultats sont synchronisés.';
 }
 async function call(action,extra){
  const headers={'Content-Type':'application/json'};
  if(session&&session.access_token)headers.Authorization='Bearer '+session.access_token;
  const response=await fetch('/api/leaderboard',{method:'POST',headers,body:JSON.stringify(Object.assign({action:action},extra||{}))});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.error||'Service indisponible.');
  return data;
 }
 function saveSession(value){
  session=value&&value.access_token?value:null;
  try{if(session)sessionStorage.setItem(key,JSON.stringify(session));else sessionStorage.removeItem(key)}catch(e){}
  show();
 }
 async function auth(action){
  const email=el('weeklyEmail').value.trim();
  const password=el('weeklyPassword').value;
  const name=el('weeklyDisplayName').value.trim();
  if(!email||password.length<8){say('Saisis un e-mail et un mot de passe de 8 caractères minimum.');return}
  if(action==='signup'&&name.length<2){say('Indique le nom à afficher dans le classement.');return}
  say('Connexion sécurisée en cours…');
  try{
   const data=await call(action,{email:email,password:password,display_name:name});
   if(data.session){saveSession(data.session);say('Bienvenue dans le classement STUDYPRO !');await load()}
   else say(data.message||'Compte créé. Vérifie tes e-mails pour confirmer ton inscription.');
  }catch(error){say(error.message)}
 }
 function escapeText(value){const span=document.createElement('span');span.textContent=String(value||'');return span.innerHTML}
 async function load(){
  if(!session)return;
  try{
   const data=await call('leaderboard');
   const rows=el('leaderboardRows');
   rows.innerHTML=(data.entries||[]).map((item,index)=>{
    const medal=index===0?'🥇':index===1?'🥈':index===2?'🥉':String(index+1);
    return '<tr class="'+(item.is_me?'me':'')+'"><td>'+medal+'</td><td>'+escapeText(item.display_name)+(item.is_me?' (toi)':'')+'</td><td>'+Number(item.score)+' pts</td><td>'+(item.best_time_ms==null?'—':(Number(item.best_time_ms)/1000).toFixed(1)+' s')+'</td></tr>';
   }).join('')||'<tr><td colspan="4">Aucun résultat cette semaine. Lance un QCM pour commencer !</td></tr>';
   el('weeklyPeriod').textContent='Classement collectif · semaine du '+data.week+' · '+data.entries.length+' étudiant(s)';
   const note=document.querySelector('#weeklyBoard .fiction-note');
   if(note)note.textContent='Classement réel des étudiants inscrits, classés par points puis par meilleur chrono.';
  }catch(error){say(error.message)}
 }
 el('weeklySignup').addEventListener('click',()=>auth('signup'));
 el('weeklyLogin').addEventListener('click',()=>auth('login'));
 el('weeklyLogout').addEventListener('click',()=>{saveSession(null);say('Déconnexion effectuée.')});
 window.studyproCollective={
  get connected(){return !!session},
  async record(questionId,elapsedMs){
   if(!session)return;
   try{await call('record',{question_id:questionId,elapsed_ms:elapsedMs});await load()}
   catch(error){say(error.message)}
  },
  refresh:load
 };
 show();
 if(session)load();
})();