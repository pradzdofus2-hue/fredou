'use client';

import Link from 'next/link';
import { useState, type CSSProperties } from 'react';
import { ArrowRight, BookOpen, Diamond, Heart, Layers3, Recycle, Search, SlidersHorizontal, Sparkles } from 'lucide-react';
import type { Card } from '@/lib/contracts';
import { useGame, formatDate } from './game-context';
import { CardTile, Empty, Modal, Pagination, Progress, Shards } from './primitives';
import { CardInspection, CARD_RARITY_STYLES } from './cards';
import { RarityFilters } from './rarity-filters';
import './collection.css';

type CollectionFilters = { series: string; owned: string; sort: string };

function CollectionViewSwitch({ albums = false, catalogue = false }: { albums?: boolean; catalogue?: boolean }) {
  return <nav className="fc-collection-view-switch" aria-label="Affichage de la collection">
    <Link className={!albums ? 'active' : ''} aria-current={!albums ? 'page' : undefined} href={catalogue ? '/wiki' : '/collection'}>Cartes</Link>
    <Link className={albums ? 'active' : ''} aria-current={albums ? 'page' : undefined} href="/albums">Albums</Link>
  </nav>;
}

function CollectionFilterFields({ value, onChange, suffix = '' }: { value: CollectionFilters; onChange: (value: CollectionFilters) => void; suffix?: string; }) {
  const { state } = useGame();
  return <>
    <label htmlFor={`fc-series${suffix}`}>Univers</label>
    <select id={`fc-series${suffix}`} aria-label="Série" value={value.series} onChange={event => onChange({ ...value, series: event.target.value })}>
      <option value="">Tous</option>{state.series.map(series => <option key={series.id} value={series.id}>{series.name}</option>)}
    </select>
    <label htmlFor={`fc-owned${suffix}`}>Cartes</label>
    <select id={`fc-owned${suffix}`} aria-label="État de collection" value={value.owned} onChange={event => onChange({ ...value, owned: event.target.value })}>
      <option value="">Toutes</option><option value="owned">Possédées</option><option value="missing">Manquantes</option><option value="duplicates">Doublons</option><option value="favorites">Favoris</option>
    </select>
    <label htmlFor={`fc-sort${suffix}`}>Tri</label>
    <select id={`fc-sort${suffix}`} aria-label="Trier les cartes" value={value.sort} onChange={event => onChange({ ...value, sort: event.target.value })}>
      <option value="number">Numéro</option><option value="name">Nom</option><option value="rarity">Rareté</option><option value="date">Dernière obtention</option><option value="value">Valeur de recyclage</option>
    </select>
  </>;
}

