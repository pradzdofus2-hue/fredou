import {createHash,randomUUID} from 'node:crypto';
import type {Action,ActionResult} from '../lib/contracts';
import {ensure} from './errors';
import {pgTransaction} from './postgres';
type EventSave=Extract<Action,{type:'event-save'}>;
export async function pgSaveEvent(userId:string,action:EventSave,key:string):Promise<ActionResult>{
 const digest=createHash('sha256').update(JSON.stringify(action)).digest('hex');
 return pgTransaction(async db=>{
  const user=await db.query<{role:string}>('SELECT role FROM users WHERE id=$1 FOR UPDATE',[userId]);
  ensure(user.rows[0],'AUTH_REQUIRED','Connexion requise.',401);
  const old=await db.query<{action_hash:string;response:string}>('SELECT action_hash,response FROM idempotency WHERE user_id=$1 AND key=$2',[userId,key]);
  if(old.rows[0]){ensure(old.rows[0].action_hash===digest,'IDEMPOTENCY_CONFLICT','Clé déjà utilisée.',409);return JSON.parse(old.rows[0].response) as ActionResult;}
  ensure(user.rows[0].role==='admin','FORBIDDEN','Réservé à l’administration.',403);
  const start=new Date(action.startsAt),end=new Date(action.endsAt);
  ensure(Number.isFinite(start.getTime())&&Number.isFinite(end.getTime())&&end>start,'VALIDATION_ERROR','Dates incorrectes.',422);
  const id=action.id||randomUUID();
  if(action.id){
   const found=await db.query('SELECT 1 FROM events WHERE id=$1',[id]);
   ensure(found.rowCount===1,'NOT_FOUND','Événement introuvable.',404);
  }
  await db.query(`INSERT INTO events(id,name,description,starts_at,ends_at,active,color,reward) VALUES($1,$2,$3,$4,$5,$6,$7,$8)
   ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,description=EXCLUDED.description,starts_at=EXCLUDED.starts_at,
   ends_at=EXCLUDED.ends_at,active=EXCLUDED.active,color=EXCLUDED.color,reward=EXCLUDED.reward`,
   [id,action.name,action.description,start.toISOString(),end.toISOString(),action.active?1:0,action.color,action.reward]);
  const result:ActionResult={type:'event-save',message:'Événement enregistré.',entityId:id};
  const date=new Date().toISOString();
  await db.query('INSERT INTO activities(id,user_id,kind,message,created_at) VALUES($1,$2,$3,$4,$5)',
   [randomUUID(),userId,'event','Événement mis à jour : '+action.name+'.',date]);
  await db.query('INSERT INTO idempotency(user_id,key,action_hash,response,created_at) VALUES($1,$2,$3,$4,$5)',
   [userId,key,digest,JSON.stringify(result),date]);
  return result;
 });
}
