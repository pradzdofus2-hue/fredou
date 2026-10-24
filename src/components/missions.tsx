'use client';
import {useCallback,useEffect,useState} from 'react';
import {useGame} from './game-context';
type Mission={id:string;title:string;description:string;period:'daily'|'weekly';metric:string;target:number;reward:number;active:boolean;progress:number;claimed:boolean};
type Data={missions:Mission[];admin:boolean;serverTime:string};
const metrics=[['openings','Boosters ouverts'],['listings','Annonces créées'],['sales','Cartes vendues'],['acquisitions','Cartes obtenues'],['legendary','Légendaires obtenues']];
export function MissionsPage(){
 const {state,login,notify}=useGame();
 const [data,setData]=useState<Data|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [title,setTitle]=useState(''),[description,setDescription]=useState(''),[metric,setMetric]=useState('openings'),[target,setTarget]=useState(10),[reward,setReward]=useState(100);
 const load=useCallback(async()=>{try{const r=await fetch('/api/missions',{cache:'no-store'});const b=await r.json();if(!r.ok)throw Error(b.error?.message||b.error||'Chargement impossible');setData(b);setError('');}catch(e){setError(e instanceof Error?e.message:'Erreur');}},[]);
 useEffect(()=>{if(state.currentUser)void load();},[state.currentUser?.id,load]);
 async function action(body:Record<string,unknown>){if(busy)return;setBusy(true);try{const r=await fetch('/api/missions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const b=await r.json();if(!r.ok)throw Error(b.error?.message||b.error||'Action impossible');notify(b.message||'Enregistré');await load();}catch(e){notify(e instanceof Error?e.message:'Erreur');}finally{setBusy(false);}}
 if(!state.currentUser)return <main className="page-container"><h1>Missions & succès</h1><p>Connecte-toi pour retrouver tes missions.</p><button className="button primary" onClick={login}>Connexion Discord</button></main>;
 return <main className="page-container" style={{maxWidth:1220,margin:'2rem auto',padding:'0 1.25rem 4rem'}}>
 <span className="eyebrow">Missions · Krosmoria</span><h1 style={{fontSize:'clamp(2rem,5vw,4rem)',margin:'1rem 0'}}>Missions <span style={{color:'#ff5037'}}>&</span> récompenses</h1>
 <p className="muted">Complète des objectifs pour obtenir des Éclats. Les missions du jour se renouvellent à minuit UTC, celles de la semaine le lundi.</p>
 {error&&<div className="panel"><p>{error}</p><button className="button secondary" onClick={()=>void load()}>Réessayer</button></div>}
 {data&&(['daily','weekly'] as const).map(period=><section className="panel" key={period} style={{marginTop:24,padding:24}}>
 <h2>{period==='daily'?'Missions du jour':'Missions de la semaine'}</h2>
 <div style={{display:'grid',gap:12,marginTop:18}}>{data.missions.filter(m=>m.period===period&&m.active).map(m=><article key={m.id} style={{background:'#181720',border:'1px solid #34303e',borderRadius:14,padding:'16px 18px',display:'flex',alignItems:'center',gap:16,flexWrap:'wrap'}}>
 <div style={{flex:'1 1 240px'}}><strong>{m.title}</strong><p className="muted" style={{margin:'5px 0'}}>{m.description}</p><div style={{height:7,background:'#30303a',borderRadius:9,overflow:'hidden'}}><div style={{height:'100%',width:(Math.min(1,m.progress/m.target)*100)+'%',background:'#ff5037'}}/></div><small>{Math.min(m.progress,m.target)}/{m.target}</small></div>
 <strong style={{color:'#60d6ff'}}>+{m.reward} ◆</strong><button className="button primary small" disabled={busy||m.claimed||m.progress<m.target} onClick={()=>void action({action:'claim',id:m.id})}>{m.claimed?'Réclamé':m.progress>=m.target?'Réclamer':'En cours'}</button>
 </article>)}</div></section>)}
 {data?.admin&&<section className="panel" style={{marginTop:24,padding:24}}><h2>Administration · Missions hebdomadaires</h2><p className="muted">Crée une mission visible par tous les joueurs. Les récompenses sont accordées une seule fois par semaine.</p>
 <form onSubmit={e=>{e.preventDefault();void action({action:'save',title,description,metric,target,reward,period:'weekly'});}} style={{display:'grid',gap:12,maxWidth:650,marginTop:16}}>
 <label className="field-label">Nom<input required minLength={3} maxLength={100} value={title} onChange={e=>setTitle(e.target.value)}/></label>
 <label className="field-label">Description<input value={description} maxLength={500} onChange={e=>setDescription(e.target.value)}/></label>
 <label className="field-label">Objectif<select value={metric} onChange={e=>setMetric(e.target.value)}>{metrics.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
 <label className="field-label">Nombre à atteindre<input type="number" min="1" max="100000" value={target} onChange={e=>setTarget(Number(e.target.value))}/></label>
 <label className="field-label">Récompense en Éclats<input type="number" min="0" max="10000" value={reward} onChange={e=>setReward(Number(e.target.value))}/></label>
 <button className="button primary" disabled={busy}>Créer la mission</button></form>
 <h3 style={{marginTop:24}}>Missions personnalisées</h3>{data.missions.filter(m=>m.id.startsWith('custom-')).map(m=><div key={m.id} style={{display:'flex',alignItems:'center',gap:12,margin:'10px 0'}}><span style={{flex:1}}>{m.title} · {m.target} · +{m.reward} ◆</span><button className="button secondary small" disabled={busy} onClick={()=>void action({action:'toggle',id:m.id,active:!m.active})}>{m.active?'Désactiver':'Activer'}</button></div>)}
 </section>}
 </main>;
}
