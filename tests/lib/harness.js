// Gedeelde testinfrastructuur voor de HeatBoard QA-suite.
// Serveert de repo-root statisch, start Chromium headless, injecteert een
// mock Supabase-client, en biedt een tellende assert-helper.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const CHROMIUM = process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium';

const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml' };

function startServer(){
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if(p === '/') p = '/index.html';
      const file = path.join(REPO_ROOT, p);
      if(!file.startsWith(REPO_ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()){
        res.writeHead(404); res.end('not found'); return;
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

// Init-script dat een in-memory mock Supabase (+ QR-stub) in de pagina zet.
// Blootgelegd: window.__mock.deliver(row) om een rij (opnieuw) aan subscribers
// te bezorgen (voor de dedup-test), en window.__mock.log.
function mockInitScript(){
  return () => {
    const log = []; let idc = 0; const subs = [];
    function deliver(row){ subs.forEach(cb => { try{ cb({ new: row }); }catch(e){} }); }
    window.__mock = { log, deliver, subs };
    window.supabase = {
      createClient(){
        return {
          from(){
            return {
              insert(row){ row = Object.assign({}, row, { id: ++idc }); log.push(row); setTimeout(() => deliver(row), 0); return Promise.resolve({ error: null }); },
              select(){ const q = { _c: null, eq(c, v){ q._c = v; return q; }, order(){ return Promise.resolve({ data: log.filter(r => r.code === q._c), error: null }); } }; return q; }
            };
          },
          channel(){ const ch = { on(e, c, cb){ ch._cb = cb; return ch; }, subscribe(s){ if(ch._cb) subs.push(ch._cb); if(s) s('SUBSCRIBED'); return ch; } }; return ch; },
          removeChannel(){}
        };
      }
    };
    window.qrcode = function(){ return { addData(){}, make(){}, createDataURL(){ return 'data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAA='; } }; };
  };
}

// Maakt een verse pagina, injecteert de mock, laadt de app en verzamelt fouten.
async function newPage(ctx, baseURL){
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if(m.type() === 'error' && !m.text().startsWith('Failed to load resource')) errors.push('console: ' + m.text()); });
  page.on('dialog', d => d.accept(page.__promptValue || undefined));
  await page.addInitScript(mockInitScript());
  page.__errors = errors;
  page.__baseURL = baseURL;
  return page;
}

// Sluit de wizard, markeert setup als klaar en forceert NL (de suites asserten NL-teksten;
// de app zelf detecteert bij een leeg toestel de browsertaal).
async function enterApp(page, url){
  await page.goto(url || (page.__baseURL + '/index.html'));
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(150);
  await page.evaluate(() => { try{ closeWizard(); }catch(e){} setLang('nl'); state.ui.setupDone = true; save(); });
}

// Kleine assert-helper die per suite telt.
function makeCheck(){
  const state = { pass: 0, fail: 0, fails: [] };
  const check = (name, cond, extra) => {
    if(cond){ state.pass++; }
    else { state.fail++; state.fails.push(name + (extra !== undefined ? '  [' + String(extra).slice(0, 220) + ']' : '')); }
    console.log((cond ? '  PASS ' : '  FAIL ') + name + (cond ? '' : (extra !== undefined ? '   [' + String(extra).slice(0, 200) + ']' : '')));
  };
  return { check, state };
}

module.exports = { startServer, newPage, enterApp, makeCheck, chromium, CHROMIUM, REPO_ROOT };
