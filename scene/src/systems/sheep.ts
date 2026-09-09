import {
  Entity,
  Material,
  MeshRenderer,
  Transform,
  engine,
} from '@dcl/sdk/ecs'
import { Color3, Color4, Quaternion, Vector3 } from '@dcl/sdk/math'

import { WORLD_SIZE, clampToArena } from '../arena'
import { Player } from '../net/components'
import { CONFIG } from '../rules/config'
import { local } from '../state'
import { pushToast } from '../ui/hud'

const SHEEP_COUNT = 9
const POP_RADIUS = 1.1
const POP_TIME = 1.5
const RESPAWN_DELAY = 2.5

const WOOL = Color3.fromHexString('#f4f1ea')
const FACE = Color3.fromHexString('#3a3a3a')

interface Sheep {
  root: Entity
  x: number
  z: number
  vx: number
  vz: number
  heading: number
  retarget: number
  respawn: number
  alive: boolean
}

const flock: Sheep[] = []

function part(
  parent: Entity,
  pos: Vector3,
  scale: Vector3,
  color: Color3,
  sphere: boolean
): Entity {
  const e = engine.addEntity()
  Transform.create(e, { parent, position: pos, scale })
  if (sphere) MeshRenderer.setSphere(e)
  else MeshRenderer.setCylinder(e, 1, 1)
  Material.setPbrMaterial(e, {
    albedoColor: Color4.fromColor3(color),
    roughness: 1,
    metallic: 0,
  })
  return e
}

/** 7 primitives. No sheep exists in the DCL catalog, so we build one. */
function makeSheep(x: number, z: number): Sheep {
  const root = engine.addEntity()
  Transform.create(root, {
    position: Vector3.create(x, 0, z),
    scale: Vector3.create(0.95, 0.95, 0.95),
  })

  part(root, Vector3.create(0, 0.58, 0), Vector3.create(0.92, 0.78, 1.16), WOOL, true)
  part(root, Vector3.create(0, 0.74, 0.6), Vector3.create(0.36, 0.36, 0.42), FACE, true)
  for (const [lx, lz] of [
    [-0.26, -0.32],
    [0.26, -0.32],
    [-0.26, 0.32],
    [0.26, 0.32],
  ] as const) {
    part(root, Vector3.create(lx, 0.19, lz), Vector3.create(0.1, 0.38, 0.1), FACE, false)
  }

  return {
    root,
    x,
    z,
    vx: 0,
    vz: 0,
    heading: Math.random() * Math.PI * 2,
    retarget: Math.random() * 2,
    respawn: 0,
    alive: true,
  }
}

function randomSpot(): { x: number; z: number } {
  return {
    x: 4 + Math.random() * (WORLD_SIZE - 8),
    z: 4 + Math.random() * (WORLD_SIZE - 8),
  }
}

export function spawnFlock(): void {
  for (let i = 0; i < SHEEP_COUNT; i++) {
    const s = randomSpot()
    flock.push(makeSheep(s.x, s.z))
  }
}

/** Nearest ram (any player) to a point, for flee behaviour. */
function nearestThreat(x: number, z: number): { d: number; dx: number; dz: number } {
  let best = Infinity
  let bdx = 0
  let bdz = 0
  for (const [, p] of engine.getEntitiesWith(Player)) {
    const dx = x - p.px
    const dz = z - p.pz
    const d = Math.sqrt(dx * dx + dz * dz)
    if (d < best) {
      best = d
      bdx = dx
      bdz = dz
    }
  }
  return { d: best, dx: bdx, dz: bdz }
}

export function sheepSystem(dt: number): void {
  for (const s of flock) {
    if (!s.alive) {
      s.respawn -= dt
      if (s.respawn <= 0) {
        const spot = randomSpot()
        s.x = spot.x
        s.z = spot.z
        s.alive = true
        Transform.getMutable(s.root).scale = Vector3.create(0.95, 0.95, 0.95)
      }
      continue
    }

    const threat = nearestThreat(s.x, s.z)
    let speed = CONFIG.sheepSpeed * 0.4

    if (threat.d < CONFIG.sheepFleeRange && threat.d > 0.001) {
      // Bolt directly away — this is what makes herding them feel alive.
      s.heading = Math.atan2(threat.dz, threat.dx)
      speed = CONFIG.sheepSpeed
    } else {
      s.retarget -= dt
      if (s.retarget <= 0) {
        s.heading = Math.random() * Math.PI * 2
        s.retarget = 1 + Math.random() * 2
      }
    }

    s.x = clampToArena(s.x + Math.cos(s.heading) * speed * dt)
    s.z = clampToArena(s.z + Math.sin(s.heading) * speed * dt)

    const t = Transform.getMutable(s.root)
    t.position = Vector3.create(s.x, 0, s.z)
    t.rotation = Quaternion.fromEulerDegrees(
      0,
      -(s.heading * 180) / Math.PI + 90,
      0
    )
  }
}

/** Walk into an idle sheep to shear it: rooted 1.5s, then points. */
export function popSystem(): void {
  if (!local.ready) return
  if (local.popTimer > 0 || local.ragdoll > 0 || local.dashing) return

  const me = Transform.get(engine.PlayerEntity).position
  for (const s of flock) {
    if (!s.alive) continue
    const d = Math.sqrt((s.x - me.x) ** 2 + (s.z - me.z) ** 2)
    if (d > POP_RADIUS) continue

    s.alive = false
    s.respawn = RESPAWN_DELAY
    Transform.getMutable(s.root).scale = Vector3.Zero()

    local.popTimer = POP_TIME
    local.state = 'popping'

    const p = Player.getMutable(local.entity)
    p.score += CONFIG.sheepPoints
    p.sheepPopped += 1
    local.stats.sheepPopped += 1
    local.stats.activity += 1
    pushToast(`+${CONFIG.sheepPoints} sheared a sheep`)
    break
  }
}
