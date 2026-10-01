// Types du contenu. Pour ajouter une info au site, on modifie uniquement
// les fichiers de ce dossier : le reste du code s'adapte tout seul.

/** Mois au format 'AAAA-MM'. */
export type Month = `${number}-${number}`;

export type Track = 'formation' | 'experience' | 'projet' | 'vie';

export interface TimelineItem {
  id: string;
  track: Track;
  title: string;
  org: string;
  place?: string;
  start: Month;
  /** Absent = en cours. */
  end?: Month;
  summary: string;
  bullets?: string[];
  stack?: string[];
  /** Renvoie vers un projet détaillé de la section Projets. */
  projectId?: string;
  /** Case vide volontaire (le futur stage). */
  placeholder?: boolean;
}

export type Domain = 'ml' | 'data' | 'nlp' | 'graphes' | 'infra' | 'agents' | 'web';

export interface Metric {
  value: string;
  label: string;
}

export interface Link {
  label: string;
  href: string;
}

export type DemoId = 'race' | 'threshold' | 'grammar' | 'graph' | 'cqrs';

export interface Project {
  id: string;
  title: string;
  /** Une phrase qui donne envie de lire la suite. */
  kicker: string;
  period: string;
  team: string;
  role: string;
  pitch: string;
  points: string[];
  metrics: Metric[];
  stack: string[];
  domains: Domain[];
  links: Link[];
  demo: DemoId;
  /** La leçon retenue, affichée en citation. */
  lesson: string;
}

/** Projets plus courts, sans démo, présentés en liste compacte. */
export interface SideProject {
  id: string;
  title: string;
  context: string;
  text: string;
  stack: string[];
  domains: Domain[];
  links?: Link[];
}

export interface Skill {
  name: string;
  /** Identifiants de projets, projets courts ou éléments du parcours. */
  proofs: string[];
}

export interface SkillGroup {
  name: string;
  skills: Skill[];
}
