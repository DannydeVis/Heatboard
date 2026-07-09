# HeatBoard

Gratis browser-tool waarmee gyms een HYROX-achtige racesimulatie draaien: atleten in heats, live timing per segment, klassement, TV-weergave en een deelbare scorekaart. Gemaakt voor een coach met een iPad in een luidruchtige gym: grote raakvlakken, hoog contrast, leesbaar van afstand.

**Live versie:** https://dannydevis.github.io/Heatboard/

## Functies

- Startscherm-wizard: naam en format kiezen, direct racen
- Formats: volledige sim (8 runs + 8 stations), halve sim, of eigen segmenten
- Heats met live klok, split-tikken per atleet, undo en DNF
- Roxzone-meting (optioneel): per station een IN-tik en een Klaar-tik, zodat transitietijd (roxzone) en werktijd apart zichtbaar worden
- Divisies met officiële HYROX-gewichtsprofielen (seizoen 2025/26); de split-knop toont het gewicht voor de divisie van de atleet
- Klassement met filters, uitklapbare splits en roxzone/werktijd per station
- TV-weergave voor een scherm aan de muur
- CSV-export (puntkomma's, opent direct in Nederlandse Excel) en scorekaart-PNG per atleet
- Live sessie (bèta): judges tikken splits op hun eigen telefoon, alles komt live samen

## Gebruik

1. Open de live-URL (of `index.html` lokaal) in een browser. Op iPad/telefoon: "Zet op beginscherm" voor een app-ervaring.
2. Doorloop het startscherm: naam, format, Start.
3. Voeg atleten toe (los of via bulk-plakken), verdeel ze over heats.
4. Start de heat op het Race-tabblad en tik de splits.

Alles wordt automatisch lokaal opgeslagen op het apparaat (localStorage). Via Opzet kun je een JSON-back-up downloaden of laden.

## Live sessie instellen (eenmalig)

De live sync gebruikt een gratis [Supabase](https://supabase.com)-project:

1. Maak een Supabase-project aan.
2. Voer het script `heatboard-live-setup.sql` uit in de SQL Editor van Supabase (maakt de tabel `heatboard_events` aan, met open policies en realtime).
3. Vul in HeatBoard onder Opzet, Live sessie, Verbinding instellen de Supabase URL en anon key in.
4. Start een live sessie als organisator; judges en de TV doen mee met de sessiecode.

## Ontwikkeling

Eén bestand (`index.html`) met alle HTML, CSS en JavaScript. Geen build-stap, geen dependencies. UI is tweetalig (NL/EN); elke tekst-string staat in beide `I18N`-maps. Deploy via GitHub Pages vanaf de `main`-branch.
