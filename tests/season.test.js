// Seizoenslogica: punten, posities, dedupe, naam-matching, JSON-roundtrip, tiebreak (opdracht B3).
module.exports = async function({ page, enterApp, check }){
  await enterApp();

  check('SEASON_POINTS exact', await page.evaluate(() =>
    JSON.stringify(SEASON_POINTS) === JSON.stringify([25,20,16,13,11,10,8,6,4,2]) &&
    pointsFor(1) === 25 && pointsFor(10) === 2 && pointsFor(11) === 1 && pointsFor(50) === 1));

  // Bouw en sla twee mini-sims op (half format), deels dezelfde namen, 2 divisies.
  const buildAndSave = (name, aths) => page.evaluate(({ name, aths }) => {
    state.event.name = name; state.event.format = 'half'; state.event.savedToSeason = null;
    const segs = getSegments();
    state.athletes = aths.map((x, i) => ({ id: 'a' + i + name, name: x[0], division: x[1], heat: 1, dnf: false, workStarts: {},
      splits: Array.from({ length: segs.length }, (_, si) => Math.round((si + 1) * x[2] * 1000 / segs.length)) }));
    // een niet-finisher + wachtlijster die NIET meetellen
    state.athletes.push({ id: 'dnf' + name, name: 'Uit', division: aths[0][1], heat: 1, splits: [1000], dnf: false, workStarts: {} });
    state.athletes.push({ id: 'wl' + name, name: 'Wacht', division: aths[0][1], heat: 0, splits: [], dnf: false, workStarts: {}, waitlist: true });
    state.heats = { '1': { startedAt: Date.now() - 5000000, running: false } };
    save();
  }, { name, aths });

  await buildAndSave('S1', [['Tom','H',2400],['Daan','H',2500],['Bram','H',2600],['Lisa','D',2450],['Roos','D',2550]]);
  await page.evaluate(() => { openFinishSim(); document.getElementById('newSeasonName').value = 'Testleague'; createSeasonAndSave(); });
  let s = await page.evaluate(() => Object.values(loadSeasons())[0]);
  check('sim 1: alleen 5 finishers opgeslagen', s.results.length === 5, s.results.map(r => r.athleteName).join(','));
  const tom1 = s.results.find(r => r.athleteName === 'Tom'), bram1 = s.results.find(r => r.athleteName === 'Bram'), lisa1 = s.results.find(r => r.athleteName === 'Lisa');
  check('posities per divisie kloppen', tom1.position === 1 && bram1.position === 3 && lisa1.position === 1, JSON.stringify([tom1.position, bram1.position, lisa1.position]));

  const sid = await page.evaluate(() => Object.keys(loadSeasons())[0]);
  await buildAndSave('S2', [['daan','H',2350],[' TOM ','H',2420],['Bram','H',2700],['Lisa','D',2400]]); // andere case/spaties
  await page.evaluate((sid) => finishSimToSeason(sid), sid);
  s = await page.evaluate(() => Object.values(loadSeasons())[0]);
  check('sim 2 toegevoegd (9 rijen)', s.results.length === 9, s.results.length);

  const standings = await page.evaluate((sid) => seasonStandings(loadSeasons()[sid], ''), sid);
  const pts = Object.fromEntries(standings.map(e => [e.name.trim().toLowerCase(), e.points]));
  // Tom: P1(25)+P2(20)=45 ; Daan: P2(20)+P1(25)=45 ; Bram 16+16=32 ; Lisa 25+25=50 ; Roos 20
  check('punten volgens schema', pts['tom'] === 45 && pts['daan'] === 45 && pts['bram'] === 32 && pts['lisa'] === 50 && pts['roos'] === 20, JSON.stringify(pts));
  check('naam-matching trim+lowercase (Tom == " TOM ")', standings.length === 5, 'unieke atleten=' + standings.length);
  const order = standings.map(e => e.name.trim().toLowerCase());
  check('sortering punten desc, tiebreak beste tijd (Daan 2350 < Tom 2400)', order[0] === 'lisa' && order[1] === 'daan' && order[2] === 'tom', JSON.stringify(order));

  // dubbel opslaan dupliceert niet na de waarschuwingsflow
  await page.evaluate((sid) => finishSimToSeason(sid), sid);
  s = await page.evaluate(() => Object.values(loadSeasons())[0]);
  check('opnieuw opslaan dupliceert niet (9 rijen)', s.results.length === 9, s.results.length);

  // JSON-export -> wissen -> import verliesvrij
  const exported = await page.evaluate((sid) => JSON.stringify(loadSeasons()[sid]), sid);
  await page.evaluate(() => localStorage.removeItem('heatboard_seasons'));
  check('seasons gewist', await page.evaluate(() => Object.keys(loadSeasons()).length === 0));
  await page.evaluate((json) => { const d = JSON.parse(json); const o = loadSeasons(); o[d.id] = d; saveSeasons(o); }, exported);
  const roundtrip = await page.evaluate((sid) => { const s2 = loadSeasons()[sid]; return s2 && s2.results.length === 9 && s2.name === 'Testleague'; }, sid);
  check('JSON-roundtrip verliesvrij', roundtrip === true);

  // divisiefilter
  const dames = await page.evaluate((sid) => seasonStandings(loadSeasons()[sid], 'D').map(e => e.name.trim().toLowerCase()), sid);
  check('divisiefilter werkt', JSON.stringify(dames) === JSON.stringify(['lisa','roos']), JSON.stringify(dames));

  // CSV van de stand
  await page.evaluate((sid) => { boardSeasonId = sid; boardMode = 'season'; showView('board'); renderBoard(); document.getElementById('filterDivision').value = ''; window.__blob = null; window.downloadBlob = (b) => { window.__blob = b; }; seasonCSV(); }, sid);
  await page.waitForFunction(() => window.__blob !== null);
  const bom = await page.evaluate(async () => { const u = new Uint8Array(await window.__blob.arrayBuffer()); return [u[0], u[1], u[2]]; });
  check('seizoen-CSV heeft UTF-8 BOM', bom[0] === 0xEF && bom[1] === 0xBB && bom[2] === 0xBF, JSON.stringify(bom));
  const csv = await page.evaluate(async () => await window.__blob.text());
  check('seizoen-CSV header + ;-separator', /^Positie;Naam;Divisie;Punten;Sims;Beste tijd/.test(csv), csv.slice(0, 60));
};
