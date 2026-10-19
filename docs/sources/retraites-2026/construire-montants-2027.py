"""Reproduit les montants monétaires à partir des PAP téléchargés, sans extrapoler le graphique.

Entrées de travail : .snapshots/ministeres-2027 (PAP officiels et tableau PLF).
Les nombres des tableaux PDF sont lus dans la colonne PLF 2027 ; les coordonnées
servent uniquement à identifier cette colonne, jamais à mesurer une barre.
"""
from pathlib import Path
import hashlib
import json
import re
import fitz

ROOT = Path(__file__).resolve().parents[3]
BASE = ROOT / '.snapshots/ministeres-2027'
OUT = Path(__file__).with_name('ministeres-montants-2027.json')

GROUPS = [
    ['156', '218', '302', '349', '148'],
    ['206', '215', '143', '142'], ['112'], ['212'], ['224'],
    ['134', '220', '305'], ['140', '141', '230', '139', '214'], ['150'],
    ['105'], ['354', '232', '216', '176', '152', '161'],
    ['166', '107', '182', '310', '335'], ['138'], [],
    ['165', '126', '164', '129', '308', '158'], ['219'], ['217'], [], ['155'], ['147'],
]

rows = json.loads((BASE / 'budgets-bruts.json').read_text(encoding='utf8'))
extractions = json.loads((BASE / 'pensions-programmes-extraction.json').read_text(encoding='utf8'))
programs = {}
for entry in extractions:
    code = entry['programme']
    if code in ['613', '624', '741']:
        continue  # budgets annexes et CAS : hors budget général
    url = entry['source']
    ident = url.split('/visualisation/')[1].split('/')[0] if '/visualisation/' in url else url.rsplit('/', 1)[1]
    path = BASE / f'pap-{ident}.pdf'
    document = fitz.open(path)
    page_index = entry['page'] - 1
    page = document[page_index]
    lines = [line for block in page.get_text('dict')['blocks'] if block['type'] == 0 for line in block['lines']]
    def text(line):
        return ''.join(s['text'] for s in line['spans']).strip()
    anchor = next(line for line in lines if "Contributions d" in text(line) and 'CAS Pensions' in text(line))
    headers = [line for line in lines if text(line) == 'PLF 2027' and line['bbox'][1] < anchor['bbox'][1]]
    header = max(headers, key=lambda line: line['bbox'][1])
    # Les montants sont alignés à droite ; la colonne précédente finit à gauche du titre PLF.
    boundary = header['bbox'][0] + 15
    def amount(label):
        labels = [line for line in lines if label in text(line) and line['bbox'][0] < 300 and line['bbox'][1] >= anchor['bbox'][1]]
        if not labels:
            # Un tableau peut continuer à la page suivante (P148).
            pnext = document[page_index + 1]
            nextlines = [line for b in pnext.get_text('dict')['blocks'] if b['type'] == 0 for line in b['lines']]
            selected = [line for line in nextlines if label in text(line) and line['bbox'][0] < 300]
            if not selected:
                raise ValueError((code, label, 'ligne absente'))
            target, source_lines = selected[0], nextlines
        else:
            target, source_lines = labels[0], lines
        nums = [text(line) for line in source_lines if abs(line['bbox'][1] - target['bbox'][1]) < 2 and line['bbox'][2] > boundary and re.fullmatch(r'[\d\s\u00a0\u202f]+', text(line))]
        return int(re.sub(r'\s', '', nums[-1])) if nums else 0
    programs[code] = {
        'programme': code, 'source': url, 'pagePdf': entry['page'],
        'pdfSha256': hashlib.sha256(path.read_bytes()).hexdigest(),
        'casCivilsAtiEuros': amount('Civils'), 'casMilitairesEuros': amount('Militaires'),
    }

