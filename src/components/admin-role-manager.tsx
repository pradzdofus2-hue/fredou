'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';
import {useGame} from './game-context';
type User={id:string;username:string;role:string};
export function AdminRoleManager(){
 const {state,notify}=useGame();
 const [users,setUsers]=useState<User[]>([]),[query,setQuery]=useState(''),[selected,setSelected]=useState(''),[busy,setBusy]=useState(false),[confirm,setConfirm]=useState(false),[error,setError]=useState('');
 const load=useCallback(async()=>{try{const r=await fetch('/api/admin-users',{cache:'no-store'});const d=await r.json();if(!r.ok)throw Error(d.error?.message||'Chargement impossible');setUsers(d.users);setError('');}catch(e){setError(e instanceof Error?e.message:'Erreur');}},[]);
 useEffect(()=>{if(state.currentUser?.role==='admin')void load();},[state.currentUser?.id,state.currentUser?.role,load]);
 const results=useMemo(()=>users.filter(u=>u.role!=='admin'&&(u.username.toLocaleLowerCase().includes(query.toLocaleLowerCase())||u.id.includes(query))).slice(0,100),[users,query]);
 const target=users.find(u=>u.id===selected);
 if(state.currentUser?.role!=='admin')return null;
 async function promote(){if(!target||busy)return;setBusy(true);try{const r=await fetch('/api/admin-users',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:target.id,role:'admin'})});const d=await r.json();if(!r.ok)throw Error(d.error?.message||'Promotion impossible');notify(d.message);setSelected('');setConfirm(false);await load();}catch(e){notify(e instanceof Error?e.message:'Erreur');}finally{setBusy(false);}}
 return <section className="panel" style={{padding:24,margin:'22px 0'}}><span className="eyebrow">ADMINISTRATION · COMPTES</span><h2 style={{margin:'10px 0'}}>Gestion des administrateurs</h2><p className="muted">Sélectionne un joueur ou recherche son pseudo / identifiant pour lui attribuer le rôle administrateur.</p>
 {error&&<p role="alert">{error}</p>}
 <div style={{display:'grid',gap:13,maxWidth:640,marginTop:18}}>
 <label className="field-label">Rechercher un joueur<input value={query} maxLength={100} placeholder="Pseudo ou identifiant du joueur" onChange={e=>{setQuery(e.target.value);setSelected('');setConfirm(false);}}/></label>
 <label className="field-label">Compte joueur<select value={selected} onChange={e=>{setSelected(e.target.value);setConfirm(false);}}><option value="">Choisir un joueur…</option>{results.map(u=><option value={u.id} key={u.id}>{u.username} — {u.id}</option>)}</select></label>
 {target&&<div style={{padding:14,border:'1px solid #554050',borderRadius:12}}><strong>{target.username}</strong><p className="muted" style={{fontSize:12,overflowWrap:'anywhere'}}>{target.id}</p><p>Rôle actuel : {target.role}</p><label style={{display:'flex',gap:8,alignItems:'start'}}><input type="checkbox" checked={confirm} onChange={e=>setConfirm(e.target.checked)}/>Je confirme donner à ce compte les droits d'administration du site.</label></div>}
 <button className="button primary" disabled={!target||!confirm||busy} onClick={()=>void promote()}>{busy?'Promotion…':'Promouvoir ce joueur en administrateur'}</button>
 </div></section>;
}
