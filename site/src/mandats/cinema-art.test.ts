import test from 'node:test';
import assert from 'node:assert/strict';
import { artForDossier } from './cinema-art.ts';

test('cinema art is selected deterministically from dossier themes', () => {
  assert.equal(artForDossier('Crise énergétique').src, '/mandats/art/energy.webp');
  assert.equal(artForDossier('Services publics').src, '/mandats/art/nation.webp');
  assert.equal(artForDossier('Éducation').src, '/mandats/art/school.webp');
  assert.equal(artForDossier('Santé et hôpital').src, '/mandats/art/hospital.webp');
  assert.equal(artForDossier('Financement').src, '/mandats/art/office.webp');
  assert.equal(artForDossier('Héritage national').src, '/mandats/art/legacy.webp');
  assert.equal(artForDossier('Question de société').src, '/mandats/art/chapter.webp');
  assert.equal(artForDossier('Dossier générique'), artForDossier('Dossier générique'));
});

test('end of the dossier sequence selects the legacy setting', () => {
  assert.equal(artForDossier('Chapitre 5', 5, 5).src, '/mandats/art/legacy.webp');
});
