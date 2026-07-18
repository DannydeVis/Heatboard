// Dubbeltik-guard, heat-klok na tijdsprong, lane-nummering onder judge-filter (opdracht B6).
module.exports = async function({ page, enterApp, check }){
  await enterApp();
  await page.evaluate(() => { window.__now = 1700000000000; Date.now = () => window.__now; });
  const advance = (ms) => page.evaluate((ms) => { window.__now += ms; }, ms);

  await page.evaluate(() => {
    state.event.format = 'half'; state.event.roxzone = false;
    state.athletes = [
      { id: 'g1', name: 'A', division: 'D', heat: 1, splits: [], dnf: false, workStarts: {} },
      { id: 'g2', name: 'B', division: 'D', heat: 1, splits: [], dnf: false, workStarts: {} },
      { id: 'g3', name: 'C', division: 'D', heat: 1, splits: [], dnf: false, workStarts: {} }
    ];
    state.heats = { '1': { startedAt: window.__now - 5000, running: true } };
    state.ui.currentHeat = 1; lastTapAt = {}; save(); showView('race');
  });

  // 1) 600ms dubbeltik-guard: tweede tik binnen 600ms genegeerd.
  await page.evaluate(() => recordSplit('g1'));            // t=0
  await advance(300);
  await page.evaluate(() => recordSplit('g1'));            // +300ms -> genegeerd
  check('tweede tik binnen 600ms genegeerd', await page.evaluate(() => state.athletes.find(a => a.id === 'g1').splits.length === 1));
  await advance(700);
  await page.evaluate(() => recordSplit('g1'));            // +1000ms -> geaccepteerd
  check('tik na 600ms geaccepteerd', await page.evaluate(() => state.athletes.find(a => a.id === 'g1').splits.length === 2));

  // 2) heat-klok na tijdsprong vooruit.
  const before = await page.evaluate(() => heatElapsed(1));
  await advance(120000); // 2 minuten
  const after = await page.evaluate(() => heatElapsed(1));
  check('heat-klok volgt tijdsprong', after - before >= 119000 && after - before <= 121000, 'delta=' + (after - before));

  // 3) lane-nummering blijft correct (full-heat-index) wanneer een judge filtert.
  const lanes = await page.evaluate(() => {
    DEFAULT_SB.url = 'http://mock'; DEFAULT_SB.key = 'mock';
    live.enabled = true; live.role = 'judge'; live.judgeAthletes = ['g2']; // alleen B
    renderRace();
    const rows = [...document.querySelectorAll('#raceAthletes .race-ath')];
    const info = rows.map(r => ({ lane: r.querySelector('.race-lane-no').textContent, name: r.querySelector('.race-ath-name').textContent }));
    live.enabled = false; live.role = null; live.judgeAthletes = []; DEFAULT_SB.url = ''; DEFAULT_SB.key = '';
    return info;
  });
  check('judge ziet alleen toegewezen atleet', lanes.length === 1 && lanes[0].name === 'B', JSON.stringify(lanes));
  check('lane-nummer = positie in volledige heat (02, niet 01)', lanes[0].lane === '02', JSON.stringify(lanes));
};
