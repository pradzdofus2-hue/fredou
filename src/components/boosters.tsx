'use client';

import { useCallback, useEffect, useReducer, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ArrowRight, Check, ChevronRight, Clock3, Diamond, Gift, History, Info, Layers3, LoaderCircle, RotateCcw, Settings2, ShieldCheck, Sparkles, X } from 'lucide-react';
import type { Booster, Opening } from '@/lib/contracts';
import { initialOpeningAnimation, openingAnimationReducer } from '@/lib/booster-animation';
import { CardReveal } from './cards';
import { useGame, formatDate } from './game-context';
import { Empty, Modal, Pagination, Shards } from './primitives';
import './boosters.css';

type BoosterTab = 'free' | 'daily' | 'shop';
interface Encounter { booster: Booster; opening: Opening; replay: boolean; }
const tabFor = (booster: Booster): BoosterTab => booster.kind === 'free' ? 'free' : booster.kind === 'daily' ? 'daily' : 'shop';
const packEdition = (booster: Booster) => booster.kind === 'daily' ? 'RENDEZ-VOUS ASTRAL' : booster.kind === 'event' ? 'CONVERGENCE' : booster.kind === 'special' ? 'SYLVE DES MURMURES' : booster.kind === 'premium' ? 'PRISME CÉLESTE' : 'ÉCLAT ORIGINEL';

/** Original vector and foil packaging, with no reference-site artwork. */
export function PackArt({ booster, small = false }: { booster: Booster; small?: boolean }) {
  const daily = booster.kind === 'daily';
  return <div className={`fc-pack fc-pack--${booster.kind} ${small ? 'fc-pack--small' : ''}`} style={{ '--pack-tint': booster.color } as CSSProperties} aria-hidden="true">
    {daily && <span className="fc-pack-bow"><i /><i /><b /></span>}
    <div className="fc-pack-foil"><span className="fc-pack-seal fc-pack-seal--top" /><span className="fc-pack-seal fc-pack-seal--bottom" /><div className="fc-pack-pattern" /><div className="fc-pack-shine" />
      <div className="fc-pack-label"><span className="fc-pack-wordmark">KROSMORIA<span>COLLECTION</span></span>{daily && <span className="fc-pack-daily-mark"><Gift size={20} /><span>CHAQUE JOUR</span></span>}
        <svg className="fc-pack-emblem" viewBox="0 0 120 160" fill="none"><path d="M60 8 106 42v66l-46 44-46-44V42Z" stroke="currentColor" strokeWidth="2" /><path d="m60 24 31 24v53l-31 31-31-31V48Z" stroke="currentColor" opacity=".45" /><path d="M43 53h42L73 67H57v17h24L68 98H57v25l-14-14Z" fill="currentColor" /><path d="m60 0 4 6-4 6-4-6Zm0 148 4 6-4 6-4-6Z" fill="currentColor" /></svg>
        <span className="fc-pack-edition">{packEdition(booster)}</span><span className="fc-pack-count">5 CARTES<span>UNE NOUVELLE HISTOIRE</span></span>
      </div><span className="fc-pack-serial">FC · 001 / CHRONIQUES</span>
    </div>
  </div>;
}

function Countdown({ target }: { target: string }) {
  const [seconds, setSeconds] = useState(() => Math.max(0, Math.ceil((Date.parse(target) - Date.now()) / 1000)));
  useEffect(() => { const tick = () => setSeconds(Math.max(0, Math.ceil((Date.parse(target) - Date.now()) / 1000))); tick(); const timer = setInterval(tick, 1000); return () => clearInterval(timer); }, [target]);
  return <span className="fc-booster-countdown"><Clock3 size={14} />{seconds ? `${Math.floor(seconds / 3600)}h ${String(Math.floor(seconds % 3600 / 60)).padStart(2, '0')}m ${String(seconds % 60).padStart(2, '0')}s` : 'Recharge prête'}</span>;
}

function useReducedMotion() {
  const { state } = useGame();
  const [systemReduced, setSystemReduced] = useState(false);
  useEffect(() => { const media = window.matchMedia('(prefers-reduced-motion: reduce)'); const change = () => setSystemReduced(media.matches); change(); media.addEventListener('change', change); return () => media.removeEventListener('change', change); }, []);
  return Boolean(state.currentUser?.preferences.reducedMotion || systemReduced);
}