result = []
for source, codes in zip(rows, GROUPS, strict=True):
    detail = [programs[code] for code in codes]
    civil = sum(p['casCivilsAtiEuros'] for p in detail)
    military = sum(p['casMilitairesEuros'] for p in detail)
    refunds = sum(p['cp'] for p in source['programmes'] if p['nom'].startswith('Remboursements et dégrèvements'))
    budget = source['cp'] - refunds
    # Convention explicite d'estimation : assiette civile approchée depuis CAS y.c. ATI.
    salary = round(civil * 11.10 / 82.28 + military * 11.10 / 126.07)
    total_t2 = civil + military + salary
    esr = source['nom'].startswith('Enseignement supérieur')
    result.append({
        'nom': source['nom'], 'budget': budget, 'budgetBrutEuros': source['cp'],
        'remboursementsDegrevementsExclusEuros': refunds,
        'retraites': None if esr else total_t2,
        'apresReclassement': None if esr else budget - total_t2,
        'estimation': bool(civil or military),
        'casEmployeurT2Euros': civil + military,
        'cotisationsSalarialesEstimeesEuros': salary,
        'retraitesT2EstimeesEuros': total_t2,
        'casOperateursT3Euros': None if esr else 0,
        'limite': 'T3 des opérateurs non obtenu en montant : le total retraites reste non renseigné.' if esr else None,
        'programmes': detail,
    })

payload = {
    'annee': 2027, 'unite': 'euros', 'statut': 'PLF : prévision, pas exécution',
    'budgetSource': 'https://www.assemblee-nationale.fr/dyn/17/textes/l17b3210_projet-loi',
    'budgetTable': 'Présentation des crédits par ministère / programme ; CP du budget général',
    'pensionsReference': 'https://www.budget.gouv.fr/documentation/file-download/34465',
    'tauxSource': {
        'url': 'https://www.assemblee-nationale.fr/dyn/contenu/visualisation/1128300/file/PAP%202027%20-%20Pensions.pdf',
        'pagesPdf': [17, 18, 20],
        'tauxSalarialPourcent': 11.10, 'tauxEmployeurCivilPourcent': 82.28,
        'tauxEmployeurMilitairePourcent': 126.07,
        'statut': 'Taux explicitement retenus pour 2027 dans le PAP Pensions ; civil inchangé depuis 2026 et militaire stable depuis 2013.',
    },
    'methode': [
        'Budget : CP officiels du tableau ministériel du PLF 2027, nets des remboursements et dégrèvements pour Action et comptes publics.',
        'Employeur T2 : addition des lignes Civils (y.c. ATI) et Militaires de la colonne PLF 2027 des PAP, par programme rattaché au ministère.',
        'Retenues salariales estimées : CAS civils y.c. ATI × 11,10 / 82,28 + CAS militaires × 11,10 / 126,07. Taux explicites du PAP Pensions 2027, p. 17, 18 et 20. La présence de l’ATI et les assiettes particulières font de ce calcul une estimation, pas une somme comptable exacte.',
        'Retraites : employeur T2 + retenues salariales estimées ; pas de conversion des pourcentages de la figure 3B en montants.',
        'Après reclassement : budget moins retraites. C’est un reclassement analytique à dépense publique inchangée, pas une économie.',
    ],
    'limites': [
        'Le total de l’Enseignement supérieur est laissé nul (donnée absente), car le T3 des opérateurs compris dans la figure 3B n’est pas identifié dans les sources monétaires récupérées. Son T2 seul est conservé séparément.',
        'Les cotisations salariales des opérateurs sont hors champ, comme dans la figure 3B. Le CAS n’est pas l’ensemble des régimes de retraite : ne pas lire zéro CAS comme zéro dépense de retraite tous régimes.',
        'Les subventions au FSPOEIE et aux cultes, et les cotisations employeur FSPOEIE, ne sont pas assimilées aux contributions civils/militaires au CAS 741 ; cet agrégat ne prétend pas reproduire au centime le traitement interne de Bercy.',
        'Les montants des budgets sont exacts dans le PLF. Les totaux retraites contenant une estimation salariale doivent être affichés avec ≈ et un arrondi adapté.',
    ],
    'rows': result,
}
OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
print(OUT)
for row in result:
    print(row['nom'], row['budget'], row['retraites'], row['casEmployeurT2Euros'])
