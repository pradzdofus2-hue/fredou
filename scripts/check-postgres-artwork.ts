/** Validate the complete live PostgreSQL catalogue against actual public assets.
 * Read-only SQL and filesystem checks: never writes to Supabase.
 */
import {existsSync, statSync} from 'node:fs';
import {resolve,sep} from 'node:path';
import {pgPool,pgRead} from '../src/server/postgres';

type CardArtwork={id:string;image:string|null};
async function main(){
 if(!process.env.DATABASE_URL&&!process.env.SUPABASE_DB_URL)
  throw new Error('DATABASE_URL / SUPABASE_DB_URL manquant');
 try{
  const cards=await pgRead<CardArtwork>('SELECT id,image FROM cards ORDER BY id');
  if(cards.length<100)throw Error('Catalogue PostgreSQL incomplet : '+cards.length+' cartes');
  const publicRoot=resolve('public')+sep;
  const references=new Map<string,number>();
  const invalid:string[]=[];
  for(const {id,image} of cards){
   if(!image||!/^\/art\/[a-zA-Z0-9_./-]+$/.test(image)||image.split('/').includes('..')){
    invalid.push(id+': '+String(image));continue;
   }
   references.set(image,(references.get(image)||0)+1);
  }
  const missing:string[]=[];
  let present=0;
  for(const [url,n] of references){
   const file=resolve('public','.'+url);
   if(!file.startsWith(publicRoot)){invalid.push(url);continue;}
   if(existsSync(file)&&statSync(file).isFile()&&statSync(file).size>0)present++;
   else missing.push(url+' ('+n+' cartes)');
  }
  console.log('Catalogue Supabase : '+cards.length+' cartes');
  console.log('Illustrations distinctes : '+references.size);
  console.log('Fichiers présents : '+present+' ; manquants : '+missing.length+' ; chemins invalides : '+invalid.length);
  for(const x of invalid.slice(0,20))console.error('CHEMIN INVALIDE : '+x);
  for(const x of missing.slice(0,20))console.error('ILLUSTRATION ABSENTE : '+x);
  if(invalid.length||missing.length)throw Error('Les images du catalogue PostgreSQL ne sont pas toutes disponibles dans public/');
  console.log('CATALOGUE SUPABASE / IMAGES LOCALES : OK (lecture seule)');
 }finally{
  await pgPool().end();
 }
}
main().catch(e=>{console.error('PG ARTWORK KO : '+(e instanceof Error?e.message:String(e)));process.exitCode=1;});
