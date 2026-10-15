# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: mandats-rework.test.mjs >> a complete mandate survives save reload and offers replay from its actual decisions
- Location: tests/mandats-rework.test.mjs:389:1

# Error details

```
Test timeout of 180000ms exceeded.
```

# Page snapshot

```yaml
- generic [ref=f1e1]:
  - link "Aller au jeu" [ref=f1e2] [cursor=pointer]:
    - /url: "#mandats"
  - main [ref=f1e3]:
    - generic [ref=f1e4]:
      - generic [ref=f1e5]:
        - link "Accueil Mandats" [ref=f1e6] [cursor=pointer]:
          - /url: /mandats/
          - text: MANDATS
        - button "Ma partie" [ref=f1e8] [cursor=pointer]
      - region "Carte de France et sujets du mandat" [ref=f1e10]:
        - generic:
          - generic: Mer Méditerranée
          - generic: Belgique
        - generic "Caméra de la carte" [ref=f1e12]:
          - generic [ref=f1e13]:
            - button "Agrandir la carte" [ref=f1e14] [cursor=pointer]: +
            - button "Réduire la carte" [ref=f1e15] [cursor=pointer]: −
          - button "Vue France" [ref=f1e16] [cursor=pointer]
      - article [ref=f1e18]:
        - paragraph [ref=f1e19]: CINQ ANS ACCOMPLIS
        - heading "Vous avez tenu cinq ans." [active] [level=1] [ref=f1e20]
        - paragraph [ref=f1e21]: 30 décisions. Le pays garde leurs conséquences.
        - generic [ref=f1e22]:
          - generic [ref=f1e23]:
            - term [ref=f1e24]: Déficit annuel
            - definition [ref=f1e25]: 102,1Md€
          - generic [ref=f1e26]:
            - term [ref=f1e27]: Services publics
            - definition [ref=f1e28]: 51/ 100
          - generic [ref=f1e29]:
            - term [ref=f1e30]: Confiance
            - definition [ref=f1e31]: 67/ 100
        - button "Nouveau mandat" [ref=f1e32] [cursor=pointer]
        - button "Rejouer un tournant du mandat" [ref=f1e33] [cursor=pointer]
        - button "Consulter le bilan complet" [ref=f1e34] [cursor=pointer]
        - group [ref=f1e35]:
          - generic "Projets et engagements" [ref=f1e36] [cursor=pointer]
        - group [ref=f1e37]:
          - generic "La suite politique" [ref=f1e38] [cursor=pointer]
        - group [ref=f1e39]:
          - generic "Partager ou retrouver ce scénario" [ref=f1e40] [cursor=pointer]
```