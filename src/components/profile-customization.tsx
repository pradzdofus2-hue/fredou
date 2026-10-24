'use client';
import {useEffect,useState} from 'react';
import {useGame} from './game-context';
import './collection-studio.css';
type Cosmetic={title:string;banner:string;featured_card:string|null};
export function ProfileCustomization(){
 const {state,notify}=useGame();
 const [data,setData]=useState<Cosmetic|null>(null),[titles,setTitles]=useState<string[]>([]),[banners,setBanners]=useState<string[]>([]);
 const [title,setTitle]=useState('Collectionneur'),[banner,setBanner]=useState('astral'),[featured,setFeatured]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{let live=true;fetch('/api/collection-studio').then(async r=>{const x=await r.json();if(!r.ok)throw Error(x.error?.message||'Erreur');if(live){setData(x.cosmetic);setTitles(x.titles);setBanners(x.banners);setTitle(x.cosmetic.title);setBanner(x.cosmetic.banner);setFeatured(x.cosmetic.featured_card||'');}}).catch(e=>{if(live)setError(String(e));});return()=>{live=false;};},[]);
 if(!state.currentUser)return null;
 const owned=new Set(state.inventory.filter(i=>i.quantity>0).map(i=>i.cardId));
 const cards=state.cards.filter(c=>owned.has(c.id));
 return <section className="fc-studio-panel"><h2>✦ Personnaliser mon profil</h2><p>Modifie ton titre, ta bannière et la carte présentée aux visiteurs de ton profil.</p>
 {error&&<p role="alert" className="fc-studio-error">{error}</p>}
 {data&&<><div className={'fc-studio-banner fc-studio-banner-'+banner}><strong>{state.currentUser.username}</strong><span>{title}</span>{featured&&<img src={state.cards.find(c=>c.id===featured)?.image} alt="Carte présentée" loading="lazy"/>}</div>
 <div className="fc-studio-controls"><label>Titre<select value={title} onChange={e=>setTitle(e.target.value)}>{titles.map(t=><option key={t}>{t}</option>)}</select></label><label>Bannière<select value={banner} onChange={e=>setBanner(e.target.value)}>{banners.map(b=><option key={b} value={b}>{({astral:'Astrale',royal:'Royale',forest:'Sylvestre',ember:'Braise'} as Record<string,string>)[b]}</option>)}</select></label><label>Carte mise en avant<select value={featured} onChange={e=>setFeatured(e.target.value)}><option value="">Aucune</option>{cards.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label></div>
 <button className="button primary" disabled={busy} onClick={async()=>{setBusy(true);setError('');try{const r=await fetch('/api/collection-studio',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'cosmetic',title,banner,cardId:featured})});const x=await r.json();if(!r.ok)throw Error(x.error?.message||'Erreur');setData(x.cosmetic);notify('Profil personnalisé !');}catch(e){setError(e instanceof Error?e.message:'Erreur');}finally{setBusy(false);}}}>Enregistrer les modifications</button></>}</section>;
}
