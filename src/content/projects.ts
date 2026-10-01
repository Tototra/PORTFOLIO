import type { Domain, Project, SideProject } from "./types";

// Les projets principaux, chacun accompagné d'une démo interactive.
// Tous les chiffres viennent des rendus, rapports et historiques git des projets.

export const projects: Project[] = [
  {
    id: "allumette",
    title: "PY-ALLUMETTE",
    kicker: "Un mini-PyTorch écrit à la main, puis branché sur une voiture de course",
    period: "Juin à juillet 2026 · 2 mois",
    team: "Binôme",
    role: "Moteur d'autodiff, couches et optimiseurs, contrôleur prédictif",
    pitch:
      "Un test automatique vérifiait qu'aucune ligne n'importait PyTorch. Il a donc fallu le réécrire sur NumPy seul, puis s'en servir pour autre chose que du deep learning : piloter une voiture de course par commande prédictive, en dérivant à travers le simulateur physique lui-même.",
    points: [
      "Classe Tensor avec graphe de calcul dynamique, rétropropagation par tri topologique et broadcasting inverse, le détail qui casse la plupart des implémentations naïves.",
      "Couches linéaires, MLP, SGD et Adam écrits depuis les articles, gradients validés un par un contre ceux de PyTorch.",
      "Modèle bicyclette dynamique en tenseurs différentiables : le MPC optimise ses commandes par descente de gradient à travers la physique, avec warm start, projection sur les bornes et gradient clipping.",
      "Variante ML-MPC : quand le modèle physique est volontairement faux, un petit réseau apprend l'écart avec la réalité.",
    ],
    metrics: [
      { value: "0", label: "import de PyTorch" },
      { value: "6D", label: "état du modèle bicyclette" },
      { value: "8·64·64·6", label: "MLP qui apprend le résidu" },
    ],
    stack: ["Python", "NumPy", "pytest", "GitLab CI", "MPC", "Autodiff"],
    domains: ["ml"],
    links: [],
    demo: "race",
    lesson: "Le projet qui m'a montré ce qu'il y a vraiment sous loss.backward().",
  },
  {
    id: "accidentwatch",
    title: "AccidentWatch",
    kicker: "7,7 millions d'accidents, une seule question : où placer les secours ?",
    period: "2026 · 2 mois",
    team: "Projet de groupe",
    role: "Pipeline, modélisation, choix du seuil de décision (7 commits sur 10 de l'application)",
    pitch:
      "Une chaîne complète, du big data à la décision : pipeline Spark sur le jeu US Accidents, zones à risque par clustering spatio-temporel, classification des accidents graves, et une application Streamlit pensée pour la direction logistique des secours en Californie.",
    points: [
      "Pipeline Spark orchestré par papermill : nettoyage, imputation, feature engineering, export Parquet et modèles sérialisés. L'application ne fait que charger les artefacts.",
      "Durée et distance décrivent l'accident après coup : elles sont exclues du jeu supervisé. Pas de fuite de données, pas de score trop beau pour être vrai.",
      "K-Means spatio-temporel (k testé de 40 à 400) pour proposer des hubs de pré-positionnement, déclinés en scénarios semaine, week-end et météo dégradée.",
      "Random Forest à 0,76 d'AUC, puis seuil de décision abaissé de 0,5 à 0,3 : le rappel des accidents graves passe de 6 % à 60 %.",
    ],
    metrics: [
      { value: "7,7 M", label: "accidents traités avec Spark" },
      { value: "0,76", label: "AUC du Random Forest" },
      { value: "6 → 60 %", label: "accidents graves détectés" },
    ],
    stack: ["PySpark", "Spark MLlib", "papermill", "Parquet", "Streamlit", "Plotly"],
    domains: ["data", "ml"],
    links: [{ label: "Code sur GitHub", href: "https://github.com/Tototra/DATA-XPLORING" }],
    demo: "threshold",
    lesson:
      "Un modèle qui répond « pas grave » à tout obtient 83,4 % d'accuracy. Tout le travail consiste à ne pas se laisser flatter par ce chiffre.",
  },
  {
    id: "t5",
    title: "Correcteur grammaticale",
    kicker: "Un bon score et un modèle utilisable, ce n'est pas la même chose",
    period: "Juin 2026 · 1 mois",
    team: "Projet de groupe",
    role: "Fine-tuning, NLP",
    pitch:
      "Fine-tuning de T5-Base (220 millions de paramètres) pour corriger l'anglais, modèle publié sur Hugging Face.",
    points: [
      "Premier dataset de 100 000 lignes abandonné : surapprentissage sur tous les sous-échantillons testés. Remplacé par 2 018 paires propres couvrant 15 types d'erreurs.",
      "Batch effectif de 64 par accumulation de gradient, fp16, early stopping, meilleur checkpoint choisi sur la loss de validation.",
      "Sur un email complet, le modèle inventait des formules de politesse. Découpage phrase par phrase et deux bornes sur la longueur générée ont réglé le problème.",
    ],
    metrics: [
      { value: "86,79", label: "score BLEU" },
      { value: "220 M", label: "paramètres fine-tunés" },
      { value: "2 018", label: "paires d'entraînement" },
    ],
    stack: ["PyTorch", "Hugging Face Transformers", "Seq2SeqTrainer", "Flask", "Python"],
    domains: ["nlp", "ml"],
    links: [
      { label: "Code sur GitHub", href: "https://github.com/Tototra/PROJET-NLP" },
      {
        label: "Modèle sur Hugging Face",
        href: "https://huggingface.co/thisisyakou/t5-base-grammar-correction-epita-86-Bleu-score",
      },
    ],
    demo: "grammar",
    lesson: "Diagnostiquer une hallucination et la contenir, c'est le vrai travail une fois le modèle entraîné.",
  },
  {
    id: "lre",
    title: "Étude d'un labo",
    kicker: "Lire la structure scientifique d'un laboratoire dans son réseau de co-publications",
    period: "Printemps 2026",
    team: "Trois personnes par projet",
    role: "Analyse de réseau, graphe de connaissances RDF (16 commits sur 31)",
    pitch:
      "Le laboratoire de recherche de l'EPITA vu de deux façons : comme un réseau social à analyser, puis comme un graphe de connaissances à interroger. Deux méthodes indépendantes, et une même conclusion, négative, défendue comme telle.",
    points: [
      "Parsing des pages DBLP : 1 289 auteurs, 4 219 collaborations, 34 communautés détectées par Louvain avec une modularité de 0,847.",
      "98,5 % des co-auteurs externes ne touchent qu'une seule équipe : ils ouvrent le labo vers l'extérieur, pas vers ses autres équipes.",
      "Graphe RDF de 18 475 triplets, ontologie OWL, huit requêtes SPARQL métier, dont une qui repère les chercheurs à deux sauts qui n'ont jamais publié ensemble.",
      "Prédiction de liens en split temporel, puis par embeddings PyKEEN (RotatE, ComplEx) : la topologie prédit bien les thèmes, mal les futures collaborations.",
      "Extensions développées après la soutenance, pour répondre point par point aux questions du jury.",
    ],
    metrics: [
      { value: "1 289", label: "auteurs dans le graphe" },
      { value: "0,847", label: "modularité de Louvain" },
      { value: "18 475", label: "triplets RDF" },
    ],
    stack: ["networkx", "rdflib", "SPARQL", "OWL", "PyKEEN", "scikit-learn", "BERT"],
    domains: ["graphes", "ml", "data"],
    links: [{ label: "Code sur GitHub", href: "https://github.com/Tototra/GDP-FIL-ROUGE" }],
    demo: "graph",
    lesson:
      "La prédiction de liens plafonne à 0,67 d'AUC en test temporel. Savoir défendre un résultat négatif vaut mieux que savoir gonfler un chiffre.",
  },
  {
    id: "epitweet",
    title: "EpiTweet",
    kicker: "Faire arriver le code de 14 personnes en production",
    period: "Printemps 2026 · 3 mois",
    team: "Équipe de 14",
    role: "Responsable CI/CD et Kubernetes",
    pitch:
      "Un réseau social distribué en six microservices Java/Quarkus, découpés par domaine métier, avec du CQRS sur un bus d'événements Redis et quatre bases spécialisées. J'y tenais le rôle le moins visible et le plus structurant : la chaîne de livraison.",
    points: [
      "Pipeline GitLab CI sur un monorepo Maven : cache partagé, déclenchement ciblé selon les fichiers modifiés, lint, build et déploiement.",
      "Images multi-architecture (amd64 et arm64) construites avec Jib et publiées sur le registre GitLab.",
      "Cluster Kubernetes complet en Kustomize : Deployments, Services, Ingress, secrets, et StatefulSets pour Neo4j et les deux MongoDB, séparées en écriture et lecture comme le veut le CQRS.",
    ],
    metrics: [
      { value: "14", label: "développeurs à livrer" },
      { value: "6", label: "microservices" },
      { value: "47 / 133", label: "commits" },
    ],
    stack: ["Java 21", "Quarkus", "Kubernetes", "Kustomize", "GitLab CI", "Jib", "Redis", "MongoDB", "Neo4j", "Elasticsearch"],
    domains: ["infra", "web"],
    links: [],
    demo: "cqrs",
    lesson: "",
  },
];

