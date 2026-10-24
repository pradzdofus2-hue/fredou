import {randomUUID} from 'node:crypto';
import {cookieValue,SESSION_COOKIE} from '@/server/auth';
import {getPgSessionUser} from '@/server/postgres-auth';
import {pgTransaction} from '@/server/postgres';
import {errorResponse,HttpError,json,validateOrigin} from '@/server/http';
export const runtime='nodejs';export const dynamic='force-dynamic';
async function getUser(r:Request){return getPgSessionUser(cookieValue(r,SESSION_COOKIE));}
export async function GET(request:Request){try{const id=await getUser(request);
 return json(await pgTransaction(async db=>{
  const offers=(await db.query<{id:string;user_id:string;username:string;card_id:string;price:number;created_at:string}>("SELECT o.id,o.user_id,u.username,o.card_id,o.price,o.created_at::text FROM market_buy_orders o JOIN users u ON u.id=o.user_id WHERE o.active=true ORDER BY o.created_at DESC LIMIT 200")).rows;
  const favorites=id?(await db.query<{card_id:string}>('SELECT card_id FROM card_wishlist WHERE user_id=$1',[id])).rows.map(x=>x.card_id):[];
  return {offers,favorites};
 }));}catch(e){return errorResponse(e);}}
export async function POST(request:Request){try{validateOrigin(request);const id=await getUser(request);
 if(!id)throw new HttpError('AUTH_REQUIRED','Connecte-toi avec Discord.',401);
 const b=await request.json();if(typeof b?.cardId!=='string'||b.cardId.length>100||!['create','cancel'].includes(b.action))throw new HttpError('VALIDATION_ERROR','Offre invalide.',422);
 return json(await pgTransaction(async db=>{
  const user=(await db.query<{balance:number}>('SELECT balance FROM users WHERE id=$1',[id])).rows[0];
  if(!user)throw new HttpError('AUTH_REQUIRED','Compte introuvable.',401);
  if(b.action==='cancel')await db.query('UPDATE market_buy_orders SET active=false WHERE user_id=$1 AND card_id=$2',[id,b.cardId]);
  else{
   if(!Number.isInteger(b.price)||b.price<1||b.price>1000000)throw new HttpError('VALIDATION_ERROR','Prix invalide.',422);
   if(b.price>user.balance)throw new HttpError('VALIDATION_ERROR','Éclats insuffisants pour cette offre.',422);
   if(!(await db.query('SELECT 1 FROM cards WHERE id=$1',[b.cardId])).rowCount)throw new HttpError('VALIDATION_ERROR','Carte inexistante.',422);
   const n=(await db.query<{n:string}>('SELECT COUNT(*)::text n FROM market_buy_orders WHERE user_id=$1 AND active=true',[id])).rows[0];
   if(Number(n.n)>=20 && !(await db.query('SELECT 1 FROM market_buy_orders WHERE user_id=$1 AND card_id=$2 AND active=true',[id,b.cardId])).rowCount)throw new HttpError('VALIDATION_ERROR','Maximum 20 offres.',422);
   await db.query('INSERT INTO market_buy_orders(id,user_id,card_id,price,active) VALUES($1,$2,$3,$4,true) ON CONFLICT(user_id,card_id) DO UPDATE SET price=EXCLUDED.price,active=true,created_at=now()',[randomUUID(),id,b.cardId,b.price]);
  }
  return {ok:true};
 }));
 }catch(e){return errorResponse(e);}}
