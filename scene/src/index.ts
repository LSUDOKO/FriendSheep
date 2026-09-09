import { engine } from '@dcl/sdk/ecs'

import { buildArena } from './arena'
import { roundEchoSystem, roundSystem, setupRound } from './round'
import { barnSystem } from './systems/barn'
import { botSystem } from './systems/bots'
import { chargeSystem } from './systems/charge'
import { hitSystem, registerHitListener } from './systems/hit'
import { joinSystem, syncSystem } from './systems/presence'
import { popSystem, sheepSystem, spawnFlock } from './systems/sheep'
import { setupHud, tickHud } from './ui/hud'
import { setupTouchControls } from './ui/touch'

export function main(): void {
  buildArena()
  spawnFlock()
  setupTouchControls()

  // syncEntity must run inside main() or it throws "Profile not initialized".
  setupRound()
  registerHitListener()

  engine.addSystem(joinSystem)
  engine.addSystem(syncSystem)
  engine.addSystem(chargeSystem)
  engine.addSystem(hitSystem)
  engine.addSystem(barnSystem)
  engine.addSystem(sheepSystem)
  engine.addSystem(popSystem)
  engine.addSystem(botSystem)
  engine.addSystem(roundSystem)
  engine.addSystem(roundEchoSystem)
  engine.addSystem(tickHud)

  setupHud()
}