export const sideProjects: SideProject[] = [
  {
    id: "agents",
    title: "Agents IA et MCP",
    context: "Workshop AWS Strands",
    text: "Serveur et client MCP écrits à la main, outils personnalisés, puis un système multi-agents : un orchestrateur délègue à un agent documentaire adossé à une base de connaissances.",
    stack: ["Python", "AWS Strands", "MCP", "A2A", "RAG"],
    domains: ["agents"],
  },
  {
    id: "iaas",
    title: "Infrastructure as Code",
    context: "Module IAAS",
    text: "Réseau OpenStack décrit en OpenTofu, WordPress et MariaDB sur K3s via Kustomize.",
    stack: ["OpenTofu", "OpenStack", "K3s", "Kustomize", "Apache Bench"],
    domains: ["infra"],
  },
  {
    id: "tiger",
    title: "Compilateur Tiger",
    context: "EPITA",
    text: "Le grand projet compilateur de l'EPITA : un compilateur pour le langage Tiger, grammaire écrite avec Bison et Flex.",
    stack: ["C++", "Bison", "Flex"],
    domains: ["web"],
  },
  {
    id: "neural-c",
    title: "Chiffres manuscrits en C",
    context: "EPITA",
    text: "Reconnaissance de chiffres manuscrits par un réseau de neurones codé sans aucune bibliothèque.",
    stack: ["C"],
    domains: ["ml"],
  },
  {
    id: "kafka-game",
    title: "Jeu de gestion distribué",
    context: "EPITA",
    text: "Un jeu de gestion de ressources en architecture distribuée, avec des services qui communiquent par messages.",
    stack: ["Java", "Kafka", "PostgreSQL"],
    domains: ["infra"],
  },
  {
    id: "shell",
    title: "Shell POSIX",
    context: "EPITA",
    text: "Un shell Unix conforme POSIX : parsing, redirections, pipes, variables.",
    stack: ["C"],
    domains: ["infra"],
  },
];

export const DOMAINS: Record<Domain, string> = {
  ml: "Machine learning",
  data: "Data",
  nlp: "NLP",
  graphes: "Graphes",
  infra: "Infra",
  agents: "Agents",
  web: "Logiciel",
};
