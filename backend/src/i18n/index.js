// cypod-telemetry
const en = require('./en.json');
const ar = require('./ar.json');

const DICTS = { en, ar };
const DEFAULT_LOCALE = 'en';


function resolveLocale(acceptLanguageHeader) {
  if (!acceptLanguageHeader) return DEFAULT_LOCALE;
  const lower = acceptLanguageHeader.toLowerCase();
  if (lower.includes('ar')) return 'ar';
  if (lower.includes('en')) return 'en';
  return DEFAULT_LOCALE;
}

function t(locale, key, params = {}) {
  const dict = DICTS[locale] || DICTS[DEFAULT_LOCALE];
  let str = dict[key] || DICTS[DEFAULT_LOCALE][key] || key;
  for (const [k, v] of Object.entries(params)) {
    str = str.replaceAll(`{${k}}`, String(v));
  }
  return str;
}

// Express middleware: attaches req.locale and req.t(key, params) so every controller
// downstream can just call req.t(...) without re-reading the header itself.
function i18nMiddleware(req, res, next) {
  req.locale = resolveLocale(req.headers['accept-language']);
  req.t = (key, params) => t(req.locale, key, params);
  next();
}

module.exports = { t, resolveLocale, i18nMiddleware };
