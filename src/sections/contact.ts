import { externalLink, h, led, tag } from '../lib/dom';
import { blip } from '../lib/audio';
import { fr } from '../lib/typo';
import { email, profile } from '../content/profile';

export function contactSection() {
  const copyState = h('span', { class: 'sr-only', 'aria-live': 'polite' });
  const mail = h('a', { class: 'btn btn--signal', href: '#contact' }, 'Écrire un email');
  // L'adresse n'existe dans la page qu'une fois le script exécuté.
  mail.addEventListener('pointerenter', () => (mail.href = `mailto:${email()}`), { once: true });
  mail.addEventListener('focus', () => (mail.href = `mailto:${email()}`), { once: true });
  mail.addEventListener('click', () => (mail.href = `mailto:${email()}`));

  const copyBtn = h('button', { type: 'button', class: 'btn' }, 'Copier l’adresse');
  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(email());
      copyBtn.textContent = 'Adresse copiée';
      copyState.textContent = 'Adresse email copiée dans le presse-papiers';
      blip(880, 0.12, 0.15);
    } catch {
      copyBtn.textContent = email();
    }
    window.setTimeout(() => (copyBtn.textContent = 'Copier l’adresse'), 2400);
  });

  return h(
    'section',
    { id: 'contact', class: 'section contact', 'aria-labelledby': 'contact-title' },
    h(
      'div',
      { class: 'wrap' },
      h(
        'header',
        { class: 'sec-head' },
        h('span', { class: 'sec-num' }, '05'),
        h('h2', { id: 'contact-title', class: 'sec-title' }, 'Contact'),
        tag(`${profile.city} · France`, 'sec-meta'),
      ),
      h(
        'div',
        { class: 'contact__grid' },
        h(
          'div',
          null,
          h('p', { class: 'contact__big' }, fr('Février 2027, six mois, '), h('span', { class: 'serif' }, 'votre équipe ?')),
          h(
            'p',
            { class: 'contact__text' },
            fr(`Je cherche un ${profile.search.what.toLowerCase()} en ${profile.search.field}. Si vous avez un problème de données qui mérite mieux qu'un modèle flatteur, ou un modèle qui mérite de tourner ailleurs que dans un notebook, parlons-en.`),
          ),
          h(
            'div',
            { class: 'contact__actions' },
            mail,
            copyBtn,
            externalLink(profile.links.linkedin, 'LinkedIn', { class: 'btn' }),
            externalLink(profile.links.github, 'GitHub', { class: 'btn' }),
            profile.cvPdf ? h('a', { class: 'btn', href: profile.cvPdf, download: '' }, 'CV en PDF') : null,
            copyState,
          ),
        ),
        h(
          'dl',
          { class: 'contact__facts' },
          h('div', null, h('dt', null, tag('Disponible')), h('dd', null, led('live'), fr(` à partir de ${profile.search.from}`))),
          h('div', null, h('dt', null, tag('Durée')), h('dd', null, '6 mois')),
          h('div', null, h('dt', null, tag('Domaines')), h('dd', null, 'Data Science · ML Engineering')),
          h('div', null, h('dt', null, tag('Langues')), h('dd', null, profile.languages.map((l) => `${l.name} (${l.level})`).join(', '))),
          h('div', null, h('dt', null, tag('Base')), h('dd', null, fr(`${profile.city}, permis B`))),
        ),
      ),
    ),
  );
}

export function footer() {
  return h(
    'footer',
    { class: 'foot' },
    h(
      'div',
      { class: 'wrap foot__inner' },
      h('span', null, `© ${new Date().getFullYear()} ${profile.firstName} ${profile.lastName}`),
      h('span', null, 'Raccourci : touche ', h('kbd', null, '/')),
    ),
  );
}
