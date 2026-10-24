import {cookieValue,SESSION_COOKIE} from '@/server/auth';
import {getPgSessionUser} from '@/server/postgres-auth';
import {pgTransaction} from '@/server/postgres';
import {errorResponse,HttpError,json,validateOrigin} from '@/server/http';
export const runtime='nodejs';export const dynamic='force-dynamic';
async function requireAdmin(req:Request){
 const id=await getPgSessionUser(cookieValue(req,SESSION_COOKIE));
 if(!id)throw new HttpError('AUTH_REQUIRED','Connexion nécessaire.',401);
 const account=await pgTransaction(db=>db.query<{role:string}>('SELECT role FROM users WHERE id=$1',[id]));
 if(account.rows[0]?.role!=='admin')throw new HttpError('FORBIDDEN','Accès administrateur requis.',403);
 return id;
}
export async function GET(req:Request){
 try{await requireAdmin(req);return json(await pgTransaction(async db=>{
 const result=await db.query<{id:string;username:string;role:string}>('SELECT id,username,role FROM users ORDER BY username ASC LIMIT 1000');
 return {users:result.rows};
 }));}catch(e){return errorResponse(e);}
}
export async function POST(req:Request){
 try{validateOrigin(req);const actor=await requireAdmin(req);
 const body=await req.json();
 if(typeof body?.id!=='string'||!/^[-a-zA-Z0-9]{1,100}$/.test(body.id)||body?.role!=='admin')throw new HttpError('VALIDATION_ERROR','Compte ou rôle invalide.',422);
 if(actor===body.id)throw new HttpError('VALIDATION_ERROR','Ton compte est déjà administrateur.',422);
 return json(await pgTransaction(async db=>{
 const self=(await db.query<{role:string}>('SELECT role FROM users WHERE id=$1 FOR UPDATE',[actor])).rows[0];
 if(self?.role!=='admin')throw new HttpError('FORBIDDEN','Accès refusé.',403);
 const target=(await db.query<{id:string;username:string;role:string}>('SELECT id,username,role FROM users WHERE id=$1 FOR UPDATE',[body.id])).rows[0];
 if(!target)throw new HttpError('NOT_FOUND','Compte introuvable.',404);
 if(target.role==='admin')return {ok:true,message:'Ce joueur est déjà administrateur.',user:target};
 const result=await db.query<{id:string;username:string;role:string}>("UPDATE users SET role='admin' WHERE id=$1 AND role='player' RETURNING id,username,role",[body.id]);
 return {ok:true,message:'Le compte '+target.username+' est maintenant administrateur.',user:result.rows[0]};
 }));}catch(e){return errorResponse(e);}
}
