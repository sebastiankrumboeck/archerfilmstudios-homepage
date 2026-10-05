INSERT INTO users (id, email, pass_hash, name, function, is_admin, is_vorstand, vorstand_title, created_at) VALUES
  ('u-owner', 'archerfilmstudios@gmail.com', '1e05d6890bb3751e49eee00d0ce1e0fb$38cc9efcd6b50ee5014046c9733f961a0d7d3fab0cfcf0fa7082c39812ed0cc0', 'Archer Studios', 'Organization', 1, 1, 'Board', '2026-01-01T00:00:00Z'),
  ('u-vor-2', 'vorstand2@archerfilmstudios', '1e05d6890bb3751e49eee00d0ce1e0fb$38cc9efcd6b50ee5014046c9733f961a0d7d3fab0cfcf0fa7082c39812ed0cc0', 'Vorstand Mitglied', 'Camera', 0, 1, 'Board', '2026-01-01T00:00:00Z'),
  ('u-vor-3', 'vorstand3@archerfilmstudios', '1e05d6890bb3751e49eee00d0ce1e0fb$38cc9efcd6b50ee5014046c9733f961a0d7d3fab0cfcf0fa7082c39812ed0cc0', 'Vorstand Mitglied', 'Editing', 0, 1, 'Board', '2026-01-01T00:00:00Z');
INSERT INTO projects (id, title, description, intensity, location, start_at, end_at, max_members, created_by, created_at) VALUES
  ('p-city', 'City Lights — Night Shoot', 'Nacht-Fotowalk durch die Stadt.', 1, 'Berlin', '2026-11-08T18:00:00Z', '2026-11-08T22:00:00Z', 12, 'u-owner', '2026-01-01T00:00:00Z'),
  ('p-short', 'Short Film Weekend', '48h short film from idea to final edit.', 3, 'Berlin / Online', '2026-11-15T09:00:00Z', '2026-11-17T18:00:00Z', 8, 'u-owner', '2026-01-01T00:00:00Z'),
  ('p-doku', 'Doku-Expedition', 'Mehrtaegige Reise-Doku, hohe Intensitaet.', 5, 'Worldwide', '2026-12-01T08:00:00Z', '2026-12-07T20:00:00Z', 5, 'u-owner', '2026-01-01T00:00:00Z');
