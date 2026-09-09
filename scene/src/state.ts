import { Entity } from '@dcl/sdk/ecs'

import { CONFIG } from './rules/config'
import {
  ActivePowerups,
  Ram,
  RamState,
  RoundStats,
  emptyPowerups,
  emptyStats,
} from './rules/types'

/**
 * Purely local, never synced: the charge/dash machine for THIS client.
 * What other players need to see about it goes out via the Player component.
 */
export interface LocalState {
  entity: Entity
  address: string
  name: string
  ready: boolean

  state: RamState
  charge: number // 0..1 while winding up
  dashStrength: number // charge captured at release
  dashing: boolean
  dashTimer: number
  recovery: number
  ragdoll: number

  /** Rooted while popping a sheep — a state rule, never InputModifier. */
  popTimer: number
  popTarget: Entity | null

  facing: number
  nonce: number

  powerups: ActivePowerups
  stats: RoundStats
}

export const local: LocalState = {
  entity: 0 as Entity,
  address: '',
  name: '',
  ready: false,

  state: 'idle',
  charge: 0,
  dashStrength: 0,
  dashing: false,
  dashTimer: 0,
  recovery: 0,
  ragdoll: 0,

  popTimer: 0,
  popTarget: null,

  facing: 0,
  nonce: 0,

  powerups: emptyPowerups(),
  stats: emptyStats(),
}

export function resetLocalRound(): void {
  local.state = 'idle'
  local.charge = 0
  local.dashStrength = 0
  local.dashing = false
  local.dashTimer = 0
  local.recovery = 0
  local.ragdoll = 0
  local.popTimer = 0
  local.popTarget = null
  local.powerups = emptyPowerups()
  local.stats = emptyStats()
}

/**
 * Adapts live state into the shape the ported combat.ts expects.
 * It reads exactly: x, z, facing, score, state, dashStrength, powerups.
 */
export function asRam(
  id: number,
  name: string,
  x: number,
  z: number,
  facing: number,
  score: number,
  state: RamState,
  dashStrength: number,
  powerups: ActivePowerups,
  stats: RoundStats
): Ram {
  return { id, name, x, z, facing, score, state, dashStrength, powerups, stats }
}

export const START_SCORE = CONFIG.startScore
/** Score floors instead of eliminating — a dead phone player has nothing to do. */
export const SCORE_FLOOR = 10
