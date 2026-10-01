import '@fontsource-variable/archivo/wdth.css';
import '@fontsource-variable/jetbrains-mono';
import '@fontsource/instrument-serif/latin-400-italic.css';
import './styles/base.css';
import './styles/components.css';
import './styles/sections.css';
import './styles/demos.css';

import { h } from './lib/dom';
import { initTheme } from './lib/theme';
import { nav } from './sections/nav';
import { hero } from './sections/hero';
import { timelineSection } from './sections/timeline';
import { projectsSection } from './sections/projects';
import { skillsSection } from './sections/skills';
import { offstageSection } from './sections/offstage';
import { contactSection, footer } from './sections/contact';
import { paletteShortcut } from './sections/palette';
import { scrollToId, smartAnchors } from './lib/scroll';

initTheme();

const app = document.getElementById('app')!;
app.append(
  h('a', { class: 'skip-link', href: '#parcours' }, 'Aller au contenu'),
  nav(),
  h('main', { id: 'main' }, hero(), timelineSection(), projectsSection(), skillsSection(), offstageSection(), contactSection()),
  footer(),
);
paletteShortcut();
smartAnchors();

// Arrivée directe sur une ancre (#projet-...) : le contenu vient d'être créé,
// on refait le saut une fois la mise en page stabilisée.
if (location.hash) {
  const id = decodeURIComponent(location.hash.slice(1));
  requestAnimationFrame(() => scrollToId(id));
}
