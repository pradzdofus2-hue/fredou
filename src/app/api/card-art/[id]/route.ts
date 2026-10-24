import {pgRead} from '@/server/postgres';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 if(!/^custom-card-[a-f0-9-]{36}$/.test(id))return new Response('Not found',{status:404});
 try{
 const rows=await pgRead<{mime:string;data:Buffer}>('SELECT mime,data FROM admin_card_art WHERE card_id=$1',[id]);
 if(!rows[0])return new Response('Not found',{status:404});
 return new Response(new Uint8Array(rows[0].data),{headers:{'Content-Type':rows[0].mime,'Cache-Control':'public,max-age=3600','X-Content-Type-Options':'nosniff'}});
 }catch{return new Response('Unavailable',{status:503});}
}
