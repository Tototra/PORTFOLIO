# Portfolio de Thomas Trahant

Site personnel : parcours, projets et démos interactives. TypeScript sans framework, construit avec Vite, 100 % statique.

## Lancer en local

```bash
npm install
npm run dev        # serveur de développement, http://localhost:5173
npm run build      # vérifie les types puis construit dans dist/
npm run preview    # sert dist/ avec les mêmes en-têtes de sécurité qu'en production
npm run lint:text  # vérifie qu'aucun tiret long ni emoji ne s'est glissé dans le texte
```

Node 20.19 ou plus récent.

## Ajouter ou modifier du contenu

Tout le texte du site est dans `src/content/`. Le reste du code s'adapte tout seul.

| Fichier | Contenu |
|---|---|
| `profile.ts` | Nom, accroche, recherche de stage, liens, bouton CV |
| `timeline.ts` | La frise du parcours (formation, expérience, projets, asso) |
| `projects.ts` | Les projets avec démo, puis les « autres pistes » (projets courts) |
| `skills.ts` | Les compétences et les projets qui les prouvent |

Exemples :

- **Nouvelle expérience** : copier un bloc dans `timeline.ts`, changer `id`, `track`, les dates au format `'AAAA-MM'` et le texte. Sans `end`, l'élément est affiché « en cours ».
- **Nouveau projet court** : ajouter un objet dans `sideProjects` (fichier `projects.ts`). Pour qu'il serve de preuve, ajouter son `id` dans les `proofs` d'une compétence de `skills.ts`.
- **Bouton « CV en PDF »** : déposer le fichier dans `public/` et renseigner `cvPdf: "/nom-du-fichier.pdf"` dans `profile.ts`. Penser à retirer le numéro de téléphone de cette version publique.
- **Photo** : remplacer `public/thomas.jpg` (portrait, idéalement 600 × 730 px ou plus).

Règles d'écriture : apostrophes droites autorisées (elles sont converties à l'affichage, comme les espaces avant `: ; ! ?`), pas de tiret long, pas d'emoji. `npm run lint:text` le vérifie.

## Structure

```
src/
  content/    le texte du site (voir ci-dessus)
  sections/   les sections de la page (accueil, parcours, projets, preuves, hors code, contact)
  demos/      une démo par projet, chargée seulement quand on s'en approche
  lib/        petits outils : DOM sans innerHTML, animation, son, thème, défilement
  styles/     CSS (jetons de design dans base.css)
  data/       données des démos (graphe LRE anonymisé, histogrammes AccidentWatch)
scripts/      génération des données et vérifications
public/       fichiers servis tels quels (_headers, photo, favicon, image d'aperçu)
```

## D'où viennent les données des démos

- **Course MPC** (`demos/race-sim.ts`) : physique et contrôleur écrits pour le site. `npm run bench:race` fait tourner le pilote sans navigateur et affiche ses temps au tour.
- **AccidentWatch** : 10 000 accidents simulés, calibrés par `scripts/calibrate-accidents.py` pour reproduire exactement les métriques du projet.
- **Graphe du LRE** : le vrai graphe du projet MLG, exporté et anonymisé par `scripts/export-lre-graph.py`.
- **Correcteur T5** : la logique des garde-fous est portée de `grammar_corrector.py` ; les sorties brutes du modèle sont écrites à la main pour illustrer le comportement observé.

## Sécurité

- Site statique : pas de serveur, pas de base de données, pas de formulaire, rien à attaquer côté back.
- Politique de sécurité du contenu stricte (`public/_headers`) : aucun script ni style tiers, polices auto-hébergées, Trusted Types activé.
- Le DOM est construit sans `innerHTML` (`src/lib/dom.ts`) : aucun texte n'est jamais interprété comme du HTML.
- Aucun cookie, aucun traceur. Le stockage local ne sert qu'au confort (thème, son, record de la course).
- L'adresse email n'apparaît pas en clair dans le HTML servi ; le numéro de téléphone n'est pas publié.

Le déploiement est décrit dans [DEPLOY.md](DEPLOY.md).
