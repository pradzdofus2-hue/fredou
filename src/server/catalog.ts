import { DOFUS_IMAGES } from './dofus-image-map';
/** Catalogue de fan-projet. Noms Dofus non affiliés à Ankama ; illustrations temporaires originales. */
import type { Card, Rarity, Series } from '../lib/contracts';
import { GAME_CONFIG } from './config';
export const SERIES: Series[] = [
  {
    "id": "aetherion",
    "name": "Astrub et ses légendes",
    "description": "Des pious d'Astrub aux personnages qui ont marqué le Monde des Douze.",
    "color": "#7db8f5"
  },
  {
    "id": "sylve",
    "name": "Amakna et ses héros",
    "description": "Des créatures des plaines aux figures mythiques des aventures d'Amakna.",
    "color": "#72d68c"
  },
  {
    "id": "forges",
    "name": "Les mystères de Frigost",
    "description": "Les monstres des neiges, les gardiens de donjons et les légendes de l'île gelée.",
    "color": "#9bccef"
  }
];
const NAMES: string[][] = [
  [
    "Piou Rouge",
    "Piou Bleu",
    "Piou Vert",
    "Tofu",
    "Arakne",
    "Boufton Blanc",
    "Boufton Noir",
    "Pissenlit Diabolique",
    "Bouftou",
    "Prespic",
    "Sanglier",
    "Tournesol Sauvage",
    "Chafer",
    "Crâqueleur",
    "Milimulou",
    "Bwork",
    "Bouftou Royal",
    "Tofu Royal",
    "Tournesol Affamé",
    "Abraknyde Ancestral",
    "Maître Corbac",
    "Chêne Mou",
    "Joris",
    "Ogrest"
  ],
  [
    "Larve Bleue",
    "Larve Verte",
    "Porkass",
    "Scara Bleu",
    "Scara Rouge",
    "Scara Vert",
    "Blop Coco",
    "Blop Reinette",
    "Kanigrou",
    "Koalak Sanguin",
    "Gelée Royale Bleue",
    "Gelée Royale Rouge",
    "Meulou",
    "Dragon Cochon",
    "Dark Vlad",
    "Minotoror",
    "Minotot",
    "Crocabulia",
    "Goultard",
    "Otomaï",
    "Otomai",
    "Rushu",
    "Djaul",
    "Dieu Iop"
  ],
  [
    "Boufmouth",
    "Boufmouth de Guerre",
    "Mansot",
    "Mansot Royal",
    "Kani Glours",
    "Sanglacier",
    "Krakal",
    "Fu Mansot",
    "Royalmouth",
    "Ben le Ripate",
    "Obsidiantre",
    "Tengu Givrefoux",
    "Korriandre",
    "Kolossos",
    "Glourséleste",
    "N",
    "Missiz Frizz",
    "Nileza",
    "Sylargh",
    "Klime",
    "Comte Harebourg",
    "Harebourg le Comte",
    "Dofus des Glaces",
    "Dieu Xélor"
  ]
];
/** Identifiants card-1 ... card-72 préservés pour ne pas perdre les inventaires existants. */
export const CARDS: Card[] = SERIES.flatMap((series, seriesIndex) => NAMES[seriesIndex].map((name, index) => {
  const rarity: Rarity = index < 8 ? 0 : index < 12 ? 1 : index < 16 ? 2 : index < 20 ? 3 : index < 22 ? 4 : 5;
  const number = seriesIndex * 24 + index + 1;
  return { id: `card-${number}`, number, name, rarity, seriesId: series.id,
    description: `${name} rejoint l'album « ${series.name} ». Carte de collection non officielle du Monde des Douze.`,
    // Visuels fictifs actuels conservés jusqu'à la sélection d'illustrations autorisées.
    image: DOFUS_IMAGES[`card-${number}`] ?? `/art/card-${number}.svg`, recycleValue: GAME_CONFIG.rarities[rarity].recycleValue,
    collectionPoints: GAME_CONFIG.rarities[rarity].collectionPoints };
}));
