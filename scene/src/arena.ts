import {
  Entity,
  MeshCollider,
  MeshRenderer,
  Material,
  TextShape,
  Transform,
  Billboard,
  engine,
} from '@dcl/sdk/ecs'
import { Color3, Color4, Quaternion, Vector3 } from '@dcl/sdk/math'

/** 2x2 parcels = 32x32m. Arena is inset from the edge so nobody falls out. */
export const WORLD_SIZE = 32
export const CENTER = Vector3.create(16, 0, 16)
export const ARENA_HALF = 14

export const BARN_POS = Vector3.create(26, 0, 6)
export const BARN_RADIUS = 3.2

const GRASS = Color3.fromHexString('#7ab861')
const GRASS_DARK = Color3.fromHexString('#6aa854')
const FENCE = Color3.fromHexString('#8b5a2b')
const BARN_RED = Color3.fromHexString('#c0392b')
const BARN_ROOF = Color3.fromHexString('#5d4037')

function solid(entity: Entity, color: Color3, roughness = 0.9): void {
  Material.setPbrMaterial(entity, {
    albedoColor: Color4.fromColor3(color),
    roughness,
    metallic: 0,
  })
}

/** Checkerboard ground: two tones read as mown grass and give depth cues. */
function buildGround(): void {
  const tile = WORLD_SIZE / 4
  for (let ix = 0; ix < 4; ix++) {
    for (let iz = 0; iz < 4; iz++) {
      const e = engine.addEntity()
      Transform.create(e, {
        position: Vector3.create(ix * tile + tile / 2, 0.01, iz * tile + tile / 2),
        scale: Vector3.create(tile, 0.02, tile),
      })
      MeshRenderer.setBox(e)
      MeshCollider.setBox(e)
      solid(e, (ix + iz) % 2 === 0 ? GRASS : GRASS_DARK)
    }
  }
}

/** Perimeter posts + rails. Cheap, readable, and it frames the play space. */
function buildFence(): void {
  const inset = 1
  const min = inset
  const max = WORLD_SIZE - inset
  const step = 4

  for (let t = min; t <= max; t += step) {
    for (const [x, z] of [
      [t, min],
      [t, max],
      [min, t],
      [max, t],
    ] as const) {
      const post = engine.addEntity()
      Transform.create(post, {
        position: Vector3.create(x, 0.6, z),
        scale: Vector3.create(0.18, 1.2, 0.18),
      })
      MeshRenderer.setBox(post)
      MeshCollider.setBox(post)
      solid(post, FENCE)
    }
  }

  // Rails along each side, at two heights.
  const span = max - min
  for (const y of [0.5, 0.95]) {
    for (const [pos, rot] of [
      [Vector3.create(WORLD_SIZE / 2, y, min), 0],
      [Vector3.create(WORLD_SIZE / 2, y, max), 0],
      [Vector3.create(min, y, WORLD_SIZE / 2), 90],
      [Vector3.create(max, y, WORLD_SIZE / 2), 90],
    ] as const) {
      const rail = engine.addEntity()
      Transform.create(rail, {
        position: pos,
        rotation: Quaternion.fromEulerDegrees(0, rot, 0),
        scale: Vector3.create(span, 0.1, 0.1),
      })
      MeshRenderer.setBox(rail)
      solid(rail, FENCE)
    }
  }
}

/** The barn: safe zone and social hub. Box body + angled roof planes. */
function buildBarn(): void {
  const body = engine.addEntity()
  Transform.create(body, {
    position: Vector3.create(BARN_POS.x, 1.4, BARN_POS.z),
    scale: Vector3.create(4.6, 2.8, 4),
  })
  MeshRenderer.setBox(body)
  MeshCollider.setBox(body)
  solid(body, BARN_RED)

  for (const sign of [-1, 1]) {
    const roof = engine.addEntity()
    Transform.create(roof, {
      position: Vector3.create(BARN_POS.x + sign * 1.2, 3.4, BARN_POS.z),
      rotation: Quaternion.fromEulerDegrees(0, 0, sign * 38),
      scale: Vector3.create(3.1, 0.16, 4.3),
    })
    MeshRenderer.setBox(roof)
    solid(roof, BARN_ROOF)
  }

  // Dark doorway so the entrance reads from across the arena.
  const door = engine.addEntity()
  Transform.create(door, {
    position: Vector3.create(BARN_POS.x - 2.32, 1, BARN_POS.z),
    rotation: Quaternion.fromEulerDegrees(0, 90, 0),
    scale: Vector3.create(1.8, 2, 0.05),
  })
  MeshRenderer.setBox(door)
  solid(door, Color3.fromHexString('#3b2415'))

  // Floating label — Billboard mode 2 keeps it upright and readable.
  const label = engine.addEntity()
  Transform.create(label, {
    position: Vector3.create(BARN_POS.x, 4.6, BARN_POS.z),
  })
  Billboard.create(label, { billboardMode: 2 })
  TextShape.create(label, {
    text: 'THE BARN\nsafe zone',
    fontSize: 3,
    textColor: Color4.White(),
    outlineColor: Color4.Black(),
    outlineWidth: 0.2,
  })

  // Ground ring marking the shelter radius.
  const ring = engine.addEntity()
  Transform.create(ring, {
    position: Vector3.create(BARN_POS.x, 0.03, BARN_POS.z),
    scale: Vector3.create(BARN_RADIUS * 2, 0.02, BARN_RADIUS * 2),
  })
  MeshRenderer.setCylinder(ring, 1, 1)
  Material.setPbrMaterial(ring, {
    albedoColor: Color4.create(1, 0.95, 0.5, 0.35),
    roughness: 1,
  })
}

/** Scattered rocks and shrubs so the field isn't visually empty. */
function buildProps(): void {
  const spots: Array<[number, number, number]> = [
    [6, 24, 0.9],
    [9, 9, 0.7],
    [23, 25, 1.1],
    [27, 19, 0.8],
    [14, 27, 0.6],
    [4, 15, 1],
  ]
  for (const [x, z, s] of spots) {
    const rock = engine.addEntity()
    Transform.create(rock, {
      position: Vector3.create(x, s * 0.35, z),
      scale: Vector3.create(s, s * 0.7, s),
    })
    MeshRenderer.setSphere(rock)
    MeshCollider.setSphere(rock)
    solid(rock, Color3.fromHexString('#9e9e9e'))
  }
}

export function buildArena(): void {
  buildGround()
  buildFence()
  buildBarn()
  buildProps()
}

export function distanceToBarn(x: number, z: number): number {
  return Math.sqrt((x - BARN_POS.x) ** 2 + (z - BARN_POS.z) ** 2)
}

export function clampToArena(v: number): number {
  return Math.max(2, Math.min(WORLD_SIZE - 2, v))
}
