import {createHash,randomUUID} from 'node:crypto';
import type {Action,ActionResult} from '../lib/contracts';
import {ensure} from './errors';
import {pgTransaction} from './postgres';
type Referral=Extract<Action,{type:'referral'}>;
export async function pgReferral(userId:string,action:Referral,key:string):Promise<ActionResult>{
 const digest=createHash('sha256').update(JSON.stringify(action)).digest('hex');
 return pgTransaction(async db=>{
  const user=await db.query<{referred_by:string|null}>('SELECT referred_by FROM users WHERE id=$1 FOR UPDATE',[userId]);
  ensure(user.rows[0],'AUTH_REQUIRED','Connexion requise.',401);
  const old=await db.query<{action_hash:string;response:string}>('SELECT action_hash,response FROM idempotency WHERE user_id=$1 AND key=$2',[userId,key]);
  if(old.rows[0]){ensure(old.rows[0].action_hash===digest,'IDEMPOTENCY_CONFLICT','Clé déjà utilisée.',409);return JSON.parse(old.rows[0].response) as ActionResult;}
  ensure(!user.rows[0].referred_by,'CONFLICT','Parrain déjà enregistré.',409);
  const reward=await db.query('SELECT 1 FROM referral_rewards WHERE referred_id=$1',[userId]);
  ensure(reward.rowCount===0,'CONFLICT','Parrain déjà récompensé.',409);
  const ref=await db.query<{id:string}>('SELECT id FROM users WHERE referral_code=$1',[action.code.toUpperCase()]);
  ensure(ref.rows[0],'NOT_FOUND','Code introuvable.',404);
  ensure(ref.rows[0].id!==userId,'VALIDATION_ERROR','Parrainage personnel interdit.',422);
  const loop=await db.query(`WITH RECURSIVE parents(id) AS
   (SELECT referred_by FROM users WHERE id=$1 UNION SELECT u.referred_by FROM users u JOIN parents p ON u.id=p.id WHERE u.referred_by IS NOT NULL)
   SELECT id FROM parents WHERE id=$2`,[ref.rows[0].id,userId]);
  ensure(loop.rows.length===0,'CONFLICT','Parrainage circulaire.',409);
  await db.query('UPDATE users SET referred_by=$1 WHERE id=$2',[ref.rows[0].id,userId]);
  const date=new Date().toISOString();
  const result:ActionResult={type:'referral',message:'Parrain enregistré. Récompense après trois ouvertures.'};
  await db.query('INSERT INTO activities(id,user_id,kind,message,created_at) VALUES($1,$2,$3,$4,$5)',[randomUUID(),userId,'referral',result.message,date]);
  await db.query('INSERT INTO idempotency(user_id,key,action_hash,response,created_at) VALUES($1,$2,$3,$4,$5)',[userId,key,digest,JSON.stringify(result),date]);
  return result;
 });
}
