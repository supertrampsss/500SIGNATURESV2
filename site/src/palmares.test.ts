/**
 * Le palmarès. Ce qu'il refuse compte autant que ce qu'il range : il publie le
 * haut et le bas d'un échelon entier, et chaque approximation y devient une
 * accusation contre un territoire nommé.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { noter } from "./note.ts";
import { palmares, rangs, rendrePalmares, rendreVoisinage, voisinage, type Ligne } from "./palmares.ts";

/** Un échelon d'essai : `n` territoires dont la note décroît régulièrement. */
function echelon(n: number, exercice = "2025"): Ligne[] {
  return Array.from({ length: n }, (_, i) => ({
    code: `c${i}`,
    nom: `Ville ${String(i).padStart(3, "0")}`,
    // Une marge qui décroît donne une note qui décroît, sans plafonner.
    note: noter(
      { tauxEpargne: 30 - (i * 26) / n, desendettement: 4, trajectoire: -2.7, exercice },
      "commune",
    ),
  }));
}

const texte = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

test("les deux bouts ne se chevauchent jamais", () => {
  // Sous vingt territoires notés, prendre dix en haut et dix en bas montrerait
  // la même commune parmi les meilleures ET parmi les pires. Le lecteur y
  // lirait une contradiction, et il aurait raison.
  for (const n of [1, 2, 3, 7, 12, 19, 20, 21, 100]) {
    const p = palmares(echelon(n));
    assert.ok(p, `${n} territoires`);
    const hauts = new Set(p.tete.map((l) => l.code));
    for (const bas of p.queue) {
      assert.ok(!hauts.has(bas.code), `${n} territoires : ${bas.nom} est en haut ET en bas`);
    }
  }
});

test("le haut se lit de haut en bas, le bas de bas en haut", () => {
  const p = palmares(echelon(100));
  assert.ok(p);
  // La meilleure d'abord.
  assert.ok(p.tete[0].note.valeur >= p.tete[1].note.valeur);
  // Et la pire d'abord dans l'autre colonne : le bas se lit en partant du bas.
  assert.ok(p.queue[0].note.valeur <= p.queue[1].note.valeur);
  assert.equal(p.queue[0].note.valeur, Math.min(...echelon(100).map((l) => l.note.valeur)));
});

test("le dénombrement porte sur ceux qui publient, jamais sur ceux qui existent", () => {
  // « 10 meilleures sur 34 875 » serait faux : 34 778 communes publient les
  // trois séries. Un rang se dit sur les publiants — c'est la règle que
  // `situation.ts` tient déjà, et le palmarès ne peut pas y déroger.
  const p = palmares(echelon(97));
  assert.ok(p);
  assert.equal(p.effectif, 97);
  assert.match(texte(rendrePalmares(p, "commune")), /sur 97 communes qui publient/);
});

test("un ex æquo ne fait pas bouger le palmarès d'une visite à l'autre", () => {
  // `Object.keys` ne garantit pas un ordre, et deux publications des mêmes
  // données rendraient deux palmarès différents. Le nom départage.
  const memeNote = (code: string, nom: string): Ligne => ({
    code,
    nom,
    note: noter({ tauxEpargne: 20, desendettement: 4, trajectoire: 1, exercice: "2025" }, "commune"),
  });
  const a = palmares([memeNote("x", "Zoé"), memeNote("y", "Alice"), memeNote("z", "Marc")], 1);
  const b = palmares([memeNote("z", "Marc"), memeNote("x", "Zoé"), memeNote("y", "Alice")], 1);
  assert.ok(a && b);
  assert.deepEqual(
    a.tete.map((l) => l.code),
    b.tete.map((l) => l.code),
  );
  assert.equal(a.tete[0].nom, "Alice");
});

test("la médiane est écrite, pour que les deux bouts aient un milieu", () => {
  // Dix communes à 19/20 posées au-dessus de dix communes à 1/20 laissent
  // croire que l'échelon se répartit en deux camps.
  const p = palmares(echelon(101));
  assert.ok(p);
  const lu = texte(rendrePalmares(p, "commune"));
  assert.match(lu, /note médiane est de \d+,\d sur 20/);
});

