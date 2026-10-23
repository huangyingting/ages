import * as THREE from 'three';
import type { V3 } from './prims.ts';

// Shared limb maths for people: two-bone IK with fixed bone lengths and a pole vector (knees bend forward, elbows
// back/out), plus angle-driven arms with anatomical joint limits. Keeps every figure's limbs the right length and
// bending the right way, whatever target a builder asks for.

const v = (a: V3) => new THREE.Vector3(a[0], a[1], a[2]);
const arr = (a: THREE.Vector3): V3 => [a.x, a.y, a.z];
export const lerp3 = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/**
 * Two-bone IK: root `a`, target `t`, bone lengths l1/l2, `pole` = direction the middle joint should point toward.
 * Out-of-reach targets straighten the limb toward them (never stretch); too-close ones fold to the minimum.
 */
export function ik2(a: V3, t: V3, l1: number, l2: number, pole: V3): { mid: V3; end: V3 } {
  const A = v(a), T = v(t), d = T.clone().sub(A);
  let L = d.length();
  const dir = L > 1e-9 ? d.clone().divideScalar(L) : new THREE.Vector3(0, -1, 0);
  L = Math.min(Math.max(L, Math.abs(l1 - l2) + 1e-4, (l1 + l2) * 0.12), (l1 + l2) * 0.9995);
  const end = A.clone().addScaledVector(dir, L);
  // distance along dir to the joint's foot, and its offset from the axis
  const x = (l1 * l1 - l2 * l2 + L * L) / (2 * L), h = Math.sqrt(Math.max(0, l1 * l1 - x * x));
  const P = v(pole).addScaledVector(dir, -v(pole).dot(dir));
  if (P.lengthSq() < 1e-9) P.set(0, 0, 1).addScaledVector(dir, -dir.z);
  P.normalize();
  const mid = A.clone().addScaledVector(dir, x).addScaledVector(P, h);
  return { mid: arr(mid), end: arr(end) };
}

/** Arm pose in radians: `fwd` raises the arm forward, `side` lifts it outward, `bend` folds the elbow, `inward` turns the forearm toward the body's midline. */
export interface ArmPose { fwd?: number; side?: number; bend?: number; inward?: number }

const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

/**
 * Forward kinematics for an arm from shoulder `sh` (side sgn −1 = left, +1 = right). The elbow is a hinge: it only
 * flexes (0…145°), around an axis carried by the shoulder rotation, so a raised arm bends upward and a hanging arm
 * bends forward — never sideways or backward. `inward` is internal rotation of the upper arm (forearm swings across).
 */
export function armFK(sgn: number, P: ArmPose, sh: V3, up: number, lo: number): { elbow: V3; wrist: V3; dir: V3 } {
  const f = clamp(P.fwd ?? 0.12, -1.0, 3.0), s = clamp(P.side ?? 0.12, -0.35, 2.9);
  const b = clamp(P.bend ?? 0.25, 0.02, 2.55), inw = clamp(P.inward ?? 0, -1.2, 1.4);
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-f, 0, sgn * s, 'ZYX'));
  const d1 = new THREE.Vector3(0, -1, 0).applyQuaternion(q);
  const hinge = new THREE.Vector3(-1, 0, 0).applyQuaternion(q);
  hinge.applyAxisAngle(d1, sgn * inw);
  const d2 = d1.clone().applyAxisAngle(hinge, b);
  const e = v(sh).addScaledVector(d1, up), w = e.clone().addScaledVector(d2, lo);
  return { elbow: arr(e), wrist: arr(w), dir: arr(d2) };
}
