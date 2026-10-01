import type { SkillGroup } from "./types";

// Chaque compétence pointe vers les endroits où elle a réellement servi.
// Les identifiants viennent de projects.ts (projets et projets courts) et de timeline.ts.

export const skillGroups: SkillGroup[] = [
  {
    name: "Langages",
    skills: [
      { name: "Python", proofs: ["allumette", "accidentwatch", "t5", "lre", "agents"] },
      { name: "TypeScript", proofs: ["exakis", "way", "site"] },
      { name: "Java", proofs: ["epitweet", "kafka-game"] },
      { name: "C#", proofs: ["exakis"] },
      { name: "C / C++", proofs: ["tiger", "shell", "neural-c"] },
      { name: "SQL", proofs: ["exakis", "kafka-game"] },
      { name: "SPARQL / Cypher", proofs: ["lre", "epitweet"] },
    ],
  },
  {
    name: "IA",
    skills: [
      { name: "Deep learning", proofs: ["allumette", "t5", "neural-c"] },
      { name: "PyTorch", proofs: ["t5", "lre"] },
      { name: "NLP et Transformers", proofs: ["t5", "lre"] },
      { name: "Fine-tuning", proofs: ["t5"] },
      { name: "Machine learning classique", proofs: ["accidentwatch", "lre"] },
      { name: "ML sur graphes", proofs: ["lre"] },
      { name: "Agents, MCP, RAG", proofs: ["agents"] },
      { name: "Optimisation, autodiff", proofs: ["allumette"] },
    ],
  },
  {
    name: "Data",
    skills: [
      { name: "Apache Spark / MLlib", proofs: ["accidentwatch"] },
      { name: "pandas / NumPy", proofs: ["allumette", "accidentwatch", "lre"] },
      { name: "Streamlit / Flask", proofs: ["accidentwatch", "t5", "lre"] },
      { name: "MongoDB, Neo4j, Elasticsearch, Redis", proofs: ["epitweet"] },
      { name: "SQL Server / PostgreSQL", proofs: ["exakis", "kafka-game"] },
      { name: "RDF / OWL", proofs: ["lre"] },
    ],
  },
  {
    name: "Infra",
    skills: [
      { name: "Docker / Kubernetes", proofs: ["epitweet", "iaas"] },
      { name: "GitLab CI/CD", proofs: ["epitweet", "allumette"] },
      { name: "Terraform / OpenTofu", proofs: ["iaas"] },
      { name: "Azure / Azure DevOps", proofs: ["exakis"] },
      { name: "Kafka", proofs: ["kafka-game"] },
    ],
  },
  {
    name: "Méthodes",
    skills: [
      { name: "Scrum", proofs: ["exakis"] },
      { name: "DDD / CQRS", proofs: ["epitweet"] },
      { name: "Tests et TDD", proofs: ["allumette", "erasmus"] },
      { name: "Du besoin métier au produit", proofs: ["exakis", "way", "accidentwatch"] },
    ],
  },
];
