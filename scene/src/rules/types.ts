/**
 * Engine-agnostic shapes for the ported rule files.
 *
 * The Three.js original carried a `mesh: THREE.Group` on every ram. Nothing in
 * combat.ts or names.ts ever touched it, so the SDK7 port drops it entirely and
 * those two files compile unchanged.
 */

export type RamState =
  | "idle"
  | "charging"
  | "dashing"
  | "recovery"
  | "ragdoll"
  | "popping"
  | "out";

export interface ActivePowerups {
  snowUntil: number;
  loveUntil: number;
  woolArmor: boolean;
  pepperHits: number;
  golden: boolean;
}

export interface RoundStats {
  sheepPopped: number;
  pointsStolen: number;
  farmerHits: number;
  knockouts: number;
  timesLaunched: number;
  activity: number;
}

/**
 * The subset of the original `Ram` that the ported rules actually read.
 * combat.ts touches: x, z, facing, score, state, dashStrength, powerups.
 * names.ts touches: id, stats.
 */
export interface Ram {
  id: number;
  name: string;
  x: number;
  z: number;
  facing: number; // radians, 0 = +x
  score: number;
  state: RamState;
  dashStrength: number; // charge 0..1 at the moment of release
  powerups: ActivePowerups;
  stats: RoundStats;
}

export function emptyPowerups(): ActivePowerups {
  return {
    snowUntil: 0,
    loveUntil: 0,
    woolArmor: false,
    pepperHits: 0,
    golden: false,
  };
}

export function emptyStats(): RoundStats {
  return {
    sheepPopped: 0,
    pointsStolen: 0,
    farmerHits: 0,
    knockouts: 0,
    timesLaunched: 0,
    activity: 0,
  };
}