test("un exercice minoritaire est compté, jamais tu", () => {
  // Une poignée de communes s'arrête un an plus tôt. Dater tout le tableau de
  // l'exercice le plus fréquent, sans le dire, en ferait un tableau faux.
  const lignes = [...echelon(30), ...echelon(3, "2024").map((l, i) => ({ ...l, code: `v${i}` }))];
  const p = palmares(lignes);
  assert.ok(p);
  assert.equal(p.exercice, "2025");
  assert.equal(p.autresExercices, 3);
  assert.match(texte(rendrePalmares(p, "commune")), /3 sont notées sur l'exercice précédent/);
  // Et le singulier quand il n'y en a qu'une.
  const seule = palmares([...echelon(30), { ...echelon(1, "2024")[0], code: "seul" }]);
  assert.ok(seule);
  assert.match(texte(rendrePalmares(seule, "commune")), /1 est notée sur l'exercice précédent/);
});

test("un échelon entièrement sur le même exercice ne dit rien de plus", () => {
  // Une phrase « 0 sont notées sur l'exercice précédent » est du bruit.
  const p = palmares(echelon(50));
  assert.ok(p);
  assert.equal(p.autresExercices, 0);
  assert.doesNotMatch(texte(rendrePalmares(p, "commune")), /exercice précédent/);
});

test("les notes gardent leur décimale : c'est une colonne", () => {
  // Deux colonnes lues de haut en bas. « 20 » entre « 19,4 » et « 18,7 »
  // casse l'alignement, et `Intl` laisse tomber la décimale sur un compte rond.
  const parfaite: Ligne = {
    code: "p",
    nom: "Parfaite",
    note: noter({ tauxEpargne: 90, desendettement: 0.1, trajectoire: 40, exercice: "2025" }, "commune"),
  };
  const html = rendrePalmares(palmares([parfaite, ...echelon(40)]), "commune");
  for (const v of [...html.matchAll(/class="palmares__note nombre">([^<]*)</g)].map((m) => m[1])) {
    assert.match(v, /^\d+,\d$/, `« ${v} » a perdu sa décimale`);
  }
});

test("un échelon inconnu ne peint rien plutôt qu'un tableau sans dénominateur", () => {
  // La France n'a pas de barème, donc pas de palmarès. Un cadre vide occuperait
  // la page pour dire qu'il n'a rien à dire.
  assert.equal(rendrePalmares(palmares(echelon(30)), "pays"), "");
  assert.equal(rendrePalmares(null, "commune"), "");
  assert.equal(palmares([]), null);
});

test("chaque ligne ouvre la fiche du territoire, et son nom est échappé", () => {
  const html = rendrePalmares(
    palmares([
      { ...echelon(1)[0], code: "33063", nom: `L'Île-d'Yeu <script>` },
      ...echelon(30).map((l, i) => ({ ...l, code: `z${i}` })),
    ]),
    "commune",
  );
  assert.match(html, /data-territoire="33063"/);
  assert.doesNotMatch(html, /<script>/);
});

test("le titre s'accorde avec le genre de l'échelon", () => {
  // **La faute exacte que le classement venait de corriger**, réapparue dans
  // un module neuf le jour où il est arrivé : « les départements les mieux et
  // les moins bien gérées ». Le participe s'accorde, et « départements » est
  // masculin quand « communes » et « régions » sont féminins.
  const p = palmares(echelon(40));
  assert.match(texte(rendrePalmares(p, "commune")), /communes les mieux et les moins bien gérées/);
  assert.match(texte(rendrePalmares(p, "region")), /régions les mieux et les moins bien gérées/);
  assert.match(
    texte(rendrePalmares(p, "departement")),
    /départements les mieux et les moins bien gérés/,
  );
});

test("les ex æquo du plafond sont comptés, et départagés par la population", () => {
  // **2 102 communes valent exactement 20 sur 20** et 2 221 valent 0 : la note
  // est bornée aux deux bouts. Un tri qui départageait par le nom sortait
  // Abbans-Dessous, Ablaincourt-Pressoir, Ablancourt — les premières de
  // l'alphabet parmi deux mille, présentées comme « les mieux gérées de
  // France ».
  const parfaite = (code: string, nom: string, population: number | null): Ligne => ({
    code,
    nom,
    population,
    note: noter({ tauxEpargne: 90, desendettement: 0.1, trajectoire: 40, exercice: "2025" }, "commune"),
  });
  const lignes = [
    parfaite("a", "Abbans-Dessous", 120),
    parfaite("b", "Bordeaux", 260_000),
    parfaite("c", "Cenon", 25_000),
    ...echelon(60).map((l, i) => ({ ...l, code: `z${i}`, population: 1_000 })),
  ];
  const p = palmares(lignes);
  assert.ok(p);
  assert.equal(p.exAequoTete, 3);
  // La plus peuplée d'abord, pas la première de l'alphabet.
  assert.equal(p.tete[0].nom, "Bordeaux");
  assert.equal(p.tete[1].nom, "Cenon");
  // Et le lecteur l'apprend, plutôt que de croire à un palmarès de trois.
  const lu = texte(rendrePalmares(p, "commune"));
  assert.match(lu, /3 communes valent exactement 20,0 sur 20/);
  assert.match(lu, /plus peuplées d'entre elles qui sont montrées en tête/);
});

test("sans ex æquo, rien n'est dit : la première est la première", () => {
  // « 1 commune vaut exactement 19,4 sur 20 » n'apprend rien.
  const p = palmares(echelon(60));
  assert.ok(p);
  assert.equal(p.exAequoTete, 1);
  assert.doesNotMatch(texte(rendrePalmares(p, "commune")), /valent exactement/);
});

test("un territoire sans population publiée n'est pas écarté", () => {
  // Il passe après ceux qui en ont une, il ne disparaît pas du palmarès.
  const p = palmares([
    { ...echelon(1)[0], code: "sans", nom: "Sans population", population: null },
    ...echelon(40).map((l, i) => ({ ...l, code: `q${i}`, population: 500 })),
  ]);
  assert.ok(p);
  assert.equal(p.effectif, 41);
});

test("les deux bouts montrent les plus peuplées, y compris le bas", () => {
  // **Le défaut, vu au navigateur sur les fichiers publiés.** Un tri unique
  // « note décroissante, population décroissante » suivi d'un `slice(-N)`
  // prend, parmi les derniers ex æquo, les MOINS peuplés : le bas affichait
  // Fontanès-de-Sault et Vérignon sous une phrase annonçant « les plus
  // peuplées d'entre elles ». Le texte publié démentait le tableau publié.
  const nulle = (code: string, nom: string, population: number): Ligne => ({
    code,
    nom,
    population,
    note: noter({ tauxEpargne: -50, desendettement: null, trajectoire: -40, exercice: "2025" }, "commune"),
  });
  const p = palmares([
    nulle("a", "Hameau", 30),
    nulle("b", "Grande-Ville", 90_000),
    nulle("c", "Bourg", 4_000),
    ...echelon(60).map((l, i) => ({ ...l, code: `z${i}`, population: 2_000 })),
  ]);
  assert.ok(p);
  assert.equal(p.queue[0].nom, "Grande-Ville", "le bas montre la plus petite au lieu de la plus grande");
  assert.equal(p.queue[1].nom, "Bourg");
});

test("des ex æquo partagent leur rang, ils n'en reçoivent pas d'inventés", () => {
  // 2 102 communes valent exactement 20 sur 20. Leur écrire « 1re, 2e, 3e… »
  // serait un rang fabriqué ; et en bas, « 34 778e, 34 777e » l'était aussi.
  // Elles sont toutes premières — dix lignes qui affichent « 1 » disent au
  // lecteur, mieux qu'une phrase, que le plafond est encombré. C'est la
  // convention que `situation.ts` tient déjà.
  const parfaite = (code: string, population: number): Ligne => ({
    code,
    nom: `Ville ${code}`,
    population,
    note: noter({ tauxEpargne: 90, desendettement: 0.1, trajectoire: 40, exercice: "2025" }, "commune"),
  });
  const p = palmares([parfaite("a", 9), parfaite("b", 8), parfaite("c", 7), ...echelon(60)]);
  assert.ok(p);
  assert.deepEqual(rangs(p.tete.slice(0, 3), p.valeurs), [1, 1, 1]);
  // Et la quatrième, elle, n'est pas première.
  assert.ok(rangs(p.tete, p.valeurs)[3] > 1);
  // Le rendu emploie ces rangs-là, pas la position dans la liste.
  const lu = rendrePalmares(p, "commune");
  const affiches = [...lu.matchAll(/class="palmares__rang nombre">([^<]*)</g)].map((m) => m[1]);
  assert.deepEqual(affiches.slice(0, 3), ["1", "1", "1"]);
});

test("les titres de colonnes s'accordent aussi, pas seulement celui du haut", () => {
  // Le titre disait « les départements les mieux et les moins bien gérés » et
  // ses deux colonnes, deux lignes plus bas, « Les mieux notées ». Le
  // participe est tombé trois fois dans ce dépôt : au critère du classement,
  // au titre du palmarès, puis à ses colonnes.
  const p = palmares(echelon(40));
  assert.match(texte(rendrePalmares(p, "departement")), /Les mieux notés/);
  assert.match(texte(rendrePalmares(p, "departement")), /Les moins bien notés/);
  assert.match(texte(rendrePalmares(p, "commune")), /Les mieux notées/);
});

/* ---------------------------------------------------------------------- *
 * LE VOISINAGE DE RANG DANS LE GROUPE DE COMMUNES SEMBLABLES              *
 * ---------------------------------------------------------------------- */

const INTITULES = ["de 100\u202f000 habitants et plus", "urbaines", "de métropole"];

test("le groupe nomme ses critères : « 40 communes » seul ne veut rien dire", () => {
  const groupe = echelon(40);
  const rendu = texte(
    rendreVoisinage(voisinage(groupe, groupe[7].code), INTITULES, {
      code: groupe[7].code,
      nom: groupe[7].nom,
      note: groupe[7].note,
    }),
  );
  assert.match(rendu, /40 communes de 100\s000 habitants et plus, urbaines, de métropole/);
  // Et la source des critères, qui n'est pas la nôtre.
  assert.match(rendu, /Observatoire des finances locales/);
});

test("la place du territoire dans son groupe est la réponse qu'on vient chercher", () => {
  const groupe = echelon(40);
  // Les notes décroissent avec le rang du tableau : le huitième est 8e.
  const rendu = texte(
    rendreVoisinage(voisinage(groupe, groupe[7].code), INTITULES, {
      code: groupe[7].code,
      nom: groupe[7].nom,
      note: groupe[7].note,
    }),
  );
  assert.match(rendu, /Ville 007 est 8e sur 40/);
  // Le premier porte sa marque, et les communes sont féminines.
  const premier = texte(
    rendreVoisinage(voisinage(groupe, groupe[0].code), INTITULES, {
      code: groupe[0].code,
      nom: groupe[0].nom,
      note: groupe[0].note,
    }),
  );
  assert.match(premier, /Ville 000 est 1re sur 40/);
});

test("la fenêtre contient toujours le territoire, même loin des deux bouts", () => {
  // C'est le défaut que cette section corrige : le groupe de semblables
  // montrait « les 5 meilleures » et « les 5 moins bonnes », deux listes
  // disjointes qui ne contenaient JAMAIS une commune classée au milieu — la
  // 14e sur 25, par exemple, n'apparaissait dans aucune des deux.
  const groupe = echelon(25);
  const milieu = groupe[13]; // 14e sur 25
  const v = voisinage(groupe, milieu.code);
  assert.ok(v);
  assert.ok(v.lignes.some((l) => l.code === milieu.code), "la commune n'est pas dans sa fenêtre");
  assert.equal(v.lignes[v.indexVous].code, milieu.code);
});

test("la fenêtre glisse vers le bord plutôt que de se tronquer", () => {
  // Une commune 2e sur 25 avec un rayon de 3 ne montre pas seulement les
  // rangs 1 à 5 (un trou en dessous d'elle) : la fenêtre glisse pour tenir
  // ses 7 rangs quand la place existe de l'autre côté.
  const groupe = echelon(25);
  const v = voisinage(groupe, groupe[1].code, 3);
  assert.ok(v);
  assert.equal(v.lignes.length, 7);
  assert.equal(v.lignes[0].code, groupe[0].code, "la fenêtre ne part pas du premier rang");
});

test("une fenêtre demandée plus grande que le groupe ne déborde pas", () => {
  const groupe = echelon(4);
  const v = voisinage(groupe, groupe[0].code, 3);
  assert.ok(v);
  assert.equal(v.lignes.length, 4);
});

test("un rang partagé se dit, il ne se présente pas comme une place propre", () => {
  // Le plafond de la note est encombré : douze communes du même groupe à
  // 20 sur 20 ne sont pas douzièmes, elles sont toutes premières.
  const plates: Ligne[] = Array.from({ length: 30 }, (_, i) => ({
    code: `p${i}`,
    nom: `Plate ${i}`,
    note: noter(
      { tauxEpargne: 40, desendettement: 1, trajectoire: 5, exercice: "2025" },
      "commune",
    ),
  }));
  const rendu = texte(
    rendreVoisinage(voisinage(plates, plates[3].code), INTITULES, {
      code: plates[3].code,
      nom: plates[3].nom,
      note: plates[3].note,
    }),
  );
  assert.match(rendu, /est 1re sur 30/);
  assert.match(rendu, /à égalité avec 29 autres/);
  // À deux, la commune ne compte pas : « à égalité avec 1 autre » se lit mal.
  const paire = plates.slice(0, 2).concat(echelon(28));
  const deux = texte(
    rendreVoisinage(voisinage(paire, paire[0].code), INTITULES, {
      code: paire[0].code,
      nom: paire[0].nom,
      note: paire[0].note,
    }),
  );
  assert.match(deux, /à égalité avec une autre/);
});

test("le territoire lu se reconnaît dans sa propre liste", () => {
  // La fenêtre le contient toujours ; c'est justement celui-là qu'on est
  // venu chercher.
  const groupe = echelon(40);
  const html = rendreVoisinage(voisinage(groupe, groupe[0].code), INTITULES, {
    code: groupe[0].code,
    nom: groupe[0].nom,
    note: groupe[0].note,
  });
  assert.match(html, /class="palmares__vous"/);
  assert.match(html, /aria-current="true"/);
  // Et une seule ligne le porte.
  assert.equal(html.match(/aria-current="true"/g)?.length, 1);
});

test("un groupe vide ne peint rien plutôt qu'une section sans tableau", () => {
  assert.equal(
    rendreVoisinage(voisinage([], "c0"), INTITULES, {
      code: "c0",
      nom: "Ville",
      note: echelon(1)[0].note,
    }),
    "",
  );
  // Et un code absent du groupe : la fenêtre n'a personne à entourer.
  assert.equal(voisinage(echelon(10), "inconnu"), null);
});

test("l'exercice minoritaire du groupe est compté, pas tu", () => {
  const melange = echelon(20).concat(echelon(3, "2024"));
  const rendu = texte(
    rendreVoisinage(voisinage(melange, melange[0].code), INTITULES, {
      code: melange[0].code,
      nom: melange[0].nom,
      note: melange[0].note,
    }),
  );
  assert.match(rendu, /3 sont notées sur l'exercice précédent/);
});
