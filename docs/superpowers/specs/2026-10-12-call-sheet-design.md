# Call Sheet pro Projekt — Design

Stand: 2026-10-12 · Status: Entwurf, wartet auf Review · Pfad: architectural (Brainstorming)

## 1. Ziel

Jedes Projekt bekommt ein Call Sheet für den Drehtag: Call-Time, Treffpunkt,
Rollenbesetzung, Tagesablauf, Logistik-Infos, Notfallkontakte. Ersetzt die
verstreute Chat-Orga durch eine verbindliche Seite pro Projekt, inkl.
Druckansicht fürs Set.

Ergebnis des Ideen-Spikes: Call Sheet als Kern, Mitfahrbörse optional später.
Eigene Social-Plattform und Willhaben-Klon explizit verworfen (Overkill).

## 2. Festlegungen aus dem Brainstorming

- Inhalt v1: Call-Time & Treffpunkt (aus Projekt vorbelegt), Rollenbesetzung,
  Tagesablauf, Logistik-Infos, Notfallkontakte.
- Pflege: Projekt-Head oder Admin (Muster: Reminder-Toggle).
- E-Mail an alle Projektmitglieder nur bei Erstveröffentlichung (deutsch).
- Rollen: feste Liste — Kamera, Ton, Regie, Schnitt, Foto, Schauspiel,
  Organisation, Fahrer.
- Sprache: UI, Fehler und Mails auf Deutsch.
- Gestrichen (YAGNI): Versionierung, Wetter-API, Mail bei jeder Änderung.

## 3. Datenmodell

- `call_sheets`: `project_id` (PK, FK → genau ein Sheet pro Projekt),
  `call_time` (TEXT, ISO), `meeting_point` (TEXT), `schedule` (TEXT),
  `logistics` (TEXT), `emergency_contacts` (TEXT),
  `published_at` (NULL = Entwurf), `created_at`, `updated_at`.
- `call_sheet_roles`: `id`, `project_id`, `role` (nur aus fester Liste),
  `user_id` (NULL = unbesetzt), UNIQUE(`project_id`, `role`).
- Projekt löschen räumt Sheet + Rollen mit weg (wie Mitgliedschaften/Fotos).

## 4. API + E-Mail

- `GET /api/projects/:id/callsheet` (Mitglied) — Sheet + Rollen; ohne Sheet
  leere Vorlage statt Fehler (alle Textfelder null, alle acht Rollen
  unbesetzt).
- `PUT /api/projects/:id/callsheet` (Head oder Admin, sonst 403) — Upsert von
  Sheet + Rollen in einem `DB.batch()`; validiert Rollen gegen feste Liste
  und `user_id` gegen alle registrierten Mitglieder (Crew muss nicht
  Projektmitglied sein).
- `POST /api/projects/:id/callsheet/publish` (Head oder Admin) — setzt
  `published_at` nur beim ersten Mal und mailt einmalig alle
  Projektmitglieder (Call-Time, Treffpunkt, Projekt-Link). Zweitversuch → 409.
- Resend-Muster wie Bestand; Fehler und Mails deutsch.

## 5. Frontend

- Abschnitt „Call Sheet" auf der Projekt-Detailseite: Call-Time, Treffpunkt,
  Rollen (Name oder „unbesetzt"), Ablauf, Logistik, Kontakte.
- Head/Admin: Bearbeiten- und Veröffentlichen-Buttons, Drucken-Button
  (`window.print`, Muster: Versammlungspack). Formular im Projekt-Stil.
- Speichern ohne Veröffentlichen = stiller Entwurf. Keine neue Route, kein
  neuer Nav-Punkt, Rest der Seite unverändert.

## 6. Randfälle + Tests

- Gelöschte/ausgetretene Rollenmitglieder → „unbesetzt". Publish ohne
  Mitglieder → veröffentlicht ohne Mail. Nicht-Head → 403.
- Workers-Tests: Rechte, Rollen-Validierung, Batch-Upsert, genau eine Mail
  beim Erst-Publish, 409 beim zweiten. Root-Tests: Anzeige, Formular,
  Drucken-Button. Build muss passen.
