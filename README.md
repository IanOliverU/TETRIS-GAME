# TETRIS BATTLE — last-one-standing (Vercel + Supabase Realtime)

No accounts. Name lives in tab memory only. Refresh = new player.

## Run
```bash
npm install
npm run dev
```

## Realtime setup (2 min, required for multiplayer)
1. supabase.com → New project → Project Settings → API.
2. Copy URL + `anon` key into `.env.local` (see `.env.example`):
```bash
NEXT_PUBLIC_SUPABASE_URL=https://xyzcompany.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```
3. No tables needed — Broadcast + Presence only (ephemeral).
4. Without env vars the app runs in solo/local mode.

## Deploy to Vercel
1. Push to GitHub, Import in Vercel.
2. Add the two env vars above in Vercel → Settings → Environment Variables.
3. Deploy. Invite link: `https://<app>.vercel.app/game/<CODE>`.

## Flows
- `/` → `WHAT'S YOUR NAME?` → main menu → CREATE (6-char code) or JOIN.
- `/game/A7K92X` → name modal FIRST → auto-join lobby.
- Lobby: players, copy/share invite, max-players + garbage mode (host),
  chat (200 chars, 1/2s), playlist (YouTube plays, Spotify link-only, 3/player,
  deduped), visible 220px YouTube mini-player (terms-compliant, never hidden),
  per-player mute/volume, START (host, 3-2-1-GO via shared `startAt`).
- Game: local SRS Tetris (ghost, hold, 5 next, DAS/ARR, touch controls),
  T-spin 3-corner detection, garbage pending/cancel/insertion, targeting
  RANDOM/ATTACKERS/TARGETED (T/Q/E + click), 2Hz compact status broadcast,
  mini-boards, survivors count, survival-placement results, spectator focus.
- Phase 2 battle rules: Single 0 · Double 1 · Triple 2 · Quad 4 ·
  T-spin 2/4/6 · B2B +1 · Combo +1~3 (cap 8). Pending grace by mode
  (Chill 1200ms / Normal 1000ms / Spicy 800ms), auto-cancel 1:1,
  max 8 pending (overflow deferred), max 5 rows/500ms, heat dampening.

## Rules kept
- No localStorage / sessionStorage / cookies / IndexedDB / accounts anywhere
  (verified). Identity = `crypto.randomUUID()` in React state.
- Board sim client-side; network carries events + 2Hz status only.
- Private rooms by code, host = oldest presence, auto-migrates.
