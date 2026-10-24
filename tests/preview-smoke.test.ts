import test from 'node:test';
import assert from 'node:assert/strict';
import {smokePreview} from '../scripts/check-preview';
const cards=Array.from({length:120},(_,i)=>({id:'card-'+i,image:'/art/dofus/'+(i+1)+'.png'}));
const state={currentUser:null,ledger:[],inventory:[],openings:[],acquisitions:[],cards,boosters:Array.from({length:5},(_,i)=>({id:String(i)}))};
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