/** Autonomous chooser shared with the homepage. Query parameters only select; they never open. */
export function BoosterShowcase({ compact = false, initialTab = 'free' }: { compact?: boolean; initialTab?: BoosterTab }) {
  const { state, act, busy, login } = useGame();
  const [tab, setTab] = useState<BoosterTab>(initialTab), [selectedId, setSelectedId] = useState('free');
  const [encounter, setEncounter] = useState<Encounter | null>(null), [purchase, setPurchase] = useState<Booster | null>(null);
  const [quantity, setQuantity] = useState(1), [probabilities, setProbabilities] = useState<Booster | null>(null), [openingPending, setOpeningPending] = useState(false), [historyPage, setHistoryPage] = useState(1);
  const openLock = useRef(false), mounted = useRef(true), encounterEpoch = useRef(0);
  const reduced = useReducedMotion();
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (compact) return;
    const requested = new URL(window.location.href).searchParams.get('booster');
    const booster = state.boosters.find(b => b.id === requested);
    if (booster) { setTab(tabFor(booster)); setSelectedId(booster.id); }
    // A refreshed snapshot must not reset the user's selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compact]);
  const visible = state.boosters.filter(b => tabFor(b) === tab);
  const selected = visible.find(b => b.id === selectedId) || visible[0];
  const open = async (booster: Booster) => {
    if (!state.currentUser) { login(); return; }
    if (openLock.current || busy || !booster.active) return;
    openLock.current = true; setOpeningPending(true); const epoch = ++encounterEpoch.current;
    try { const result = await act({ type: 'open', boosterId: booster.id }); if (mounted.current && epoch === encounterEpoch.current && result?.opening) { setEncounter({ booster, opening: result.opening, replay: false }); setHistoryPage(1); } }
    finally { openLock.current = false; if (mounted.current) setOpeningPending(false); }
  };
  const chooseTab = (next: BoosterTab) => { setTab(next); setSelectedId(state.boosters.find(b => tabFor(b) === next)?.id || ''); };
  const activate = (booster: Booster) => {
    if (!state.currentUser) { login(); return; }
    if (booster.available > 0 || booster.price === 0) void open(booster);
    else { setPurchase(booster); setQuantity(1); }
  };
  const showOpening = (opening: Opening) => { const booster = state.boosters.find(b => b.id === opening.boosterId); if (booster) { encounterEpoch.current++; setEncounter({ opening, booster, replay: true }); } };
  const closeEncounter = useCallback(() => { encounterEpoch.current++; setEncounter(null); }, []);
  if (!selected) return <Empty title="Les boosters se préparent" text="Revenez bientôt découvrir les prochaines éditions." />;
  const exhausted = !!state.currentUser && selected.available === 0 && selected.price === 0 && !!selected.nextAvailableAt && Date.parse(selected.nextAvailableAt) > Date.now();
  return <section className={`fc-booster-showcase ${compact ? 'fc-booster-showcase--compact' : ''} ${reduced ? 'fc-motion-reduced' : ''}`}>
    <div className="fc-booster-heading"><div><span className="fc-booster-kicker">CINQ CARTES. UN NOUVEAU DÉPART.</span><h2>Choisir un booster<span>.</span></h2></div><span className="fc-booster-heading-note"><Layers3 size={15} /> 72 cartes à découvrir</span></div>
    <div className="fc-booster-tabs" role="tablist" aria-label="Catégories de boosters">{([['free', 'Gratuits'], ['daily', 'Du jour'], ['shop', 'Boutique']] as const).map(([value, label]) => <button key={value} role="tab" aria-selected={tab === value} onClick={() => chooseTab(value)} className={tab === value ? 'is-active' : ''}>{value === 'free' ? <Sparkles size={15} /> : value === 'daily' ? <Gift size={15} /> : <Diamond size={15} />}{label}{value === 'daily' && <span className="fc-booster-tab-dot" />}</button>)}</div>
    <div className="fc-booster-layout"><div className={`fc-booster-stage fc-booster-stage--${tab}`}>
      <span className="fc-booster-stage-grid" aria-hidden="true" /><span className="fc-booster-stage-light" aria-hidden="true" />
      <div className="fc-booster-stage-caption"><span>{tab === 'free' ? 'À CHAQUE RETOUR, UNE DÉCOUVERTE' : tab === 'daily' ? 'VOTRE RENDEZ-VOUS QUOTIDIEN' : 'DES ÉDITIONS À EXPLORER'}</span><span>KROSMORIA / COLLECTION 001</span></div>
      <div className={`fc-pack-lineup ${visible.length === 1 ? 'fc-pack-lineup--single' : ''}`}>
        {visible.length === 1 && <div className="fc-pack-echo fc-pack-echo--left" aria-hidden="true"><PackArt booster={selected} /></div>}
        {visible.map((booster, index) => <button key={booster.id} onClick={() => setSelectedId(booster.id)} className={`fc-pack-choice ${selected.id === booster.id ? 'is-selected' : ''}`} style={{ '--pack-angle': `${visible.length === 1 ? -2 : (index - (visible.length - 1) / 2) * 3}deg`, '--pack-tint': booster.color } as CSSProperties} aria-label={`Sélectionner ${booster.name}`} aria-pressed={selected.id === booster.id}><span className="fc-pack-choice-halo" /><PackArt booster={booster} /><span className="fc-pack-choice-shadow" /><span className="fc-pack-choice-name">{booster.name}</span></button>)}
        {visible.length === 1 && <div className="fc-pack-echo fc-pack-echo--right" aria-hidden="true"><PackArt booster={selected} /></div>}
      </div><div className="fc-booster-stage-bottom"><span><ShieldCheck size={14} /> Une rareté garantie dans chaque booster</span><span>5 <Layers3 size={14} /></span></div>
    </div><aside className="fc-booster-details" aria-label={`Détails de ${selected.name}`}>
      <div className="fc-booster-details-top"><span className={`fc-booster-edition ${selected.kind === 'daily' ? 'is-daily' : ''}`}>{selected.kind === 'free' ? 'BOOSTER GRATUIT' : selected.kind === 'daily' ? 'PACK DU JOUR' : selected.kind === 'event' ? 'ÉDITION LIMITÉE' : 'BOOSTER SPÉCIAL'}</span><span className="fc-booster-card-total">5 cartes</span></div><h3>{selected.name}</h3><p className="fc-booster-description">{selected.description}</p>
      <div className="fc-booster-guarantee"><span className="fc-booster-guarantee-star" style={{ color: state.config.rarities[selected.guarantee].color }}>✦</span><div><strong>Une {state.config.rarities[selected.guarantee].name.toLowerCase()} ou mieux</strong><span>garantie dans chaque booster</span></div></div>
      <div className="fc-booster-reserve"><div><span>Votre réserve</span><strong>{selected.available}<small>{selected.kind === 'free' ? ' / 3' : selected.kind === 'daily' ? ' / 1' : ' disponible(s)'}</small></strong></div>{selected.nextAvailableAt ? <Countdown target={selected.nextAvailableAt} /> : <span className="fc-booster-available"><span /> {selected.active ? selected.available ? 'Prêt à ouvrir' : 'Disponible' : 'Événement terminé'}</span>}</div>
      <div className="fc-booster-pity"><div><span>Pitié mythique <Info size={12} aria-hidden="true" /></span><b>{selected.pityCount}<span> / {selected.pityLimit}</span></b></div><div className="fc-booster-pity-track" role="progressbar" aria-label="Progression de la pitié mythique" aria-valuenow={selected.pityCount} aria-valuemin={0} aria-valuemax={selected.pityLimit}><span style={{ width: `${Math.min(100, selected.pityCount / selected.pityLimit * 100)}%` }} /></div></div>
      <button className="fc-booster-primary" disabled={busy || openingPending || exhausted || !selected.active} onClick={() => activate(selected)}>{openingPending ? <><LoaderCircle className="fc-booster-spinner" size={17} /> Préparation…</> : exhausted ? <><Clock3 size={17} /> En recharge</> : selected.available > 0 || selected.price === 0 ? <><Gift size={17} /> Ouvrir le booster <ArrowRight size={17} /></> : <>Obtenir le booster <Shards value={selected.price} /><ArrowRight size={16} /></>}</button>
      {selected.price > 0 && selected.available > 0 && <button className="fc-booster-buy-more" disabled={busy || !selected.active} onClick={() => { if (!state.currentUser) return login(); setPurchase(selected); setQuantity(1); }}>Ajouter à ma réserve <Shards value={selected.price} /></button>}
      <button className="fc-booster-probability-link" onClick={() => setProbabilities(selected)}><Info size={14} /> Probabilités et garanties <ChevronRight size={14} /></button>
    </aside></div>
    {!compact && <section className="fc-booster-history"><div className="fc-booster-history-heading"><h2><History size={18} /> Vos dernières ouvertures</h2><span>Enregistrées dans votre collection</span></div>{state.openings.length ? <><div className="fc-booster-history-list">{state.openings.slice((historyPage - 1) * 20, historyPage * 20).map(opening => <button className="fc-booster-history-row" key={opening.id} onClick={() => showOpening(opening)} aria-label={`Revoir l’ouverture de ${state.boosters.find(b => b.id === opening.boosterId)?.name} du ${formatDate(opening.createdAt)}`}><span className="fc-booster-history-icon"><Gift size={18} /></span><span className="fc-booster-history-description"><strong>{state.boosters.find(b => b.id === opening.boosterId)?.name}</strong><small>{opening.cards.map(c => state.cards.find(card => card.id === c.cardId)?.name).join(' · ')}</small></span><span className="fc-booster-history-date">{formatDate(opening.createdAt)}</span><Shards value={`+${opening.shardsReward}`} /><span className="fc-booster-history-replay">Revoir <ArrowRight size={15} /></span></button>)}</div><Pagination page={historyPage} pages={Math.ceil(state.openings.length / 20)} setPage={setHistoryPage} /></> : <Empty title="Votre premier booster vous attend" text="Chaque ouverture sera conservée ici. Vous pourrez revoir ses cinq cartes à tout moment." />}</section>}
    {purchase && <Modal title={`Obtenir ${purchase.name}`} close={() => setPurchase(null)}><div className="fc-booster-dialog"><p>Les boosters rejoignent votre réserve. Ils contiennent chacun cinq cartes et ne sont ouverts qu’à votre demande.</p><label className="field-label">Quantité<input type="number" min="1" max="20" step="1" value={quantity} onChange={event => setQuantity(Number(event.target.value))} /></label><div className="fc-booster-purchase-total"><span>Total</span><Shards value={purchase.price * quantity} /></div><button className="fc-booster-primary" disabled={busy || !Number.isInteger(quantity) || quantity < 1 || quantity > 20} onClick={async () => { if (await act({ type: 'buy-booster', boosterId: purchase.id, quantity })) setPurchase(null); }}>Confirmer l’achat <ArrowRight size={16} /></button><p className="fc-booster-dialog-footnote">Monnaie virtuelle uniquement. Aucun paiement en argent réel.</p></div></Modal>}
    {probabilities && <Modal title="Probabilités et garanties" close={() => setProbabilities(null)}><div className="fc-booster-dialog"><p>Poids de base de <strong>{probabilities.name}</strong>, appliqués aux trois premières cartes.</p><div className="fc-booster-odds">{state.config.rarities.map((rarity, index) => <div key={rarity.id}><span style={{ color: rarity.color }}><i />{rarity.name}</span><b>{(probabilities.weights[index] / probabilities.weights.reduce((a, b) => a + b, 0) * 100).toFixed(2)} %</b></div>)}</div><p>La quatrième carte est au moins Peu commune. La cinquième est au moins {state.config.rarities[probabilities.guarantee].name}. Sur ces emplacements, les probabilités sont recalculées uniquement parmi les raretés admissibles.</p><p>Une Mythique est garantie au plus tard à la {probabilities.pityLimit}e ouverture de ce type sans Mythique. Une Mythique obtenue remet ce compteur à zéro.</p><p className="fc-booster-dialog-footnote">Chaque identité est tirée uniformément dans sa rareté. Les tirages se font avec remise : les doublons sont possibles.</p></div></Modal>}
    {encounter && <OpeningExperience key={encounter.opening.id} {...encounter} close={closeEncounter} again={async () => { const booster = state.boosters.find(b => b.id === encounter.booster.id); if (booster) await open(booster); }} />}
  </section>;
}

