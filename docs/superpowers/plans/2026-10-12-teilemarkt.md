# TeileMarkt Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Statische willhaben-ähnliche Demo-Site für Ersatzteile mit Kompatibilitäts-Ampel bauen.

**Architecture:** Separates Vite-Projekt in `../teilemarkt/`, rein clientseitig, JSON-Daten + localStorage, 5 Seiten via Multi-Page Vite-Build.

**Tech Stack:** Vite 6+, Tailwind CSS v4 (@tailwindcss/vite), Vanilla JS ES-Module, Vitest für compat-Tests.

**Spec:** `docs/superpowers/specs/2026-10-12-teilemarkt-design.md`

## Global Constraints

- Neues Projekt in `../teilemarkt/`, unabhängig von `photography-club/`, kein Shared-Code.
- Kein Backend, kein Auth, kein Payment – nur Frontend + JSON + localStorage.
- Kategorien V1: Auto, Motorrad, Boot, Flugzeug, Traktor, LKW, Sonstige.
- Kompat-Status immer einer von `gruen|gelb|rot` mit `reasons: string[]`.
- Mobil responsiv, Deutsch als UI-Sprache.

## Review Focus

- Teil ohne `modelle`-Array oder ohne `baujahrVon/Bis` darf Kompat-Check nicht crashen – erwartet gelb mit Reason.
- Maschine ohne Baujahr → kein False-Green, erwartet Hinweis statt Ampel.
- Filter „Nur kompatibel“ ohne gespeicherte Maschine → erwartet Empty-State mit CTA, kein Absturz.
- localStorage korrupt (ungültiges JSON) → erwartet Fallback auf Demo-Daten + Warnbanner.
- Bild-URL 404 → erwartet Placeholder via onerror, kein Broken-Layout.

---

### Task 1: Projekt-Scaffolding teilemarkt/

**Files:**
- Create: `../teilemarkt/package.json`
- Create: `../teilemarkt/vite.config.js`
- Create: `../teilemarkt/index.html`
- Create: `../teilemarkt/markt/index.html`
- Create: `../teilemarkt/teil/index.html`
- Create: `../teilemarkt/maschinen/index.html`
- Create: `../teilemarkt/inserieren/index.html`
- Create: `../teilemarkt/src/input.css`
- Create: `../teilemarkt/src/main.js`

**Interfaces:**
- Consumes: nichts
- Produces: `src/main.js` exportiert `initLayout(activeNav: string) -> void`; Vite Multi-Page Build mit 5 Entries.

- [ ] **Step 1: package.json + vite.config.js + input.css erstellen**

In `../teilemarkt/package.json`: name `teilemarkt`, type module, scripts dev/build/preview/test, deps tailwindcss + @tailwindcss/vite, devDeps vite + vitest + jsdom.
In `vite.config.js`: tailwindcss Plugin, rollupOptions input mit home, markt, teil, maschinen, inserieren.
In `src/input.css`: `@import "tailwindcss";` plus 2 Custom-Klassen `.card` und `.badge`.

- [ ] **Step 2: Verifizieren dass dev-Server startet**

Run: `cd ../teilemarkt; npm install; npm run dev`
Expected: Vite läuft ohne Fehler (kurz starten, dann stoppen).

- [ ] **Step 3: Basis-HTML + initLayout implementieren in `src/main.js`**

Signatur: `initLayout(activeNav: string) -> void` – rendert Header (Logo TeileMarkt, Suche, Nav Markt/Inserieren/Meine Maschinen) + Footer in `#app-header` / `#app-footer`. Alle 5 HTML-Dateien enthalten `<div id=\"app-header\">`, `<main>`, `<div id=\"app-footer\">` und laden `/src/main.js` als module.

- [ ] **Step 4: Build prüfen**

Run: `npm run build`
Expected: PASS, `dist/` mit 5 HTML-Dateien.

- [ ] **Step 5: Commit**

```bash
git add ../teilemarkt
git commit -m "feat(teilemarkt): scaffolding vite multi-page demo"
```

### Task 2: Demo-Daten parts + machines

**Files:**
- Create: `../teilemarkt/src/data/parts.json`
- Create: `../teilemarkt/src/data/machines-demo.json`
- Create: `../teilemarkt/public/placeholder.svg`

**Interfaces:**
- Consumes: nichts
- Produces: `parts.json: Part[]` (24 Einträge), `machines-demo.json: Machine[]` (3 Einträge). Felder exakt wie Spec §4.

- [ ] **Step 1: parts.json mit 24 Teilen schreiben**

