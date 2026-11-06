// Instantané officiel servi par le site : aucune recherche de visiteur n'est envoyée à l'API.
import { mkdir, writeFile } from 'node:fs/promises';
const source = 'https://geo.api.gouv.fr/communes?fields=code,codesPostaux&format=json';
const reponse = await fetch(source);
if (!reponse.ok) throw new Error(`Correspondances postales indisponibles (${reponse.status})`);
const communes = await reponse.json();
if (!Array.isArray(communes) || communes.length < 30000) throw new Error('Liste de communes incomplète.');
const parCode = {};
for (const commune of communes) {
  if (!/^[0-9AB]{5}$/.test(commune.code) || !Array.isArray(commune.codesPostaux)) throw new Error('Commune mal formée.');
  for (const postal of commune.codesPostaux) {
    if (!/^\d{5}$/.test(postal)) throw new Error('Code postal mal formé.');
    (parCode[postal] ??= new Set()).add(commune.code);
  }
}
const codes = Object.fromEntries(Object.entries(parCode).sort(([a], [b]) => a.localeCompare(b)).map(([code, liste]) => [code, [...liste].sort()]));
const sortie = new URL('../public/recherche/', import.meta.url);
await mkdir(sortie, { recursive: true });
await writeFile(new URL('codes-postaux.json', sortie), JSON.stringify({ source, extrait_le: new Date().toISOString(), codes }) + '\n');
console.log(`${Object.keys(codes).length} codes postaux, ${communes.length} communes ; instantané officiel enregistré.`);
