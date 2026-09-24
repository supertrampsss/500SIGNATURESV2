import type { Game } from './types.ts';
import { domainFor } from './engine.ts';

export type CinemaArt = { src: string; alt: string; mood: string };

const ART: Record<string, CinemaArt> = {
  office: { src: '/mandats/art/office.webp', alt: 'Bâtiment public dans un paysage français.', mood: 'civic' },
  school: { src: '/mandats/art/school.webp', alt: 'École au cœur d’un quartier français.', mood: 'education' },
  hospital: { src: '/mandats/art/hospital.webp', alt: 'Hôpital dans une ville française.', mood: 'care' },
  nation: { src: '/mandats/art/nation.webp', alt: 'Paysage urbain français.', mood: 'nation' },
  chapter: { src: '/mandats/art/chapter.webp', alt: 'Vue d’ensemble d’un territoire français.', mood: 'chapter' },
  legacy: { src: '/mandats/art/legacy.webp', alt: 'Paysage français au terme du mandat.', mood: 'legacy' },
  energy: { src: '/mandats/art/energy.webp', alt: 'Paysage industriel et énergétique français.', mood: 'energy' },
  parliament: { src: '/mandats/art/parliament.webp', alt: 'Vue miniature de l’Assemblée nationale.', mood: 'parliament' },
  council: { src: '/mandats/art/council.webp', alt: 'Conseil institutionnel dans une salle républicaine.', mood: 'council' },
  rupture: { src: '/mandats/art/rupture.webp', alt: 'Paysage institutionnel français à un tournant du mandat.', mood: 'rupture' },
};

/** Stable editorial mapping: the picture follows the dossier theme, never its simulated outcome. */
export function artForDossier(category: string, turn = 0, total = 0): CinemaArt {
  const normalized = category.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr');
  if (/assemblee|parlement|scrutin|censure|coalition|cohabitation|gouvernement/.test(normalized)) return ART.parliament;
  if (/scandale|destitution|conseil|president/.test(normalized)) return ART.council;
  if (/rupture|demission|dissolution|crise institutionnelle/.test(normalized)) return ART.rupture;
  if (total > 0 && turn >= total) return ART.legacy;
  if (/heritage|bilan|successeur/.test(normalized)) return ART.legacy;
  if (/crise.*(energet|energie)|energet|energie/.test(normalized)) return ART.energy;
  if (/sante|hospital|soin/.test(normalized)) return ART.hospital;
  if (/ecole|education|enseignement/.test(normalized)) return ART.school;
  if (/fiscal|dette|financement|budget/.test(normalized)) return ART.office;
  if (/services publics/.test(normalized)) return ART.nation;
  if (/industrie|transport|climat/.test(normalized)) return ART.energy;
  return ART.chapter;
}

export function artForGame(game: Game, inherited = false): CinemaArt {
  const dossiers = domainFor(game).dossiers;
  const index = inherited ? 0 : Math.min(game.turn, Math.max(0, dossiers.length - 1));
  return artForDossier(dossiers[index]?.category ?? 'Chapitre', index, dossiers.length);
}

export function cinemaSceneMarkup(art: CinemaArt): string {
  return `<div class="cinema-scene" data-cinema-scene data-mood="${art.mood}" role="img" aria-label="${art.alt}">
    <img class="cinema-scene-art" data-cinema-art src="${art.src}" alt="" decoding="async" fetchpriority="high" draggable="false">
    <span class="cinema-scene-grain" aria-hidden="true"></span>
    <span class="cinema-scene-light" aria-hidden="true"></span>
  </div>`;
}
