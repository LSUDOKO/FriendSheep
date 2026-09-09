# 🐏 FriendSheep

**Charge. Headbutt. Steal their points.**
A 3-minute ram brawl for Decentraland, built for phones.

Submission for the **Decentraland Friendzone Mobile Buildathon**.

---

## The game

You are a ram. So is everyone else. Hold the button to wind up a charge, let go to
launch yourself, and slam into somebody — the harder the charge and the worse their
angle, the more of their points you take.

- **Score is everything.** It's your health, your wallet, and your rank. There is no
  separate health bar.
- **Hit them from the side or behind** and you take 30% of their score. Head-on is
  20%. If you both charge each other at once it's a **duel**, and the bigger charge wins.
- **Sheep** wander the field. Walk into one and you're rooted for 1.5s while you shear
  it, then +10. They bolt when you get close, so herding one into a corner is its own
  little game.
- **The barn is the Friendzone** — 6 seconds of total safety, then a 15-second lockout.
  Nobody can touch you in there, which makes it the one place you can stop and talk.
- Rounds run **180 seconds**, then a podium hands out titles — THE ROBBER, RAM-BO,
  ROADKILL, WALLFLOWER — and the next round starts on its own.

**You never get eliminated.** Your score floors instead of knocking you out, because
staring at a dead screen on a phone is not a game.

---

## Built for mobile first

- **One button.** Hold anywhere on the RAM pad to charge, release to fire. It
  auto-fires at full charge, so a slipped finger never leaves you stuck.
- **Aim by steering.** There's no mouselook on mobile (`screenDelta` is always 0), so
  the joystick that moves you also aims you. Point, hold, release.
- Big flat HUD blocks, no rounded corners (unsupported on mobile UI), high contrast,
  everything readable at arm's length.
- Runs on primitives and a handful of entities — about **18% of the entity budget** for
  4 parcels.

---

## Running it

```bash
cd scene
npm install
npm run start              # desktop preview
npm run start -- --mobile  # QR code, scan with the Decentraland app
```

Deploy to a World (set `worldConfiguration.name` in `scene.json` first):

```bash
npx @dcl/sdk-commands deploy --target-content https://worlds-content-server.decentraland.org
```

---

## How it's put together

```
scene/src/
  rules/        config.ts, combat.ts, names.ts  ← ported verbatim
  net/          synced components + message bus
  systems/      charge, hit, sheep, bots, barn, presence
  ui/           React-ECS HUD + touch controls
  arena.ts      ground, fence, barn, props
  round.ts      round clock, podium, titles
```

### The interesting problem

A scene **cannot move a player's avatar**. Writing to `Transform` on
`engine.PlayerEntity` silently does nothing, and `Physics.applyKnockbackToPlayer`
only ever affects the *local* player. So a hit has to round-trip:

```
ATTACKER                                  VICTIM
detects the overlap while dashing
resolveHit() decides the outcome
broadcasts {victim, angle, knock, stolen}
      ──── MessageBus ────────────▶
                                          "that's me"
                                          applies its own knockback
                                          debits its own score
```

Each client owns exactly one row of synced state — its own — so the CRDT's
last-write-wins never actually fires.

### Reused from the original

This started as a Three.js browser game (kept in [`web/`](web/) for reference).
SDK7 runs in a QuickJS sandbox with no DOM and no WebGL, so none of the rendering
survived — but **330 lines of pure game rules ported without a single change**:

| File | What it does |
|---|---|
| `rules/config.ts` | Every tuning constant. Zero imports |
| `rules/combat.ts` | `resolveHit()` — flank/front/duel, steal amounts, knockback |
| `rules/names.ts` | The name pool and the podium titles |

---

## Known limitations

**Hits are client-authoritative.** A modified client could claim a hit it didn't land.
There are sanity clamps — a hit is ignored if the attacker is more than 5m away, if the
knockback is absurd, or if the steal is disproportionate to your score — but they are
speed bumps, not security.

Doing this properly needs the authoritative Multiplayer Server (`@dcl/sdk@auth-server`),
where clients send *intent* and the server is the only writer of game state. That's the
obvious next step; it wasn't a safe mid-project SDK branch switch on a hackathon clock.

`syncEntity` state also resets once the scene is completely empty, so scores are
per-session. A persistent cross-session leaderboard would need a real backend.

---

## License

Apache 2.0 — see [LICENSE](LICENSE).
