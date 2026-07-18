// Automatisch indelen + drag-and-drop (opdracht B7).
module.exports = async function({ page, enterApp, check }){
  await enterApp();

  // 12 atleten met uiteenlopende verwachte tijden + een wachtlijster.
  await page.evaluate(() => {
    const times = [3600, 3300, 3000, 2880, 2760, 2700, 2640, 2580, 2520, 2460, null, null];
    state.athletes = times.map((et, i) => ({ id: 's' + i, name: 'A' + String(i).padStart(2, '0'), division: 'D', heat: 0, splits: [], dnf: false, workStarts: {}, expectedTime: et }));
    state.athletes.push({ id: 'wl', name: 'Wacht', division: 'D', heat: 0, splits: [], dnf: false, workStarts: {}, waitlist: true });
    save(); showView('athletes');
  });

  await page.evaluate(() => { openSeed(); });
  await page.fill('#seedHeats', '3');
  await page.selectOption('#seedOrder', 'fast');
  await page.evaluate(() => autoSeed());

  const seed = await page.evaluate(() => ({
    h1: state.athletes.filter(a => a.heat === 1 && !a.waitlist).map(a => a.expectedTime),
    h2: state.athletes.filter(a => a.heat === 2 && !a.waitlist).map(a => a.expectedTime),
    h3: state.athletes.filter(a => a.heat === 3 && !a.waitlist).map(a => a.expectedTime),
    wl: state.athletes.filter(a => a.waitlist).length
  }));
  check('3 heats van 4', seed.h1.length === 4 && seed.h2.length === 4 && seed.h3.length === 4, JSON.stringify(seed));
  // aaneengesloten tijdblokken: max(h1) <= min(h2) <= min(h3) (nulls achteraan in h3)
  const noNull = arr => arr.filter(x => x != null);
  check('aaneengesloten tijdblokken (snelste eerst)', Math.max(...seed.h1) <= Math.min(...noNull(seed.h2)) && Math.max(...noNull(seed.h2)) <= Math.min(...noNull(seed.h3)), JSON.stringify(seed));
  check('atleten zonder tijd achteraan (heat 3)', seed.h3.filter(x => x == null).length === 2, JSON.stringify(seed));
  check('wachtlijst overgeslagen', seed.wl === 1);

  // Drag-and-drop via echte DragEvents door de inline handlers.
  await page.evaluate(() => renderAthletes());
  const moved = await page.evaluate(() => {
    const row = document.querySelector('.heat-group[data-heat="1"] .ath-row');
    const target = document.querySelector('.heat-group[data-heat="2"]');
    if(!row || !target) return 'missing';
    const dt = new DataTransfer();
    row.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }));
    target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }));
    target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
    const id = row.getAttribute('data-id');
    return state.athletes.find(x => x.id === id).heat === 2;
  });
  check('drag-and-drop verplaatst tussen heats', moved === true, moved);

  // Mobiele fallback: verplaats-knop (prompt).
  page.__promptValue = '3';
  const mvId = await page.evaluate(() => state.athletes.find(a => a.heat === 2 && !a.waitlist).id);
  await page.evaluate((id) => moveAthlete(id), mvId);
  check('verplaats-knop werkt nog (mobiele fallback)', await page.evaluate((id) => state.athletes.find(x => x.id === id).heat === 3, mvId));
};
