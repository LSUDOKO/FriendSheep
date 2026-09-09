import { InputAction, TouchScreenControls, engine } from '@dcl/sdk/ecs'

/**
 * One visible action button. Well under the 5-button limit that would push
 * the rest behind a "+" overflow. The joystick stays: it is both movement
 * and aim, since screenDelta is always 0 on mobile (no mouselook).
 */
export function setupTouchControls(): void {
  TouchScreenControls.createOrReplace(engine.RootEntity, {
    hideJoystick: false,
    hideCrosshair: true,
    mainAction: InputAction.IA_PRIMARY,
    touchInputs: [
      { inputAction: InputAction.IA_SECONDARY, hide: true },
      { inputAction: InputAction.IA_ACTION_3, hide: true },
      { inputAction: InputAction.IA_ACTION_4, hide: true },
      { inputAction: InputAction.IA_ACTION_5, hide: true },
      { inputAction: InputAction.IA_ACTION_6, hide: true },
    ],
  })
}
