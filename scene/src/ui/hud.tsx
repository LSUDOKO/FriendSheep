import { InputAction, engine } from '@dcl/sdk/ecs'
import { Color4 } from '@dcl/sdk/math'
import ReactEcs, { Label, ReactEcsRenderer, UiEntity } from '@dcl/sdk/react-ecs'

import { Phase, Player, Round } from '../net/components'
import { local } from '../state'
import { roundEntity } from '../round'

// Module-level state only — React hooks do not exist here, and the renderer
// re-runs every frame so plain variables are read fresh each time.
let toast = ''
let toastUntil = 0
let now = 0

export function pushToast(text: string): void {
  toast = text
  toastUntil = now + 2.2
}

export function tickHud(dt: number): void {
  now += dt
  if (now > toastUntil) toast = ''
}

const INK = Color4.create(0, 0, 0, 0.55)
const WHITE = Color4.White()
const GOLD = Color4.create(1, 0.85, 0.25, 1)
const RED = Color4.create(1, 0.35, 0.3, 1)

function chargeColor(c: number): Color4 {
  if (c >= 1) return RED
  if (c > 0.6) return GOLD
  return Color4.create(1, 1, 1, 0.9)
}

function leaderboard(): Array<{ name: string; score: number; me: boolean }> {
  const rows: Array<{ name: string; score: number; me: boolean }> = []
  for (const [, p] of engine.getEntitiesWith(Player)) {
    rows.push({
      name: p.name,
      score: p.score,
      me: p.address === local.address,
    })
  }
  rows.sort((a, b) => b.score - a.score)
  return rows.slice(0, 5)
}

function myScore(): number {
  if (!local.ready) return 0
  const p = Player.getOrNull(local.entity)
  return p ? p.score : 0
}

function clock(): { time: string; phase: number } {
  const r = roundEntity !== null ? Round.getOrNull(roundEntity) : null
  if (!r) return { time: '--', phase: Phase.Playing }
  const s = Math.max(0, Math.ceil(r.timeLeft))
  const mm = Math.floor(s / 60)
  const ss = s % 60
  return {
    time: `${mm}:${ss < 10 ? '0' : ''}${ss}`,
    phase: r.phase,
  }
}

const Hud = () => {
  const c = clock()
  const rows = leaderboard()
  const charging = local.state === 'charging'

  return (
    <UiEntity
      uiTransform={{ width: '100%', height: '100%', positionType: 'absolute' }}
    >
      {/* Score — the one number that matters. Big enough to read mid-brawl. */}
      <UiEntity
        uiTransform={{
          positionType: 'absolute',
          position: { top: '3%', left: '3%' },
          padding: 12,
        }}
        uiBackground={{ color: INK }}
      >
        <Label
          value={`<b>${myScore()}</b>`}
          fontSize={44}
          color={GOLD}
          uiTransform={{ width: 'auto', height: 'auto' }}
        />
      </UiEntity>

      {/* Round clock */}
      <UiEntity
        uiTransform={{
          positionType: 'absolute',
          position: { top: '3%', left: '44%' },
          padding: 10,
        }}
        uiBackground={{ color: INK }}
      >
        <Label
          value={c.phase === Phase.Podium ? 'ROUND OVER' : c.time}
          fontSize={26}
          color={WHITE}
          uiTransform={{ width: 'auto', height: 'auto' }}
        />
      </UiEntity>

      {/* Leaderboard — you see WHO is robbing you, by name. */}
      <UiEntity
        uiTransform={{
          positionType: 'absolute',
          position: { top: '3%', right: '3%' },
          flexDirection: 'column',
          padding: 10,
          width: 190,
        }}
        uiBackground={{ color: INK }}
      >
        {rows.map((r, i) => (
          <Label
            key={i}
            value={`${i + 1}. ${r.me ? '<b>' : ''}${r.name}${r.me ? '</b>' : ''}  ${r.score}`}
            fontSize={15}
            color={r.me ? GOLD : WHITE}
            uiTransform={{ width: '100%', height: 20 }}
          />
        ))}
      </UiEntity>

      {/* Charge meter, bottom-centre above the thumb. */}
      <UiEntity
        uiTransform={{
          positionType: 'absolute',
          position: { bottom: '17%', left: '25%' },
          width: '50%',
          height: 22,
        }}
        uiBackground={{ color: Color4.create(0, 0, 0, 0.45) }}
      >
        <UiEntity
          uiTransform={{
            width: `${Math.round(local.charge * 100)}%`,
            height: '100%',
          }}
          uiBackground={{ color: chargeColor(local.charge) }}
        />
      </UiEntity>

      <UiEntity
        uiTransform={{
          positionType: 'absolute',
          position: { bottom: '22%', left: '25%' },
          width: '50%',
          height: 22,
        }}
      >
        <Label
          value={
            local.ragdoll > 0
              ? '<b>KNOCKED DOWN</b>'
              : local.popTimer > 0
                ? 'shearing…'
                : charging
                  ? local.charge >= 1
                    ? '<b>FULL POWER!</b>'
                    : 'charging…'
                  : 'HOLD to charge'
          }
          fontSize={16}
          color={WHITE}
          uiTransform={{ width: '100%', height: 22 }}
        />
      </UiEntity>

      {/* Transient event toast */}
      {toast !== '' && (
        <UiEntity
          uiTransform={{
            positionType: 'absolute',
            position: { top: '34%', left: '28%' },
            width: '44%',
            padding: 10,
          }}
          uiBackground={{ color: INK }}
        >
          <Label
            value={`<b>${toast}</b>`}
            fontSize={22}
            color={GOLD}
            uiTransform={{ width: '100%', height: 'auto' }}
          />
        </UiEntity>
      )}

      {/* Charge pad. uiInputBinding fires IA_PRIMARY continuously while held —
          exactly the semantics hold-to-charge needs on touch. */}
      <UiEntity
        uiTransform={{
          positionType: 'absolute',
          position: { bottom: '5%', right: '6%' },
          width: 132,
          height: 132,
        }}
        uiBackground={{
          color: charging
            ? chargeColor(local.charge)
            : Color4.create(1, 1, 1, 0.28),
        }}
        uiInputBinding={{ actions: [InputAction.IA_PRIMARY] }}
      >
        <Label
          value="<b>RAM</b>"
          fontSize={26}
          color={WHITE}
          uiTransform={{ width: '100%', height: '100%' }}
        />
      </UiEntity>
    </UiEntity>
  )
}

export function setupHud(): void {
  ReactEcsRenderer.setUiRenderer(Hud)
}
