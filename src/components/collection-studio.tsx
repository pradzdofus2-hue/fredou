'use client';
import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import './collection-studio.css';
import {useGame} from './game-context';
import {PageIntro} from './primitives';
type Studio={wishlist:string[];cosmetic:{title:string;banner:string;featured_card:string|null};season:{key:string;xp:number;level:number;claimed:number[]};titles:string[];banners:string[]};
const costs=[150,350,800,1800];
export function CollectionStudioPage(){
 const {state,notify,refresh}=useGame();
 const [data,setData]=useState<Studio|null>(null),[error,setError]=useState(''),[pending,setPending]=useState(false),[query,setQuery]=useState(''),[selected,setSelected]=useState('');
 const owned=useMemo(()=>new Set(state.inventory.filter(x=>x.quantity>0).map(x=>x.cardId)),[state.inventory]);
 const missing=useMemo(()=>state.cards.filter(c=>!owned.has(c.id)&&c.name.toLowerCase().includes(query.toLowerCase())).slice(0,60),[state.cards,owned,query]);
 useEffect(()=>{if(!state.currentUser)return;let live=true;fetch('/api/collection-studio',{cache:'no-store'}).then(async r=>{const x=await r.json();if(!r.ok)throw Error(x.error?.message||'Erreur');if(live){setData(x);}}).catch(e=>{if(live)setError(String(e.message||e));});return()=>{live=false;};},[state.currentUser?.id]);
 const doAction=async(action:string,other:Record<string,unknown>={})=>{if(pending)return;setPending(true);setError('');try{const r=await fetch('/api/collection-studio',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...other})});const x=await r.json();if(!r.ok)throw Error(x.error?.message||'Action refusée');setData(x);notify('Modification enregistrée !');if(action==='forge'||action==='season')window.location.reload();}catch(e){setError(e instanceof Error?e.message:'Erreur');}finally{setPending(false);}};
 if(!state.currentUser)return <section className="fc-studio"><h1>Atelier du collectionneur</h1><p>Connecte-toi avec Discord pour accéder à tes souhaits, ta forge et ton passe de saison.</p></section>;
 const cards=data?.wishlist.map(id=>state.cards.find(c=>c.id===id)).filter((c):c is (typeof state.cards)[number]=>!!c)||[];
 const choose=state.cards.find(c=>c.id===selected);
 
 return <div className="fc-studio"><PageIntro eyebrow="NOUVEAU • KROSMORIA" title="Atelier du collectionneur" text="Des récompenses de saison, une forge, tes souhaits et les cartes à fabriquer."/>
 {error&&<p role="alert" className="fc-studio-error">{error}</p>}{!data?<p>Chargement de ton atelier…</p>:<>
 <section className="fc-studio-panel"><h2>✦ Passe de saison gratuit — {data.season.key}</h2><p>Ouvre des boosters pour progresser : 3 ouvertures = 1 niveau. La saison change chaque mois.</p><div className="fc-studio-level"><strong>Niveau {data.season.level}/30</strong><span>{data.season.xp} ouvertures cette saison</span></div><div className="fc-studio-rewards">{Array.from({length:30},(_,i)=>i+1).map(n=><button key={n} disabled={pending||n>data.season.level||data.season.claimed.includes(n)} onClick={()=>doAction('season',{level:n})}><strong>{n}</strong><span>{data.season.claimed.includes(n)?'✓ Récupéré':n>data.season.level?'Verrouillé':(50+n*10)+' Éclats'}</span></button>)}</div></section>
 <section className="fc-studio-panel"><h2>✦ Liste de souhaits</h2><p>Choisis jusqu'à 100 cartes manquantes. Tes souhaits sont sauvegardés sur ton compte.</p>{cards.length?<div className="fc-studio-cardlist">{cards.map(c=><div key={c.id}><img src={c.image} alt="" loading="lazy"/><span>{c.name}{state.listings.some(l=>l.cardId===c.id&&l.status==='active')&&<Link href={'/marche?card='+c.id} className="fc-studio-sale">Disponible au marché ↗</Link>}</span><button disabled={pending} onClick={()=>doAction('wishlist',{cardId:c.id,add:false})}>Retirer</button></div>)}</div>:<p>Ta liste est vide pour le moment.</p>}</section>
 <section className="fc-studio-panel"><h2>✦ Forge de cartes manquantes</h2><p>Dépense des fragments pour créer une carte que tu ne possèdes pas. Coûts en Éclats : Commune 150 · Peu commune 350 · Rare 800 · Épique 1 800. Les légendaires et mythiques ne sont pas forgeables.</p><input className="fc-studio-search" type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Chercher une carte manquante…" aria-label="Chercher une carte"/><div className="fc-studio-cardlist">{missing.map(c=><div key={c.id}><img src={c.image} loading="lazy" alt=""/><span>{c.name}</span><button disabled={pending||data.wishlist.includes(c.id)} onClick={()=>doAction('wishlist',{cardId:c.id,add:true})}>{data.wishlist.includes(c.id)?'♥':'♡ Souhait'}</button>{c.rarity<=3&&<button onClick={()=>setSelected(c.id)}>Forger</button>}</div>)}</div>{choose&&<div className="fc-studio-forge"><h3>Forger : {choose.name}</h3><p>Coût : {costs[choose.rarity]??'Indisponible'} Éclats · Ton solde : {state.currentUser.balance}</p><button disabled={pending||choose.rarity>3||state.currentUser.balance<(costs[choose.rarity]??Infinity)} className="button primary" onClick={()=>doAction('forge',{cardId:choose.id})}>Confirmer la forge</button><button className="button secondary" onClick={()=>setSelected('')}>Annuler</button></div>}</section>
 </>}</div>;
}
