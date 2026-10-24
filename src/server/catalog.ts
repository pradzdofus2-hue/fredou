import type { Card, Rarity, Series } from '../lib/contracts';
import { GAME_CONFIG } from './config';
export const SERIES: Series[] = [
  { id: 'aetherion', name: 'Citadelles astrales', description: 'Au-dessus des nuages, Aetherion garde la mémoire des constellations.', color: '#ad8aff' },
  { id: 'sylve', name: 'Sylve des murmures', description: 'Une forêt ancienne où chaque souffle éveille une histoire.', color: '#6cdaa8' },
  { id: 'forges', name: 'Forges du crépuscule', description: 'Des cités de cuivre suspendues au bord d’un soleil endormi.', color: '#efb66a' },
];
const NAMES = [
  ['Veilleur des nuées', 'Messagère d’azur', 'Apprenti stellaire', 'Archiviste du vent', 'Guetteur des ponts', 'Tisseuse de brume', 'Pilote du levant', 'Gardien des lanternes', 'Éclaireur prismatique', 'Voyageuse des cimes', 'Sentinelle opaline', 'Cartographe astral', 'Danseuse de comètes', 'Oracle d’argent', 'Duelliste de lune', 'Alchimiste des aurores', 'Chevalière de l’éclipse', 'Sphinx des hauteurs', 'Maître des horizons', 'Chimère de cristal', 'Impératrice céleste', 'Dragon du firmament', 'Astra, cœur des étoiles', 'Néant, dernier astre'],
  ['Pousse de rosée', 'Gardien des fougères', 'Luciole vagabonde', 'Pisteuse de mousse', 'Sculpteur de racines', 'Esprit de la pluie', 'Écuyer des chênes', 'Tisseuse de lierre', 'Chasseur de songes', 'Guérisseuse d’ambre', 'Biche des saisons', 'Dryade du silence', 'Chanteur des ronces', 'Sorcière des sources', 'Renard des mirages', 'Veilleur du saule', 'Cerf de jade', 'Ent des mille hivers', 'Phénix de feuilles', 'Reine des floraisons', 'Sylvar, arbre-monde', 'Hydre des marais clairs', 'Élyne, première sève', 'Orée, esprit primordial'],
  ['Forgeron des braises', 'Coursière de cuivre', 'Mineur de l’aube', 'Sondeuse des cendres', 'Mécanicien solaire', 'Gardienne du charbon', 'Golem d’argile', 'Guetteuse des rails', 'Artilleur d’obsidienne', 'Artisane des étincelles', 'Automate du couchant', 'Marchande de chaleur', 'Capitaine de la fournaise', 'Mage du métal', 'Griffon de bronze', 'Alchimiste des scories', 'Titan des enclumes', 'Sirène de lave', 'Seigneur du creuset', 'Chimère mécanique', 'Roi des volcans', 'Dragon de l’aurore rouge', 'Vulcar, soleil captif', 'Ignis, feu originel'],
];
export const CARDS: Card[] = SERIES.flatMap((series, seriesIndex) => NAMES[seriesIndex].map((name, index) => {
  const rarity: Rarity = index < 8 ? 0 : index < 12 ? 1 : index < 16 ? 2 : index < 20 ? 3 : index < 22 ? 4 : 5;
  const number = seriesIndex * 24 + index + 1;
  return { id: `card-${number}`, number, name, rarity, seriesId: series.id,
    description: `${name} veille sur les secrets de ${series.name}. Les voyageurs racontent que sa présence change le destin de ceux qui croisent son chemin. Fragment ${String(number).padStart(3, '0')} des chroniques de FREDOU.`,
    image: `/art/card-${number}.svg`, recycleValue: GAME_CONFIG.rarities[rarity].recycleValue, collectionPoints: GAME_CONFIG.rarities[rarity].collectionPoints };
}));