Je Kategorie mindestens 2: Auto (VW Golf 7 Bremsscheibe 5Q0615301H, Passat Ölfilter, BMW E46 Querlenker, Audi A4 Turbo), Motorrad (KTM Duke Kette, BMW R1250 Bremsbelag), Boot (Mercury Propeller, Volvo Penta Impeller), Flugzeug (Cessna 172 Zündkerze, Piper Ölfilter), Traktor (John Deere Filter-Kit, Fendt Hydraulikpumpe), LKW (MAN Bremsbelag, Volvo FH Luftfilter), Sonstige (2x). Jedes mit id p001-p024, titel, kategorie, marke, modelle[], baujahrVon/Bis, oem[], zustand (Neu/Gebraucht/Generalüberholt), preis, standort (Wien/Graz/Linz...), bilder (picsum seed), beschreibung 1-2 Sätze, verkaeufer Demo-Name.

- [ ] **Step 2: machines-demo.json + placeholder.svg**

3 Maschinen: VW Golf 7 2016 Auto, KTM 390 Duke 2022 Motorrad, Mercury 150PS Außenborder 2019 Boot. placeholder.svg: graues 600x400 SVG mit Text „Kein Bild“.

- [ ] **Step 3: JSON validieren**

Run: `node -e "JSON.parse(require('fs').readFileSync('../teilemarkt/src/data/parts.json','utf8'));JSON.parse(require('fs').readFileSync('../teilemarkt/src/data/machines-demo.json','utf8'));console.log('ok')"`
Expected: `ok`, 24 Teile.

- [ ] **Step 4: Commit**

```bash
git add ../teilemarkt/src/data ../teilemarkt/public
git commit -m "feat(teilemarkt): demo daten 24 teile 3 maschinen"
```

### Task 3: Kompat-Logik + Tests

**Files:**
- Create: `../teilemarkt/src/lib/compat.js`
- Test: `../teilemarkt/tests/compat.test.js`

**Interfaces:**
- Consumes: `Part`, `Machine` Typen aus Spec §4
- Produces: `checkCompatibility(part: Part, machine: Machine|null) -> {status: 'gruen'|'gelb'|'rot', reasons: string[]}`; `getBestStatus(part, machines) -> same`.

- [ ] **Step 1: Failing tests schreiben**

```js
import { describe, it, expect } from 'vitest';
import { checkCompatibility } from '../src/lib/compat.js';
describe('compat', () => {
  it('gruen bei Marke+Modell+Baujahr Treffer', () => {
    const r = checkCompatibility({kategorie:'Auto',marke:'VW',modelle:['Golf 7'],baujahrVon:2012,baujahrBis:2020,oem:['5Q0615301H']},{kategorie:'Auto',marke:'VW',modell:'Golf 7',baujahr:2016});
    expect(r.status).toBe('gruen');
  });
  it('rot bei Kategorie-Mismatch', () => {
    const r = checkCompatibility({kategorie:'Boot',marke:'Mercury',modelle:[],baujahrVon:2015,baujahrBis:2022,oem:[]},{kategorie:'Auto',marke:'VW',modell:'Golf 7',baujahr:2016});
    expect(r.status).toBe('rot');
  });
  it('gelb bei Marke ok aber Modell abweichend', () => {
    const r = checkCompatibility({kategorie:'Auto',marke:'VW',modelle:['Passat B8'],baujahrVon:2014,baujahrBis:2022,oem:[]},{kategorie:'Auto',marke:'VW',modell:'Golf 7',baujahr:2016});
    expect(r.status).toBe('gelb');
  });
  it('kein Crash ohne modelle-Array', () => {
    const r = checkCompatibility({kategorie:'Auto',marke:'VW',baujahrVon:2012,baujahrBis:2020,oem:[]},{kategorie:'Auto',marke:'VW',modell:'Golf 7',baujahr:2016});
    expect(['gruen','gelb','rot']).toContain(r.status);
  });
  it('null-Maschine gibt rot mit CTA-Reason', () => {
    const r = checkCompatibility({kategorie:'Auto',marke:'VW',modelle:['Golf 7'],baujahrVon:2012,baujahrBis:2020,oem:[]}, null);
    expect(r.status).toBe('rot');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ../teilemarkt && npx vitest run tests/compat.test.js`
Expected: FAIL with „Failed to resolve import ... compat.js“.

- [ ] **Step 3: Implement `checkCompatibility` + `getBestStatus` in `src/lib/compat.js`**

