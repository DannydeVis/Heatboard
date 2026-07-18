// Migratie van oude localStorage-vormen zonder fouten of dataverlies (opdracht B4).
module.exports = async function({ page, enterApp, check }){
  await enterApp();

  // Fixture: een pre-fase-3/4/6/7 sim. Mist workStarts, expectedTime, judges,
  // divisionProfiles, savedToSeason, orgName, registrationOpen, roxzone.
  const legacy = {
    lang: 'nl',
    event: { name: 'Oude Sim', format: 'full', customSegs: [] },
    divisions: ['Dames Open', 'Heren Open', 'Mijn Groep'],
    athletes: [
      { id: 'o1', name: 'Lisa', division: 'Dames Open', heat: 1, splits: [60000, 130000], dnf: false },
      { id: 'o2', name: 'Tom', division: 'Heren Open', heat: 1, splits: [], dnf: false }
    ],
    heats: { '1': { startedAt: Date.now() - 200000, running: true } },
    ui: { currentHeat: 1, view: 'race', setupDone: true }
  };

  await page.evaluate((data) => { localStorage.setItem('heatboard_v1', JSON.stringify(data)); }, legacy);
  await page.reload();
  await page.waitForTimeout(300);

  check('oude sim laadt zonder wizard', await page.evaluate(() => !document.getElementById('wizardOverlay').classList.contains('active')));
  const migrated = await page.evaluate(() => ({
    name: state.event.name,
    aths: state.athletes.length,
    splits: state.athletes.find(a => a.id === 'o1').splits.length,
    judges: Array.isArray(state.judges) ? state.judges.length : 'NIET-ARRAY',
    profilesHerenOpen: state.divisionProfiles['Heren Open'],
    profilesMijnGroep: state.divisionProfiles['Mijn Groep'],
    savedToSeason: state.event.savedToSeason,
    orgName: state.event.orgName,
    roxzone: state.event.roxzone,
    registrationOpen: state.event.registrationOpen
  }));
  check('data behouden (naam + atleten + splits)', migrated.name === 'Oude Sim' && migrated.aths === 2 && migrated.splits === 2, JSON.stringify(migrated));
  check('judges default []', migrated.judges === 0, migrated.judges);
  check('divisionProfiles afgeleid (Heren Open -> heren_open, Mijn Groep -> geen)', migrated.profilesHerenOpen === 'heren_open' && migrated.profilesMijnGroep === undefined, JSON.stringify(migrated));
  check('nieuwe event-velden defaulten', migrated.savedToSeason === null && migrated.orgName === '' && migrated.roxzone === false && migrated.registrationOpen === false, JSON.stringify(migrated));

  // Renders zonder crash op atleten zonder workStarts/expectedTime.
  const renders = await page.evaluate(() => {
    let ok = true;
    try {
      showView('athletes'); renderAthletes();
      showView('race'); renderRace();
      showView('board'); boardMode = 'sim'; renderBoard();
      showView('setup'); renderSetup();
    } catch(e){ ok = false; window.__err = e.message; }
    return ok;
  });
  check('alle views renderen zonder crash', renders === true, await page.evaluate(() => window.__err || ''));

  // Een IN-tik op een legacy-atleet (zonder workStarts) werkt via lazy-init.
  const inTap = await page.evaluate(() => {
    state.event.roxzone = true; state.event.format = 'half'; save();
    const a = state.athletes.find(x => x.id === 'o2'); a.splits = []; // schoon
    lastTapAt = {}; recordSplit('o2'); // run 1 -> split
    lastTapAt = {}; recordSplit('o2'); // station -> IN (workStarts lazy-init)
    return { splits: a.splits.length, ws: Object.keys(a.workStarts || {}).length };
  });
  check('legacy-atleet: IN-tik lazy-init workStarts', inTap.splits === 1 && inTap.ws === 1, JSON.stringify(inTap));

  // Oude live-config (heatboard_live_cfg zonder DEFAULT_SB) blijft werken: geen crash bij renderLiveUI.
  check('renderLiveUI zonder config crasht niet', await page.evaluate(() => { try { renderLiveUI(); return true; } catch(e){ return false; } }));
};
