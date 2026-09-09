import {
  AvatarLocomotionSettings,
  InputAction,
  Physics,
  Transform,
  engine,
  inputSystem,
} from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'

import { CONFIG } from '../rules/config'
import { local } from '../state'

/**
 * DCL physics units are not the source game's velocity units, so the source
 * numbers get scaled. Tune these two by feel, nothing else.
 */
export const DASH_IMPULSE = 3.2
export const KNOCK_IMPULSE = 6

const BASE_RUN_SPEED = 10 // client default
const CHARGE_RUN_SPEED = 2.5 // the telegraph: you crawl while winding up

function setRunSpeed(speed: number): void {
  AvatarLocomotionSettings.createOrReplace(engine.PlayerEntity, {
    runSpeed: speed,
  })
}

/** Yaw in radians from the avatar's rotation. Reading Transform IS allowed. */
export function playerFacing(): number {
  const rot = Transform.get(engine.PlayerEntity).rotation
  const fwd = Vector3.rotate(Vector3.Forward(), rot)
  return Math.atan2(fwd.z, fwd.x)
}

function fire(): void {
  const rot = Transform.get(engine.PlayerEntity).rotation
  const fwd = Vector3.rotate(Vector3.Forward(), rot)

  local.dashStrength = local.charge
  const speed =
    CONFIG.dashTapSpeed +
    local.charge * (CONFIG.dashFullSpeed - CONFIG.dashTapSpeed)

  // Slight upward component so the launch reads as a lunge, not a slide.
  Physics.applyImpulseToPlayer(
    Vector3.create(fwd.x, 0.12, fwd.z),
    speed * DASH_IMPULSE
  )
  setRunSpeed(CONFIG.dashFullSpeed)

  local.state = 'dashing'
  local.dashing = true
  local.charge = 0
  local.dashTimer = CONFIG.dashHoldDuration + local.dashStrength * 0.2
  local.stats.activity += 1
}

/** Called by the hit system when a landed hit should cut the dash short. */
export function endDash(): void {
  if (local.state !== 'dashing') return
  local.state = 'recovery'
  local.dashing = false
  local.recovery = CONFIG.postDashRecovery
  setRunSpeed(BASE_RUN_SPEED)
}

export function chargeSystem(dt: number): void {
  if (!local.ready) return

  // Ragdoll: helpless after being hit.
  if (local.ragdoll > 0) {
    local.ragdoll -= dt
    local.charge = 0
    local.dashing = false
    if (local.ragdoll <= 0) {
      local.state = 'idle'
      setRunSpeed(BASE_RUN_SPEED)
    }
    return
  }

  // Rooted while popping a sheep — a state rule, not InputModifier
  // (InputModifier is desktop-only and silently no-ops on mobile).
  if (local.popTimer > 0) {
    local.popTimer -= dt
    local.charge = 0
    setRunSpeed(0.1)
    if (local.popTimer <= 0) {
      local.state = 'idle'
      setRunSpeed(BASE_RUN_SPEED)
    }
    return
  }

  if (local.recovery > 0) {
    local.recovery -= dt
    if (local.recovery <= 0) local.state = 'idle'
    return
  }

  if (local.state === 'dashing') {
    local.dashTimer -= dt
    if (local.dashTimer <= 0) endDash()
    return
  }

  const held = inputSystem.isPressed(InputAction.IA_PRIMARY)

  if (held && local.state === 'idle') {
    local.state = 'charging'
    local.charge = 0
  }

  if (local.state === 'charging') {
    local.charge = Math.min(1, local.charge + dt / CONFIG.chargeTime)
    setRunSpeed(CHARGE_RUN_SPEED)

    // Release on button-up OR auto-fire at full charge. Auto-fire matters on
    // mobile: a slipped finger or a dropped PET_UP would otherwise soft-lock.
    if (!held || local.charge >= 1) fire()
  }
}
