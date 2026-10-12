# TeileMarkt – Design Spec (Demo V1)

Datum: 2026-10-12
Status: Approved Design (Ansatz A)
Unabhängig von ArcherFilmStudios / photography-club

## 1. Verständnis / Ziel

Willhaben-ähnlicher Marktplatz nur für Ersatzteile (Auto, Motorrad, Boot, Flugzeug, Traktor/Landmaschine, LKW).
Kern-Feature: Kompatibilitäts-Check „passt dieses Teil zu meiner Maschine?“ anhand Marke/Modell/Baujahr + OEM-Nummern.
V1 ist bewusst **Nur Demo ohne Login**: Katalog, Suche/Filter, Detailseite, Meine Maschinen (localStorage), Inserieren (nur lokal).

Erfolg: Nutzer findet in <30s ein Teil, sieht sofort Ampel grün/gelb/rot pro eigener Maschine, alles mobil nutzbar, willhaben-Feeling (Kachel-Grid, Filter-Sidebar).

## 2. Ansatz-Entscheid

Gewählt: **A – Statische Demo**
- Neuer Ordner separat: `../teilemarkt/` (neben `photography-club/`), eigenes Vite-Projekt
- Vite + Tailwind CSS v4, Vanilla JS ES-Module, keine Backend-Abhängigkeit
- Daten als JSON, Bilder via Placeholder (picsum / inline SVG), hostbar als statisches `dist/` (Cloudflare Pages)
- Datenmodell bereits backend-kompatibel (IDs, OEM-Arrays, Kompat-Regeln) für spätere V2 mit Hono+D1+R2

Verworfen: B Full-Stack – Overkill für Demo-Wunsch, 5–10x Aufwand, als V2 vorgesehen.

## 3. Architektur

```
teilemarkt/
  index.html (Home + Suche)
  markt/index.html (Liste + Filter)
  teil/index.html (Detail + Kompat-Ampel)
  maschinen/index.html (Meine Maschinen CRUD localStorage)
  inserieren/index.html (Demo-Form, speichert nach localStorage)
  src/
    main.js (Routing-Helper, Layout)
    lib/store.js (localStorage Maschinen + Demo-Inserate)
    lib/compat.js (checkCompatibility(part, machine) -> {status, reasons[]})
    lib/render.js (Cards, Ampel-Badge)
    data/parts.json (~24 Teile)
    data/machines-demo.json (3 Beispiel-Maschinen)
    input.css (Tailwind)
  public/placeholder.svg
```

Kein Build-Backend, kein Auth. Alles clientseitig filterbar (<1000 Datensätze problemlos).

## 4. Datenmodell

Part:
```json
{
  "id": "p001",
  "titel": "Bremsscheibe vorne",
  "kategorie": "Auto",
  "marke": "VW",
  "modelle": ["Golf 7", "Passat B8"],
  "baujahrVon": 2012,
  "baujahrBis": 2020,
  "oem": ["5Q0615301H", "8V0615301"],
  "zustand": "Neu",
  "preis": 89.9,
  "standort": "Wien",
  "bilder": ["https://picsum.photos/seed/p001/600/400"],
  "beschreibung": "...",
  "verkaeufer": "Demo-Händler"
}
```

Machine (localStorage `tm_machines`):
```json
{
  "id": "m1",
  "name": "Mein Golf",
  "kategorie": "Auto",
  "marke": "VW",
  "modell": "Golf 7",
  "baujahr": 2016,
  "motor": "2.0 TDI",
  "vin": ""
}
```

Kategorien V1: Auto, Motorrad, Boot, Flugzeug, Traktor, LKW, Sonstige.

## 5. Kompatibilitäts-Logik (`lib/compat.js`)

`checkCompatibility(part, machine)`:
- Kategorie mismatch → `rot`, reason „Kategorie passt nicht“
- Sonst Score:
  - Marke gleich (+2), Modell in `modelle` (+2), Baujahr in [von,bis] (+2), OEM-Schnittmenge falls User OEM pflegt (+1 Bonus)
  - Score >=5 oder (Marke+Modell+Baujahr alle ok) → `grün` „Passt“
  - Nur Marke ok ODER Baujahr ±1 Jahr daneben → `gelb` „Wahrscheinlich / prüfen“
  - Sonst `rot`
- Rückgabe immer `{status: 'gruen'|'gelb'|'rot', reasons: string[]}` für UI-Badge + Tooltip.
- Detailseite zeigt Ampel pro gespeicherter Maschine, Liste zeigt Ampel für ausgewählte Standard-Maschine.

Edge: keine Maschine gespeichert → Hinweis-CTA „Lege deine Maschine an“, kein False-Green.

## 6. Seiten / UX (willhaben-Stil)

- Header: Logo „TeileMarkt“, Suche (Text + Kategorie), Nav Markt / Inserieren / Meine Maschinen
- Home: Hero-Suche, Kategorie-Kacheln (6), neueste Teile (8 Cards)
- Markt: Sidebar-Filter (Kategorie, Marke, Preis bis, Zustand, Nur kompatibel Checkbox) + Sort (Preis asc/desc, Neu), Grid 1/2/3/4-spaltig responsiv
- Card: Bild, Preis, Titel, Marke/Modell-Kurz, Standort, Ampel-Dot
- Detail: Galerie, Preis, Kompat-Panel (Ampel je Maschine), Daten-Tabelle (OEM, Baujahre, Modelle), Beschreibung, Verkäufer-Dummy, Favorit-Button (localStorage)
- Maschinen: CRUD-Form (Name, Kategorie, Marke, Modell, Baujahr, Motor), Set-Default
- Inserieren: Form → validiert → in localStorage `tm_custom_parts` + sofort in Markt sichtbar (Badge „Dein Inserat“)

## 7. Fehlerbehandlung / Leere Zustände

- JSON-Ladefehler → Fallback-Text + Retry
- Keine Treffer → Empty-State mit Filter-Zurücksetzen
- localStorage voll/defekt → try/catch, Fallback In-Memory + Warnbanner
- Bild-404 → onerror Placeholder

## 8. Test / Abnahme

- Manuell: Suche „Bremse“, Filter Auto/VW, Detail-Ampel mit Demo-Golf (erwarte grün), mit Boot (erwarte rot), ohne Maschine (CTA)
- Später Vitest für `compat.js` (grün/gelb/rot-Matrix) – in V1 optional, empfohlen 8 Fälle

## 9. Nicht-Ziele V1

Kein Login, kein Payment/Versand, kein Chat, keine echten User-Inserate am Server, keine FIN/VIN-Datenbank, keine Händler-Bewertungen. Alles V2 (Hono+D1+R2).

## 10. Nächster Schritt

writing-plans Skill → Implementierungsplan für `../teilemarkt/` Scaffolding, dann Build.
