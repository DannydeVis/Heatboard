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
- CSV-export (puntkomma's, opent direct in Nederlandse Excel), scorekaart-PNG per atleet en een heat-kaartje (top 8) om te delen
- Self-registration: atleten schrijven zichzelf in via een link of QR, met optionele capaciteit en wachtlijst
- Persoonlijke atleet-weergave: elke deelnemer volgt live zijn eigen splits, roxzone-tijden en positie op zijn telefoon
- QR-code op de TV: scannen om mee te doen (inschrijving open) of om de live standen te bekijken
- Live sessie (bèta): judges tikken splits op hun eigen telefoon, alles komt live samen

## Rollen

Bij een live sessie kies je bij het meedoen een rol:

- **Organisator (host):** beheert de sim, opent de inschrijving, deelt atleten in, start heats.
- **Judge:** tikt splits voor toegewezen atleten op de eigen telefoon.
- **TV / kijker:** toont de live standen, bijvoorbeeld op een scherm aan de muur (met QR-code).
- **Atleet:** ziet de eigen kaart en positie live; automatisch na inschrijving of door je naam te kiezen uit de deelnemerslijst.

## Gebruik

1. Open de live-URL (of `index.html` lokaal) in een browser. Op iPad/telefoon: "Zet op beginscherm" voor een app-ervaring.
2. Doorloop het startscherm: naam, format, Start.
3. Voeg atleten toe (los of via bulk-plakken), verdeel ze over heats.
4. Start de heat op het Race-tabblad en tik de splits.

Alles wordt automatisch lokaal opgeslagen op het apparaat (localStorage). Via Opzet kun je een JSON-back-up downloaden of laden.

## Inschrijfflow (self-registration)

1. Start als organisator een live sessie (zie hieronder).
2. Zet onder Live sessie "Inschrijving open" aan en stel eventueel een capaciteit in.
3. Deel de inschrijflink (kopieer/deel-knop) of laat de TV-weergave zien: die toont een QR-code met "Scan om mee te doen".
4. Atleten openen de link, vullen naam en divisie in en staan direct in de lobby ("Nog indelen"). Boven de capaciteit belanden ze op de wachtlijst.
5. De organisator deelt ze in bij een heat. Verwijder je een ingedeelde atleet, dan schuift de oudste wachtlijster automatisch door.
6. Is de inschrijving dicht, dan toont de TV-QR "Scan voor live standen" (direct meekijken zonder invoerscherm).

## Live sessie instellen (eenmalig)

De live sync gebruikt een gratis [Supabase](https://supabase.com)-project:

1. Maak een Supabase-project aan.
2. Voer het script `heatboard-live-setup.sql` uit in de SQL Editor van Supabase (maakt de tabel `heatboard_events` aan, met open policies en realtime).
3. Vul in HeatBoard onder Opzet, Live sessie, Verbinding instellen de Supabase URL en anon key in. (Wie de app zelf host kan de constante `DEFAULT_SB` boven in `index.html` invullen, zodat ingeschreven atleten meteen verbinden zonder iets in te stellen.)
4. Start een live sessie als organisator; judges, TV en atleten doen mee met de sessiecode of via de link/QR.

## Ontwikkeling

Eén bestand (`index.html`) met alle HTML, CSS en JavaScript. Geen build-stap, geen dependencies. UI is tweetalig (NL/EN); elke tekst-string staat in beide `I18N`-maps. Deploy via GitHub Pages vanaf de `main`-branch.
