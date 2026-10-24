'use client';
import {useRef,useState} from 'react';
import {useGame} from './game-context';
const rarityNames=['Commune','Inhabituelle','Rare','Épique','Légendaire','Mythique'];
export function AdminCardCreator(){
 const {state,notify}=useGame();
 const [name,setName]=useState(''),[description,setDescription]=useState(''),[seriesId,setSeriesId]=useState(''),[rarity,setRarity]=useState(0);
 const [recycleValue,setRecycleValue]=useState(1),[collectionPoints,setCollectionPoints]=useState(1),[image,setImage]=useState(''),[busy,setBusy]=useState(false),[created,setCreated]=useState<{id:string;number:number}|null>(null);
 const input=useRef<HTMLInputElement>(null);
 if(state.currentUser?.role!=='admin')return null;
 async function readImage(file?:File){
  if(!file)return;
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>2*1024*1024){notify('PNG, JPEG ou WebP, maximum 2 Mo.');return;}
  const data=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('Image illisible'));reader.readAsDataURL(file);});
  setImage(data);
 }
 async function save(e:React.FormEvent){
  e.preventDefault();if(busy||!image)return;setBusy(true);
  try{
   const res=await fetch('/api/admin-cards',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,description,seriesId:seriesId||state.series[0]?.id,rarity,recycleValue,collectionPoints,image})});
   const json=await res.json();if(!res.ok)throw new Error(json.error?.message||json.error||'Création impossible');
   setCreated({id:json.id,number:json.number});notify('Carte ajoutée !');setName('');setDescription('');setImage('');if(input.current)input.current.value='';
  }catch(err){notify(err instanceof Error?err.message:'Erreur de création');}finally{setBusy(false);}
 }
 return <section className="panel" style={{padding:24,margin:'22px 0'}}><span className="eyebrow">ADMINISTRATION · CATALOGUE</span><h2 style={{margin:'10px 0'}}>Ajouter une carte</h2><p className="muted">Création immédiate dans le catalogue officiel. Aucun fichier GitHub nécessaire. Image enregistrée dans Supabase.</p>
 <form onSubmit={save} style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(250px,1fr))',gap:16,marginTop:20}}>
 <label className="field-label">Nom de la carte<input required maxLength={100} value={name} onChange={e=>setName(e.target.value)}/></label>
 <label className="field-label">Série<select required value={seriesId||state.series[0]?.id||''} onChange={e=>setSeriesId(e.target.value)}>{state.series.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
 <label className="field-label">Rareté<select value={rarity} onChange={e=>setRarity(Number(e.target.value))}>{rarityNames.map((r,i)=><option key={i} value={i}>{i} · {r}</option>)}</select></label>
 <label className="field-label">Image (PNG, JPEG ou WebP, 2 Mo max)<input ref={input} required type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>void readImage(e.target.files?.[0])}/></label>
 <label className="field-label">Points de recyclage<input type="number" required min={1} max={100000} value={recycleValue} onChange={e=>setRecycleValue(Number(e.target.value))}/></label>
 <label className="field-label">Points de collection<input type="number" required min={1} max={100000} value={collectionPoints} onChange={e=>setCollectionPoints(Number(e.target.value))}/></label>
 <label className="field-label" style={{gridColumn:'1 / -1'}}>Description<textarea maxLength={1000} value={description} onChange={e=>setDescription(e.target.value)} rows={3}/></label>
 {image&&<div style={{gridColumn:'1 / -1'}}><p>Aperçu de l'illustration :</p><img src={image} alt="Aperçu" style={{width:150,height:190,objectFit:'contain',borderRadius:12,background:'#16141c'}}/></div>}
 <button type="submit" className="button primary" disabled={busy||!image||!state.series.length} style={{gridColumn:'1 / -1'}}>{busy?'Création…':'Ajouter la carte au site officiel'}</button>
 </form>
 {created&&<p role="status" style={{marginTop:12}}>Carte n°{created.number} enregistrée. <a href={'/wiki/'+created.id}>Voir la carte</a>. Actualise pour la retrouver dans le catalogue.</p>}
 </section>;
}
