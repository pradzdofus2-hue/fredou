import {randomUUID} from 'node:crypto';
import {cookieValue,SESSION_COOKIE} from '@/server/auth';
import {getPgSessionUser} from '@/server/postgres-auth';
import {pgTransaction} from '@/server/postgres';
import {errorResponse,HttpError,json,validateOrigin} from '@/server/http';
import {HIDDEN_DUPLICATE_CARD_IDS} from '@/server/card-visibility';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const titles=['Collectionneur','Explorateur','Chasseur de mythiques','Maître des cartes'];
const banners=['astral','royal','forest','ember'];
const season=()=>new Date().toISOString().slice(0,7);
async function logged(request:Request){const id=await getPgSessionUser(cookieValue(request,SESSION_COOKIE));if(!id)throw new HttpError('AUTH_REQUIRED','Connecte-toi avec Discord.',401);return id;}
async function snapshot(db:import('pg').PoolClient,id:string){
 const wishlist=(await db.query<{card_id:string}>('SELECT card_id FROM card_wishlist WHERE user_id=$1 ORDER BY created_at DESC',[id])).rows.map(x=>x.card_id);
 const cosmetic=(await db.query<{title:string;banner:string;featured_card:string|null}>('SELECT title,banner,featured_card FROM player_cosmetics WHERE user_id=$1',[id])).rows[0]||{title:'Collectionneur',banner:'astral',featured_card:null};
 const key=season();
 const xp=Number((await db.query<{n:string}>('SELECT COUNT(*)::text n FROM openings WHERE user_id=$1 AND created_at >= $2 AND created_at < $3',[id,key+'-01',new Date(Date.UTC(Number(key.slice(0,4)),Number(key.slice(5,7)),1)).toISOString().slice(0,10)])).rows[0]?.n||0);
 const claimed=(await db.query<{level:number}>('SELECT level FROM season_claims WHERE user_id=$1 AND season_key=$2',[id,key])).rows.map(x=>x.level);
 const albumClaims=(await db.query<{series_id:string;milestone:number}>('SELECT series_id,milestone FROM album_milestone_claims WHERE user_id=$1',[id])).rows;
 return {wishlist,cosmetic,season:{key,xp,level:Math.min(30,Math.floor(xp/3)),claimed},albumClaims,titles,banners};
}
export async function GET(request:Request){try{
 const player=new URL(request.url).searchParams.get('player');
 if(player){if(player.length>100)return json({error:'Invalid player'},400);return json(await pgTransaction(async db=>({cosmetic:(await db.query<{title:string;banner:string;featured_card:string|null}>('SELECT title,banner,featured_card FROM player_cosmetics WHERE user_id=$1',[player])).rows[0]||{title:'Collectionneur',banner:'astral',featured_card:null}})));}
 const id=await logged(request);return json(await pgTransaction(db=>snapshot(db,id)));
 }catch(e){return errorResponse(e);}}
