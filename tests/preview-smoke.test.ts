import test from 'node:test';
import assert from 'node:assert/strict';
import {smokePreview} from '../scripts/check-preview';
const cards=Array.from({length:120},(_,i)=>({id:'card-'+i,image:'/art/dofus/'+(i+1)+'.png'}));
const state={mode:'discord',discordConfigured:true,currentUser:null,ledger:[],inventory:[],openings:[],acquisitions:[],activities:[],cards,boosters:Array.from({length:5},(_,i)=>({id:String(i)}))};
function mockFetcher(broken?:string):typeof fetch{
 return (async(input:RequestInfo|URL)=>{
  const path=new URL(String(input)).pathname;
  if(path===broken)return new Response('Not Found',{status:404});
  if(path==='/')return new Response('<html>FREDOU</html>',{status:200,headers:{'content-type':'text/html'}});
  if(path==='/api/state')return Response.json(state);
  if(path.startsWith('/art/'))return new Response(new Uint8Array([137,80,78,71]),{status:200,headers:{'content-type':'image/png'}});
  return new Response('Not Found',{status:404});
 }) as typeof fetch;
}
test('preview smoke checks complete guest game response and representative images',async()=>{
 const result=await smokePreview('https://example.com/',mockFetcher());
 assert.equal(result.cards,120);
 assert.equal(result.images,5);
});
test('preview smoke blocks missing published artwork',async()=>{
 await assert.rejects(smokePreview('https://example.com/',mockFetcher('/art/dofus/1.png')),/HTTP 404/);
});
test('preview smoke blocks incomplete or private guest state',async()=>{
 const privateState={...state,currentUser:{id:'not-a-guest'}};
 const fetcher=(async(input:RequestInfo|URL)=>{
  if(new URL(String(input)).pathname==='/api/state')return Response.json(privateState);
  return mockFetcher()(input);
 }) as typeof fetch;
 await assert.rejects(smokePreview('https://example.com/',fetcher),/visiteur sans session/);
});
test('preview smoke rejects insecure targets without network access',async()=>{
 await assert.rejects(smokePreview('http://example.com/',mockFetcher()),/HTTPS/);
});

test('full preview audit checks every unique image rather than five samples',async()=>{
 let visited=0;
 const base=mockFetcher();
 const countImages=(async(input:RequestInfo|URL,init?:RequestInit)=>{
  if(new URL(String(input)).pathname.startsWith('/art/'))visited++;
  return base(input,init);
 }) as typeof fetch;
 const result=await smokePreview('https://example.com/',countImages,true);
 assert.equal(result.images,120);
 assert.equal(visited,120);
});
test('full preview audit detects a missing middle image outside the five samples',async()=>{
 const absent='/art/dofus/20.png';
 await assert.rejects(smokePreview('https://example.com/',mockFetcher(absent),true),/HTTP 404/);
});

test('preview refuses accidental local demo mode or disabled Discord',async()=>{
 for(const override of [{mode:'development'},{discordConfigured:false}]){
  const fetcher=(async(input:RequestInfo|URL)=>{
   if(new URL(String(input)).pathname==='/api/state')return Response.json({...state,...override});
   return mockFetcher()(input);
  }) as typeof fetch;
  await assert.rejects(smokePreview('https://example.com/',fetcher),/Discord/);
 }
});
test('preview refuses guest responses leaking private economic activity',async()=>{
 const fetcher=(async(input:RequestInfo|URL)=>{
  if(new URL(String(input)).pathname==='/api/state')
   return Response.json({...state,activities:[{id:'activity',userId:'another-player',kind:'referral',message:'secret',createdAt:'2026-10-24T00:00:00Z'}]});
  return mockFetcher()(input);
 }) as typeof fetch;
 await assert.rejects(smokePreview('https://example.com/',fetcher),/activités privées/);
});