export function BoosterGrid({ compact = false }: { compact?: boolean }) { return <BoosterShowcase compact={compact} />; }

/** Presentation of an already persisted server result. No reward is selected here. */
function OpeningExperience({ booster, opening, replay, close, again }: Encounter & { close: () => void; again: () => Promise<void> }) {
  const { state, act, busy } = useGame();
  const reduced = useReducedMotion();
  const [animation, dispatch] = useReducer(openingAnimationReducer, { reduced, replay }, input => initialOpeningAnimation(input.reduced, input.replay));
  const [options, setOptions] = useState(false);
  const root = useRef<HTMLDivElement>(null), closeRef = useRef(close), nextLock = useRef(false); closeRef.current = close;
  const stage = animation.phase, cards = opening.cards.map(draw => ({ draw, card: state.cards.find(card => card.id === draw.cardId)! }));
  const latest = state.boosters.find(b => b.id === booster.id), highlighted = animation.flipping === null ? null : cards[animation.flipping]?.card;
  // Individual flips remain silent. "Tout révéler" plays the highest rarity exactly once.
  const flipAudio = useRef<HTMLAudioElement | null>(null);
  const allRevealSoundPlayed = useRef(false);
  const allRevealRequested = useRef(false);
  const [bestRarityHighlighted, setBestRarityHighlighted] = useState(false);
  const playHighestRarityOnce = () => {
    if (allRevealSoundPlayed.current) return;
    allRevealSoundPlayed.current = true;
    const rarity = Math.max(...cards.map(item => item.card.rarity));
    const files = ['commune', 'peu-commune', 'rare', 'epique', 'legendaire', 'mythique'];
    const name = files[rarity];
    if (!name) return;
    try {
      flipAudio.current?.pause();
      const audio = new Audio('/sounds/' + name + '.wav');
      audio.volume = 0.85;
      flipAudio.current = audio;
      audio.addEventListener('error', () => {
        if (flipAudio.current !== audio) return;
        const fallback = new Audio('/sounds/' + name + '.ogg');
        fallback.volume = 0.65;
        flipAudio.current = fallback;
        void fallback.play().catch(() => {});
      }, {once:true});
      void audio.play().catch(() => {});
    } catch { /* Optional sound must never block rewards. */ }
  };
  // Wait until the fifth card has fully finished flipping before the final cue.
  useEffect(() => {
    if (stage !== 'summary' || !allRevealRequested.current || allRevealSoundPlayed.current) return;
    setBestRarityHighlighted(true);
    playHighestRarityOnce();
    // Only an explicit click on Tout révéler is allowed to trigger this cue.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);
  // A flip emits one sound, chosen from the server-assigned card rarity.
  const playedFlips = useRef(new Set<number>());
  useEffect(() => {
    const index = animation.flipping;
    if (stage !== 'reveal' || index === null || playedFlips.current.has(index) || allRevealSoundPlayed.current || animation.automatic) return;
    playedFlips.current.add(index);
    const rarity = cards[index]?.card.rarity;
    const files = ['commune', 'peu-commune', 'rare', 'epique', 'legendaire', 'mythique'];
    const name = typeof rarity === 'number' ? files[rarity] : undefined;
    if (!name) return;
    try {
      flipAudio.current?.pause();
      const audio = new Audio('/sounds/' + name + '.wav');
      audio.volume = 0.85;
      flipAudio.current = audio;
      // Keep existing audio working until the original WAV assets are uploaded.
      const fallback = () => {
        if (flipAudio.current !== audio) return;
        const old = new Audio('/sounds/' + name + '.ogg');
        old.volume = 0.65;
        flipAudio.current = old;
        void old.play().catch(() => {});
      };
      audio.addEventListener('error', fallback, { once: true });
      void audio.play().catch(() => {});
    } catch { /* Sound is optional and never blocks the reveal. */ }
  }, [animation.flipping, stage, animation.automatic]);
  useEffect(() => () => { flipAudio.current?.pause(); }, []);

  useEffect(() => {
    const oldOverflow = document.body.style.overflow, previousFocus = document.activeElement as HTMLElement | null;
    const siblings = Array.from(document.body.children).filter((element): element is HTMLElement => element instanceof HTMLElement && element !== root.current).map(element => ({ element, inert: element.inert }));
    for (const sibling of siblings) sibling.element.inert = true;
    document.body.style.overflow = 'hidden'; root.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { closeRef.current(); return; }
      if (event.key !== 'Tab' || !root.current) return;
      const elements = Array.from(root.current.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),[tabindex="0"]')).filter(element => !element.closest('[inert]'));
      const first = elements[0], last = elements[elements.length - 1];
      if (!root.current.contains(document.activeElement)) { event.preventDefault(); (event.shiftKey ? last : first)?.focus(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === root.current)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === root.current)) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', handleKey);
    return () => { document.body.style.overflow = oldOverflow; for (const sibling of siblings) sibling.element.inert = sibling.inert; document.removeEventListener('keydown', handleKey); previousFocus?.focus(); };
  }, []);
  useEffect(() => { if (reduced) dispatch({ type: 'REDUCE' }); }, [reduced]);
  useEffect(() => { if (stage !== 'tear' && stage !== 'fan') return; const timer = setTimeout(() => dispatch({ type: stage === 'tear' ? 'TEAR_DONE' : 'FAN_DONE' }), stage === 'tear' ? 720 : 820); return () => clearTimeout(timer); }, [stage]);
  useEffect(() => {
    if (animation.flipping === null || stage !== 'reveal') return;
    const timer = setTimeout(() => dispatch({ type: 'FLIP_DONE' }), cards[animation.flipping]?.card.rarity >= 4 ? 1200 : 760);
    return () => clearTimeout(timer);
    // A snapshot refresh must not restart a fixed result's presentation timers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animation.flipping, stage]);
  useEffect(() => { if (!animation.automatic || animation.flipping !== null || stage !== 'reveal') return; const timer = setTimeout(() => dispatch({ type: 'REVEAL', index: animation.revealed.length }), 160); return () => clearTimeout(timer); }, [animation.automatic, animation.flipping, animation.revealed.length, stage]);
  const next = async () => { if (nextLock.current || busy) return; nextLock.current = true; try { await again(); } finally { nextLock.current = false; } };
  const displayName = stage === 'summary' ? replay ? 'Votre ouverture enregistrée' : 'Une collection qui s’agrandit' : stage === 'reveal' ? 'Chaque carte a son histoire.' : booster.name;
  return createPortal(<div ref={root} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="fc-opening-title" className={`fc-opening fc-opening--${stage} ${reduced ? 'fc-motion-reduced' : ''}`} data-opening-id={opening.id} data-opening-phase={stage} style={{ '--opening-color': highlighted ? state.config.rarities[highlighted.rarity].color : '#f5c518' } as CSSProperties}>
    <div className="fc-opening-atmosphere" aria-hidden="true"><span className="fc-opening-floor" />{Array.from({ length: 18 }, (_, index) => <i key={index} style={{ '--particle-x': `${(index * 43 + 7) % 100}%`, '--particle-y': `${(index * 31 + 13) % 100}%`, '--particle-delay': `${index * -.73}s` } as CSSProperties} />)}</div>
    <header className="fc-opening-header"><button onClick={close} className="fc-opening-back"><ArrowLeft size={17} /><span>Boosters</span></button><strong><Layers3 size={15} /> {booster.name}</strong><div className="fc-opening-tools"><span className="fc-opening-wallet"><Shards value={state.currentUser?.balance || 0} /></span><button className={options ? 'is-active' : ''} onClick={() => setOptions(!options)} aria-label="Options d’ouverture" aria-expanded={options}><Settings2 size={19} /></button><button onClick={close} aria-label="Fermer l’ouverture"><X size={19} /></button></div></header>
    {options && <div className="fc-opening-options"><div><strong>À votre rythme</strong><button aria-label="Fermer les options" onClick={() => setOptions(false)}><X size={15} /></button></div><label><span>Animations réduites<small>Afficher directement les cinq cartes</small></span><button role="switch" aria-checked={!!state.currentUser?.preferences.reducedMotion} aria-label="Réduire les animations d’ouverture" disabled={busy} onClick={() => void act({ type: 'preferences', reducedMotion: !state.currentUser?.preferences.reducedMotion })} className={`fc-opening-switch ${state.currentUser?.preferences.reducedMotion ? 'is-on' : ''}`}><i /></button></label><p>Vos cartes sont déjà enregistrées. Vous pouvez fermer puis revoir ce tirage dans l’historique.</p></div>}
    <div className="fc-opening-main"><div className="fc-opening-title"><span>{stage === 'summary' ? replay ? 'HISTORIQUE DE VOTRE COLLECTION' : 'CINQ CARTES ONT REJOINT VOTRE COLLECTION' : stage === 'reveal' ? `${animation.revealed.length} / 5 CARTES RÉVÉLÉES` : 'UNE NOUVELLE DÉCOUVERTE'}</span><h2 id="fc-opening-title">{displayName}</h2></div>
      {(stage === 'pack' || stage === 'tear') && <div className="fc-opening-pack-stage"><span className="fc-opening-pack-aura" /><div className="fc-opening-flash" /><button className="fc-opening-pack-button" disabled={stage === 'tear'} onClick={() => dispatch({ type: 'OPEN' })} aria-label="Déchirer le booster"><PackArt booster={booster} /><span className="fc-opening-tear-line" /><span className="fc-opening-pack-shadow" /></button><p className="fc-opening-pack-prompt">{stage === 'tear' ? 'Les horizons s’ouvrent…' : 'Touchez le booster pour l’ouvrir'}<span>{stage === 'tear' ? 'Vos cartes vous attendent.' : 'Cinq cartes. Une nouvelle histoire.'}</span></p></div>}
      {(stage === 'fan' || stage === 'reveal' || stage === 'summary') && <div className="fc-opening-card-area"><div className="fc-opening-card-row">{cards.map(({ draw, card }, index) => <div key={`${opening.id}-${index}`} className={`fc-opening-card ${animation.flipping === index ? 'is-flipping' : ''} ${animation.revealed.includes(index) ? 'is-revealed' : ''} ${card.rarity >= 4 ? 'is-exceptional' : ''} ${bestRarityHighlighted && card.rarity === Math.max(...cards.map(c => c.card.rarity)) ? 'is-best-rarity-highlighted' : ''}`} style={{ '--card-index': index, '--fan-x': `${(2 - index) * 118}px`, '--fan-angle': `${(index - 2) * 11}deg`, '--fan-y': `${Math.abs(index - 2) * 13}px`, '--reveal-color': state.config.rarities[card.rarity].color } as CSSProperties} inert={stage === 'fan' || (stage === 'reveal' && (index !== animation.revealed.length || animation.flipping !== null)) || undefined}>
        <span className="fc-opening-card-glow" /><CardReveal card={card} revealed={animation.revealed.includes(index)} onReveal={() => dispatch({ type: 'REVEAL', index })} index={index} badge={draw.isNew ? 'NOUVEAU' : 'DOUBLON +1'} reducedMotion={reduced} className="fc-opening-card-face" /><div className="fc-opening-card-caption"><strong>{card.name}</strong><span style={{ color: state.config.rarities[card.rarity].color }}>{state.config.rarities[card.rarity].name}</span></div>
      </div>)}</div></div>}
      <div className="fc-opening-controls" aria-live="polite">
        <span className="fc-opening-sr-only">{animation.revealed.length > 0 && stage !== 'summary' ? `Carte ${animation.revealed.length} : ${cards[animation.revealed.length - 1].card.name}, ${state.config.rarities[cards[animation.revealed.length - 1].card.rarity].name}.` : ''}</span>
        {stage === 'reveal' && <><p>{highlighted && highlighted.rarity >= 4 ? <span className="fc-opening-extraordinary" style={{ color: state.config.rarities[highlighted.rarity].color }}><Sparkles size={18} /> Une rencontre {state.config.rarities[highlighted.rarity].name.toLowerCase()}.</span> : animation.automatic ? 'Chaque découverte prend sa place…' : 'Touchez la prochaine carte pour la révéler.'}</p><button className="fc-opening-secondary" disabled={animation.automatic} onClick={() => { allRevealRequested.current = true; dispatch({ type: 'AUTOMATIC' }); }}><Sparkles size={16} /> Tout révéler</button></>}
        {stage === 'summary' && <><div className="fc-opening-reward"><span><Check size={17} /> {replay ? 'Récompenses déjà reçues' : 'Collection mise à jour'}</span><Shards value={`+${opening.shardsReward}`} />{opening.pityTriggered && <b><Sparkles size={13} /> Pitié mythique</b>}</div><div className="fc-opening-summary-stats"><span>{opening.cards.filter(card => card.isNew).length} nouvelle(s) carte(s)</span><i /><span>{opening.cards.filter(card => !card.isNew).length} doublon(s)</span></div><div className="fc-opening-buttons"><button className="fc-opening-secondary" onClick={close}><ArrowLeft size={16} /> Retour aux boosters</button><button className="fc-booster-primary" disabled={busy || !latest?.available || !latest.active} onClick={() => void next()}>{busy ? <LoaderCircle className="fc-booster-spinner" size={16} /> : <RotateCcw size={16} />} Ouvrir à nouveau</button></div></>}
      </div>
    </div><span className="fc-opening-footnote">KROSMORIA · {replay ? formatDate(opening.createdAt) : 'VOTRE HISTOIRE CONTINUE'}</span>
  </div>, document.body);
}

export function BoostersPage() { return <div className="fc-boosters-page"><BoosterShowcase /></div>; }
