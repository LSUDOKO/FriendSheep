import { engine } from '@dcl/sdk/ecs'

import { buildArena } from './arena'
import { roundEchoSystem, roundSystem, setupRound } from './round'
import { chargeSystem } from './systems/charge'
import { hitSystem, registerHitListener } from './systems/hit'
import { joinSystem, syncSystem } from './systems/presence'
import { setupHud, tickHud } from './ui/hud'
import { setupTouchControls } from './ui/touch'

export function main(): void {
  buildArena()
  setupTouchControls()

  // syncEntity must run inside main() or it throws "Profile not initialized".
  setupRound()
  registerHitListener()

  engine.addSystem(joinSystem)
  engine.addSystem(syncSystem)
  engine.addSystem(chargeSystem)
  engine.addSystem(hitSystem)
  engine.addSystem(roundSystem)
  engine.addSystem(roundEchoSystem)
  engine.addSystem(tickHud)

  setupHud()
}
