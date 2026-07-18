// Draait alle *.test.js in deze map tegen één browser + één static server.
// Eén commando: `npm test`. Exit-code != 0 zodra een check faalt.
const fs = require('fs');
const path = require('path');
const { startServer, newPage, enterApp, makeCheck, chromium, CHROMIUM } = require('./lib/harness');

(async () => {
  const server = await startServer();
  const baseURL = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ executablePath: CHROMIUM });

  const files = fs.readdirSync(__dirname).filter(f => f.endsWith('.test.js')).sort();
  let totalPass = 0, totalFail = 0;
  const summary = [];

  for(const f of files){
    const mod = require(path.join(__dirname, f));
    const ctx = await browser.newContext({ viewport: { width: 900, height: 950 } });
    const page = await newPage(ctx, baseURL);
    const { check, state } = makeCheck();
    console.log('\n=== ' + f + ' ===');
    try{
      await mod({ page, enterApp: (url) => enterApp(page, url), check, baseURL });
    }catch(e){
      state.fail++; state.fails.push('SUITE THREW: ' + e.message);
      console.log('  FAIL suite threw: ' + e.message);
    }
    // console/page errors tellen als falen
    if(page.__errors.length){
      state.fail += page.__errors.length;
      page.__errors.forEach(e => { state.fails.push('runtime: ' + e); console.log('  FAIL runtime: ' + e); });
    }
    await ctx.close();
    totalPass += state.pass; totalFail += state.fail;
    summary.push({ file: f, pass: state.pass, fail: state.fail });
  }

  await browser.close();
  server.close();

  console.log('\n================ SAMENVATTING ================');
  summary.forEach(s => console.log('  ' + (s.fail ? 'FAIL' : 'ok  ') + '  ' + s.file + '  (' + s.pass + ' pass, ' + s.fail + ' fail)'));
  console.log('  TOTAAL: ' + totalPass + ' pass, ' + totalFail + ' fail');
  process.exit(totalFail ? 1 : 0);
})();
