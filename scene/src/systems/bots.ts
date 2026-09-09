import { AvatarShape, Entity, Transform, engine } from '@dcl/sdk/ecs'
import { Quaternion, Vector3 } from '@dcl/sdk/math'
import { syncEntity } from '@dcl/sdk/network'

import { WORLD_SIZE, clampToArena } from '../arena'
import { Player } from '../net/components'
import { CONFIG } from '../rules/config'
import { nextName } from '../rules/names'
import { START_SCORE } from '../state'
import { isHost } from '../round'

const MAX_BOTS = 3
const BODY = [
  'urn:decentraland:off-chain:base-avatars:BaseMale',
  'urn:decentraland:off-chain:base-avatars:BaseFemale',
]

type BotMode = 'wander' | 'hunt' | 'charge'

interface Bot {
  entity: Entity
  address: string
  name: string
  x: number
  z: number
  heading: number
  mode: BotMode
  timer: number
  charge: number
  reaction: number
  skill: number
  aggression: number
}

const bots: Bot[] = []
let spawned = false

function spawnBot(i: number): Bot {
  const e = engine.addEntity()
  const name = nextName()
  const address = `bot:${i}:${Math.floor(Math.random() * 1e6)}`
  const x = 6 + Math.random() * (WORLD_SIZE - 12)
  const z = 6 + Math.random() * (WORLD_SIZE - 12)

  Transform.create(e, { position: Vector3.create(x, 0, z) })
  // Moving an AvatarShape's Transform makes it WALK (real animation) rather
  // than teleport — unlike the read-only player Transform.
  AvatarShape.create(e, {
    id: address,
    name,
    bodyShape: BODY[i % BODY.length],
    wearables: [],
    emotes: [],
  })

  Player.create(e, {
    address,
    name,
    score: START_SCORE,
    charge: 0,
    dashing: false,
    facing: 0,
    px: x,
    pz: z,
    isBot: true,
    sheepPopped: 0,
    stolenTotal: 0,
    knockouts: 0,
    launched: 0,
  })
  syncEntity(e, [Transform.componentId, Player.componentId])

  return {
    entity: e,
    address,
    name,
    x,
    z,
    heading: Math.random() * Math.PI * 2,
    mode: 'wander',
    timer: 0,
    charge: 0,
    reaction:
      CONFIG.botReactionMin +
      Math.random() * (CONFIG.botReactionMax - CONFIG.botReactionMin),
    skill: 0.3 + Math.random() * 0.7,
    aggression: Math.random(),
  }
}

function humanCount(): number {
  let n = 0
  for (const [, p] of engine.getEntitiesWith(Player)) if (!p.isBot) n++
  return n
}

/** Nearest non-bot target, so bots go for real players first. */
function nearestTarget(b: Bot): { x: number; z: number; d: number } | null {
  let best: { x: number; z: number; d: number } | null = null
  for (const [, p] of engine.getEntitiesWith(Player)) {
    if (p.address === b.address) continue
    const d = Math.sqrt((p.px - b.x) ** 2 + (p.pz - b.z) ** 2)
    if (!best || d < best.d) best = { x: p.px, z: p.pz, d }
  }
  return best
}

export function botSystem(dt: number): void {
  // Exactly one client simulates the bots, or they duplicate and jitter.
  if (!isHost()) return

  if (!spawned) {
    const want = Math.max(0, Math.min(MAX_BOTS, MAX_BOTS - (humanCount() - 1)))
    for (let i = 0; i < want; i++) bots.push(spawnBot(i))
    spawned = true
  }

  for (const b of bots) {
    b.timer -= dt

    const target = nearestTarget(b)
    if (b.timer <= 0) {
      b.timer = b.reaction
      if (target && target.d < 9 && Math.random() < b.aggression) {
        b.mode = target.d < 4.5 ? 'charge' : 'hunt'
      } else {
        b.mode = 'wander'
        b.heading = Math.random() * Math.PI * 2
      }
    }

    let speed = CONFIG.walkSpeed * 0.55

    if (b.mode === 'hunt' && target) {
      b.heading = Math.atan2(target.z - b.z, target.x - b.x)
      speed = CONFIG.walkSpeed * 0.8
      b.charge = 0
    } else if (b.mode === 'charge' && target) {
      b.heading = Math.atan2(target.z - b.z, target.x - b.x)
      b.charge = Math.min(1, b.charge + dt / CONFIG.chargeTime)
      speed = CONFIG.chargeMoveSpeed
      // Release around the bot's skill threshold, then lunge.
      if (b.charge >= b.skill) {
        speed = CONFIG.dashTapSpeed + b.charge * 6
        b.charge = 0
        b.mode = 'wander'
        b.timer = CONFIG.postDashRecovery
      }
    } else {
      b.charge = 0
    }

    b.x = clampToArena(b.x + Math.cos(b.heading) * speed * dt)
    b.z = clampToArena(b.z + Math.sin(b.heading) * speed * dt)

    const t = Transform.getMutable(b.entity)
    t.position = Vector3.create(b.x, 0, b.z)
    t.rotation = Quaternion.fromEulerDegrees(
      0,
      -(b.heading * 180) / Math.PI + 90,
      0
    )

    const p = Player.getMutable(b.entity)
    p.px = b.x
    p.pz = b.z
    p.facing = b.heading
    p.charge = b.charge
    p.dashing = b.mode === 'charge' && b.charge > 0.5
  }
}

export function botCount(): number {
  return bots.length
}

