# Crew-Bedarf + Ideenbox — Design

Stand: 2026-10-12 · Status: Entwurf, wartet auf Review · Pfad: architectural (Brainstorming)

## 1. Ziel

Zwei neue Abläufe rund um Projekte: (a) offene Call-Sheet-Rollen werden
ausgeschrieben, Mitglieder bewerben sich, der Head bestätigt; (b) zentrale
Ideenbox, über die Mitglieder Titel, Autor-Name und Skript-PDF einreichen,
die per Mail an die Club-Adresse gehen.

## 2. Festlegungen aus dem Brainstorming

- Crew: Bewerbung → Bestätigung durch Head (keine Direktvergabe).
- Ideenbox: zentral als eigene Mitglieder-Seite, nicht pro Projekt.
- Empfänger: Club-Adresse · PDF-Zustellung: Download-Link aus R2 statt Anhang.
- Ansatz A (voll integriert); verworfen: Crew per Mail (B), externes
  Formular-Tool (C).
- Sprache: UI, Fehler und Mails auf Deutsch.
- Gestrichen (YAGNI): Voting auf Ideen, Bewerbungsfristen, Mehrfach-Skripte
  pro Idee, Status-Workflow für Ideen.

## 3. Datenmodell

- `role_applications`: `id`, `project_id`, `role` (feste Call-Sheet-Liste),
  `user_id`, `status` (`pending`/`approved`/`rejected`), `decided_by`,
  `created_at`, `decided_at`. UNIQUE(`project_id`, `role`, `user_id`).
- Zusage schreibt `call_sheet_roles.user_id` und lehnt konkurrierende
  Pendings derselben Rolle automatisch ab — alles in einem `DB.batch()`.
- `ideas`: `id`, `title`, `author_name` (Freitext), `script_r2_key`
  (NULL bis Upload fertig), `created_by`, `created_at`. Kein Status.
- PDFs in R2 unter `scripts/`; Download `GET /scripts/:key` nur für Mitglieder.

## 4. API + E-Mail

- `POST /api/projects/:id/roles/apply` (Mitglied) — `{role}`; besetzte Rolle
  oder Doppelbewerbung → 409, alles deutsch.
- `POST /api/role-applications/:id/decision` (Head oder Admin, sonst 403) —
  `{approved}`; Bewerber erhalten deutsche Zu-/Absage-Mail.
- Offene Bewerbungen hängen an `GET /api/projects/:id/callsheet` (Bewerbernamen
  nur für Head/Admin).
- `POST /api/ideas` (`{title, author_name}`) → `POST /api/ideas/:id/script`
  (nur `application/pdf`, max. 40 MB → 413/415) → Mail an Club-Adresse mit
  Titel, Autor, Download-Link. Ohne `RESEND_API_KEY`: speichern + `sent: false`.

## 5. Frontend

- Projektseite, Abschnitt „Offene Rollen": unbesetzte Rollen mit
  „Bewerben"-Button (Bestätigungs-Popup); Head/Admin sieht Bewerber mit
  „Bestätigen"/„Ablehnen"; besetzte Rollen zeigen Namen.
- Neue Seite „Ideenbox" (Nav-Punkt, login-geschützt): Titel, Autor-Name,
  PDF-Upload (Hinweis 40 MB / nur PDF), „Absenden", danach Bestätigung;
  eigene Einreichungen als Liste (Titel + Datum).
- Neue Seite im Vite-MPA-Setup registrieren; Stil und Rest unverändert.

## 6. Randfälle + Tests

- Bewerbung auf inzwischen besetzte Rolle → 409; ausgetretener Bewerber →
  „ehemaliges Mitglied"; Absenden ohne PDF → 400; falscher Typ → 415.
- Projekt löschen räumt Bewerbungen mit weg; Ideen sind projektlos.
- Workers-Tests: Rechte, Doppelbewerbung, Zusage besetzt + lehnt Konkurrenz
  ab, Mails, Ideen-Validierung, Mail-Link. Root-Tests: Popup, Bewerberliste,
  Formular inkl. Upload. Build muss passen.
