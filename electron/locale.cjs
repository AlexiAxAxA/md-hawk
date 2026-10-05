const fs = require('node:fs');
const path = require('node:path');
const { languages } = require('../shared/preferences.json');
function chooseLanguage(lcid, locale) {
  return languages.find(item => item.lcid === lcid)?.id || languages.find(item => item.id === String(locale).toLowerCase().split(/[-_]/)[0])?.id || 'en';
}
function initialLanguage(directory, locale) {
  try {
    const file = path.join(directory, 'installer-language.json');
    if (fs.statSync(file).size <= 128) return chooseLanguage(JSON.parse(fs.readFileSync(file, 'utf8')).lcid, locale);
  } catch { /* Portable builds use the OS locale; existing profiles retain their preference. */ }
  return chooseLanguage(undefined, locale);
}
function translate(language, english, russian) {
  if (language === 'ru') return russian;
  if (language === 'en' || !languages.some(item => item.id === language)) return english;
  return require('../shared/locales/' + language + '.json')[english] || english;
}
module.exports = { chooseLanguage, initialLanguage, translate };
