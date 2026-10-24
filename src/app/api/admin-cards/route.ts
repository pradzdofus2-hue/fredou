import {randomUUID} from 'node:crypto';
import {cookieValue,SESSION_COOKIE} from '@/server/auth';
import {getPgSessionUser} from '@/server/postgres-auth';
import {pgTransaction} from '@/server/postgres';
import {errorResponse,HttpError,json,validateOrigin} from '@/server/http';
export const runtime='nodejs';
export const dynamic='force-dynamic';
async function admin(req:Request){
 const userId=await getPgSessionUser(cookieValue(req,SESSION_COOKIE));
 if(!userId)throw new HttpError('AUTH_REQUIRED','Connexion requise.',401);
 const rows=await pgTransaction(db=>db.query<{role:string}>('SELECT role FROM users WHERE id=$1',[userId]));
 if(rows.rows[0]?.role!=='admin')throw new HttpError('FORBIDDEN','Administrateur uniquement.',403);
 return userId;
}
export async function POST(req:Request){
 try{
 validateOrigin(req);await admin(req);
 const body=await req.json();
 const name=typeof body.name==='string'?body.name.trim():'';
 const description=typeof body.description==='string'?body.description.trim():'';
 const seriesId=body.seriesId;
 const rarity=body.rarity;
 const recycleValue=body.recycleValue;
 const collectionPoints=body.collectionPoints;
 if(name.length<2||name.length>100||description.length>1000||typeof seriesId!=='string'||!Number.isInteger(rarity)||rarity<0||rarity>5||!Number.isInteger(recycleValue)||recycleValue<1||recycleValue>100000||!Number.isInteger(collectionPoints)||collectionPoints<1||collectionPoints>100000)throw new HttpError('VALIDATION_ERROR','Vérifie le nom, la rareté, la série et les points.',422);
 const match=typeof body.image==='string'?/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(body.image):null;
 if(!match)throw new HttpError('VALIDATION_ERROR','Image PNG, JPEG ou WebP obligatoire.',422);
 const buffer=Buffer.from(match[2],'base64');
 if(buffer.length<100||buffer.length>2*1024*1024)throw new HttpError('VALIDATION_ERROR','Image limitée à 2 Mo.',422);
 const mime=match[1];
 const signature=mime==='image/png'?buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):mime==='image/jpeg'?buffer[0]===255&&buffer[1]===216&&buffer[2]===255:buffer.toString('ascii',0,4)==='RIFF'&&buffer.toString('ascii',8,12)==='WEBP';
 if(!signature)throw new HttpError('VALIDATION_ERROR','Fichier image invalide.',422);
 return json(await pgTransaction(async db=>{
 const series=await db.query('SELECT id FROM series WHERE id=$1',[seriesId]);
 if(series.rowCount!==1)throw new HttpError('VALIDATION_ERROR','Série introuvable.',422);
 // Serialize number allocation across concurrent admin requests.
 await db.query('SELECT pg_advisory_xact_lock($1)',[87211056]);
 const number=Number((await db.query<{n:number}>('SELECT COALESCE(MAX(number),0)+1 AS n FROM cards')).rows[0].n);
 const id='custom-card-'+randomUUID();
 await db.query('INSERT INTO cards(id,number,name,rarity,series_id,description,image,recycle_value,collection_points) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[id,number,name,rarity,seriesId,description||name+' rejoint Krosmoria.', '/api/card-art/'+id,recycleValue,collectionPoints]);
 await db.query('INSERT INTO admin_card_art(card_id,mime,data) VALUES($1,$2,$3)',[id,mime,buffer]);
 return {ok:true,id,number,message:'Carte ajoutée au catalogue !'};
 }));
 }catch(e){return errorResponse(e);}
}
