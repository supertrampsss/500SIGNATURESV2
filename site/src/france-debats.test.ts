import assert from "node:assert/strict";
import { test } from "node:test";
import type { Insight } from "./insights.ts";
import { questionsFrance } from "./france-debats.ts";

function fait(id: string, titre: string, sourceIds: string[]): Insight {
  return { id, famille: "fiscalite", surtitre: "", titre, texte: titre, reserve: "", sourceIds, preuves: [] };
}

test("les questions renvoient aux analyses et aux sources réellement présentes", () => {
  const html = questionsFrance([
    fait("tres-hauts-revenus", "Les revenus du 0,1 % ont progressé", ["insee-tres-hauts-revenus"]),
    fait("ir-foyers-imposes", "47 % des foyers paient l'impôt", ["dgfip-ir-2024"]),
  ]);
  assert.match(html, /Les hauts revenus contribuent-ils assez/);
  assert.match(html, /href="#insight-tres-hauts-revenus"/);
  assert.match(html, /INSEE|Insee/);
  assert.doesNotMatch(html, /Combien la dette coûtera-t-elle demain/);
  assert.equal(questionsFrance([]), "");
});
