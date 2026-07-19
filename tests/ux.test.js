// Fase 9: taal-select, auto-detectie, hulp-overlay, aria en contrast.
module.exports = async function({ page, enterApp, check, baseURL }){
  await enterApp();

  // 1) taal-select wisselt echt (DE -> Duitse tab-labels), en synct terug
  await page.selectOption('#langSel', 'de');
  check('DE: tab-label Rangliste', await page.evaluate(() => document.getElementById('tab-board').textContent === 'Rangliste'));
  check('DE: html lang attribuut', await page.evaluate(() => document.documentElement.lang === 'de'));
  await page.selectOption('#langSel', 'es');
  check('ES: tab-label Clasificación', await page.evaluate(() => document.getElementById('tab-board').textContent === 'Clasificación'));
  await page.selectOption('#langSel', 'nl');
  check('terug naar NL', await page.evaluate(() => document.getElementById('tab-board').textContent === 'Klassement'));

  // 2) hulp-overlay: opent, gevuld in elke taal, sluit
  for(const L of ['nl','en','de','es']){
    const r = await page.evaluate((L) => {
      setLang(L); openHelp();
      const inner = document.querySelector('#helpOverlay .wizard-inner');
      const open = document.getElementById('helpOverlay').classList.contains('active');
      const untranslated = [...inner.querySelectorAll('[data-i18n]')].filter(el => !el.textContent || el.textContent === el.getAttribute('data-i18n')).map(el => el.getAttribute('data-i18n'));
      const secs = inner.querySelectorAll('.help-sec').length;
      closeHelp();
      const closed = !document.getElementById('helpOverlay').classList.contains('active');
      return { open, untranslated, secs, closed };
    }, L);
    check('help ' + L + ': open/gevuld/sluit (6 secties)', r.open && r.closed && r.secs === 6 && r.untranslated.length === 0, JSON.stringify(r.untranslated));
  }
  await page.evaluate(() => setLang('nl'));

  // 3) auto-detectie: leeg toestel met Duitse browser -> DE + Engelse divisies; bestaande save behoudt taal
  const browser = page.context().browser();
  const deCtx = await browser.newContext({ locale: 'de-DE' });
  const dePage = await deCtx.newPage();
  await dePage.goto(baseURL + '/index.html');
  await dePage.evaluate(() => localStorage.clear());
  await dePage.reload(); await dePage.waitForTimeout(200);
  const det = await dePage.evaluate(() => ({ lang: state.lang, divs: state.divisions.join(','), prof: state.divisionProfiles['Men Open'] }));
  check('auto-detect: DE bij leeg toestel', det.lang === 'de', det.lang);
  check('auto-detect: Engelse divisies + profielen', det.divs.includes('Women Open') && det.prof === 'heren_open', JSON.stringify(det));
  // bestaande NL-save blijft NL, ook in een Duitse browser
  await dePage.evaluate(() => { setLang('nl'); state.ui.setupDone = true; save(); });
  await dePage.reload(); await dePage.waitForTimeout(200);
  check('bestaande save behoudt taal (nl in DE-browser)', await dePage.evaluate(() => state.lang === 'nl'));
  await deCtx.close();

  // 4) aria: icon-knoppen hebben aria-labels; toast is aria-live
  await page.evaluate(() => {
    state.athletes = [{ id: 'x1', name: 'A', division: 'D', heat: 1, splits: [], dnf: false, workStarts: {} }];
    save(); showView('athletes');
  });
  const aria = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('#athleteList .icon-btn')];
    return { total: btns.length, labeled: btns.filter(b => b.getAttribute('aria-label')).length,
      toastLive: document.getElementById('toast').getAttribute('aria-live') === 'polite',
      bannerLive: document.getElementById('announceBanner').getAttribute('aria-live') === 'polite',
      helpBtn: !!document.querySelector('.help-btn[aria-label]') };
  });
  check('icon-knoppen hebben aria-label', aria.total > 0 && aria.labeled === aria.total, JSON.stringify(aria));
  check('toast/banner aria-live + help-knop gelabeld', aria.toastLive && aria.bannerLive && aria.helpBtn, JSON.stringify(aria));

  // 5) contrast: --muted-dim haalt >= 4.5:1 tegen --panel
  const contrast = await page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    const hex = v => { const m = cs.getPropertyValue(v).trim().replace('#',''); return [0,2,4].map(i => parseInt(m.slice(i, i+2), 16) / 255); };
    const lum = c => { const f = x => x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); const [r,g,b] = c.map(f); return 0.2126*r + 0.7152*g + 0.0722*b; };
    const ratio = (a, b) => { const la = lum(hex(a)), lb = lum(hex(b)); const hi = Math.max(la, lb), lo = Math.min(la, lb); return (hi + 0.05) / (lo + 0.05); };
    return { onPanel: ratio('--muted-dim', '--panel'), onVoid: ratio('--muted-dim', '--void') };
  });
  check('contrast --muted-dim op --panel >= 4.5', contrast.onPanel >= 4.5, JSON.stringify(contrast));

  // 6) OG/meta aanwezig
  const meta = await page.evaluate(() => ({
    desc: !!document.querySelector('meta[name="description"]'),
    og: !!document.querySelector('meta[property="og:image"]'),
    title: document.title.includes('HeatBoard')
  }));
  check('meta description + og:image + titel', meta.desc && meta.og && meta.title, JSON.stringify(meta));
};
