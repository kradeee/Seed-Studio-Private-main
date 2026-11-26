/* Site settings. Everything here is public: never put secrets in this file.
 * Empty values switch the related feature off. */
export const SITE = {
  /** Public address of the site, with the trailing slash. Used for canonical links,
   *  hreflang, Open Graph and the sitemap. */
  url: 'https://kradeee.github.io/Seed-Studio-Private-main/',
  name: 'Seed Studio',
  /** Ko-fi / Buy Me a Coffee / PayPal.me page for tips. Empty: the button is hidden. */
  supportUrl: 'https://ko-fi.com/krkrkrade',
  /** Google AdSense publisher id, e.g. "ca-pub-1234567890123456". Empty: no ads, no ad script.
   *  In the EU/EEA/UK AdSense requires a Google-certified consent banner: enable the free
   *  "Privacy & messaging" GDPR message in the AdSense dashboard before turning this on. */
  adsenseClient: '',
  /** AdSense ad unit (slot) id for the banner under the map. */
  adsenseSlot: '',
  /** GoatCounter site code (the "seedstudio" of seedstudio.goatcounter.com). Cookie-free visit and
   *  event counting; empty: no analytics script at all. Localhost visits are never counted. */
  goatcounterCode: 'seedstudio',
  /** Contact e-mail shown on the privacy page. */
  contactEmail: '',
} as const;
