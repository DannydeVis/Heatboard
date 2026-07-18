# HeatBoard testrapport (fase 8: stabilisatie-sprint)

Geautomatiseerde QA van de zeven gebouwde fases. Geen nieuwe features, geen redesign.
Versie na deze sprint: **SIM v0.7.1**.

## Draaien

```
cd tests
npm install    # eenmalig (Playwright; Chromium wordt niet opnieuw gedownload)
npm test       # draait alle *.test.js, exit-code != 0 bij een fout
```

De app (`index.html`) blijft één bestand zonder dependencies. Alle testcode staat in `tests/`
en komt niet in de app terecht. De suite serveert de repo-root statisch, start Chromium headless
en injecteert een mock Supabase-client (in-memory event-log dat realtime-inserts aan de
subscribers levert). Geen echt netwerk nodig.

> Noot: er bestond geen `HeatBoard-testdraaiboek.md` in de repo. Als "testdraaiboek" is de som
> van de testchecklists uit de fase-opdrachten gebruikt.

## Resultaat

**67 checks, alles groen (7 suites).**

| Suite | Checks | Dekking |
|---|---|---|
| `solo-flow.test.js` | 20 | Sim opzetten, roxzone aan, countdown-start (klok blijft 0 tot het moment, start dan vanzelf), alle splits incl. IN/KLAAR, undo in beide fases, DNF, klassement, CSV-inhoud (BOM op byte-niveau, `;`-separator, kolommen, tijden) |
| `reducer-edge.test.js` | 10 | Dubbele uuid genegeerd (via realtime-subscriber), onbekend type crasht niet en laat state ongemoeid, snapshot na bestaande splits, split na `reset_heat`, undo op lege atleet = no-op, register boven capacity → wachtlijst, work_start zonder split + undo daarvan |
| `season.test.js` | 13 | Puntenschema exact, posities per divisie, dubbel opslaan dupliceert niet, naam-matching trim+lowercase, JSON-roundtrip verliesvrij, tiebreak op beste tijd, divisiefilter, CSV-BOM |
| `migration.test.js` | 8 | Oude localStorage-sim (zonder workStarts/expectedTime/judges/divisionProfiles/seizoenen/orgName) laadt zonder verlies, alle views renderen, IN-tik lazy-init op legacy-atleet |
| `guards-timing.test.js` | 5 | 600ms dubbeltik-guard, heat-klok na tijdsprong, lane-nummering blijft full-heat-index onder judge-filter |
| `seed-dnd.test.js` | 6 | 12 atleten → 3 aaneengesloten tijdblokken, zonder-tijd achteraan, wachtlijst overgeslagen, drag-and-drop (echte DragEvents) + verplaats-knop |
| `i18n.test.js` | 5 | NL/EN-pariteit (248 keys elk), elke statische en dynamische `t()`-key bestaat in beide maps, geen em/en-dash in i18n-waarden of zichtbare UI |

De timing-tests gebruiken een gestubde `Date.now()` zodat countdown, dubbeltik-guard en klok
deterministisch zijn.

## Gevonden en gefixte bugs

**1. Em-dashes in UI-teksten (huisstijl-schending).**
Symptoom: het teken `—` stond in zichtbare teksten, terwijl de huisregel em/en-dashes verbiedt.
Plekken: de placeholders `phEventName` (Opzet- en wizard-veld) en hun i18n-waarden (NL+EN),
`demoEventName` (NL+EN), de finish-toast (`naam — Finish`), en het lane-label `—` van de
lobby-/wachtlijstrijen.
Oorzaak: voorbeeldteksten en scheidingstekens uit fase 1-6.
Fix: vervangen door de huisstijl-scheider `·` (middot). Beide talen bijgewerkt.

**2. En-dashes in UI-teksten.**
Symptoom: het teken `–` als "geen tijd"-glyph.
Plekken: `fmtTime()` (retourneert de glyph bij lege/ongeldige tijd) en de "nog geen tijd"-fallbacks
op de TV, in het klassement, in de atleet-view en op het heat-kaartje.
Oorzaak: en-dash als placeholder-glyph uit fase 1/2.
Fix: vervangen door een gewone hyphen `-`.

Keuze bij twijfel: em-dash → `·` (past bij de bestaande `·`-scheiders in de app), en-dash → `-`.
Em-dashes in **code- en CSS-commentaar** zijn bewust NIET aangepast: dat is geen UI-tekst en de
huisregel gaat over zichtbare teksten.

**Geen functionele of logische bugs gevonden.** De event-reducer, seizoenslogica (punten,
posities, dedupe, tiebreak, naam-matching, JSON-roundtrip), de migraties van oude saves, en de
guards/timing bleken onder alle geteste randgevallen correct.

Tijdens het schrijven van de tests dook één *test*-valkuil op (geen app-bug): `Blob.text()` strip
volgens de Encoding-spec een leidende UTF-8 BOM bij het decoderen. De CSV-export schrijft de BOM
wel degelijk; de test verifieert dit nu op byte-niveau (`arrayBuffer()` → `EF BB BF`).

## Wat alleen handmatig kan (rest voor de eigenaar)

Deze punten vragen echte hardware, een echt netwerk of menselijke waarneming en zitten niet in de
geautomatiseerde suite:

- **Multi-device sync-latentie:** twee of meer echte toestellen op één live-sessie; hoe snel een
  split/registratie/aankondiging aankomt op host, judge, TV en atleet-view.
- **Beeps / WebAudio autoplay:** hoorbaarheid van de countdown-beeps en of de AudioContext op iOS
  en Android pas na de eerste tik geluid geeft (browser-autoplaybeleid).
- **QR scannen met een camera:** de QR op de TV daadwerkelijk scannen en of de link opent in de
  juiste modus (inschrijven vs. kijken).
- **Wake lock:** blijft het scherm aan tijdens een lopende heat op een echt toestel.
- **Schermrotatie en fullscreen:** TV-weergave in landschap, fullscreen-gedrag, notch/safe-area op
  telefoons.
- **Vliegtuigstand / offline herstel:** tikken in de wachtrij zetten bij verbroken verbinding en de
  flush-timing zodra het netwerk terugkomt (echte Supabase + echt netwerk).
- **Echte Supabase round-trip + RLS:** de meegeleverde `DEFAULT_SB`-config tegen de echte database,
  inclusief de open RLS-policies uit `heatboard-live-setup.sql`.
- **PWA installeren:** "Zet op beginscherm" op iPad/telefoon en de app-ervaring.
- **Delen/klembord op echt toestel:** `navigator.share` en klembord-kopie van de inschrijflink.
