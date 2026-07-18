// i18n-pariteit, t()-key-bestaan, en huisregel: geen em/en-dashes in UI-teksten.
const fs = require('fs');
const path = require('path');

module.exports = async function({ page, enterApp, check }){
  await enterApp();

  const r = await page.evaluate(() => {
    const nl = Object.keys(I18N.nl), en = Object.keys(I18N.en);
    const nlS = new Set(nl), enS = new Set(en);
    const dyn = [];
    ['dames_open','heren_open','dames_pro','heren_pro'].forEach(k => dyn.push('profile_' + k));
    ['full','half','custom'].forEach(f => { const c = 'fmt' + f.charAt(0).toUpperCase() + f.slice(1); dyn.push(c + 'Name', c + 'Desc'); });
    dyn.push('athletes_one','athletes_other','moveHeat','btnAssign');
    return {
      nlOnly: nl.filter(k => !enS.has(k)),
      enOnly: en.filter(k => !nlS.has(k)),
      total: nl.length,
      dynMissing: dyn.filter(k => !nlS.has(k) || !enS.has(k)),
      // waardescan op em/en-dash
      dashValues: [].concat(
        Object.entries(I18N.nl), Object.entries(I18N.en)
      ).filter(([k, v]) => typeof v === 'string' && (v.includes('—') || v.includes('–'))).map(([k]) => k)
    };
  });

  check('NL/EN keys in pariteit', r.nlOnly.length === 0 && r.enOnly.length === 0, 'nlOnly=' + r.nlOnly + ' enOnly=' + r.enOnly);
  check('dynamisch opgebouwde keys bestaan', r.dynMissing.length === 0, r.dynMissing.join(','));
  check('geen em/en-dash in i18n-waarden', r.dashValues.length === 0, r.dashValues.join(','));

  // Elke statische t('literal') in de bron bestaat in beide maps.
  const src = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf-8');
  const used = new Set();
  for(const m of src.matchAll(/\bt\(\s*'([A-Za-z_][A-Za-z0-9_]*)'\s*\)/g)) used.add(m[1]);
  for(const m of src.matchAll(/\bt\(\s*"([A-Za-z_][A-Za-z0-9_]*)"\s*\)/g)) used.add(m[1]);
  const missing = await page.evaluate((keys) => keys.filter(k => !(k in I18N.nl) || !(k in I18N.en)), [...used]);
  check('elke statische t()-key bestaat in beide maps (' + used.size + ' keys)', missing.length === 0, missing.join(','));

  // Geen em/en-dash in user-facing HTML-teksten of placeholders (data-i18n scope + placeholders).
  const uiDash = await page.evaluate(() => {
    const bad = [];
    document.querySelectorAll('[data-i18n]').forEach(el => { if(/[—–]/.test(el.textContent)) bad.push(el.getAttribute('data-i18n')); });
    document.querySelectorAll('[placeholder]').forEach(el => { if(/[—–]/.test(el.placeholder)) bad.push('ph:' + (el.id || el.getAttribute('data-i18n-ph'))); });
    return bad;
  });
  check('geen em/en-dash in zichtbare UI-teksten/placeholders', uiDash.length === 0, uiDash.join(','));
};