export function CollectionPage({ catalogue = false, seriesId = '' }: { catalogue?: boolean; seriesId?: string }) {
  const { state, act, busy, login } = useGame();
  const [query, setQuery] = useState('');
  const [rarity, setRarity] = useState('');
  const [filters, setFilters] = useState<CollectionFilters>({ series: seriesId, owned: '', sort: 'number' });
  const [draftFilters, setDraftFilters] = useState(filters);
  const [mobileFilters, setMobileFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [recycle, setRecycle] = useState(false);
  const inventory = new Map(state.inventory.map(item => [item.cardId, item]));
  const normalizedQuery = query.trim().toLocaleLowerCase('fr');
  const filtered = state.cards.filter(card => {
    const item = inventory.get(card.id);
    const seriesName = state.series.find(series => series.id === card.seriesId)?.name || '';
    return `${card.name} ${seriesName}`.toLocaleLowerCase('fr').includes(normalizedQuery)
      && (!rarity || card.rarity === Number(rarity)) && (!filters.series || card.seriesId === filters.series)
      && (!filters.owned || (filters.owned === 'owned' && item) || (filters.owned === 'missing' && !item)
        || (filters.owned === 'duplicates' && item && item.quantity > 1) || (filters.owned === 'favorites' && item?.favorite));
  }).sort((a, b) => {
    if (filters.sort === 'name') return a.name.localeCompare(b.name, 'fr');
    if (filters.sort === 'rarity') return b.rarity - a.rarity || a.number - b.number;
    if (filters.sort === 'value') return b.recycleValue - a.recycleValue || a.number - b.number;
    if (filters.sort === 'date') return (inventory.get(b.id)?.lastObtainedAt || '').localeCompare(inventory.get(a.id)?.lastObtainedAt || '') || a.number - b.number;
    return a.number - b.number;
  });
  const unique = state.inventory.length;
  const completion = state.cards.length ? unique / state.cards.length * 100 : 0;
  const duplicates = state.inventory.reduce((total, item) => total + Math.max(0, item.quantity - 1), 0);
  const recycleAmount = state.inventory.reduce((total, item) => total + Math.max(0, item.quantity - 1) * (state.cards.find(card => card.id === item.cardId)?.recycleValue || 0), 0);
  const currentSeries = state.series.find(series => series.id === filters.series);
  const updateFilters = (value: CollectionFilters) => { setFilters(value); setPage(1); };

  return <div className="fc-collection">
    <header className="fc-collection-header">
      <div className="fc-collection-overview">
        <span className="fc-section-kicker">{catalogue ? 'CATALOGUE · FREDOU COLLECTION' : 'ALBUM · FREDOU COLLECTION'}</span>
        <h1>{catalogue ? 'Le catalogue' : 'Ma collection'}</h1>
        <div className="fc-collection-metrics">
          <div><strong>{unique}<span>/{state.cards.length}</span></strong><small>CARTES UNIQUES</small></div>
          <div className="accent"><strong>{completion.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %</strong><small>COMPLÉTION</small></div>
          <div><strong>{duplicates}</strong><small>DOUBLONS</small></div>
        </div>
        <button className="button secondary fc-recycle-button" disabled={!duplicates || busy} onClick={() => state.currentUser ? setRecycle(true) : login()}><Recycle size={15} /> Recycler les doublons</button>
      </div>
      <div className="fc-collection-series-progress" aria-label="Progression par album">
        {state.series.map(series => {
          const cards = state.cards.filter(card => card.seriesId === series.id);
          const owned = cards.filter(card => inventory.has(card.id)).length;
          return <Link href={`/albums/${series.id}`} key={series.id} title={`Ouvrir l’album ${series.name}`}><b>{series.name}</b><Progress value={owned / Math.max(1, cards.length) * 100} /><span>{owned}/{cards.length}</span></Link>;
        })}
      </div>
    </header>
    <div className="fc-collection-toolbar">
      <div className="fc-collection-search"><Search size={17} /><input aria-label="Rechercher une carte" placeholder="Rechercher une carte ou un univers…" value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} /></div>
      <CollectionViewSwitch catalogue={catalogue} />
    </div>
    <RarityFilters value={rarity} onChange={value => { setRarity(value); setPage(1); }} />
    <div className="fc-collection-selects"><CollectionFilterFields value={filters} onChange={updateFilters} /></div>
    <button className="button secondary fc-mobile-filters-button" onClick={() => { setDraftFilters(filters); setMobileFilters(true); }}><SlidersHorizontal size={16} /> Filtres{(filters.series || filters.owned || filters.sort !== 'number') && <span className="fc-filter-active-dot" />}</button>
    <div className="fc-collection-results"><span>{filtered.length.toLocaleString('fr-FR')} carte{filtered.length > 1 ? 's' : ''}{currentSeries ? ` · ${currentSeries.name}` : ''}</span>{catalogue && <span>Illustrations du catalogue</span>}</div>
    {filtered.length ? <div className="cards-grid fc-collection-grid">{filtered.slice((page - 1) * 18, page * 18).map(card => <CardTile key={card.id} card={card} muted={!catalogue && !inventory.has(card.id)} />)}</div> : <Empty title="Aucune carte trouvée" text="Essayez un autre nom, un autre univers ou une autre combinaison de filtres." />}
    <Pagination page={page} pages={Math.ceil(filtered.length / 18)} setPage={setPage} />
    {recycle && <Modal title="Recycler vos doublons" close={() => setRecycle(false)}>
      <p>Recyclez {duplicates} exemplaires pour recevoir <Shards value={recycleAmount} />. Vous conserverez un exemplaire de chaque carte de votre inventaire. Les exemplaires réservés au marché ne sont pas concernés.</p>
      <button className="button primary full" disabled={busy} onClick={async () => { if (await act({ type: 'recycle' })) setRecycle(false); }}><Recycle size={17} /> Confirmer le recyclage</button>
    </Modal>}
    {mobileFilters && <Modal title="Filtres" close={() => setMobileFilters(false)}><div className="fc-collection-filter-dialog"><CollectionFilterFields value={draftFilters} onChange={setDraftFilters} suffix="-mobile" /><div className="fc-filter-dialog-actions"><button className="button secondary" onClick={() => setDraftFilters({ series: '', owned: '', sort: 'number' })}>Réinitialiser</button><button className="button primary" onClick={() => { updateFilters(draftFilters); setMobileFilters(false); }}>Appliquer</button></div></div></Modal>}
  </div>;
}

export function AlbumsPage() {
  const { state } = useGame();
  const owned = new Set(state.inventory.map(item => item.cardId));
  return <div className="fc-albums-page">
    <header className="fc-albums-header"><span className="fc-section-kicker">ALBUMS · TROIS UNIVERS À RÉUNIR</span><h1>Les albums</h1><p>Explorez chaque monde et retrouvez les cartes qui vous manquent.</p></header>
    <div className="fc-albums-toolbar"><span>{state.series.length} albums · {state.cards.length} cartes</span><CollectionViewSwitch albums /></div>
    <div className="fc-album-grid">{state.series.map((series, index) => {
      const cards = state.cards.filter(card => card.seriesId === series.id);
      const discovered = cards.filter(card => owned.has(card.id)).length;
      const portraits = [cards[0], cards[Math.floor(cards.length / 2)], cards[cards.length - 1]].filter(Boolean);
      return <Link className="fc-album-panel" href={`/albums/${series.id}`} key={series.id} style={{ '--fc-album-color': series.color } as CSSProperties}>
        <div className="fc-album-portraits"><span className="fc-album-number">ALBUM {String(index + 1).padStart(2, '0')}</span>{portraits.map((card, portraitIndex) => <img className={`portrait-${portraitIndex}`} src={card.image} alt={card.name} loading="lazy" key={card.id} />)}<span className="fc-album-art-shade" /></div>
        <div className="fc-album-copy"><h2>{series.name}</h2><p>{series.description}</p><div className="fc-album-completion"><strong>{discovered}<span>/{cards.length}</span></strong><span>{Math.round(discovered / Math.max(1, cards.length) * 100)} %</span></div><Progress value={discovered / Math.max(1, cards.length) * 100} />
          <div className="fc-album-rarity-counts">{state.config.rarities.map(rarity => <span key={rarity.id} title={`${rarity.name} : ${cards.filter(card => card.rarity === rarity.id && owned.has(card.id)).length} sur ${cards.filter(card => card.rarity === rarity.id).length}`}><i style={{ background: CARD_RARITY_STYLES[rarity.id].color }} /><b>{CARD_RARITY_STYLES[rarity.id].letter}</b><small>{cards.filter(card => card.rarity === rarity.id && owned.has(card.id)).length}/{cards.filter(card => card.rarity === rarity.id).length}</small></span>)}</div>
          <span className="fc-album-open">Explorer l’album <ArrowRight size={16} /></span>
        </div>
      </Link>;
    })}</div>
  </div>;
}

export function CardDetail({ id }: { id: string }) {
  const { state, act, busy, login } = useGame();
  const [inspecting, setInspecting] = useState(false);
  const card = state.cards.find(card => card.id === id);
  if (!card) return <Empty title="Carte introuvable" text="Cette carte ne figure pas dans le catalogue." />;
  const inventory = state.inventory.find(item => item.cardId === id);
  const rarity = state.config.rarities[card.rarity];
  const series = state.series.find(series => series.id === card.seriesId);
  const prices = state.priceHistory.filter(point => point.cardId === id).sort((a, b) => b.soldAt.localeCompare(a.soldAt));
  const sortedPrices = prices.map(point => point.unitPrice).sort((a, b) => a - b);
  const median = sortedPrices.length ? (sortedPrices[Math.floor((sortedPrices.length - 1) / 2)] + sortedPrices[Math.floor(sortedPrices.length / 2)]) / 2 : null;
  const recentPrices = prices.slice(0, 12).reverse();
  const listings = state.listings.filter(listing => listing.cardId === id && listing.status === 'active');
  const acquisitions = state.acquisitions.filter(acquisition => acquisition.cardId === id);
  const associated = state.cards.filter(candidate => candidate.seriesId === card.seriesId && candidate.id !== id).slice(0, 6);

  return <article className="fc-wiki">
    <header className="fc-wiki-banner detail-information">
      <nav className="fc-wiki-breadcrumbs" aria-label="Fil d’Ariane"><Link href="/wiki">Wiki</Link><span>/</span><Link href={`/albums/${card.seriesId}`}>{series?.name}</Link><span>/</span><span>{card.name}</span></nav>
      <div className="fc-wiki-tags"><Link href={`/albums/${card.seriesId}`} className="fc-wiki-series-tag">{series?.name}</Link><Link href="/raretes" style={{ color: CARD_RARITY_STYLES[card.rarity].color, borderColor: CARD_RARITY_STYLES[card.rarity].color }}>{rarity.name}</Link><span>{inventory ? `${inventory.quantity} exemplaire(s)` : 'Non possédée'}</span></div>
      <h1>{card.name}</h1>
      <span className="fc-wiki-identifier">#{String(card.number).padStart(3, '0')}/{state.cards.length} <i /> {series?.name}</span>
      <span className="fc-wiki-watermark" aria-hidden="true">{String(card.number).padStart(3, '0')}</span>
    </header>
    <div className="fc-wiki-columns">
      <div className="fc-wiki-main">
        <section className="fc-wiki-biography"><span className="fc-wiki-section-icon"><BookOpen size={27} /></span><span className="fc-section-kicker">HISTOIRE · UNIVERS ORIGINAL</span><h2>Une carte, une histoire</h2><p>{card.description}</p><div className="fc-wiki-data-row"><span><b>{rarity.name}</b> · Rareté</span><span><b>{card.collectionPoints}</b> points de collection</span><span><b>{inventory?.quantity || 0}</b> exemplaire(s) possédé(s)</span></div><div className="button-row"><Link className="button primary" href="/boosters">Ouvrir un booster <Sparkles size={16} /></Link><Link className="button secondary" href={`/marche?card=${id}`}>{listings.length ? `Acheter dès ${Math.min(...listings.map(listing => listing.price))} Éclats` : 'Voir le marché'} <ArrowRight size={16} /></Link></div></section>
        <section className="fc-wiki-history"><span className="fc-section-kicker">VOTRE COLLECTION</span><h2>Historique d’obtention</h2>{acquisitions.length ? <div className="fc-wiki-history-table">{acquisitions.map(acquisition => <div key={acquisition.id}><span>{acquisition.source}</span><b>+{acquisition.quantity}</b><time>{formatDate(acquisition.createdAt)}</time></div>)}</div> : <div className="fc-wiki-empty-history"><Layers3 size={21} /><p>Votre première rencontre avec cette carte sera enregistrée ici.</p></div>}</section>
        <section className="fc-wiki-market-history"><span className="fc-section-kicker">MARCHÉ</span><h2>Les dernières ventes</h2>{recentPrices.length ? <><div className="fc-wiki-price-chart" role="img" aria-label={`Les ${recentPrices.length} derniers prix de vente, de ${Math.min(...recentPrices.map(point => point.unitPrice))} à ${Math.max(...recentPrices.map(point => point.unitPrice))} Éclats`}>{recentPrices.map((point, index) => <div key={`${point.soldAt}-${index}`} title={`${formatDate(point.soldAt)} : ${point.unitPrice} Éclats par carte`}><span style={{ height: `${Math.max(5, point.unitPrice / Math.max(...recentPrices.map(item => item.unitPrice)) * 140)}px` }} /><b>{point.unitPrice}</b><small>{new Date(point.soldAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}</small></div>)}</div><p className="fc-wiki-chart-caption">Prix unitaires des {recentPrices.length} ventes les plus récentes, en Éclats.</p></> : <div className="fc-wiki-empty-history"><Diamond size={21} /><p>Aucune vente réalisée pour cette carte. L’historique apparaîtra après sa première transaction.</p></div>}</section>
      </div>
      <aside className="fc-wiki-sidebar"><div className="fc-wiki-card-panel"><CardTile card={card} onClick={() => setInspecting(true)} /><button className="fc-wiki-inspect-hint" onClick={() => setInspecting(true)}>Toucher la carte pour l’inspecter</button><p className="fc-wiki-ownership" style={{ color: CARD_RARITY_STYLES[card.rarity].color }}>{rarity.name} · {inventory ? `${inventory.quantity} exemplaire(s)` : 'non possédée'}</p><dl className="fc-wiki-market-facts"><div><dt>Recyclage</dt><dd><Shards value={card.recycleValue} /></dd></div><div><dt>Points</dt><dd>{card.collectionPoints}</dd></div><div><dt>Prix médian</dt><dd>{median === null ? '—' : <Shards value={median.toLocaleString('fr-FR')} />}</dd></div><div><dt>Annonces actives</dt><dd>{listings.length}</dd></div></dl><button className="button secondary full" disabled={busy || (!!state.currentUser && !inventory)} title={!inventory ? 'Obtenez cette carte pour la mettre en favori' : undefined} onClick={() => state.currentUser ? void act({ type: 'favorite', cardId: id }) : login()}><Heart size={16} fill={inventory?.favorite ? 'currentColor' : 'none'} />{!inventory && state.currentUser ? 'Carte à découvrir' : inventory?.favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}</button></div></aside>
    </div>
    <section className="fc-wiki-associated"><div className="fc-wiki-associated-heading"><div><span className="fc-section-kicker">POURSUIVRE LA DÉCOUVERTE</span><h2>Dans le même univers</h2></div><Link href={`/albums/${card.seriesId}`}>Tout l’album <ArrowRight size={16} /></Link></div><div className="cards-grid">{associated.map(card => <CardTile key={card.id} card={card} />)}</div></section>
    {inspecting && <CardInspection card={card} close={() => setInspecting(false)} />}
  </article>;
}

const rarityDescriptions = [
  'Un cadre gris mat. L’essentiel de votre collection, sans effet holographique.',
  'Un cadre vert et un filet lumineux pour les premières découvertes singulières.',
  'Un cadre bleu, un reflet léger et une lumière qui accompagne le survol.',
  'Un cadre violet et les premiers reflets holographiques animés.',
  'Un or brossé, des reflets plus intenses et une lumière chaleureuse.',
  'Un cadre multicolore en mouvement et une holographie complète.',
];

export function RaritiesPage() {
  const { state } = useGame();
  const [inspected, setInspected] = useState<Card | null>(null);
  return <div className="fc-rarities-page">
    <header className="fc-rarities-header"><span className="fc-section-kicker">SYSTÈME DE RARETÉ · COLLECTION</span><h1>De Commune à Mythique</h1><p>Six raretés, six façons de découvrir votre collection. Les chances de tirage et les garanties sont propres à chaque booster.</p></header>
    <div className="fc-rarity-gallery">{state.config.rarities.map(rarity => {
      const card = state.cards.find(card => card.rarity === rarity.id);
      if (!card) return null;
      return <article className="fc-rarity-example" key={rarity.id} style={{ '--fc-example-rarity': rarity.id === 0 ? '#bcb8c4' : CARD_RARITY_STYLES[rarity.id].color } as CSSProperties}>
        <CardTile card={card} onClick={() => setInspected(card)} /><h2><span />{rarity.name}</h2><span className="fc-rarity-recycle-value">Recyclage : {rarity.recycleValue} Éclat{rarity.recycleValue > 1 ? 's' : ''}</span><p>{rarityDescriptions[rarity.id]}</p><span className="fc-rarity-points">{rarity.collectionPoints} points de collection</span>
      </article>;
    })}</div>
    <div className="fc-rarity-guide-grid"><section><span className="fc-section-kicker">COMPOSITION</span><h2>5 cartes par booster</h2><div className="fc-five-card-symbols" aria-hidden="true">{Array.from({ length: 5 }, (_, index) => <span key={index}>{index + 1}</span>)}</div><p>La quatrième carte est au moins peu commune. La cinquième respecte toujours la rareté garantie du booster.</p><p>Les doublons sont possibles. Un compteur de pitié propre à chaque type de booster garantit une Mythique au seuil indiqué.</p><Link href="/boosters">Consulter les probabilités <ArrowRight size={16} /></Link></section><section><span className="fc-section-kicker">RECYCLAGE</span><h2>Doublons → Éclats</h2><div className="fc-rarity-recycle-grid">{state.config.rarities.map(rarity => <div key={rarity.id}><span><i style={{ background: CARD_RARITY_STYLES[rarity.id].color }} />{rarity.name}</span><Shards value={rarity.recycleValue} /></div>)}</div><p>Le recyclage automatique conserve toujours un exemplaire de chaque carte de votre inventaire.</p><Link href="/collection">Retrouver ma collection <ArrowRight size={16} /></Link></section></div>
    {inspected && <CardInspection card={inspected} close={() => setInspected(null)} />}
  </div>;
}