Regeln aus Spec §5: Kategorie mismatch → rot. Sonst Marke+Modell+Baujahr prüfen, Score wie Spec. `modelle` optional (fehlend → behandeln als leer). `machine null/ohne baujahr` → rot mit reason „Lege deine Maschine an“. `getBestStatus(part, machines)` wählt besten Status (gruen > gelb > rot).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ../teilemarkt && npx vitest run tests/compat.test.js`
Expected: PASS, 5 passed.

- [ ] **Step 5: Commit**

```bash
git add ../teilemarkt/src/lib/compat.js ../teilemarkt/tests/compat.test.js
git commit -m "feat(teilemarkt): kompat check gruen gelb rot"
```

### Task 4: Store (localStorage) + Render-Helpers

**Files:**
- Create: `../teilemarkt/src/lib/store.js`
- Create: `../teilemarkt/src/lib/render.js`

**Interfaces:**
- Consumes: `checkCompatibility`, `getBestStatus` aus Task 3
- Produces: `store.js`: `loadMachines()->Machine[]`, `saveMachines(m)`, `getDefaultMachineId()->string|null`, `loadCustomParts()->Part[]`, `saveCustomPart(p)`, `toggleFav(id)`, `isFav(id)->bool`. `render.js`: `partCard(part, status)->string`, `statusBadge(status)->string`, `attachImgFallback(scope)`.

- [ ] **Step 1: store.js implementieren**

Keys: `tm_machines`, `tm_default`, `tm_custom_parts`, `tm_favs`. Alle Loads mit try/catch → Fallback `[]`/`null`. Bei Erststart ohne `tm_machines`: machines-demo.json per fetch laden und seeden (async `ensureSeeded()`).

- [ ] **Step 2: render.js implementieren**

`statusBadge`: gruen→grüner Pill „Passt“, gelb→„Prüfen“, rot→„Passt nicht“. `partCard`: willhaben-Kachel (Bild, Preis €-Format, Titel, Marke/Modell, Standort, Badge). `attachImgFallback`: alle `img[data-fallback]` bekommen onerror → `/placeholder.svg`. Kein Crash bei korruptem localStorage (Review-Focus-Test manuell prüfen).

- [ ] **Step 3: Manuell verifizieren**

Run: `cd ../teilemarkt && npx vitest run; npm run build`
Expected: Tests PASS, Build PASS.

- [ ] **Step 4: Commit**

```bash
git add ../teilemarkt/src/lib/store.js ../teilemarkt/src/lib/render.js
git commit -m "feat(teilemarkt): store und render helpers"
```

### Task 5: Seiten Home, Markt, Detail, Maschinen, Inserieren

**Files:**
- Modify: `../teilemarkt/index.html`, `../teilemarkt/markt/index.html`, `../teilemarkt/teil/index.html`, `../teilemarkt/maschinen/index.html`, `../teilemarkt/inserieren/index.html`
- Create: `../teilemarkt/src/pages/home.js`, `markt.js`, `teil.js`, `maschinen.js`, `inserieren.js`

**Interfaces:**
- Consumes: store.js, render.js, compat.js aus Task 3–4
- Produces: 5 funktionierende Seiten gemäß Spec §6.

- [ ] **Step 1: home.js + index.html**

Hero-Suche (Text + Kategorie → Link auf `/markt/?q=&kat=`), 6 Kategorie-Kacheln, „Neueste Teile“ (erste 8 aus parts.json + custom). initLayout('home').

- [ ] **Step 2: markt.js + Filter**

URL-Params q, kat, marke, bis (Preis), zustand, kompatibel. Sidebar-Filter + Sort (preis-asc/desc/neu). „Nur kompatibel“ nutzt Default-Maschine + getBestStatus; ohne Maschine → Empty-State mit CTA-Link auf /maschinen/. Grid responsive.

- [ ] **Step 3: teil.js Detail + Ampel-Panel**

`?id=p001` laden (parts + custom). Galerie, Preis, Tabelle (OEM, Baujahre, Modelle), Beschreibung. Kompat-Panel: Liste aller Maschinen mit Badge + Reasons; ohne Maschine → CTA. Favorit-Toggle. Unbekannte ID → „Teil nicht gefunden“ + Zurück-Link.

- [ ] **Step 4: maschinen.js + inserieren.js**

Maschinen: Liste + Form (Name, Kategorie-Select, Marke, Modell, Baujahr number, Motor), Default setzen, Löschen. Inserieren: Form (Titel, Kategorie, Marke, Modelle komma-getrennt, Von/Bis, OEM komma-getrennt, Zustand, Preis, Standort, Beschreibung) → validiert (Titel, Kategorie, Preis Pflicht) → `saveCustomPart` mit id `c-<timestamp>` → Redirect auf Detail mit Badge „Dein Inserat“.

- [ ] **Step 5: Build + Klickpfad prüfen**

Run: `cd ../teilemarkt && npm run build`
Expected: PASS. Manuell: Home → Suche „Bremse“ → Markt gefiltert → Detail p001 mit Demo-Golf grün, mit Boot rot → Maschinen anlegen → Inserieren.

- [ ] **Step 6: Commit**

```bash
git add ../teilemarkt/index.html ../teilemarkt/markt ../teilemarkt/teil ../teilemarkt/maschinen ../teilemarkt/inserieren ../teilemarkt/src/pages
git commit -m "feat(teilemarkt): alle 5 seiten demo fertig"
```
