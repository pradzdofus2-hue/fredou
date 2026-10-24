import {pgTransaction} from './postgres';
import {ensure} from './errors';
import type {Action,ActionResult} from '../lib/contracts';

export async function deletePgAccount(userId:string,confirmation:Extract<Action,{type:'account-delete'}>['confirmation']):Promise<ActionResult>{
 return pgTransaction(async db=>{
  const found=await db.query<{username:string}>('SELECT username FROM users WHERE id=$1 FOR UPDATE',[userId]);
  ensure(found.rows[0],'AUTH_REQUIRED','Compte introuvable.',401);
  ensure(found.rows[0].username===confirmation,'VALIDATION_ERROR','Pseudo de confirmation incorrect.',422);
  const date=new Date().toISOString();
  // A cancelled listing must never leave reserved stock on an account being deleted.
  await db.query("UPDATE listings SET status='cancelled',completed_at=$1 WHERE seller_id=$2 AND status='active'",[date,userId]);
  // FK actions CASCADE user-owned data and SET NULL on historical market identities.
  const deleted=await db.query('DELETE FROM users WHERE id=$1 RETURNING id',[userId]);
  ensure(deleted.rowCount===1,'CONFLICT','Suppression impossible.',409);
  return {type:'account-delete',message:'Compte et données personnelles supprimés.'};
 });
}
