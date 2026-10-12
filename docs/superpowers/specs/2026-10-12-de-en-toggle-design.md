# DE/EN-Umschaltung (Schritt 1) — Design

Stand: 2026-10-12 · Status: Entwurf, wartet auf Review · Pfad: architectural (Brainstorming)

## 1. Ziel

Deutsch/Englisch-Umschalter oben auf der Seite (zwei Buttons `DE / EN`),
der die Website-Sprache sofort umschaltet und die Wahl im Browser merkt.
Schritt 1 umfasst nur die öffentlichen Seiten; Rest folgt später.

## 2. Festlegungen aus dem Brainstorming

- Umfang: Navigation, Footer, Header-Button sowie Home, Films, Contact,
  Impressum (inkl. Formular-Labels, Buttons, Fehlermeldungen dieser Seiten).
- Draußen: Login-geschützte Seiten (Folgeschritte), E-Mails (bleiben
  deutsch), nutzergenerierte Inhalte (Projekttitel, Namen).
- Mechanik: sofort umschalten ohne Reload, Wahl in `localStorage`
  (`archer-lang`), Default `en`, keine Browser-Automatik.
- Deutsche Texte: Agent formuliert, Mensch prüft im Review.
- Ansatz A (zentrales Wörterbuch); verworfen: doppelte HTML-Seiten (B),
  eigene URLs (C).

## 3. Architektur

- Neu: `src/i18n/dict.js` (Schlüssel → `{en, de}`), `getLang()`/`setLang()`.
- Header: `DE / EN`-Buttons mit Hervorhebung der aktiven Sprache; Klick
  speichert + wendet sofort an.
- `mountLayout` initialisiert die Sprache; dynamische Views nutzen `t(key)`,
  statische Stellen `data-i18n="key"` plus Ersetzungsdurchlauf.
- `<html lang>` wird mitgesetzt (SEO); kein sichtbarer Design-Unterschied
  außer Texten und Button-Hervorhebung.

## 4. Verhalten + Tests

- Klick schaltet Schritt-1-Texte sofort um; Wahl überlebt Reloads;
  Erstbesuch Englisch.
- Tests: Wörterbuch-Vollständigkeit (jeder Schlüssel beidseitig, keine
  Leerwerte), Toggle-Roundtrip, Default-`en`, Button-Active-State.
- Danach beide Suiten + Build.
