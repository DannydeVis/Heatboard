// Fase 10b: geen emoji's meer in de UI; alles is een inline vector-icoon (<svg class="ic">).
module.exports = async function({ page, enterApp, check }){
  await enterApp();

  // Emoji-detector: pictografische ranges + varianten. Typografische tekens
  // (·, ●, →, -, en/em-dash) zijn geen emoji en blijven toegestaan.
  const EMOJI_SRC = '[\\u{1F000}-\\u{1FAFF}\\u{2600}-\\u{27BF}\\u{2B00}-\\u{2BFF}\\u{2300}-\\u{23FF}\\u{FE00}-\\u{FE0F}\\u{1F1E6}-\\u{1F1FF}\\u{2049}\\u{203C}\\u{2122}\\u{2139}]';

  // 1) Alle i18n-waarden over 4 talen bevatten geen emoji.
  const i18nHits = await page.evaluate((src) => {
    const re = new RegExp(src, 'u');
    const out = [];
    for(const L of Object.keys(I18N)){
      for(const [k,v] of Object.entries(I18N[L])){
        if(typeof v === 'string' && re.test(v)) out.push(L + '.' + k + ' = ' + v);
      }
    }
    return out;
  }, EMOJI_SRC);
  check('geen emoji in i18n-waarden (4 talen)', i18nHits.length === 0, JSON.stringify(i18nHits));

  // 2) Bouw representatieve views op en scan zichtbare tekst + labels.
  await page.evaluate(() => {
    state.athletes = [
      { id:'a1', name:'Alpha', division:'D', heat:1, splits:[5000,9000], dnf:false, workStarts:{} },
      { id:'a2', name:'Bravo', division:'D', heat:1, splits:[], dnf:true, workStarts:{} },
      { id:'a3', name:'Charlie', division:'D', heat:0, splits:[], dnf:false, workStarts:{} }
    ];
    state.heats = { '1': { startedAt: Date.now()-60000, running:true } };
    state.ui.currentHeat = 1;
    save(); renderAll();
  });

  async function scan(label){
    return await page.evaluate((src) => {
      const re = new RegExp(src, 'gu'); // 'g' voor match; per gebruik verse match (geen test/lastIndex-val)
      const hits = [];
      const text = document.body.innerText || '';
      const m = text.match(re);
      if(m) hits.push('innerText: ' + [...new Set(m)].join(' '));
      document.querySelectorAll('[title],[aria-label],[placeholder]').forEach(el => {
        ['title','aria-label','placeholder'].forEach(attr => {
          const v = el.getAttribute(attr);
          if(v && v.match(re)) hits.push(attr + '="' + v + '"');
        });
      });
      return hits;
    }, EMOJI_SRC).then(hits => { check('geen emoji zichtbaar: ' + label, hits.length === 0, JSON.stringify(hits)); });
  }

  // Atleten-tab (icon-knoppen ⏱✎⇄🗑 -> svg)
  await page.evaluate(() => showView('athletes'));
  await scan('atleten-tab');

  // Race-tab (undo/dnf-knoppen)
  await page.evaluate(() => showView('race'));
  await scan('race-tab');
  check('race: icon-knoppen zijn svg', await page.evaluate(() =>
    [...document.querySelectorAll('#raceAthletes .icon-btn, #raceAthletes .x-btn')].every(b => b.querySelector('svg.ic'))));

  // Klassement + finish-knop met trofee-icoon
  await page.evaluate(() => { boardMode='sim'; showView('board'); renderBoard(); });
  await scan('klassement');
  check('board-acties bevatten svg-iconen', await page.evaluate(() =>
    !!document.querySelector('.board-actions svg.ic') &&
    !!document.getElementById('btnFinishSim').querySelector('svg.ic')));

  // Lege staten (empty-state es-icon)
  await page.evaluate(() => { state.athletes=[]; state.heats={}; save(); renderAll(); showView('athletes'); });
  await scan('lege atleten');
  check('lege staat gebruikt svg-icoon', await page.evaluate(() =>
    !!document.querySelector('.empty-state .es-icon svg.ic')));

  // Seed-overlay (bolt-icoon op de indeel-knop)
  await page.evaluate(() => {
    state.athletes = [{ id:'s1', name:'X', division:'D', heat:0, splits:[], dnf:false, workStarts:{} }];
    save(); showView('athletes'); if(typeof openSeed==='function') openSeed();
  });
  await scan('seed-overlay');

  // Tik-bouwer (Eigen format)
  await page.evaluate(() => { state.event.format='custom'; state.event.customSegs=[]; save(); showView('setup'); renderSetup(); });
  await scan('tik-bouwer');

  // Hulp-overlay in elke taal
  for(const L of ['nl','en','de','es']){
    await page.evaluate((L) => { setLang(L); openHelp(); }, L);
    await scan('help-' + L);
    await page.evaluate(() => closeHelp());
  }
  await page.evaluate(() => setLang('nl'));

  // TV-overlay sluitknop houdt svg + aria-label
  check('TV-sluitknop: svg + aria-label', await page.evaluate(() => {
    const b = document.querySelector('.tv-close');
    return !!b && !!b.querySelector('svg.ic') && !!b.getAttribute('aria-label');
  }));

  // Statische kop-knoppen hebben hun icoon behouden na applyI18n
  check('TV/heat-kaartje/finish-knop hebben svg-icoon', await page.evaluate(() => {
    const btns = [...document.querySelectorAll('.board-actions button')];
    const tv = btns.find(b => /openTV/.test(b.getAttribute('onclick')||''));
    const hc = btns.find(b => /heatCard/.test(b.getAttribute('onclick')||''));
    return !!(tv && tv.querySelector('svg.ic')) && !!(hc && hc.querySelector('svg.ic'));
  }));
};
