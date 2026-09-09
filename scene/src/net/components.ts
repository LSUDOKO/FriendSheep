import { engine, Schemas } from '@dcl/sdk/ecs'

/**
 * One entity per participant (human or bot). Only the owning client ever
 * writes its own row, so CRDT last-write-wins never actually fires.
 */
export const Player = engine.defineComponent('friendsheep::Player', {
  address: Schemas.String,
  name: Schemas.String,
  score: Schemas.Int,
  charge: Schemas.Float, // 0..1, drives the remote charge telegraph
  dashing: Schemas.Boolean,
  facing: Schemas.Float, // radians
  px: Schemas.Float, // owner-written position, ~10Hz
  pz: Schemas.Float,
  isBot: Schemas.Boolean,
  // podium stats
  sheepPopped: Schemas.Int,
  stolenTotal: Schemas.Int,
  knockouts: Schemas.Int,
  launched: Schemas.Int,
})

export const enum Phase {
  Playing = 0,
  Podium = 1,
}

/** Singleton round clock, owned by the host client. */
export const Round = engine.defineComponent('friendsheep::Round', {
  timeLeft: Schemas.Float,
  phase: Schemas.Int,
  // Int64: Schemas.Int/Number corrupt values over 13 digits like Date.now()
  startedAt: Schemas.Int64,
})

/** Stable IDs are required for singletons — auto IDs fail to reconcile. */
export const enum SyncIds {
  ROUND = 1,
}
