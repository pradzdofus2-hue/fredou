'use client';
import {useCallback,useEffect,useState} from 'react';
import {useGame} from './game-context';
type Success={id:string;title:string;description:string;target:number;reward:number;progress:number;claimed:boolean};
export function PermanentSuccesses(){
 const {state,login,notify}=useGame();
 const [items,setItems]=useState<Success[]>([]),[filter,setFilter]=useState<'all'|'pending'|'claimed'>('all'),[busy,setBusy]=useState(false),[review,setReview]=useState('');
 const [error,setError]=useState('');
 const load=useCallback(async()=>{try{const res=await fetch('/api/kyara-successes',{cache:'no-store'});const data=await res.json();if(!res.ok)throw Error(data.error?.message||'Succès indisponibles');setItems(data.successes);setError('');}catch(e){setError(e instanceof Error?e.message:'Erreur de chargement');}},[]);
 useEffect(()=>{if(state.currentUser)void load();},[state.currentUser?.id,load]);
 async function act(body:Record<string,unknown>){if(busy)return;setBusy(true);try{const r=await fetch('/api/kyara-successes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await r.json();if(!r.ok)throw Error(data.error?.message||'Action impossible');notify(data.message);await load();}catch(e){notify(e instanceof Error?e.message:'Erreur');}finally{setBusy(false);}}
 if(!state.currentUser)return <section className="panel" style={{marginTop:24,padding:24}}><h2>Succès</h2><button className="button primary" onClick={login}>Connecte-toi pour voir tes succès</button></section>;
 return <section id="succes-permanents" style={{marginTop:38}}>
 <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:16,flexWrap:'wrap',marginBottom:18}}><div><span className="eyebrow">Défis permanents</span><h2 style={{fontSize:'2rem',margin:'8px 0'}}>Succès {items.filter(s=>s.claimed).length}/{items.length||23}</h2></div><div style={{display:'flex',gap:8}}>{([['all','Tous'],['pending','À faire'],['claimed','Obtenus']] as const).map(([id,label])=><button key={id} className={'button '+(filter===id?'primary':'secondary')+' small'} onClick={()=>setFilter(id)}>{label}</button>)}</div></div>
 {error&&<p role="alert">{error} <button onClick={()=>void load()}>Réessayer</button></p>}
 <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))',gap:12}}>
 {items.filter(s=>filter==='all'||(filter==='claimed'?s.claimed:!s.claimed)).map(s=><article key={s.id} style={{border:'1px solid #302b3a',background:'#17151e',borderRadius:15,padding:16,display:'flex',gap:12}}>
 <div style={{width:42,height:42,flexShrink:0,border:'1px solid #3c3744',borderRadius:11,display:'grid',placeItems:'center',color:s.claimed?'#e8bb52':'#9d92b4',fontSize:20}}>{s.claimed?'★':'?'}</div>
 <div style={{minWidth:0,flex:1}}><strong>{s.title}</strong><p style={{fontSize:12,margin:'7px 0',minHeight:33}}>{s.description}</p>
 <div style={{height:7,borderRadius:9,background:'#302d38',overflow:'hidden'}}><div style={{height:'100%',background:'#ff533a',width:(100*Math.min(1,s.progress/s.target))+'%'}}/></div>
 <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginTop:6,gap:8}}><span>{s.progress.toLocaleString('fr-FR')}/{s.target.toLocaleString('fr-FR')}</span><span>+{s.reward} ◆</span></div>
 {s.progress>=s.target&&!s.claimed&&<button className="button primary small" style={{marginTop:9}} disabled={busy} onClick={()=>void act({action:'claim',id:s.id})}>Réclamer</button>}
 {s.claimed&&<span style={{color:'#e8bb52',fontSize:12}}>✓ Obtenu</span>}
 </div></article>)}</div>
 {!items.length&&!error&&<p>Chargement des succès…</p>}
 {items.some(s=>s.id==='review'&&!s.claimed&&s.progress===0)&&<div className="panel" style={{marginTop:20,padding:20}}><h3>Critique : donne ton avis sur Krosmoria</h3><textarea aria-label="Ton avis" value={review} onChange={e=>setReview(e.target.value)} maxLength={1000} placeholder="Ton retour en au moins 10 caractères…" style={{width:'100%',minHeight:90,margin:'12px 0'}}/><button className="button primary" disabled={busy||review.trim().length<10} onClick={()=>void act({action:'review',content:review})}>Envoyer mon avis</button></div>}
 </section>;
}
