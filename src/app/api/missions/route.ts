import { randomUUID } from 'node:crypto';
import { cookieValue, SESSION_COOKIE } from '@/server/auth';
import { getPgSessionUser } from '@/server/postgres-auth';
import { pgTransaction } from '@/server/postgres';
import { errorResponse, HttpError, json, validateOrigin } from '@/server/http';
export const runtime='nodejs';
export const dynamic='force-dynamic';
type Mission={id:string;title:string;description:string;period:'daily'|'weekly';metric:string;target:number;reward:number;active:boolean};
const metrics=['openings','listings','sales','acquisitions','legendary'] as const;
function windowFor(period:'daily'|'weekly'){
 const now=new Date(),d=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()));
 if(period==='weekly'){const day=(d.getUTCDay()+6)%7;d.setUTCDate(d.getUTCDate()-day);}
 const start=d.toISOString(), end=new Date(d.getTime()+(period==='daily'?1:7)*86400000).toISOString();
 return {start,end,key:start.slice(0,10)};
}
async function user(request:Request){const id=await getPgSessionUser(cookieValue(request,SESSION_COOKIE));if(!id)throw new HttpError('AUTH_REQUIRED','Connecte-toi avec Discord.',401);return id;}
async function measure(db:import('pg').PoolClient,id:string,m:Mission){
 const {start,end}=windowFor(m.period);
 const params=[id,start,end];let sql='';
 switch(m.metric){
 case 'openings':sql='SELECT COUNT(*)::int n FROM openings WHERE user_id=$1 AND created_at >= $2 AND created_at < $3';break;
 case 'listings':sql='SELECT COUNT(*)::int n FROM listings WHERE seller_id=$1 AND created_at >= $2 AND created_at < $3';break;
 case 'sales':sql="SELECT COALESCE(SUM(quantity),0)::int n FROM listings WHERE seller_id=$1 AND status='sold' AND completed_at >= $2 AND completed_at < $3";break;
 case 'acquisitions':sql='SELECT COALESCE(SUM(quantity),0)::int n FROM acquisitions WHERE user_id=$1 AND created_at >= $2 AND created_at < $3';break;
 case 'legendary':sql='SELECT COALESCE(SUM(a.quantity),0)::int n FROM acquisitions a JOIN cards c ON c.id=a.card_id WHERE a.user_id=$1 AND a.created_at >= $2 AND a.created_at < $3 AND c.rarity=4';break;
 default:throw new HttpError('VALIDATION_ERROR','Objectif inconnu.',422);
 }
 return Number((await db.query<{n:number}>(sql,params)).rows[0]?.n||0);
}
export async function GET(request:Request){
 try{const id=await user(request);return json(await pgTransaction(async db=>{
 const role=(await db.query<{role:string}>('SELECT role FROM users WHERE id=$1',[id])).rows[0]?.role;
 const defs=(await db.query<Mission>('SELECT * FROM mission_definitions WHERE active=true OR $1=true ORDER BY period,id',[role==='admin'])).rows;
 const claims=(await db.query<{mission_id:string;period_key:string}>('SELECT mission_id,period_key FROM mission_claims WHERE user_id=$1',[id])).rows;
 const missions=[];for(const m of defs){const key=windowFor(m.period).key;missions.push({...m,progress:await measure(db,id,m),claimed:claims.some(c=>c.mission_id===m.id&&c.period_key===key)});}
 return {missions,admin:role==='admin',serverTime:new Date().toISOString()};
 }));}catch(e){return errorResponse(e);}
}
export async function POST(request:Request){
 try{validateOrigin(request);const id=await user(request);const body=await request.json();
 if(!body||typeof body!=='object')throw new HttpError('VALIDATION_ERROR','Requête invalide.',422);
 return json(await pgTransaction(async db=>{
 const account=(await db.query<{role:string;balance:number}>('SELECT role,balance FROM users WHERE id=$1 FOR UPDATE',[id])).rows[0];
 if(!account)throw new HttpError('AUTH_REQUIRED','Compte introuvable.',401);
 if(body.action==='save'){
 if(account.role!=='admin')throw new HttpError('FORBIDDEN','Accès administrateur requis.',403);
 if(body.period!=='weekly'||!metrics.includes(body.metric)||typeof body.title!=='string'||body.title.trim().length<3||body.title.length>100||!Number.isInteger(body.target)||body.target<1||body.target>100000||!Number.isInteger(body.reward)||body.reward<0||body.reward>10000)throw new HttpError('VALIDATION_ERROR','Mission hebdomadaire invalide.',422);
 const mid=typeof body.id==='string'&&/^custom-[a-f0-9-]{36}$/.test(body.id)?body.id:'custom-'+randomUUID();
 await db.query("INSERT INTO mission_definitions(id,title,description,period,metric,target,reward,active) VALUES($1,$2,$3,'weekly',$4,$5,$6,true) ON CONFLICT(id) DO UPDATE SET title=EXCLUDED.title,description=EXCLUDED.description,metric=EXCLUDED.metric,target=EXCLUDED.target,reward=EXCLUDED.reward", [mid,body.title.trim(),String(body.description||'').slice(0,500),body.metric,body.target,body.reward]);
 return {ok:true,message:'Mission hebdomadaire enregistrée.',id:mid};
 }
 if(body.action==='toggle'){
 if(account.role!=='admin')throw new HttpError('FORBIDDEN','Accès administrateur requis.',403);
 if(typeof body.id!=='string'||!body.id.startsWith('custom-')||typeof body.active!=='boolean')throw new HttpError('VALIDATION_ERROR','Mission invalide.',422);
 const result=await db.query('UPDATE mission_definitions SET active=$1 WHERE id=$2 AND period=$3 RETURNING id',[body.active,body.id,'weekly']);
 if(!result.rowCount)throw new HttpError('NOT_FOUND','Mission introuvable.',404);
 return {ok:true,message:'Mission mise à jour.'};
 }
 if(body.action!=='claim'||typeof body.id!=='string')throw new HttpError('VALIDATION_ERROR','Action inconnue.',422);
 const m=(await db.query<Mission>('SELECT * FROM mission_definitions WHERE id=$1 AND active=true',[body.id])).rows[0];
 if(!m)throw new HttpError('NOT_FOUND','Mission indisponible.',404);
 const progress=await measure(db,id,m);
 if(progress<m.target)throw new HttpError('FORBIDDEN','Objectif pas encore atteint.',403);
 const key=windowFor(m.period).key;
 const claim=await db.query('INSERT INTO mission_claims(user_id,mission_id,period_key) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING mission_id',[id,m.id,key]);
 if(!claim.rowCount)return {ok:true,alreadyClaimed:true,message:'Récompense déjà récupérée.'};
 const updated=(await db.query<{balance:number}>('UPDATE users SET balance=balance+$1 WHERE id=$2 AND balance+$1<=1000000000 RETURNING balance',[m.reward,id])).rows[0];
 if(!updated)throw new HttpError('CONFLICT','Plafond d’Éclats atteint.',409);
 await db.query('INSERT INTO ledger(id,user_id,amount,balance_after,reason,created_at,reference_id) VALUES($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),id,m.reward,updated.balance,'Mission : '+m.title,new Date().toISOString(),m.id+':'+key]);
 return {ok:true,message:'Mission validée : +'+m.reward+' Éclats !',balance:updated.balance};
 }));}catch(e){return errorResponse(e);}
}
