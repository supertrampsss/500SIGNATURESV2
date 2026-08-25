import assert from "node:assert/strict";
import { test } from "node:test";

import { demarrerSessionImmersive } from "./session-immersive.ts";

type Ecouteur = (evenement: MouseEvent) => void;

function fauxCadre() {
  const ecouteurs = new Set<Ecouteur>();
  return {
    addEventListener: (_type: string, ecouteur: Ecouteur) => ecouteurs.add(ecouteur),
    removeEventListener: (_type: string, ecouteur: Ecouteur) => ecouteurs.delete(ecouteur),
    cliquer: (cible: HTMLElement) => ecouteurs.forEach((ecouteur) => ecouteur({ target: cible } as MouseEvent)),
  } as unknown as HTMLElement & { cliquer(cible: HTMLElement): void };
}

function fauxDocument() {
  return { body: { dataset: {} as DOMStringMap } } as unknown as Document;
}

test("une séance immersive active son état sur le document", () => {
  const precedent = globalThis.document;
  const cadre = fauxCadre();
  globalThis.document = fauxDocument();
  try {
    const demonter = demarrerSessionImmersive(cadre);
    assert.equal(document.body.dataset.session, "active");
    demonter();
  } finally {
    globalThis.document = precedent;
  }
});

test("la sortie explicite et le démontage nettoient l'état de séance", () => {
  const precedent = globalThis.document;
  const cadre = fauxCadre();
  globalThis.document = fauxDocument();
  try {
    demarrerSessionImmersive(cadre);
    const quitter = { closest: (selecteur: string) => selecteur === ".tunnel__quitter" ? quitter : null } as unknown as HTMLElement;
    cadre.cliquer(quitter);
    assert.equal(document.body.dataset.session, undefined);

    const demonter = demarrerSessionImmersive(cadre);
    assert.equal(document.body.dataset.session, "active");
    demonter();
    assert.equal(document.body.dataset.session, undefined);
  } finally {
    globalThis.document = precedent;
  }
});
