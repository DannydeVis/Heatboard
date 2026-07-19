// Fase 10: tik-bouwer voor Eigen format (aantikken in plaats van typen).
module.exports = async function({ page, enterApp, check }){
  await enterApp();

  // Custom format aan, geen segmenten: bouwer + lege-hint zichtbaar in Opzet.
  await page.evaluate(() => { state.event.format = 'custom'; state.event.customSegs = []; save(); showView('setup'); renderSetup(); });
  check('bouwer gerenderd met palet', await page.evaluate(() => document.querySelectorAll('#segBuilder .seg-pal').length >= 10));
  check('lege-hint zichtbaar', await page.evaluate(() => !!document.querySelector('#segBuilder .seg-empty')));
  check('textarea in ingeklapte details', await page.evaluate(() => { const d = document.querySelector('#customSegField details'); return d && !d.open && !!d.querySelector('#customSegs'); }));

  // Tikken voegt toe (Run + station), preview en textarea syncen mee.
  await page.evaluate(() => addCustomSeg('R','Run 1 km'));
  await page.evaluate(() => addCustomSeg('S','SkiErg 1000 m'));
  const st1 = await page.evaluate(() => ({
    segs: state.event.customSegs.map(s => s.join(' ')),
    rows: document.querySelectorAll('#segBuilder .seg-build-row').length,
    preview: document.querySelectorAll('#segPreview .seg-chip').length,
    ta: document.getElementById('customSegs').value
  }));
  check('twee tikken = twee segmenten', JSON.stringify(st1.segs) === JSON.stringify(['R Run 1 km','S SkiErg 1000 m']), JSON.stringify(st1));
  check('lijst + preview + textarea synced', st1.rows === 2 && st1.preview === 2 && st1.ta === 'R Run 1 km\nS SkiErg 1000 m', JSON.stringify(st1));

  // Via het palet zelf tikken (echte klik).
  await page.click('#segBuilder .seg-pal.station >> nth=1'); // Sled Push 50 m
  check('paletklik voegt station toe', await page.evaluate(() => state.event.customSegs.length === 3 && state.event.customSegs[2][1] === 'Sled Push 50 m'),
    await page.evaluate(() => JSON.stringify(state.event.customSegs)));

  // Eigen station via prompt.
  page.__promptValue = 'Bike 2 km';
  await page.evaluate(() => addCustomSegPrompt('S'));
  check('eigen station via prompt', await page.evaluate(() => state.event.customSegs[3].join('|') === 'S|Bike 2 km'));

  // Omhoog verplaatsen en verwijderen.
  await page.evaluate(() => moveCustomSeg(3));
  check('omhoog verplaatst', await page.evaluate(() => state.event.customSegs[2][1] === 'Bike 2 km' && state.event.customSegs[3][1] === 'Sled Push 50 m'));
  await page.evaluate(() => removeCustomSeg(0));
  check('verwijderen werkt', await page.evaluate(() => state.event.customSegs.length === 3 && state.event.customSegs[0][1] === 'SkiErg 1000 m'));

  // Textarea -> bouwer sync (geavanceerde route blijft werken).
  await page.evaluate(() => updateCustomSegs('R Run 400 m\nS Wall Balls'));
  const st2 = await page.evaluate(() => ({ segs: state.event.customSegs.map(s => s.join(' ')), rows: document.querySelectorAll('#segBuilder .seg-build-row').length }));
  check('tekstinvoer vult de bouwer', JSON.stringify(st2.segs) === JSON.stringify(['R Run 400 m','S Wall Balls']) && st2.rows === 2, JSON.stringify(st2));

  // Wizard: zelfde bouwer, Start-knop reageert op tikken.
  await page.evaluate(() => { state.event.customSegs = []; save(); openWizard(); wizardNext(); wizSetFormat('custom'); });
  check('wizard: bouwer aanwezig en Start disabled', await page.evaluate(() =>
    document.querySelectorAll('#wizSegBuilder .seg-pal').length >= 10 && document.getElementById('wizBtnStart').disabled === true));
  await page.click('#wizSegBuilder .seg-pal >> nth=0'); // Run 1 km
  check('wizard: tik enabled Start', await page.evaluate(() =>
    state.event.customSegs.length === 1 && document.getElementById('wizBtnStart').disabled === false));
  await page.evaluate(() => { closeWizard(); state.ui.setupDone = true; save(); });

  // hasTimes-guard: bij bestaande tijden vraagt aanpassen om bevestiging.
  // We sturen de confirm via een gestubde window.confirm (deterministisch, geen dialog-race).
  await page.evaluate(() => {
    state.event.customSegs = [['R','Run 1 km']];
    state.athletes = [{ id: 'g1', name: 'A', division: 'D', heat: 1, splits: [5000], dnf: false, workStarts: {} }];
    state.heats = { '1': { startedAt: Date.now() - 60000, running: true } }; save();
    window.confirm = () => false; // annuleren
  });
  await page.evaluate(() => addCustomSeg('S','Wall Balls'));
  check('guard: annuleren laat segmenten en tijden staan', await page.evaluate(() =>
    state.event.customSegs.length === 1 && state.athletes[0].splits.length === 1),
    await page.evaluate(() => state.event.customSegs.length + '/' + state.athletes[0].splits.length));
  await page.evaluate(() => { window.confirm = () => true; }); // bevestigen
  await page.evaluate(() => addCustomSeg('S','Wall Balls'));
  check('guard: bevestigen past toe en wist tijden', await page.evaluate(() =>
    state.event.customSegs.length === 2 && state.athletes[0].splits.length === 0),
    await page.evaluate(() => state.event.customSegs.length + '/' + state.athletes[0].splits.length));
};
