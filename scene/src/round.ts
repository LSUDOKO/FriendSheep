import { Entity, engine } from '@dcl/sdk/ecs'
import { syncEntity } from '@dcl/sdk/network'

import { Phase, Player, Round, SyncIds } from './net/components'
import { CONFIG } from './rules/config'
import { assignTitles } from './rules/names'
import { Ram, emptyPowerups } from './rules/types'
import { START_SCORE, local, resetLocalRound } from './state'
import { pushToast } from './ui/hud'

export let roundEntity: Entity | null = null

/** Must be called from main() — syncEntity throws if run at module load. */
export function setupRound(): void {
  const e = engine.addEntity()
  Round.create(e, {
    timeLeft: CONFIG.roundLength,
    phase: Phase.Playing,
    startedAt: Date.now(),
  })
  // Singleton -> stable ID. Auto IDs on singletons fail to reconcile remotely.
  syncEntity(e, [Round.componentId], SyncIds.ROUND)
  roundEntity = e
}

/**
 * Only the host ticks the clock; everyone else reads the synced value.
 * Host = lexicographically smallest human address present.
 */
export function isHost(): boolean {
  const humans: string[] = []
  for (const [, p] of engine.getEntitiesWith(Player)) {
    if (!p.isBot) humans.push(p.address)
  }
  if (humans.length === 0) return true
  humans.sort()
  return humans[0] === local.address
}

function podiumRams(): Ram[] {
  const rams: Ram[] = []
  let id = 0
  for (const [, p] of engine.getEntitiesWith(Player)) {
    rams.push({
      id: id++,
      name: p.name,
      x: p.px,
      z: p.pz,
      facing: p.facing,
      score: p.score,
      state: 'idle',
      dashStrength: 0,
      powerups: emptyPowerups(),
      stats: {
        sheepPopped: p.sheepPopped,
        pointsStolen: p.stolenTotal,
        farmerHits: 0,
        knockouts: p.knockouts,
        timesLaunched: p.launched,
        activity: p.sheepPopped + p.knockouts + p.stolenTotal / 10,
      },
    })
  }
  return rams
}

function announcePodium(): void {
  const rams = podiumRams()
  if (rams.length === 0) return

  rams.sort((a, b) => b.score - a.score)
  const titles = assignTitles(rams)
  const winner = rams[0]
  const mine = rams.find((r) => r.name === local.name)
  const myTitle = mine ? titles.get(mine.id) : undefined

  pushToast(
    myTitle
      ? `${winner.name} WINS! You: ${myTitle}`
      : `${winner.name} WINS the round!`
  )
}

function beginNewRound(): void {
  resetLocalRound()
  if (local.ready) {
    const p = Player.getMutable(local.entity)
    p.score = START_SCORE
    p.sheepPopped = 0
    p.stolenTotal = 0
    p.knockouts = 0
    p.launched = 0
  }
}

export function roundSystem(dt: number): void {
  if (roundEntity === null) return
  if (!isHost()) return

  const r = Round.getMutable(roundEntity)
  r.timeLeft -= dt

  if (r.phase === Phase.Playing && r.timeLeft <= 0) {
    r.phase = Phase.Podium
    r.timeLeft = CONFIG.podiumTime
    announcePodium()
    return
  }

  if (r.phase === Phase.Podium && r.timeLeft <= 0) {
    r.phase = Phase.Playing
    r.timeLeft = CONFIG.roundLength
    r.startedAt = Date.now()
    beginNewRound()
  }
}

/** Non-host clients still need the local podium/reset beats. */
let lastPhase = Phase.Playing
export function roundEchoSystem(): void {
  if (roundEntity === null || isHost()) return
  const r = Round.getOrNull(roundEntity)
  if (!r) return
  if (r.phase !== lastPhase) {
    if (r.phase === Phase.Podium) announcePodium()
    else beginNewRound()
    lastPhase = r.phase
  }
}
