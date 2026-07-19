// i18n-pariteit, t()-key-bestaan, en huisregel: geen em/en-dashes in UI-teksten.
const fs = require('fs');
const path = require('path');

module.exports = async function({ page, enterApp, check }){
  await enterApp();

  const r = await page.evaluate(() => {
    const langs = Object.keys(I18N);
    const ref = new Set(Object.keys(I18N.nl));
    const parity = {};
    langs.forEach(L => {
      const ks = new Set(Object.keys(I18N[L]));
      parity[L] = {
        missing: [...ref].filter(k => !ks.has(k)),
        extra: [...ks].filter(k => !ref.has(k))
      };
    });
    const dyn = [];
    ['dames_open','heren_open','dames_pro','heren_pro'].forEach(k => dyn.push('profile_' + k));
    ['full','half','custom'].forEach(f => { const c = 'fmt' + f.charAt(0).toUpperCase() + f.slice(1); dyn.push(c + 'Name', c + 'Desc'); });
    dyn.push('athletes_one','athletes_other','moveHeat','btnAssign');
    const dynMissing = [];
    langs.forEach(L => dyn.forEach(k => { if(!(k in I18N[L])) dynMissing.push(L + ':' + k); }));
    const dashValues = [];
    langs.forEach(L => Object.entries(I18N[L]).forEach(([k, v]) => { if(typeof v === 'string' && (v.includes('—') || v.includes('–'))) dashValues.push(L + ':' + k); }));
    return { langs, parity, dynMissing, dashValues, total: ref.size };
  });

  check('4 talen aanwezig (nl,en,de,es)', JSON.stringify(r.langs.sort()) === JSON.stringify(['de','en','es','nl']), r.langs.join(','));
  for(const L of r.langs){
    check('pariteit ' + L + ' (' + r.total + ' keys)', r.parity[L].missing.length === 0 && r.parity[L].extra.length === 0,
      'missing=' + r.parity[L].missing.slice(0,8) + ' extra=' + r.parity[L].extra.slice(0,8));
  }
  check('dynamisch opgebouwde keys bestaan in alle talen', r.dynMissing.length === 0, r.dynMissing.join(','));
  check('geen em/en-dash in i18n-waarden (alle talen)', r.dashValues.length === 0, r.dashValues.join(','));

  // Elke statische t('literal') in de bron bestaat in alle talen.
  const src = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf-8');
  const used = new Set();
  for(const m of src.matchAll(/\bt\(\s*'([A-Za-z_][A-Za-z0-9_]*)'\s*\)/g)) used.add(m[1]);
  for(const m of src.matchAll(/\bt\(\s*"([A-Za-z_][A-Za-z0-9_]*)"\s*\)/g)) used.add(m[1]);
  const missing = await page.evaluate((keys) => {
    const out = [];
    Object.keys(I18N).forEach(L => keys.forEach(k => { if(!(k in I18N[L])) out.push(L + ':' + k); }));
    return out;
  }, [...used]);
  check('elke statische t()-key bestaat in alle talen (' + used.size + ' keys)', missing.length === 0, missing.join(','));

  // Geen em/en-dash in user-facing HTML-teksten of placeholders (data-i18n scope + placeholders).
  const uiDash = await page.evaluate(() => {
    const bad = [];
    document.querySelectorAll('[data-i18n]').forEach(el => { if(/[—–]/.test(el.textContent)) bad.push(el.getAttribute('data-i18n')); });
    document.querySelectorAll('[placeholder]').forEach(el => { if(/[—–]/.test(el.placeholder)) bad.push('ph:' + (el.id || el.getAttribute('data-i18n-ph'))); });
    return bad;
  });
  check('geen em/en-dash in zichtbare UI-teksten/placeholders', uiDash.length === 0, uiDash.join(','));
};
