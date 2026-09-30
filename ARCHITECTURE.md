# NETWORK AUDIT — why not full-mesh P2P for 10–15 players

## Existing project (audited)
- Next.js 14 + Tailwind, `lib/tetris/engine.ts` (SRS, 7-bag, scoring), `constants.ts`,
  `room.ts` (code gen), `youtube.ts` (link parse). No net code yet.
  `trystero` was listed in package.json but unused → cheap to replace.

## Proposed before audit: Trystero full-mesh P2P, no server
Each browser opens WebRTC DataChannels to every other browser via public
BitTorrent trackers. Vercel hosts only static frontend.

### Why it fails at 10–15 competitive players
1. **Connections:** 15 players = 105 peer connections. Data-only mesh can work at
   3–4 players, degrades hard at 10–15 (join storms, re-negotiation, mobile uplink).
2. **No TURN guarantee:** ~10–20% of home/campus NATs need TURN. Public tracker
   config has none → random friends can't connect with no error you can fix.
3. **Presence/host migration:** no authoritative roster. `onPeerJoin/Leave` is mesh
   heuristics. Host state (playlist, chat, config, seed) is lost if host leaves;
   migration is manual and racy.
4. **Late join:** new peer must discover 14 peers via tracker (5–15s) then beg
   someone for full lobby snapshot — race between 14 responders.
5. **Broadcast cost:** chat/playlist/attack to all = 14 sends per client.
   2Hz board status × 15 = 420 msgs/s network-wide, all from phone uplinks.
6. **No history/observability:** no chat/playlist persistence for late joiners,
   no rate limiting, no moderation hook.
7. **Vercel:** frontend-only is fine, but you get zero relay help.

Verdict: fine for a 2–4 player prototype, **unsuitable for 10–15-player
garbage battles + host migration + spectators + chat + playlist sync**.

## Smallest fix (gameplay rules unchanged)
Keep everything that matters:
- Vercel static frontend (no custom WebSocket server to deploy).
- Client-side Tetris simulation (board, SRS, T-spin, garbage rendering).
- No accounts, session-only in-memory identity.

Swap exactly one layer:
- **Remove:** Trystero mesh.
- **Add:** Supabase Realtime star relay — one WebSocket per client to Supabase,
  channel `tetris:<CODE>`, **Broadcast** for events + **Presence** for roster/host.
  Anon key, no tables, no auth, ephemeral only.

Why this is smallest:
- No new deploy target (Supabase managed, Vercel stays static + env vars).
- Same event names, same game rules, same UI. Only transport changes mesh→star.
- Host election becomes deterministic (lowest `joinedAt` in Presence).
- Late join = `request_state` → host `room_state` (single responder).
- Broadcast fan-out done server-side, not on phones. Works behind NAT (wss/443).
- Missing env vars → local/solo fallback so dev/preview never crashes.

## Traffic shape (event-only)
LOCAL (never sent): piece x/y/rotation per frame, collision, gravity, animation.
NETWORK (Broadcast): joined/ready, request_state/room_state, chat (≤1/2s),
playlist_add/remove (≤1/10s), music_state, game_start {startAt, seed, order},
attack {toId, amount}, eliminated {place}, status 2Hz {score, lines, level,
alive, pending, board[20] compact ~200B}, game_end {placements}.

15 players × 2Hz status = 30 inbound/s, ~450 fan-out/s — well within Supabase
Realtime free tier for friend groups. Attacks are rare (~1/s lobby-wide).

## Alternatives rejected
- Pusher/Ably: same shape, faster to hit paid limits.
- PartyKit/Cloudflare DO: requires second deploy, bigger change.
- Custom ws on Vercel: Vercel serverless has no persistent connections.
