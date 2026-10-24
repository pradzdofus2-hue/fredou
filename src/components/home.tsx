'use client';
import Link from 'next/link';
import { useEffect, useState, type CSSProperties } from 'react';
import { ArrowRight, Diamond, Gift, Pause, Play, ShoppingBag, Sparkles, Trophy } from 'lucide-react';
import { useGame, formatDate } from './game-context';
import { BoosterShowcase } from './boosters';
import { Avatar } from './community';

export function HomePage() {
  const { state } = useGame();
  const [slide, setSlide] = useState(0);
  const [paused, setPaused] = useState(false);
  const [interacting, setInteracting] = useState(false);
  const [systemReduced, setSystemReduced] = useState(false);
  const eventBooster = state.boosters.find(b => b.kind === 'event' && b.active);
  const daily = state.boosters.find(b => b.kind === 'daily') || state.boosters[0];
  const slides = eventBooster ? [daily, eventBooster] : [daily];
  const current = slides[slide % slides.length];
  const isEvent = current.kind === 'event';
  const event = state.events.find(e => e.id === current.eventId);
  const featured = state.cards.filter(c => (!current.seriesId || c.seriesId === current.seriesId) && c.rarity >= 4).slice(isEvent ? 1 : 0, isEvent ? 4 : 3);
  const reduced = !!state.currentUser?.preferences.reducedMotion || systemReduced;
  useEffect(() => { const media = window.matchMedia('(prefers-reduced-motion: reduce)'); const update = () => setSystemReduced(media.matches); update(); media.addEventListener('change', update); return () => media.removeEventListener('change', update); }, []);
  useEffect(() => { if (paused || interacting || reduced || slides.length < 2) return; const timer = setInterval(() => { if (document.visibilityState === 'visible') setSlide(value => (value + 1) % slides.length); }, 8000); return () => clearInterval(timer); }, [paused, interacting, reduced, slides.length]);
  const rareDraws = state.openings.flatMap(opening => opening.cards.map((draw, index) => ({ draw, opening, index, card: state.cards.find(c => c.id === draw.cardId)! }))).filter(item => item.card?.rarity >= 3).slice(0, 6);
  const market = state.listings.filter(l => l.status === 'active').slice(0, 3);
  const leaders = state.rankings.collectionPoints.slice(0, 3);
  return <>
    <div className="fc-home-container fc-home-top">
      <section className={`fc-feature-hero ${isEvent ? 'is-event' : 'is-daily'}`} aria-label="Boosters à la une" aria-roledescription="carrousel" onMouseEnter={() => setInteracting(true)} onMouseLeave={e => setInteracting(e.currentTarget.contains(document.activeElement))} onFocusCapture={() => setInteracting(true)} onBlurCapture={e => { if (!e.currentTarget.contains(e.relatedTarget)) setInteracting(e.currentTarget.matches(':hover')); }}>
        <div className="fc-hero-symbol" aria-hidden="true"><span/><span/><span/></div>
        <div className="fc-hero-content" key={current.id}>
          <p className="fc-hero-eyebrow">{isEvent ? 'CONVERGENCE DES ASTRES' : 'VOTRE RENDEZ-VOUS QUOTIDIEN'}<span> · {isEvent && event ? `JUSQU’AU ${new Date(event.endsAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }).toUpperCase()}` : '5 CARTES À DÉCOUVRIR'}</span></p>
          <h1>{isEvent ? <>L’appel<br/>{' '}des astres</> : <>Le rituel<br/>{' '}astral</>}</h1>
          <p className="fc-hero-description">{isEvent ? 'Les Citadelles astrales vous ouvrent leurs portes.' : 'Une nouvelle journée. Cinq nouvelles rencontres.'}</p>
          <div className="fc-hero-ctas"><Link className="fc-hero-primary" href={`/boosters?booster=${current.id}`}>{current.available > 0 || !current.price ? 'Ouvrir ce booster' : 'Découvrir ce booster'}<span>{current.available > 0 || !current.price ? <><Gift size={15}/>{current.price ? 'EN RÉSERVE' : 'GRATUIT'}</> : <>{current.price}<Diamond size={13}/></>}</span></Link><Link className="fc-hero-secondary" href={`/boosters?booster=${current.id}`}>Voir les détails</Link></div>
        </div>
        <div className="fc-hero-fan" aria-label="Exemples de cartes du catalogue">{featured.map((card,index) => <Link href={`/wiki/${card.id}`} className={`fc-hero-card fc-hero-card-${index}`} key={card.id} style={{ '--fc-card-color': state.config.rarities[card.rarity].color } as CSSProperties}><img src={card.image} alt={card.name}/><span>{card.name}</span></Link>)}</div>
        <div className="fc-carousel-controls">{slides.map((booster,index) => <button key={booster.id} className={index === slide % slides.length ? 'is-active' : ''} aria-label={`Afficher ${booster.name}`} aria-pressed={index === slide % slides.length} onClick={() => setSlide(index)}/>)}</div>
        {slides.length > 1 && !reduced && <button className="fc-carousel-pause" aria-label={paused ? 'Reprendre le défilement des boosters' : 'Mettre le défilement en pause'} onClick={() => setPaused(!paused)}>{paused ? <Play size={13}/> : <Pause size={13}/>}</button>}
      </section>
    </div>
    <section className="fc-home-steps" aria-label="Comment collectionner"><div className="fc-home-container"><div className="fc-steps-grid"><article><span>01</span><h2>Faites vos découvertes</h2><p>Des boosters gratuits se rechargent chaque jour. Ouvrez-les et laissez les cartes vous surprendre.</p></article><article><span>02</span><h2>Réunissez vos univers</h2><p>Trois mondes, trois albums. Vos doublons se recyclent en Éclats ou trouvent un autre collectionneur.</p></article><article><span>03</span><h2>Partagez l’aventure</h2><p>Explorez les fiches, trouvez une carte au marché et composez vos propres échanges.</p></article></div></div></section>
    <div className="fc-home-container fc-home-lower"><section className="fc-home-boosters"><BoosterShowcase compact/></section>
      <section className="fc-home-rares"><div className="fc-home-section-heading"><h2>Vos découvertes rares</h2><Link href="/collection">Votre collection<ArrowRight size={16}/></Link></div>{rareDraws.length ? <div className="fc-recent-draws">{rareDraws.map(({card,opening,index,draw}) => <Link href={`/wiki/${card.id}`} className="fc-rare-draw" key={`${opening.id}-${index}`} style={{ '--fc-card-color': state.config.rarities[card.rarity].color } as CSSProperties}><div><img src={card.image} alt={card.name} loading="lazy"/><span>{state.config.rarities[card.rarity].name}</span></div><b>{card.name}</b><small>{draw.isNew ? 'Première découverte' : 'Un nouvel exemplaire'}</small><time>{formatDate(opening.createdAt)}</time></Link>)}</div> : <div className="fc-home-empty"><Sparkles size={25}/><div><h3>Votre prochaine belle rencontre est à venir.</h3><p>Les cartes Épiques, Légendaires et Mythiques de vos ouvertures apparaîtront ici.</p></div><Link href="/boosters">Ouvrir un booster<ArrowRight size={16}/></Link></div>}</section>
      <div className="fc-home-bottom"><section className="fc-home-market"><div className="fc-home-section-heading"><h2>Sur la place du marché</h2><Link href="/marche" aria-label="Voir toutes les annonces"><ArrowRight size={18}/></Link></div>{market.length ? market.map(listing => { const card = state.cards.find(c => c.id === listing.cardId)!; return <Link href={`/marche?card=${card.id}`} className="fc-home-market-row" key={listing.id}><img src={card.image} alt="" loading="lazy"/><div><b>{card.name}</b><small>{listing.quantity} exemplaire{listing.quantity > 1 ? 's' : ''} disponible{listing.quantity > 1 ? 's' : ''}</small></div><strong>{listing.price}<Diamond size={13}/><small>par carte</small></strong></Link>; }) : <p className="fc-home-empty-text">Aucune annonce disponible. Vos prochaines ventes trouveront leur place ici.</p>}<Link className="fc-home-panel-link" href="/marche"><ShoppingBag size={16}/>Explorer le marché<ArrowRight size={16}/></Link></section>
      <section className="fc-home-leaders"><div className="fc-home-section-heading"><h2>Les collectionneurs</h2><Trophy size={22}/></div>{leaders.map(entry => { const player = state.users.find(u => u.id === entry.userId)!; return <Link href={`/profil/${player.id}`} className="fc-home-leader-row" key={player.id}><span>0{entry.rank}</span><Avatar username={player.username} image={player.avatar}/><b>{player.username}</b><strong>{entry.value.toLocaleString('fr-FR')}<small>points</small></strong></Link>; })}<Link className="fc-home-panel-link" href="/classement">Le classement complet<ArrowRight size={16}/></Link></section></div>
      <section className="fc-home-rarities"><h2>Six raretés à collectionner.</h2><div>{state.config.rarities.map(rarity => <Link key={rarity.id} href="/regles#rarities" style={{ color: rarity.color }}><span>✦</span>{rarity.name}</Link>)}</div></section>
    </div>
  </>;
}
