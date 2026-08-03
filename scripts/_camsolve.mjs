/**
 * Offline camera/composition solver. Projects key bridge points through
 * candidate cameras and prints screen coordinates (0..1, y down) so the
 * composition can be matched to the reference frame numerically.
 *
 * Temporary tool — not part of the check suite.
 */
import * as THREE from "three";

// --- candidate world (edit alongside config when iterating) ----------------
const CENTRELINE = [
  [158, 36, 920],
  [170, 44, 660],
  [152, 55, 390],
  [320, 80, 70], // main tower base
  [620, 84, -340], // far tower base
  [900, 62, -590],
];
const TOWER_MAIN = { p: 3, height: 192 };
const TOWER_FAR = { p: 4, height: 114 };
const SAG_RATIO = 0.094;

// --- candidates: [name, pos, target, fov] ----------------------------------
const CANDIDATES = [
  // Camera-correction round (2026-08-03): low over the road start, wide.
  ["current", [140, 62, 980], [440, 52, -240], 35],
];

// Allow overrides from CLI: node _camsolve.mjs px py pz tx ty tz fov
if (process.argv.length >= 9) {
  const a = process.argv.slice(2).map(Number);
  CANDIDATES.push(["cli", [a[0], a[1], a[2]], [a[3], a[4], a[5]], a[6]]);
}

const ASPECT = 1536 / 1024;

function buildCurve() {
  const pts = CENTRELINE.map((p) => new THREE.Vector3(...p));
  return new THREE.CatmullRomCurve3(pts, false, "centripetal", 0.5);
}

const curve = buildCurve();

// arc-length table
const N = 512;
const arc = new Float32Array(N + 1);
{
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  curve.getPoint(0, a);
  for (let i = 1; i <= N; i++) {
    curve.getPoint(i / N, b);
    arc[i] = arc[i - 1] + a.distanceTo(b);
    a.copy(b);
  }
}
const arcLength = arc[N];
function tOf(u) {
  const target = u * arcLength;
  let lo = 0, hi = N;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arc[mid] < target) lo = mid + 1;
    else hi = mid;
  }
  if (lo === 0) return 0;
  const f = (target - arc[lo - 1]) / (arc[lo] - arc[lo - 1] || 1);
  return (lo - 1 + f) / N;
}
function posAt(u) {
  return curve.getPoint(tOf(u), new THREE.Vector3());
}
function nearestU(p) {
  let bu = 0, bd = Infinity;
  for (let i = 0; i <= 200; i++) {
    const u = i / 200;
    const d = posAt(u).distanceToSquared(p);
    if (d < bd) { bd = d; bu = u; }
  }
  return bu;
}

const uMain = nearestU(new THREE.Vector3(...CENTRELINE[TOWER_MAIN.p]));
const uFar = nearestU(new THREE.Vector3(...CENTRELINE[TOWER_FAR.p]));

function cableY(u) {
  const mainBase = posAt(uMain), farBase = posAt(uFar);
  const mainTop = mainBase.y + TOWER_MAIN.height;
  const farTop = farBase.y + TOWER_FAR.height;
  const t = (u - uMain) / (uFar - uMain);
  const chord = THREE.MathUtils.lerp(mainTop, farTop, t);
  const span = (uFar - uMain) * arcLength;
  return chord - span * SAG_RATIO * 4 * t * (1 - t);
}

for (const [name, pos, target, fov] of CANDIDATES) {
  const cam = new THREE.PerspectiveCamera(fov, ASPECT, 1, 4000);
  cam.position.set(...pos);
  cam.lookAt(new THREE.Vector3(...target));
  cam.updateMatrixWorld(true);
  cam.updateProjectionMatrix();

  const project = (v) => {
    const p = v.clone().project(cam);
    return {
      x: (p.x + 1) / 2,
      y: (1 - p.y) / 2,
      behind: p.z > 1 || p.z < -1,
      dist: v.distanceTo(cam.position),
    };
  };
  const fmt = (s, l) => {
    const t = `(${s.x.toFixed(3)}, ${s.y.toFixed(3)})${s.behind ? " BEHIND" : ""} d=${s.dist.toFixed(0)}`;
    return `${l.padEnd(24)} ${t}`;
  };

  console.log(`\n=== ${name}  pos=[${pos}] target=[${target}] fov=${fov} ===`);
  console.log(`  arcLength=${arcLength.toFixed(0)} uMain=${uMain.toFixed(3)} uFar=${uFar.toFixed(3)}`);

  const mainBase = posAt(uMain);
  const farBase = posAt(uFar);
  const mainTop = mainBase.clone(); mainTop.y += TOWER_MAIN.height;
  const farTop = farBase.clone(); farTop.y += TOWER_FAR.height;

  console.log("  " + fmt(project(mainTop), "main tower TOP"));
  console.log("  " + fmt(project(mainBase), "main tower BASE"));
  console.log("  " + fmt(project(farTop), "far tower TOP"));
  console.log("  " + fmt(project(farBase), "far tower BASE"));

  // cable lowest point on screen (search)
  let sagPt = null, sagMax = -Infinity;
  for (let i = 0; i <= 40; i++) {
    const u = THREE.MathUtils.lerp(uMain, uFar, i / 40);
    const p = posAt(u); p.y = cableY(u);
    const s = project(p);
    if (s.y > sagMax) { sagMax = s.y; sagPt = { u, s }; }
  }
  const sTopM = project(mainTop);
  console.log("  " + fmt(sagPt.s, `cable low (u=${sagPt.u.toFixed(2)})`) +
    `  sag on screen=${(sagPt.s.y - sTopM.y).toFixed(3)}`);

  for (const u of [0, 0.1, 0.2, 0.32, 0.5, 0.7, 0.85, 1.0]) {
    console.log("  " + fmt(project(posAt(u)), `deck u=${u}`));
  }

  // horizon: project a distant point at camera height along the view azimuth
  const dir = new THREE.Vector3(...target).sub(cam.position); dir.y = 0; dir.normalize();
  const horizonPt = cam.position.clone().addScaledVector(dir, 3500);
  console.log("  " + fmt(project(horizonPt), "horizon"));

  // --- orb tour waypoints (edit alongside ORB config) ---------------------
  const TOUR = [
    ["form (top-left)", [-1050, 470, -420]],
    ["behind text", [-780, 250, -60]],
    ["valley sweep", [-320, 150, 60]],
    ["behind mountains", [1050, 150, -900]],
    ["arrive far end", [220, 90, -1000]],
    ["orb2 hover", [-60, 140, -300]],
    ["boom point", [-140, 250, -170]],
  ];
  for (const [label, p] of TOUR) {
    console.log("  " + fmt(project(new THREE.Vector3(...p)), `tour: ${label}`));
  }
}
