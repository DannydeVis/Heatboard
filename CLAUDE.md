# HeatBoard

Single-file PWA: een HYROX-achtige heat-timing scoreboard (runs + stations, heats, splits, klassement, TV-weergave). Alles — HTML, CSS en JavaScript — staat in `index.html`. Geen build-stap, geen dependencies; open het bestand in een browser of serveer het statisch.

## Workflow

- **Push wijzigingen direct naar `main`.** Geen pull requests aanmaken — de eigenaar wil geen PR-stap.

## Conventies

- UI is tweetalig (NL/EN). Elke nieuwe tekst-string moet in **beide** `I18N`-maps in `index.html` (nl én en), en in de HTML via `data-i18n` / `data-i18n-ph` attributen.
- State wordt automatisch opgeslagen in localStorage (`heatboard_v1`) via `save()`; hergebruik bestaande helpers (`showView`, `renderAll`, `toast`, `esc`) en styling-classes (`.card`, `.field`, `.btn*`, `.format-opt`, `.chip`).
- Standaardtaal van de app en van commit-teksten richting de eigenaar: Nederlands.
