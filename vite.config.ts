import {defineConfig,type Plugin} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
import {SITE} from './site.config';

const page = (p: string) => fileURLToPath(new URL(p, import.meta.url));

const ADS_IT = `<h2>Pubblicità</h2>
<p>Il sito mostra annunci di Google AdSense. Google e i suoi partner possono usare cookie e identificatori per mostrare e misurare gli annunci, anche personalizzati, solo dopo il tuo consenso, che puoi dare, negare o cambiare dal messaggio sul consenso di Google. Dettagli: <a href="https://policies.google.com/technologies/ads" rel="noreferrer">come Google usa i cookie nella pubblicità</a>.</p>`;
const ADS_EN = `<h2>Advertising</h2>
<p>The site shows Google AdSense ads. Google and its partners may use cookies and identifiers to show and measure ads, including personalised ones, only after your consent, which you can give, refuse or change from Google’s consent message. Details: <a href="https://policies.google.com/technologies/ads" rel="noreferrer">how Google uses cookies in advertising</a>.</p>`;

const STATS_IT = `<h2>Statistiche di visita</h2>
<p>Per sapere quante persone usano il sito e quali funzioni servono davvero, contiamo visite ed eventi d’uso (ad esempio «ricerca avviata» o «seed copiato») con <a href="https://www.goatcounter.com" rel="noreferrer">GoatCounter</a>. GoatCounter non usa cookie, non crea profili e non registra l’indirizzo IP completo: conserva solo dati aggregati (pagina, tipo di browser e sistema, dimensione dello schermo, paese stimato, sito di provenienza). Nessun seed o testo che scrivi viene inviato.</p>`;
const STATS_EN = `<h2>Visit statistics</h2>
<p>To know how many people use the site and which features actually help, we count visits and usage events (such as “search started” or “seed copied”) with <a href="https://www.goatcounter.com" rel="noreferrer">GoatCounter</a>. GoatCounter uses no cookies, builds no profiles and does not store the full IP address: it keeps only aggregate data (page, browser and OS type, screen size, estimated country, referring site). No seed or text you type is sent.</p>`;

/* Fills %SITE_URL% in the HTML pages and writes robots.txt and sitemap.xml, so the public
 * address lives in one place (site.config.ts). */
function siteFiles(): Plugin {
  const url = SITE.url.endsWith('/') ? SITE.url : SITE.url + '/';
  return {
    name: 'seed-studio-site-files',
    transformIndexHtml: html => html
      .replaceAll('%SITE_URL%', url)
      .replaceAll('%UPDATED%', new Date().toISOString().slice(0, 10))
      .replaceAll('%ADS_IT%', SITE.adsenseClient ? ADS_IT : '')
      .replaceAll('%ADS_EN%', SITE.adsenseClient ? ADS_EN : '')
      .replaceAll('%STATS_IT%', SITE.goatcounterCode ? STATS_IT : '')
      .replaceAll('%STATS_EN%', SITE.goatcounterCode ? STATS_EN : '')
      .replaceAll('%CONTACT_IT%', SITE.contactEmail ? `Scrivi a <a href="mailto:${SITE.contactEmail}">${SITE.contactEmail}</a>.` : 'Apri una segnalazione nel repository del progetto su GitHub.')
      .replaceAll('%CONTACT_EN%', SITE.contactEmail ? `Write to <a href="mailto:${SITE.contactEmail}">${SITE.contactEmail}</a>.` : 'Open an issue in the project repository on GitHub.'),
    generateBundle() {
      const today = new Date().toISOString().slice(0, 10);
      const entry = (loc: string, it: string, en: string) =>
        `  <url><loc>${loc}</loc><lastmod>${today}</lastmod>` +
        `<xhtml:link rel="alternate" hreflang="it" href="${it}"/>` +
        `<xhtml:link rel="alternate" hreflang="en" href="${en}"/>` +
        `<xhtml:link rel="alternate" hreflang="x-default" href="${en}"/></url>`;
      const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entry(url, url, url + 'en/')}
${entry(url + 'en/', url, url + 'en/')}
</urlset>
`;
      this.emitFile({type: 'asset', fileName: 'sitemap.xml', source: sitemap});
      this.emitFile({type: 'asset', fileName: 'robots.txt', source: `User-agent: *\nAllow: /\n\nSitemap: ${url}sitemap.xml\n`});
    },
  };
}

export default defineConfig({
  // Relative paths: the same build works at a domain root or under /<repository>/ on GitHub Pages.
  base: './',
  plugins: [react(), siteFiles()],
  server: {port: 5173},
  build: {
    rollupOptions: {
      input: {it: page('index.html'), en: page('en/index.html'), privacy: page('privacy.html')},
    },
  },
});
