/** Read-only smoke test for the actual HTTPS preview. No logins, writes or secrets. */
import assert from 'node:assert/strict';
import type {StateResponse} from '../src/lib/contracts';

export async function smokePreview(baseUrl:string,fetcher:typeof fetch=fetch):Promise<{cards:number;images:number}>{
 const base=new URL(baseUrl);
 assert.equal(base.protocol,'https:','PREVIEW_URL doit être HTTPS');
 assert.equal(base.username,'');assert.equal(base.password,'');
 assert.equal(base.pathname,'/');assert.equal(base.search,'');assert.equal(base.hash,'');
 const retrieve=async(path:string)=>{
  const response=await fetcher(new URL(path,base),{redirect:'manual',signal:AbortSignal.timeout(15000),headers:{'Cache-Control':'no-cache'}});
  assert.equal(response.status,200,path+' a répondu HTTP '+response.status);
  return response;
 };
 const homepage=await retrieve('/');
 assert.ok((homepage.headers.get('content-type')||'').includes('text/html'),'Accueil HTML requis');
 const response=await retrieve('/api/state');
 assert.ok((response.headers.get('content-type')||'').includes('application/json'),'État JSON requis');
 const state=await response.json() as StateResponse;
 assert.equal(state.currentUser,null,'Le visiteur sans session ne doit pas être connecté');
 assert.equal(state.ledger.length,0,'Le visiteur ne doit pas recevoir de journal privé');
 assert.equal(state.inventory.length,0,'Le visiteur ne doit pas recevoir un inventaire privé');
 assert.equal(state.openings.length,0,'Le visiteur ne doit pas recevoir des ouvertures privées');
 assert.equal(state.acquisitions.length,0,'Le visiteur ne doit pas recevoir des acquisitions privées');
 assert.ok(state.cards.length>=100,'Catalogue incomplet sur la préproduction');
 assert.equal(state.boosters.length,5,'Les cinq boosters doivent être disponibles');
 const unique=[...new Set(state.cards.map(card=>card.image).filter(Boolean))];
 assert.ok(unique.length>0,'Illustrations manquantes dans le catalogue');
 const selected=[unique[0],unique[Math.floor(unique.length/4)],unique[Math.floor(unique.length/2)],unique[Math.floor(unique.length*3/4)],unique[unique.length-1]];
 for(const image of new Set(selected)){
  assert.ok(/^\/art\/[A-Za-z0-9_./-]+$/.test(image)&&!image.split('/').includes('..'),'Chemin d’image incorrect');
  const file=await retrieve(image);
  assert.ok((file.headers.get('content-type')||'').startsWith('image/'),'Image non servie comme image : '+image);
  await file.body?.cancel();
 }
 return {cards:state.cards.length,images:new Set(selected).size};
}
if(process.argv[1]?.replaceAll('\\','/').endsWith('/check-preview.ts')){
 const url=process.env.PREVIEW_URL;
 if(!url){console.error('PREVIEW_URL manquante (exemple : https://preview.example.com/)');process.exitCode=1;}
 else smokePreview(url).then(x=>console.log('PREVIEW OK : '+x.cards+' cartes ; '+x.images+' images vérifiées (échantillon).'))
  .catch(e=>{console.error('PREVIEW BLOQUÉE : '+(e instanceof Error?e.message:String(e)));process.exitCode=1;});
}
