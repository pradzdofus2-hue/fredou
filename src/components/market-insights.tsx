'use client';
import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {useGame} from './game-context';
import './collection-studio.css';
type Offer={id:string;user_id:string;username:string;card_id:string;price:number;created_at:string};
export function MarketInsights(){
 const {state,notify,login}=useGame();
 const [open,setOpen]=useState(false),[offers,setOffers]=useState<Offer[]>([]),[favorites,setFavorites]=useState<string[]>([]),[cardId,setCardId]=useState(''),[price,setPrice]=useState(100),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [term,setTerm]=useState('');
 const refresh=async()=>{try{const r=await fetch('/api/market-offers',{cache:'no-store'});if(!r.ok)throw Error('Offres indisponibles');const x=await r.json();setOffers(x.offers);setFavorites(x.favorites);}catch(e){setError(e instanceof Error?e.message:'Erreur');}};
 useEffect(()=>{void refresh();},[state.currentUser?.id]);
 const selected=state.cards.find(c=>c.id===cardId);
 const sales=useMemo(()=>state.priceHistory.filter(p=>p.cardId===cardId).sort((a,b)=>a.soldAt.localeCompare(b.soldAt)),[cardId,state.priceHistory]);
 const recent=sales.slice(-12),min=recent.length?Math.min(...recent.map(x=>x.unitPrice)):0,max=recent.length?Math.max(...recent.map(x=>x.unitPrice)):0,average=recent.length?Math.round(recent.reduce((n,x)=>n+x.unitPrice*x.quantity,0)/recent.reduce((n,x)=>n+x.quantity,0)):0;
 const relevant=state.cards.filter(c=>c.name.toLocaleLowerCase('fr').includes(term.toLocaleLowerCase('fr'))).slice(0,40);
 const send=async(action:'create'|'cancel',id=cardId)=>{if(!state.currentUser)return login();setBusy(true);setError('');try{const r=await fetch('/api/market-offers',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,cardId:id,price})});const x=await r.json();if(!r.ok)throw Error(x.error?.message||'Action refusée');await refresh();notify(action==='create'?'Offre publiée. Aucun Éclat n’a été prélevé.':'Offre supprimée');}catch(e){setError(e instanceof Error?e.message:'Erreur');}finally{setBusy(false);}};
 const favorite=async()=>{if(!state.currentUser)return login();if(!cardId)return;setBusy(true);try{const add=!favorites.includes(cardId);const r=await fetch('/api/collection-studio',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'wishlist',cardId,add})});const x=await r.json();if(!r.ok)throw Error(x.error?.message||'Erreur');setFavorites(x.wishlist);notify(add?'Carte suivie':'Carte retirée du suivi');}catch(e){setError(e instanceof Error?e.message:'Erreur');}finally{setBusy(false);}};
 const cheapest=cardId?state.listings.filter(l=>l.cardId===cardId&&l.status==='active').sort((a,b)=>a.price-b.price)[0]:undefined;
 return <section className="fc-market-insights"><button className="button secondary" onClick={()=>setOpen(x=>!x)} aria-expanded={open}>{open?'Masquer':'Afficher'} le marché avancé · prix, offres, favoris</button>{open&&<div className="fc-studio-panel"><h2>✦ Observatoire du marché</h2><p>Historique des ventes, tendances et offres d'achat. Les offres sont des intentions de négocier : elles ne réservent ni carte ni Éclats.</p>
 {error&&<p role="alert" className="fc-studio-error">{error}</p>}
 <label>Rechercher une carte<input className="fc-studio-search" type="search" value={term} onChange={e=>setTerm(e.target.value)} placeholder="Nom de la carte…"/></label>
 <select className="fc-studio-search" aria-label="Carte analysée" value={cardId} onChange={e=>setCardId(e.target.value)}><option value="">Choisis une carte</option>{relevant.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
 {selected&&<><div className="fc-market-metrics"><div><small>Dernier prix vendu</small><strong>{recent.at(-1)?.unitPrice??'—'} Éclats</strong></div><div><small>Moyenne des dernières ventes</small><strong>{recent.length?average:'—'} Éclats</strong></div><div><small>Meilleure annonce active</small><strong>{cheapest?cheapest.price+' Éclats':'Aucune'}</strong></div><div><small>Tendance disponible</small><strong>{recent.length>1?(recent.at(-1)!.unitPrice>recent[0].unitPrice?'↗ Hausse':recent.at(-1)!.unitPrice<recent[0].unitPrice?'↘ Baisse':'→ Stable'):'Données insuffisantes'}</strong></div></div>
 <div className="fc-market-chart" aria-label="Douze dernières ventes de cette carte">{recent.length?recent.map((p,i)=><div key={i} title={p.unitPrice+' Éclats · '+p.quantity+' exemplaire(s)'}><span style={{height:((p.unitPrice-min)/Math.max(1,max-min)*75+15)+'%'}}/><small>{p.unitPrice}</small></div>):<p>Aucune vente enregistrée dans l'historique récent.</p>}</div>
 <div className="fc-studio-controls"><button disabled={busy} className="button secondary" onClick={()=>void favorite()}>{favorites.includes(cardId)?'♥ Ne plus suivre':'♡ Suivre cette carte'}</button><Link className="button secondary" href={'/marche?card='+cardId}>Voir les annonces</Link></div>
 <div className="fc-market-offer-form"><label>Mon offre d'achat en Éclats<input type="number" min="1" max="1000000" value={price} onChange={e=>setPrice(Number(e.target.value))}/></label><button className="button primary" disabled={busy} onClick={()=>void send('create')}>Publier mon offre</button>{offers.some(o=>o.card_id===cardId&&o.user_id===state.currentUser?.id)&&<button className="button secondary" disabled={busy} onClick={()=>void send('cancel')}>Retirer mon offre</button>}</div>
 <h3>Offres d'achat pour {selected.name}</h3>{offers.filter(o=>o.card_id===cardId).length?offers.filter(o=>o.card_id===cardId).map(o=><div className="fc-market-offer-row" key={o.id}><Link href={'/profil/'+o.user_id}>{o.username}</Link><strong>{o.price} Éclats</strong><Link href={'/echanges?recipient='+o.user_id}>Proposer un échange ↗</Link></div>):<p>Aucune offre actuellement.</p>}
 </>}
 {favorites.length>0&&<div className="fc-market-watch"><h3>Mes cartes suivies ({favorites.length})</h3>{favorites.map(id=>{const c=state.cards.find(x=>x.id===id);if(!c)return null;const listings=state.listings.filter(l=>l.cardId===id&&l.status==='active');return <button key={id} onClick={()=>{setCardId(id);setTerm(c.name);}}>{c.name} {listings.length?'· '+Math.min(...listings.map(x=>x.price))+' Éclats disponibles':'· Aucune vente active'}</button>})}</div>}
 </div>}</section>;
}
