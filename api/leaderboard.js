// STUDYPRO CAMEROUN — authentification et classement collectif Supabase
function send(res,status,payload){return res.status(status).json(payload)}
function originAllowed(origin){
 if(!origin)return false;
 const exact=process.env.STUDYPRO_ALLOWED_ORIGIN;
 if(exact)return origin===exact;
 return origin==="https://corettaboo6-oss.github.io"||/^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin);
}
export default async function handler(req,res){
 const origin=req.headers.origin||"";
 if(!originAllowed(origin))return send(res,403,{error:"Origine non autorisée."});
 res.setHeader("Access-Control-Allow-Origin",origin);res.setHeader("Vary","Origin");
 res.setHeader("Access-Control-Allow-Methods","POST, OPTIONS");res.setHeader("Access-Control-Allow-Headers","Content-Type, Authorization");
 res.setHeader("Cache-Control","no-store");
 if(req.method==="OPTIONS")return res.status(204).end();
 if(req.method!=="POST")return send(res,405,{error:"Méthode non autorisée."});
 const url=(process.env.SUPABASE_URL||"").replace(/\/$/,""),key=process.env.SUPABASE_ANON_KEY;
 if(!url||!key)return send(res,503,{error:"Le classement collectif n'est pas encore configuré par l'administrateur."});
 const body=req.body||{},action=String(body.action||"");
 async function supa(path,options={}){
  const r=await fetch(url+path,{...options,headers:{apikey:key,"Content-Type":"application/json",...(options.headers||{})}});
  const data=await r.json().catch(()=>({}));
  if(!r.ok){const msg=data.msg||data.message||data.error_description||data.error||"Erreur du service de comptes.";throw new Error(String(msg).slice(0,220))}
  return data;
 }
 try{
  if(action==="signup"||action==="login"){
   const email=typeof body.email==="string"?body.email.trim().slice(0,254):"",password=typeof body.password==="string"?body.password:"";
   if(!/^\S+@\S+\.\S+$/.test(email)||password.length<8||password.length>128)return send(res,400,{error:"Adresse e-mail ou mot de passe invalide (8 caractères minimum)."});
   let data;
   if(action==="signup"){
    const name=typeof body.display_name==="string"?body.display_name.trim().slice(0,32):"";
    if(name.length<2)return send(res,400,{error:"Le nom affiché doit contenir au moins 2 caractères."});
    data=await supa("/auth/v1/signup",{method:"POST",body:JSON.stringify({email,password,data:{display_name:name}})});
   }else data=await supa("/auth/v1/token?grant_type=password",{method:"POST",body:JSON.stringify({email,password})});
   if(data.access_token)return send(res,200,{session:{access_token:data.access_token,refresh_token:data.refresh_token,expires_at:Date.now()+Number(data.expires_in||3600)*1000,user:data.user}});
   return send(res,200,{message:"Compte créé. Consulte ta boîte e-mail pour confirmer l'adresse avant de te connecter."});
  }
  const bearer=String(req.headers.authorization||"").replace(/^Bearer\s+/i,"");
  if(!bearer||bearer.length>4096)return send(res,401,{error:"Connecte-toi pour accéder au classement collectif."});
  const user=await supa("/auth/v1/user",{headers:{Authorization:"Bearer "+bearer}});
  if(!user||!user.id)return send(res,401,{error:"Session invalide. Reconnecte-toi."});
  if(action==="record"){
   const q=Number(body.question_id),ms=Number(body.elapsed_ms);
   if(!Number.isInteger(q)||q<0||!Number.isInteger(ms)||ms<1||ms>600000)return send(res,400,{error:"Résultat QCM invalide."});
   await supa("/rest/v1/rpc/studypro_record_answer",{method:"POST",headers:{Authorization:"Bearer "+bearer},body:JSON.stringify({p_question_id:q,p_elapsed_ms:ms})});
   return send(res,200,{ok:true});
  }
  if(action==="leaderboard"){
   const rows=await supa("/rest/v1/rpc/studypro_weekly_leaderboard",{method:"POST",headers:{Authorization:"Bearer "+bearer},body:"{}"});
   const entries=(Array.isArray(rows)?rows:[]).map(row=>({display_name:row.display_name,score:Number(row.score)||0,best_time_ms:row.best_time_ms===null?null:Number(row.best_time_ms),answers_count:Number(row.answers_count)||0,is_me:row.user_id===user.id,avatar:"🎓"}));
   const now=new Date(),monday=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()));monday.setUTCDate(monday.getUTCDate()-((monday.getUTCDay()+6)%7));
   return send(res,200,{week:monday.toISOString().slice(0,10),entries});
  }
  return send(res,400,{error:"Action inconnue."});
 }catch(error){
  const msg=error&&error.message?error.message:"Erreur inconnue";
  console.error("Studypro leaderboard:",msg);
  return send(res,400,{error:msg.includes("Invalid login")?"E-mail ou mot de passe incorrect.":msg.includes("already registered")?"Cette adresse e-mail possède déjà un compte. Essaie de te connecter.":msg.includes("Email not confirmed")?"Confirme ton adresse e-mail avant de te connecter.":msg.includes("relation")||msg.includes("function")?"La base de données STUDYPRO doit encore être initialisée avec le script SQL.":msg});
 }
}
