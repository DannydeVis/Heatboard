// Volledige solo-flow met countdown, roxzone IN/KLAAR, undo, DNF, klassement, CSV (opdracht B1).
module.exports = async function({ page, enterApp, check }){
  await enterApp();

  // Bestuurbare klok, zodat de countdown deterministisch getest kan worden.
  await page.evaluate(() => {
    window.__now = 1700000000000;
    Date.now = () => window.__now;
  });
  const advance = (ms) => page.evaluate((ms) => { window.__now += ms; }, ms);

  // Half-format (8 segmenten: R S R S R S R S), roxzone aan, 2 atleten in heat 1.
  await page.evaluate(() => {
    state.event.name = 'Solo'; state.event.format = 'half'; state.event.roxzone = true;
    state.divisions = ['Test'];
    state.athletes = [
      { id: 'p1', name: 'Runner', division: 'Test', heat: 1, splits: [], dnf: false, workStarts: {} },
      { id: 'p2', name: 'Quitter', division: 'Test', heat: 1, splits: [], dnf: false, workStarts: {} }
    ];
    state.heats = {}; state.ui.currentHeat = 1; save(); showView('race');
  });

  const segCount = await page.evaluate(() => getSegments().length);
  check('half format = 8 segmenten', segCount === 8, segCount);

  // Countdown-start: klok blijft 0 tot het moment.
  await page.evaluate(() => { lastTapAt = {}; startHeatCountdown(); });
  check('countdown: startedAt in de toekomst', await page.evaluate(() => state.heats['1'].startedAt === window.__now + 10000));
  check('countdown: heatElapsed 0', await page.evaluate(() => heatElapsed(1) === 0));
  const blocked = await page.evaluate(() => { recordSplit('p1'); return state.athletes.find(a => a.id === 'p1').splits.length; });
  check('countdown: tikken geblokkeerd', blocked === 0);
  await page.evaluate(() => tickCountdown());
  check('countdown-overlay actief tijdens aftellen', await page.evaluate(() => document.getElementById('countdownOverlay').classList.contains('active')));

  // Klok voorbij de start -> race loopt vanzelf, geen extra event.
  await advance(10500);
  await page.evaluate(() => tickCountdown());
  check('na afloop: overlay weg', await page.evaluate(() => !document.getElementById('countdownOverlay').classList.contains('active')));
  check('na afloop: klok loopt', await page.evaluate(() => heatElapsed(1) > 0));

  // Tik Runner volledig door: R (1 tik) S (IN+KLAAR) R S R S R S = 4 runs + 4x2 = 12 tikken.
  const tap = async () => { await page.evaluate(() => { lastTapAt = {}; recordSplit('p1'); }); await advance(30000); };
  // segment 0 = run -> 1 split
  await tap();
  check('run 1 geeft directe split', await page.evaluate(() => state.athletes.find(a => a.id === 'p1').splits.length === 1));
  // segment 1 = station -> IN
  await tap();
  const inState = await page.evaluate(() => { const a = state.athletes.find(x => x.id === 'p1'); return { splits: a.splits.length, ws: Object.keys(a.workStarts).length }; });
  check('station IN-tik: workStart gezet, geen split', inState.splits === 1 && inState.ws === 1, JSON.stringify(inState));
  // undo IN (fase 1)
  await page.evaluate(() => undoSplit('p1'));
  check('undo draait IN-tik terug', await page.evaluate(() => Object.keys(state.athletes.find(a => a.id === 'p1').workStarts).length === 0));
  // IN + KLAAR opnieuw
  await tap(); await tap();
  check('station KLAAR: 2 splits', await page.evaluate(() => state.athletes.find(a => a.id === 'p1').splits.length === 2));
  // undo KLAAR (fase 2): pop split, workStart blijft
  await page.evaluate(() => undoSplit('p1'));
  const afterUndo2 = await page.evaluate(() => { const a = state.athletes.find(x => x.id === 'p1'); return { splits: a.splits.length, ws: Object.keys(a.workStarts).length }; });
  check('undo na KLAAR: split weg, workStart blijft', afterUndo2.splits === 1 && afterUndo2.ws === 1, JSON.stringify(afterUndo2));

  // Verder tikken tot finish (16 splits? nee: 8 segmenten -> 8 splits).
  let guard = 0;
  while(await page.evaluate(() => state.athletes.find(a => a.id === 'p1').splits.length) < 8 && guard++ < 30){
    await tap();
  }
  check('Runner finisht met 8 splits', await page.evaluate(() => state.athletes.find(a => a.id === 'p1').splits.length === 8));

  // DNF de tweede atleet.
  await page.evaluate(() => toggleDNF('p2'));
  check('DNF gezet', await page.evaluate(() => state.athletes.find(a => a.id === 'p2').dnf === true));

  // Klassement: Runner boven, Quitter DNF onderaan.
  const board = await page.evaluate(() => { showView('board'); boardMode = 'sim'; renderBoard(); return document.getElementById('boardList').innerHTML; });
  check('board toont finisher', board.includes('Runner'));
  check('board toont DNF', board.includes('DNF'));

  // CSV-inhoud: ;-separator, BOM (byte-niveau, want blob.text() strip de BOM), kolommen, tijden.
  await page.evaluate(() => { window.__blob = null; window.downloadBlob = (b) => { window.__blob = b; }; exportCSV(); });
  await page.waitForFunction(() => window.__blob !== null);
  const bom = await page.evaluate(async () => { const u = new Uint8Array(await window.__blob.arrayBuffer()); return [u[0], u[1], u[2]]; });
  check('CSV heeft UTF-8 BOM (Excel NL)', bom[0] === 0xEF && bom[1] === 0xBB && bom[2] === 0xBF, JSON.stringify(bom));
  const csv = await page.evaluate(async () => await window.__blob.text());
  check('CSV ;-header met kolommen', /;Naam;Divisie;Heat;Status;Totaal/.test(csv.split('\r\n')[0]), csv.slice(0, 40));
  check('CSV bevat roxzone-kolommen (toggle aan)', csv.includes('Rox ') && csv.includes('Roxzone totaal'));
  const runnerRow = csv.split('\r\n').find(r => r.includes('Runner'));
  check('CSV finisher-rij heeft tijden', /\d\d:\d\d/.test(runnerRow), runnerRow);
};
