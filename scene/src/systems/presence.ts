import { Transform, engine } from '@dcl/sdk/ecs'
import { syncEntity } from '@dcl/sdk/network'
import { getPlayer } from '@dcl/sdk/src/players'

import { Player } from '../net/components'
import { START_SCORE, local } from '../state'
import { playerFacing } from './charge'

/** ~10Hz. Per-frame writes on this many fields would flood CRDT. */
const SYNC_INTERVAL = 0.1
let acc = 0

/**
 * getPlayer() returns null for the first few frames, so registration polls
 * until identity is available, then removes itself.
 */
export function joinSystem(): void {
  if (local.ready) {
    engine.removeSystem(joinSystem)
    return
  }

  const p = getPlayer()
  if (!p || !p.userId) return

  local.address = p.userId
  local.name = p.name && p.name.length > 0 ? p.name : `Ram-${p.userId.slice(-4)}`

  const e = engine.addEntity()
  Player.create(e, {
    address: local.address,
    name: local.name,
    score: START_SCORE,
    charge: 0,
    dashing: false,
    facing: 0,
    px: 0,
    pz: 0,
    isBot: false,
    sheepPopped: 0,
    stolenTotal: 0,
    knockouts: 0,
    launched: 0,
  })
  // Auto ID (no third arg): player-spawned entities are cleaned up on leave.
  syncEntity(e, [Player.componentId])

  local.entity = e
  local.ready = true
  engine.removeSystem(joinSystem)
}

export function syncSystem(dt: number): void {
  if (!local.ready) return

  local.facing = playerFacing()

  acc += dt
  if (acc < SYNC_INTERVAL) return
  acc = 0

  const pos = Transform.get(engine.PlayerEntity).position
  const p = Player.getMutable(local.entity)
  p.px = pos.x
  p.pz = pos.z
  p.facing = local.facing
  p.charge = local.charge
  p.dashing = local.dashing
}
