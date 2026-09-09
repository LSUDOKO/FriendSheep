import { Transform, engine } from '@dcl/sdk/ecs'

import { distanceToBarn, BARN_RADIUS } from '../arena'
import { CONFIG } from '../rules/config'
import { local } from '../state'
import { pushToast } from '../ui/hud'

/**
 * The barn is the "Friendzone": a no-hit sanctuary that forces players into
 * shared space. Timed and cooldown-gated so it cannot be camped.
 */
let insideLast = false

export function isSheltered(): boolean {
  return local.barnSafeRemaining > 0 && local.inBarn
}

export function barnSystem(dt: number): void {
  if (!local.ready) return

  const pos = Transform.get(engine.PlayerEntity).position
  const inside = distanceToBarn(pos.x, pos.z) <= BARN_RADIUS
  local.inBarn = inside

  if (local.barnCooldown > 0) local.barnCooldown -= dt

  if (inside && !insideLast) {
    if (local.barnCooldown <= 0) {
      local.barnSafeRemaining = CONFIG.barnSafeTime
      pushToast('Safe in the barn — say hi!')
    } else {
      pushToast(`Barn on cooldown (${Math.ceil(local.barnCooldown)}s)`)
    }
  }

  if (inside && local.barnSafeRemaining > 0) {
    local.barnSafeRemaining -= dt
    if (local.barnSafeRemaining <= 0) {
      local.barnCooldown = CONFIG.barnCooldown
      pushToast('Kicked out of the barn!')
    }
  }

  // Leaving refills the window but starts the lockout, so doorway-camping
  // gains nothing: you get ~6 safe seconds per 21.
  if (!inside && insideLast && local.barnSafeRemaining > 0) {
    local.barnSafeRemaining = 0
    local.barnCooldown = CONFIG.barnCooldown
  }

  insideLast = inside
}
