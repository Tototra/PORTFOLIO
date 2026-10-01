# Mettre le site en ligne

Recommandation : **GitHub + Cloudflare Pages**. Coût : **0 €**, ou environ 10 € par an avec un nom de domaine à soi.

Pourquoi Cloudflare Pages plutôt que GitHub Pages : il applique le fichier `public/_headers`, donc la politique de sécurité (CSP, HSTS, anti-iframe…) est envoyée par le serveur. GitHub Pages ne permet pas de choisir ses en-têtes HTTP. Netlify fonctionne aussi avec le même fichier, mais sa bande passante gratuite est limitée.

## 1. Sécuriser les comptes (le vrai point faible d'un site statique)

Un site statique n'a pas de serveur à pirater : l'attaque réaliste, c'est la prise de contrôle d'un compte qui peut publier.

- GitHub et Cloudflare : activer la double authentification, idéalement avec une clé de sécurité ou une application TOTP, pas par SMS.
- Mots de passe uniques, dans un gestionnaire.

## 2. Publier le code sur GitHub

```bash
cd portfolio
git init
git add .
git commit -m "Premier jet du portfolio"
git branch -M main
# Créer d'abord un dépôt vide sur github.com (public ou privé), puis :
git remote add origin git@github.com:Tototra/portfolio.git
git push -u origin main
```

Un dépôt public est un argument de plus : le site lui-même devient un projet que le recruteur peut lire.

Dans les réglages du dépôt :
- **Settings → Branches** : protéger `main` (pas de suppression, pas de force push).
- **Settings → Code security** : activer Dependabot alerts et security updates (le fichier `.github/dependabot.yml` est déjà là).

La CI (`.github/workflows/ci.yml`) vérifie les types, le texte, le build et les vulnérabilités connues à chaque push.

## 3. Déployer sur Cloudflare Pages

1. Créer un compte sur dash.cloudflare.com (gratuit), activer la double authentification.
2. **Workers & Pages → Create → Pages → Connect to Git**, autoriser l'accès au seul dépôt `portfolio`.
3. Réglages du build :
   - Framework preset : `Vite` (ou `None`)
   - Build command : `npm run build`
   - Build output directory : `dist`
   - Variable d'environnement : `NODE_VERSION` = `22`
4. **Save and Deploy**. Le site est en ligne sur `https://<nom-du-projet>.pages.dev`, en HTTPS.

Ensuite, chaque `git push` sur `main` redéploie automatiquement. Chaque branche ou pull request obtient sa propre URL de prévisualisation.

Si l'interface propose plutôt un projet **Workers** avec « static assets », le même dossier `dist` et le même fichier `_headers` fonctionnent.

## 4. Nom de domaine (optionnel, environ 10 € par an)

Un domaine du type `thomastrahant.fr` ou `thomastrahant.dev` fait plus sérieux sur un CV.

- `.dev` ou `.com` : achetable directement chez Cloudflare Registrar, au prix coûtant.
- `.fr` : chez OVHcloud ou Gandi, puis changer les serveurs DNS pour ceux de Cloudflare.

Puis, dans le projet Pages : **Custom domains → Set up a custom domain**. Le certificat HTTPS est automatique.

Réglages DNS et TLS conseillés dans Cloudflare :
- **SSL/TLS** : mode *Full (strict)*, *Always Use HTTPS* activé, version minimale TLS 1.2.
- **DNS → Settings** : activer DNSSEC.
- Un enregistrement **CAA** qui n'autorise que les autorités utilisées par Cloudflare, pour empêcher l'émission d'un certificat ailleurs.

## 5. Vérifier

- https://securityheaders.com et https://developer.mozilla.org/en-US/observatory : on vise la note A+.
- Ouvrir le site sur téléphone, en navigation privée, et en thème sombre.
- Dans `index.html`, remplacer `content="/og.png"` par l'URL complète (ex. `https://thomastrahant.fr/og.png`), pour que l'aperçu s'affiche quand on partage le lien sur LinkedIn. Tester avec le Post Inspector de LinkedIn.

## Pour mettre à jour le site

Modifier `src/content/`, vérifier avec `npm run dev`, puis :

```bash
git add .
git commit -m "Ajout de ..."
git push
```

Le site est à jour une minute plus tard.
