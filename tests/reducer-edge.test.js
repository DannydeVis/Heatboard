// Event-reducer randgevallen (opdracht B2).
module.exports = async function({ page, enterApp, check }){
  await enterApp();

  // Basis-roster met een lopende heat 1.
  const setup = () => page.evaluate(() => {
    state.event.format = 'half'; // 8 segmenten
    state.event.roxzone = false; state.event.capacity = null;
    state.athletes = [
      { id: 'a1', name: 'Alice', division: 'D', heat: 1, splits: [], dnf: false, workStarts: {} },
      { id: 'a2', name: 'Bob', division: 'D', heat: 1, splits: [], dnf: false, workStarts: {} }
    ];
    state.heats = { '1': { startedAt: Date.now() - 60000, running: true } };
    save();
  });

  // 1) dubbele uuid wordt genegeerd (via de mock-subscriber-route in subscribeLive)
  await setup();
  await page.evaluate(() => {
    DEFAULT_SB.url = 'http://mock'; DEFAULT_SB.key = 'mock';
  });
  await page.evaluate(() => startLiveSession());
  await page.waitForFunction(() => live.enabled === true);
  const dedup = await page.evaluate(() => {
    const before = state.athletes.find(a => a.id === 'a1').splits.length;
    const row = { code: live.code, type: 'split', payload: { id: 'a1', ms: 12345, uuid: 'dup-1' } };
    window.__mock.deliver(row); // eerste keer -> toegepast
    window.__mock.deliver(row); // tweede keer, zelfde uuid -> genegeerd
    const after = state.athletes.find(a => a.id === 'a1').splits.length;
    return { before, after };
  });
  check('dubbele uuid: split maar één keer toegepast', dedup.after === dedup.before + 1, JSON.stringify(dedup));
  await page.evaluate(() => { leaveLiveSession(); DEFAULT_SB.url = ''; DEFAULT_SB.key = ''; });

  // 2) onbekend event type crasht niet en laat state ongemoeid
  await setup();
  const unknown = await page.evaluate(() => {
    const snap = JSON.stringify(state.athletes);
    let threw = false;
    try { applyEvent('totally_unknown', { foo: 1 }, true); } catch(e){ threw = true; }
    return { threw, unchanged: JSON.stringify(state.athletes) === snap };
  });
  check('onbekend type: geen crash', unknown.threw === false);
  check('onbekend type: state ongemoeid', unknown.unchanged === true);

  // 3) snapshot na bestaande splits: wholesale replace
  await setup();
  const snap = await page.evaluate(() => {
    _applySplit(state.athletes.find(a => a.id === 'a1'), 5000, false); // lokale split
    applyEvent('snapshot', { athletes: [{ id: 'z9', name: 'Zed', division: 'X', heat: 1, splits: [1000], dnf: false, workStarts: {} }] }, false);
    return { count: state.athletes.length, first: state.athletes[0].id };
  });
  check('snapshot vervangt athletes volledig', snap.count === 1 && snap.first === 'z9', JSON.stringify(snap));

  // 4) split die binnenkomt na reset_heat
  await setup();
  const afterReset = await page.evaluate(() => {
    _applySplit(state.athletes.find(a => a.id === 'a1'), 5000, false);
    applyEvent('reset_heat', { heat: 1 }, false);
    const clearedRunning = state.heats['1'].running;
    applyEvent('split', { id: 'a1', ms: 8000 }, false);
    const a = state.athletes.find(x => x.id === 'a1');
    return { running: clearedRunning, splits: a.splits.slice() };
  });
  check('reset_heat wist splits + running', afterReset.running === false);
  check('split na reset_heat begint schoon', afterReset.splits.length === 1 && afterReset.splits[0] === 8000, JSON.stringify(afterReset));

  // 5) undo op atleet zonder splits/workStarts = no-op
  await setup();
  const undoEmpty = await page.evaluate(() => {
    let threw = false;
    try { applyEvent('undo', { id: 'a1' }, false); } catch(e){ threw = true; }
    const a = state.athletes.find(x => x.id === 'a1');
    return { threw, splits: a.splits.length, ws: Object.keys(a.workStarts || {}).length };
  });
  check('undo op lege atleet: no-op zonder crash', undoEmpty.threw === false && undoEmpty.splits === 0 && undoEmpty.ws === 0, JSON.stringify(undoEmpty));

  // 6) register boven capacity -> waitlist
  await setup();
  const cap = await page.evaluate(() => {
    state.athletes = []; state.event.capacity = 2; save();
    applyEvent('register', { id: 'r1', name: 'R1', division: 'D' }, false);
    applyEvent('register', { id: 'r2', name: 'R2', division: 'D' }, false);
    applyEvent('register', { id: 'r3', name: 'R3', division: 'D' }, false);
    return {
      placed: state.athletes.filter(a => !a.waitlist).length,
      wait: state.athletes.filter(a => a.waitlist).map(a => a.id)
    };
  });
  check('register boven capacity -> waitlist', cap.placed === 2 && cap.wait.length === 1 && cap.wait[0] === 'r3', JSON.stringify(cap));

  // 7) work_start zonder split + undo verwijdert de work_start
  await page.evaluate(() => { state.event.roxzone = true; save(); });
  await setup();
  await page.evaluate(() => { state.event.roxzone = true; save(); });
  const ws = await page.evaluate(() => {
    // segment 1 (index 1) is een station in half-format (SkiErg). Zet eerst een run-split.
    _applySplit(state.athletes.find(a => a.id === 'a1'), 3000, false); // run 1
    applyEvent('work_start', { id: 'a1', seg: 1, ms: 6000 }, false); // IN op station
    const a = state.athletes.find(x => x.id === 'a1');
    const hadWs = a.workStarts[1] === 6000 && a.splits.length === 1;
    applyEvent('undo', { id: 'a1' }, false); // moet de work_start terugdraaien, niet de split
    const afterWs = a.workStarts[1];
    const afterSplits = a.splits.length;
    return { hadWs, afterWs, afterSplits };
  });
  check('work_start opgeslagen zonder split', ws.hadWs === true, JSON.stringify(ws));
  check('undo verwijdert work_start eerst (split blijft)', ws.afterWs == null && ws.afterSplits === 1, JSON.stringify(ws));
};
