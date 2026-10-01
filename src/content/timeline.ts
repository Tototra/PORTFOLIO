import type { TimelineItem } from "./types";

// La frise « Parcours ». Pour ajouter une ligne : copier un bloc, changer l'id,
// les dates ('AAAA-MM') et le texte. Sans `end`, l'élément est considéré en cours.

export const timeline: TimelineItem[] = [
  // FORMATION
  {
    id: "bac",
    track: "formation",
    title: "Baccalauréat général, mention bien",
    org: "Lycée Édouard Branly",
    place: "Lyon",
    start: "2020-09",
    end: "2022-07",
    summary: "Spécialités mathématiques, physique-chimie et numérique et sciences informatiques (NSI).",
  },
  {
    id: "epita",
    track: "formation",
    title: "Diplôme d'ingénieur en informatique",
    org: "EPITA",
    place: "Lyon",
    start: "2022-09",
    end: "2027-08",
    summary:
      "Bac+5. Majeure Intelligence Artificielle (SCIA) : machine learning, deep learning, traitement du langage, données massives, statistiques, optimisation.",
    bullets: [
      "Projets systèmes en C et C++ : shell POSIX, compilateur du langage Tiger, réseau de neurones sans bibliothèque.",
      "Majeure SCIA : de la rétropropagation calculée à la main jusqu'aux agents IA, en passant par l'optimisation convexe, le big data et les graphes.",
    ],
  },
  {
    id: "erasmus",
    track: "formation",
    title: "Semestre d'échange Erasmus",
    org: "Vilnius Tech",
    place: "Lituanie",
    start: "2024-01",
    end: "2024-06",
    summary: "Cursus en anglais : cybersécurité, Test Driven Development, projets en équipe internationale.",
  },

  // EXPÉRIENCE
  {
    id: "barge",
    track: "experience",
    title: "Serveur, CDD saisonnier",
    org: "La Barge",
    place: "Lyon",
    start: "2022-06",
    end: "2022-07",
    summary: "Service en salle, en forte affluence, tout l'été.",
  },
  {
    id: "way",
    track: "experience",
    title: "Co-fondateur",
    org: "WAY, tourisme personnalisé",
    place: "Lyon",
    start: "2025-05",
    summary:
      "Une application mobile qui propose des parcours touristiques sur mesure. Projet lancé de zéro.",
    bullets: [
      "Étude de marché, business plan et conception du produit.",
      "Première version en no-code pour tester l'idée auprès des premiers utilisateurs.",
      "Démarchage des établissements touristiques lyonnais : plusieurs sont intéressés par un partenariat.",
    ],
    stack: ["Bubble", "React", "TypeScript"],
  },
  {
    id: "exakis",
    track: "experience",
    title: "Consultant stagiaire",
    org: "Exakis Nelite, groupe Magellan Partners",
    place: "Lyon",
    start: "2025-09",
    end: "2026-01",
    summary:
      "Service Line Modern Apps & Innovation. Conception et développement de SolarPulse, l'outil de chiffrage des installations photovoltaïques utilisé chaque jour par les équipes commerciales, en remplacement du fichier Excel utilisé jusque-là.",
    bullets: [
      "Règles de calcul métier traduites en formulaires React à logique conditionnelle, avec un chiffrage recalculé à chaque saisie.",
      "Équipe Scrum sur un projet client, du cadrage du besoin avec le métier jusqu'à la mise en production sur Azure.",
    ],
    stack: ["React", "TypeScript", ".NET / ASP.NET Core", "SQL Server", "Azure", "Azure DevOps", "Scrum"],
  },
  {
    id: "pfe",
    track: "experience",
    title: "Stage de fin d'études, 6 mois",
    org: "Votre équipe ?",
    start: "2027-02",
    end: "2027-08",
    summary:
      "Data Science ou Machine Learning Engineering, à partir de février 2027. Cette piste est encore vide, et c'est voulu.",
    placeholder: true,
  },

  // PROJETS (renvoient vers la section Projets)
  {
    id: "t-epitweet",
    track: "projet",
    title: "EpiTweet",
    org: "Réseau social distribué, équipe de 14",
    start: "2026-02",
    end: "2026-04",
    summary: "Responsable de la chaîne de livraison : GitLab CI et Kubernetes pour 14 développeurs.",
    projectId: "epitweet",
  },
  {
    id: "t-lre",
    track: "projet",
    title: "Radiographie du LRE",
    org: "Graphes et graphe de connaissances",
    start: "2026-01",
    end: "2026-06",
    summary: "Le réseau de co-publications d'un laboratoire, analysé puis interrogé en SPARQL.",
    projectId: "lre",
  },
  {
    id: "t-t5",
    track: "projet",
    title: "Correcteur T5",
    org: "Fine-tuning NLP",
    start: "2026-05",
    end: "2026-06",
    summary: "T5-Base fine-tuné pour la correction grammaticale, BLEU 86,79.",
    projectId: "t5",
  },
  {
    id: "t-allumette",
    track: "projet",
    title: "PY-ALLUMETTE",
    org: "Autodiff et commande prédictive",
    start: "2026-06",
    end: "2026-07",
    summary: "Un mini-PyTorch écrit à la main qui pilote une voiture de course.",
    projectId: "allumette",
  },
  {
    id: "t-accidentwatch",
    track: "projet",
    title: "AccidentWatch",
    org: "Spark et aide à la décision",
    start: "2026-06",
    end: "2026-07",
    summary: "7,7 millions d'accidents pour décider où placer les secours.",
    projectId: "accidentwatch",
  },

  // ASSO ET VIE
  {
    id: "tqb",
    track: "vie",
    title: "Organisation de concerts",
    org: "La Tête Qui Bouge",
    place: "Lyon",
    start: "2023-03",
    end: "2025-01",
    summary: "Programmation, communication et logistique technique de concerts locaux : son, lumière, scène.",
  },
];

export const TRACKS: { id: TimelineItem["track"]; label: string }[] = [
  { id: "formation", label: "Formation" },
  { id: "experience", label: "Expérience" },
  { id: "projet", label: "Projets" },
  { id: "vie", label: "Asso" },
];
