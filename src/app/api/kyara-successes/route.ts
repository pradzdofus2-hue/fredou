import {randomUUID} from 'node:crypto';
import {cookieValue,SESSION_COOKIE} from '@/server/auth';
import {getPgSessionUser} from '@/server/postgres-auth';
import {pgTransaction} from '@/server/postgres';
import {HIDDEN_DUPLICATE_CARD_IDS} from '@/server/card-visibility';
import {SUCCESS_DEFS} from '@/server/kyara-success-defs';
import {errorResponse,HttpError,json,validateOrigin} from '@/server/http';
export const runtime='nodejs';
export const dynamic='force-dynamic';
type Numbers=Record<string,number>;
async function account(req:Request){const id=await getPgSessionUser(cookieValue(req,SESSION_COOKIE));if(!id)throw new HttpError('AUTH_REQUIRED','Connexion Discord requise.',401);return id;}
async function metrics(db:import('pg').PoolClient,userId:string):Promise<Numbers>{
 const hidden=Array.from(HIDDEN_DUPLICATE_CARD_IDS);
 const r=await db.query<Numbers>(`SELECT
 (SELECT COUNT(*)::int FROM openings WHERE user_id=$1) openings,
 (SELECT COUNT(*)::int FROM inventory WHERE user_id=$1 AND quantity>0 AND NOT(card_id=ANY($2::text[]))) unique,
 (SELECT COUNT(*)::int FROM cards WHERE NOT(id=ANY($2::text[]))) total,
 (SELECT COUNT(*)::int FROM acquisitions a JOIN cards c ON c.id=a.card_id WHERE a.user_id=$1 AND c.rarity>=3) epic,
 (SELECT COUNT(*)::int FROM acquisitions a JOIN cards c ON c.id=a.card_id WHERE a.user_id=$1 AND c.rarity>=4) legendary,
 (SELECT COUNT(*)::int FROM acquisitions a JOIN cards c ON c.id=a.card_id WHERE a.user_id=$1 AND c.rarity=5) mythic,
 (SELECT COUNT(DISTINCT i.card_id)::int FROM inventory i JOIN cards c ON c.id=i.card_id WHERE i.user_id=$1 AND i.quantity>0 AND c.rarity=5) pantheon,
 (SELECT COUNT(*)::int FROM series s WHERE EXISTS(SELECT 1 FROM cards c WHERE c.series_id=s.id AND NOT(c.id=ANY($2::text[])))
 AND NOT EXISTS(SELECT 1 FROM cards c WHERE c.series_id=s.id AND NOT(c.id=ANY($2::text[])) AND NOT EXISTS(SELECT 1 FROM inventory i WHERE i.user_id=$1 AND i.card_id=c.id AND i.quantity>0))) albums,
 (SELECT COALESCE(SUM(quantity),0)::int FROM listings WHERE seller_id=$1 AND status='sold') sales,
 (SELECT COUNT(*)::int FROM trades WHERE (sender_id=$1 OR recipient_id=$1) AND status='accepted') trades,
 (SELECT COUNT(*)::int FROM openings o JOIN boosters b ON b.id=o.booster_id WHERE o.user_id=$1 AND (b.name ILIKE '%divin%' OR b.id ILIKE '%divin%')) divine,
 (SELECT COUNT(*)::int FROM kyara_reviews WHERE user_id=$1) review`,[userId,hidden]);
 const n=r.rows[0];
 return {...n,complete:n.total>0&&n.unique>=n.total?1:0};
}
function progress(n:Numbers,key:string){return Number(n[key]||0);}
export async function GET(req:Request){try{const userId=await account(req);return json(await pgTransaction(async db=>{
 const n=await metrics(db,userId);
 const claimed=new Set((await db.query<{success_id:string}>('SELECT success_id FROM kyara_success_claims WHERE user_id=$1',[userId])).rows.map(x=>x.success_id));
 return {successes:SUCCESS_DEFS.map(([id,title,description,metric,target,reward])=>({id,title,description,target,reward,progress:Math.min(target,progress(n,metric)),claimed:claimed.has(id)}))};
 }));}catch(e){return errorResponse(e);}}
export async function POST(req:Request){try{validateOrigin(req);const userId=await account(req);const body=await req.json();return json(await pgTransaction(async db=>{
 const locked=await db.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[userId]);if(!locked.rowCount)throw new HttpError('AUTH_REQUIRED','Compte introuvable.',401);
 if(body?.action==='review'){
  if(typeof body.content!=='string'||body.content.trim().length<10||body.content.length>1000)throw new HttpError('VALIDATION_ERROR','Avis entre 10 et 1000 caractères requis.',422);
  await db.query('INSERT INTO kyara_reviews(user_id,content) VALUES($1,$2) ON CONFLICT(user_id) DO NOTHING',[userId,body.content.trim()]);
  return {message:'Avis enregistré. Tu peux réclamer ton succès.'};
 }
 const def=SUCCESS_DEFS.find(x=>x[0]===body?.id);
 if(body?.action!=='claim'||!def)throw new HttpError('VALIDATION_ERROR','Succès inconnu.',422);
 const [id,title,,metric,target,reward]=def;const n=await metrics(db,userId);
 if(progress(n,metric)<target)throw new HttpError('FORBIDDEN','Succès non terminé.',403);
 const inserted=await db.query('INSERT INTO kyara_success_claims(user_id,success_id) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING success_id',[userId,id]);
 if(!inserted.rowCount)return {message:'Succès déjà réclamé.'};
 const result=await db.query<{balance:number}>('UPDATE users SET balance=balance+$1 WHERE id=$2 AND balance+$1<=1000000000 RETURNING balance',[reward,userId]);
 if(!result.rowCount)throw new HttpError('CONFLICT','Plafond d’Éclats atteint.',409);
 await db.query('INSERT INTO ledger(id,user_id,amount,balance_after,reason,created_at,reference_id) VALUES($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),userId,reward,result.rows[0].balance,'Succès : '+title,new Date().toISOString(),'kyara-success:'+id]);
 return {message:'Succès réclamé : +'+reward+' Éclats !',balance:result.rows[0].balance};
 }));}catch(e){return errorResponse(e);}}
