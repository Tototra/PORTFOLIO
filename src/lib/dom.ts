// Construction du DOM sans innerHTML : aucun texte n'est jamais interprété
// comme du HTML. C'est ce qui permet d'activer Trusted Types dans la CSP.

export type Child = Node | string | number | null | undefined | false | Child[];
type AttrValue = string | number | boolean | null | undefined | EventListener;
export type Attrs = Record<string, AttrValue>;

function apply(el: Element, attrs: Attrs | null | undefined) {
  if (!attrs) return;
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === 'style') {
      throw new Error('Pas d\'attribut style : la CSP le bloque. Utiliser setVars().');
    } else {
      el.setAttribute(key === 'className' ? 'class' : key, value === true ? '' : String(value));
    }
  }
}

function append(parent: Node, children: Child[]) {
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    if (Array.isArray(child)) append(parent, child);
    else parent.appendChild(typeof child === 'object' ? child : document.createTextNode(String(child)));
  }
}

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs?: Attrs | null,
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  apply(el, attrs);
  append(el, children);
  return el;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

export function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs?: Attrs | null,
  ...children: Child[]
): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  apply(el, attrs);
  append(el, children);
  return el;
}

/** Variables CSS posées via le CSSOM, ce que la CSP autorise (contrairement à l'attribut style). */
export function setVars(el: HTMLElement | SVGElement, vars: Record<string, string | number>) {
  for (const [k, v] of Object.entries(vars)) el.style.setProperty(k, String(v));
}

export function clear(el: Element) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

export function externalLink(href: string, label: Child, attrs: Attrs = {}) {
  return h('a', { href, target: '_blank', rel: 'noopener noreferrer', ...attrs }, label);
}

/** Libellé d'interface en petites capitales monospace. */
export const tag = (text: string, cls = '') => h('span', { class: `tag ${cls}`.trim() }, text);

export function led(state: 'on' | 'off' | 'warn' | 'live' = 'off') {
  return h('span', { class: `led led--${state}`, 'aria-hidden': 'true' });
}
