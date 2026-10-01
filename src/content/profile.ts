// Identité et contact. Le numéro de téléphone n'est volontairement pas publié :
// un site public est lu par des robots qui collectent les numéros.

export const profile = {
  firstName: "Thomas",
  lastName: "Trahant",
  headline: "Élève ingénieur en intelligence artificielle",
  school: "EPITA Lyon · majeure SCIA",
  city: "Lyon",
  motto: "Je reconstruis les outils avant de m'en servir.",
  intro:
    "Machine learning, data engineering, infrastructure : j'aime autant entraîner un modèle que le faire tourner quelque part. Cette année, on m'a interdit d'importer PyTorch, alors je l'ai réécrit. Chaque projet de ce site a une démo à manipuler, parce que ça se comprend mieux en jouant qu'en lisant.",
  search: {
    what: "Stage de fin d'études de 6 mois",
    field: "Data Science ou Machine Learning Engineering",
    from: "février 2027",
  },
  languages: [
    { name: "Français", level: "langue maternelle" },
    { name: "Anglais", level: "bilingue, double nationalité franco-britannique" },
  ],
  // L'adresse est assemblée au dernier moment dans le navigateur,
  // pour ne pas apparaître en clair dans le code servi.
  emailParts: ["thomas.trahant1", "gmail.com"] as const,
  links: {
    github: "https://github.com/Tototra/",
    linkedin: "https://www.linkedin.com/in/thomas-trahant-abb181357",
  },
  /** Mettre un chemin (ex. "/cv-thomas-trahant.pdf" placé dans public/) pour afficher le bouton. */
  cvPdf: null as string | null,
  /** Mois affiché comme « aujourd'hui » sur la frise. */
  today: "2026-09" as const,
};

export const email = () => profile.emailParts.join("@");
