// Typographie française appliquée à l'affichage : on écrit le contenu
// simplement (apostrophes droites, espaces normales) et le rendu s'occupe du reste.

const NNBSP = ' '; // espace fine insécable
const NBSP = ' ';

export function fr(text: string): string {
  return text
    .replace(/'/g, '’')
    .replace(/ ([:;!?])/g, `${NNBSP}$1`)
    .replace(/« /g, `«${NBSP}`)
    .replace(/ »/g, `${NBSP}»`)
    .replace(/(\d) (%|Go|Mo|M\b|k\b|ms|s\b)/g, `$1${NNBSP}$2`)
    .replace(/(\d) (\d{3})/g, `$1${NNBSP}$2`);
}
