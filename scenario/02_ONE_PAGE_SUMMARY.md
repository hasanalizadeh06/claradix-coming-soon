# 02 — ONE PAGE SUMMARY

**For someone with two minutes. Everything else in this pack is this page, expanded.**

---

## What it is

A single web page. One screen, no scrolling. It contains one continuous
real-time 3D scene: **a bridge assembling itself out of flying particles.**

## What happens

```
T+0.0 ─────────────────────────────────────────────────────────── T+15.5
  │        │         │              │         │        │
  ▼        ▼         ▼              ▼         ▼        ▼
DORMANT  AWAKEN    GLIDE        ASSEMBLY  COMPLETE   UI IN
 1.2s     1.6s      2.6s          5.8s      1.2s     3.1s
  │        │         │              │         │        │
  │        │         │              │         │        └─ text fades in,
  │        │         │              │         │           element by element
  │        │         │              │         └─ last particle lands,
  │        │         │              │            one pulse of light runs
  │        │         │              │            the bridge's length
  │        │         │              └─ particles stop at their exact
  │        │         │                 coordinates. FAR END FIRST,
  │        │         │                 working back toward the camera.
  │        │         │                 Within each section: piers →
  │        │         │                 towers → deck → cables → hangers
  │        │         └─ they fly in a long curving river, each one
  │        │            barrel-rolling, leaving light trails
  │        └─ they lift off the ground in a spreading wave
  └─ a dark valley. Thousands of dim specks lie scattered on the
     ground like seeds. No bridge exists.
```

**After `T+15.5` the scene is alive forever:** the bridge breathes, the camera
shifts as you move the mouse, and pointing at the bridge pushes its particles
aside. They always drift back.

## The five laws

1. **The world is not made of particles. Only the bridge is.** Terrain,
   mountains, and sky are solid built geometry, present from frame one.
2. **The world came first; the bridge grew into it.** The valley is shaped
   around the bridge's path, not the other way round.
3. **The bridge is never fully solid.** Permanently between energy and matter —
   always a point cloud, always see-through.
4. **A particle in flight never stops.** The cursor makes it *steer around*, not
   slow down.
5. **Interaction disturbs; it never destroys.** The silhouette stays legible at
   maximum disturbance. Everything returns.

## The look

- **85%** near-black · **10%** deep green · **5%** brand lime `#7CFC00`
- One accent colour. No second hue anywhere.
- The scene is dark. Shape is read from rim light and glow, not from
  illumination.
- Bloom is the identity. Without it this is a field of hard dots.

## Key numbers

| | |
|---|---|
| Particles | 140,000 (high tier) · 45,000 (mobile) |
| Intro duration | **12.4s** — derived from one scalar, easy to change |
| Page readable at | **15.5s** |
| Bridge main span | 468 world units (metres) |
| Main tower height | 175u above deck |
| Cursor influence radius | 90u |
| Target frame rate | 60 fps · floor 30 fps |
| Loop | **off by default** (`SCENE.loop`) |

All numbers live in [`36_CONFIGURATION.md`](36_CONFIGURATION.md). Nowhere else.

## The one symbol you must know

**`u`** = position along the bridge, `0` = near end (bottom-left of frame),
`1` = far end (right horizon).

**Assembly runs `u=1 → u=0`.** Far to near. Toward the viewer.

## What makes it hard

There is no reference video. The scene is procedural and real-time, so the only
ground truth is **one still image of the final frame plus these documents**.
Every ambiguity in the writing becomes a difference in the build. That is why
the pack is long.

## Where to go next

| You are | Read |
|---|---|
| New here | [`04_story_seed_to_bridge.md`](04_story_seed_to_bridge.md) → [`08_SCREENPLAY_FULL.md`](08_SCREENPLAY_FULL.md) |
| Designing | [`06_art_direction.md`](06_art_direction.md) → [`07_reference_frame_analysis.md`](07_reference_frame_analysis.md) |
| Building | [`36_CONFIGURATION.md`](36_CONFIGURATION.md) → [`16_world_map.md`](16_world_map.md) → [`32_technical_architecture.md`](32_technical_architecture.md) |
| Reviewing | [`38_acceptance_criteria.md`](38_acceptance_criteria.md) → [`39_do_and_dont.md`](39_do_and_dont.md) |

---

**Next:** [`03_brand_philosophy.md`](03_brand_philosophy.md)