export async function POST(request:Request){
 try{validateOrigin(request);const id=await logged(request);const body=await request.json();
  if(!body||typeof body!=='object'||typeof body.action!=='string')throw new HttpError('VALIDATION_ERROR','Requête invalide.',422);
  return json(await pgTransaction(async db=>{
   const me=(await db.query<{balance:number}>('SELECT balance FROM users WHERE id=$1 FOR UPDATE',[id])).rows[0];if(!me)throw new HttpError('AUTH_REQUIRED','Compte introuvable.',401);
   if(body.action==='wishlist'){
    if(typeof body.cardId!=='string'||body.cardId.length>100)throw new HttpError('VALIDATION_ERROR','Carte invalide.',422);
    const exists=(await db.query('SELECT 1 FROM cards WHERE id=$1',[body.cardId])).rowCount;
    if(!exists)throw new HttpError('VALIDATION_ERROR','Carte inexistante.',422);
    if(body.add===true){const n=Number((await db.query<{n:string}>('SELECT COUNT(*)::text n FROM card_wishlist WHERE user_id=$1',[id])).rows[0]?.n||0);if(n>=100)throw new HttpError('VALIDATION_ERROR','Maximum 100 souhaits.',422);await db.query('INSERT INTO card_wishlist(user_id,card_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[id,body.cardId]);}
    else await db.query('DELETE FROM card_wishlist WHERE user_id=$1 AND card_id=$2',[id,body.cardId]);
   }else if(body.action==='cosmetic'){
    if(!titles.includes(body.title)||!banners.includes(body.banner))throw new HttpError('VALIDATION_ERROR','Personnalisation invalide.',422);
    let card:string|null=null;
    if(typeof body.cardId==='string' && body.cardId){card=body.cardId;
     const owned=await db.query('SELECT 1 FROM inventory WHERE user_id=$1 AND card_id=$2 AND quantity>0',[id,card]);if(!owned.rowCount)throw new HttpError('VALIDATION_ERROR','Cette carte ne fait pas partie de ta collection.',422);}
    await db.query('INSERT INTO player_cosmetics(user_id,title,banner,featured_card) VALUES($1,$2,$3,$4) ON CONFLICT(user_id) DO UPDATE SET title=EXCLUDED.title,banner=EXCLUDED.banner,featured_card=EXCLUDED.featured_card',[id,body.title,body.banner,card]);
   }else if(body.action==='season'){
    const key=season(),level=Number(body.level);
    if(!Number.isInteger(level)||level<1||level>30)throw new HttpError('VALIDATION_ERROR','Niveau invalide.',422);
    const xp=Number((await db.query<{n:string}>('SELECT COUNT(*)::text n FROM openings WHERE user_id=$1 AND created_at >= $2 AND created_at < $3',[id,key+'-01',new Date(Date.UTC(Number(key.slice(0,4)),Number(key.slice(5,7)),1)).toISOString().slice(0,10)])).rows[0]?.n||0);
    if(xp<level*3)throw new HttpError('VALIDATION_ERROR','Niveau pas encore atteint.',422);
    const claim=await db.query('INSERT INTO season_claims(user_id,season_key,level) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING level',[id,key,level]);
    if(!claim.rowCount)throw new HttpError('VALIDATION_ERROR','Récompense déjà reçue.',409);
    const reward=50+level*10;
    const balance=(await db.query<{balance:number}>('UPDATE users SET balance=balance+$1 WHERE id=$2 RETURNING balance',[reward,id])).rows[0].balance;
    await db.query('INSERT INTO ledger(id,user_id,amount,balance_after,reason,created_at,reference_id) VALUES($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),id,reward,balance,'season_reward',new Date().toISOString(),key+'-'+level]);
   }else if(body.action==='album'){
    if(typeof body.seriesId!=='string'||body.seriesId.length>100||![25,50,75,100].includes(body.milestone))throw new HttpError('VALIDATION_ERROR','Palier invalide.',422);
    const counted=(await db.query<{total:string;owned:string}>('SELECT (SELECT COUNT(*)::text FROM cards WHERE series_id=$1 AND NOT(id=ANY($3::text[]))) total,(SELECT COUNT(*)::text FROM inventory i JOIN cards c ON c.id=i.card_id WHERE i.user_id=$2 AND i.quantity>0 AND c.series_id=$1 AND NOT(c.id=ANY($3::text[]))) owned',[body.seriesId,id,Array.from(HIDDEN_DUPLICATE_CARD_IDS)])).rows[0];
    if(!counted||Number(counted.total)<1||100*Number(counted.owned)/Number(counted.total)<body.milestone)throw new HttpError('VALIDATION_ERROR','Palier non atteint.',422);
    const claim=await db.query('INSERT INTO album_milestone_claims(user_id,series_id,milestone) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING milestone',[id,body.seriesId,body.milestone]);
    if(!claim.rowCount)throw new HttpError('VALIDATION_ERROR','Récompense déjà réclamée.',409);
    const reward=({25:200,50:500,75:1000,100:2000} as Record<number,number>)[body.milestone];
    const balance=(await db.query<{balance:number}>('UPDATE users SET balance=balance+$1 WHERE id=$2 RETURNING balance',[reward,id])).rows[0].balance;
    await db.query('INSERT INTO ledger(id,user_id,amount,balance_after,reason,created_at,reference_id) VALUES($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),id,reward,balance,'album_milestone',new Date().toISOString(),body.seriesId+'-'+body.milestone]);
   }else if(body.action==='forge'){
    if(typeof body.cardId!=='string'||body.cardId.length>100)throw new HttpError('VALIDATION_ERROR','Carte invalide.',422);
    const card=(await db.query<{rarity:number}>('SELECT rarity FROM cards WHERE id=$1',[body.cardId])).rows[0];
    if(!card||card.rarity>3||card.rarity<0)throw new HttpError('VALIDATION_ERROR','Seules les cartes jusqu’à Épique peuvent être forgées.',422);
    const costs=[150,350,800,1800],cost=costs[card.rarity];
    if(me.balance<cost)throw new HttpError('VALIDATION_ERROR','Fragments insuffisants.',422);
    const own=await db.query('SELECT 1 FROM inventory WHERE user_id=$1 AND card_id=$2 AND quantity>0',[id,body.cardId]);
    if(own.rowCount)throw new HttpError('VALIDATION_ERROR','La forge est réservée aux cartes manquantes.',422);
    const balance=(await db.query<{balance:number}>('UPDATE users SET balance=balance-$1 WHERE id=$2 RETURNING balance',[cost,id])).rows[0].balance;
    await db.query('INSERT INTO inventory(user_id,card_id,quantity,favorite,first_obtained_at,last_obtained_at) VALUES($1,$2,1,0,$3,$3) ON CONFLICT(user_id,card_id) DO UPDATE SET quantity=inventory.quantity+1,last_obtained_at=EXCLUDED.last_obtained_at',[id,body.cardId,new Date().toISOString()]);
    const ref=randomUUID();
    await db.query('INSERT INTO ledger(id,user_id,amount,balance_after,reason,created_at,reference_id) VALUES($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),id,-cost,balance,'forge',new Date().toISOString(),ref]);
    await db.query('INSERT INTO acquisitions(id,user_id,card_id,quantity,source,created_at,reference_id) VALUES($1,$2,$3,1,$4,$5,$6)',[randomUUID(),id,body.cardId,'forge',new Date().toISOString(),ref]);
    await db.query('DELETE FROM card_wishlist WHERE user_id=$1 AND card_id=$2',[id,body.cardId]);
   }else throw new HttpError('VALIDATION_ERROR','Action inconnue.',422);
   return {ok:true,...await snapshot(db,id)};
  }));
 }catch(e){return errorResponse(e);}
}
