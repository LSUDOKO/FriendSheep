import {
  KnockbackFalloff,
  Physics,
  Transform,
  engine,
} from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'

import { Player } from '../net/components'
import { HitMsg, MSG_HIT, bus } from '../net/bus'
import { resolveHit } from '../rules/combat'
import { emptyPowerups, emptyStats } from '../rules/types'
import { SCORE_FLOOR, asRam, local } from '../state'
import { KNOCK_IMPULSE, endDash } from './charge'
import { pushToast } from '../ui/hud'
import { isSheltered } from './barn'

/** Generous: synced positions are up to ~100ms stale at 10Hz. */
const HIT_RADIUS = 1.8
const VICTIM_COOLDOWN = 0.8

const cooldown = new Map<string, number>()
const seen = new Set<string>()

/**
 * ATTACKER SIDE. Physics only moves the local player, so we cannot knock the
 * victim ourselves — we detect, resolve, and broadcast the outcome.
 */
export function hitSystem(dt: number): void {
  if (!local.ready) return

  for (const [key, value] of cooldown) {
    const next = value - dt
    if (next <= 0) cooldown.delete(key)
    else cooldown.set(key, next)
  }

  if (!local.dashing) return

  const me = Transform.get(engine.PlayerEntity).position

  for (const [, p] of engine.getEntitiesWith(Player)) {
    if (p.address === local.address) continue
    if (cooldown.has(p.address)) continue

    const dist = Math.sqrt((p.px - me.x) ** 2 + (p.pz - me.z) ** 2)
    if (dist > HIT_RADIUS) continue

    const attacker = asRam(
      0,
      local.name,
      me.x,
      me.z,
      local.facing,
      Player.get(local.entity).score,
      'dashing',
      local.dashStrength,
      local.powerups,
      local.stats
    )
    const victim = asRam(
      1,
      p.name,
      p.px,
      p.pz,
      p.facing,
      p.score,
      p.dashing ? 'dashing' : 'idle',
      p.dashing ? p.charge : 0,
      emptyPowerups(),
      emptyStats()
    )

    const res = resolveHit(attacker, victim)
    if (!res) continue

    // resolveHit picks a winner; only broadcast when we actually won.
    const weWon = res.winner === attacker
    cooldown.set(p.address, VICTIM_COOLDOWN)

    if (weWon) {
      bus.emit(MSG_HIT, {
        atk: local.address,
        vic: p.address,
        kind: res.type,
        stolen: res.stolen,
        knock: res.loserKnock,
        sx: me.x,
        sz: me.z,
        nonce: ++local.nonce,
      } satisfies HitMsg)

      // Credit ourselves immediately — no round-trip lag on our own hit.
      const mine = Player.getMutable(local.entity)
      mine.score += res.stolen
      mine.stolenTotal += res.stolen
      mine.knockouts += 1
      local.stats.pointsStolen += res.stolen
      local.stats.knockouts += 1
      pushToast(`+${res.stolen} ${res.type.toUpperCase()} on ${p.name}`)
    }

    // A duel we lost, or the bounce-back from one we won.
    const selfKnock = weWon ? res.winnerKnock : res.loserKnock
    if (selfKnock > 0) {
      Physics.applyKnockbackToPlayer(
        Vector3.create(p.px, 0, p.pz),
        selfKnock * KNOCK_IMPULSE,
        12,
        KnockbackFalloff.CONSTANT
      )
      local.ragdoll = weWon ? 0.4 : 0.8
      local.state = 'ragdoll'
    }

    endDash()
    break
  }
}

/**
 * VICTIM SIDE. Every client receives this; only the named victim acts on it.
 */
export function registerHitListener(): void {
  bus.on(MSG_HIT, (m: HitMsg) => {
    if (m.vic !== local.address) return
    if (!local.ready) return

    // Sheltered in the barn: the whole point of the Friendzone.
    if (isSheltered()) return

    const key = `${m.atk}:${m.nonce}`
    if (seen.has(key)) return
    seen.add(key)

    // Cheap anti-tamper. Not a substitute for an authoritative server, but it
    // stops naive tampering for the cost of two comparisons.
    const me = Transform.get(engine.PlayerEntity).position
    if (Math.sqrt((m.sx - me.x) ** 2 + (m.sz - me.z) ** 2) > 5) return

    const mine = Player.getMutable(local.entity)
    if (m.knock > 200) return
    if (m.stolen > mine.score * 0.35 + 20) return

    // We are the only client that can move our own avatar.
    Physics.applyKnockbackToPlayer(
      Vector3.create(m.sx, 0, m.sz),
      m.knock * KNOCK_IMPULSE,
      12,
      KnockbackFalloff.CONSTANT
    )

    mine.score = Math.max(SCORE_FLOOR, mine.score - m.stolen)
    mine.launched += 1
    local.stats.timesLaunched += 1
    local.ragdoll = 0.8
    local.state = 'ragdoll'
    local.dashing = false
    pushToast(`-${m.stolen} ${m.kind.toUpperCase()}!`)
  })
}
