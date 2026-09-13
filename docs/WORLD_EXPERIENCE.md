# Courage World Experience

This document is the implementation contract for Courage's interactive 3D
worlds. It describes what is shipped, how live token signals enter the scene,
and the performance and brand boundaries that future work must preserve.

## Narrative premise

Courage is a self-aware meme living inside the Nowhere farmhouse. He cannot
find an off button. An original trail of emerald signal shards leads him out of
the house, through a forest that watches back, and to a portal hovering above a
river.

The experience takes inspiration from the agentic meme-world energy around
`$FLY`: the character is not presented as a static mascot. The browser contains
four interactive worlds with their own light, cast, music, events, and behavior.

The four world states are:

| World | Story behavior |
| --- | --- |
| Sunrise | Courage leaves the farmhouse while giant flies join the chase. |
| Noon | The caretaker walks to a truck, drives away, returns, and crosses paths with Courage. |
| Evening | Courage runs between the farmhouse and a gathering of ghosts. |
| Disco | The rear of the farmhouse becomes a reactive monster dance floor. |

Midnight is a landing-page time state that enters the Evening 3D world. It is
not a fifth 3D scene.

## Scene graph

`src/components/3d/Scene3D.jsx` composes the shared environment:

```text
Scene
|- sky gradient, stars, sun, and clouds
|- shared lighting
`- terrain group
   |- Terrain (shared flat homestead surface)
   |- ForestPortal
   |  |- instanced tree trunks and crowns
   |  |- curved river strip
   |  |- instanced emerald signal shards
   |  `- animated portal and particle field
   |- TickerlingForest
   |  |- hero bushes with blinking eye rigs
   |  `- instanced distant bush ring
   `- world-specific story controller
      |- farmhouse and windmill
      |- Courage and scene creatures
      `- truck and caretaker where applicable
```

The shared scene remains procedural. No large GLB was introduced for this
round; the improved caretaker and truck use reusable geometries and materials so
they can ship inside the existing lazy-loaded world chunks.

## Tickerling encounters

A Tickerling is a short, wide bush with a dark eye cavity. Its normal state is
quiet: eyes track the camera and blink without React state updates.

An encounter can start in two ways:

1. The visitor clicks or taps a hero bush.
2. After a drag, touch, or wheel interaction, a hero bush stays near the camera
   center for roughly half a second.

The interaction requirement is intentional. A bush must not jump at a visitor
on initial page load.

During an encounter:

- the foliage squashes and recoils;
- the face rises from the eye cavity;
- the assigned live token logo appears with cartoon brows, pupils, and mouth;
- the token symbol is shown for identification; and
- the encounter releases after about two seconds.

Assignments are stable for the browser session. They are shuffled from the
eligible snapshot with a session seed and distributed across hero bushes.
Refreshing upstream data does not cause constant random flicker.

If a visitor clicks before the first snapshot arrives, the bush reacts
immediately with an original Courage signal rune marked `TUNING...`. The same
encounter restarts with a real assigned ticker as soon as the shared request
finishes. If data remains unavailable, the application never fabricates price,
volume, trend, or token identity data.

## Grounding contract

Sunrise, Noon, Evening/Midnight, and Disco reuse the same scene terrain. The
playable homestead is a flat circular surface; horizon curvature belongs in the
sky treatment, not in the asset placement surface. `worldGround.js` is the
single source of truth for its local Y coordinate.

- Trees calculate their trunk centers from the shared surface plus a small root
  depth.
- Hero and distant bushes share one root height instead of approximating a
  sphere equation.
- The river and signal trail sit just above the shared surface to avoid
  z-fighting.
- Story assets keep their established center-of-scene offsets because the flat
  terrain preserves the former sphere's top height.

Do not introduce per-tree Y nudges. If a future ground profile changes, update
the shared ground contract and every surface layer together.

## Market data contract

The landing market widget and the world use the same frontend service:

```text
DexScreener discovery and pair endpoints
        |
        v
server/app/robinhood_service.py
  - Robinhood Chain filter
  - address deduplication
  - source attribution
  - liquidity and image eligibility
  - 60 second process cache
  - one in-flight refresh shared by concurrent consumers
        |
        +--> GET /api/robinhood-crypto
        |       |
        |       `--> src/services/tokenService.js
        |               |- one in-flight browser request
        |               |- 30 second memory cache
        |               |- 24 hour stale localStorage fallback
        |               |- market widget
        |               `- TickerlingForest
        |
        `--> GET /api/token-logo/{token_address}
                - known eligible tokens only
                - HTTPS host allowlist
                - content type, byte, and dimension limits
                - decode and re-encode to 128px WebP
                - bounded 24 hour process cache
```

Discovery source tags are retained. A result from a text search is not called
"trending." Only entries discovered through boost feeds receive the `boosted`
and `trending` flags. This is discovery metadata, not investment advice.

Current world eligibility requires all of the following:

- a valid symbol and token address;
- a positive USD price;
- at least USD 1,000 reported liquidity; and
- an upstream image that can be served through the safe proxy.

The eligibility rule reduces obvious broken or empty appearances. It is not a
security audit, endorsement, quality score, or guarantee about a token.

## Performance budget

The default experience keeps the existing low-cost renderer settings:

- world bundles remain lazy-loaded;
- device pixel ratio stays capped between 1 and 1.5;
- antialiasing remains disabled;
- hidden world canvases use `frameloop="demand"`;
- token art is fetched only for the currently emerged face;
- one snapshot and in-flight request are shared across world consumers;
- hero foliage is instanced inside each interactive bush;
- distant foliage, tree trunks, crowns, and signal shards are instanced;
- portal particles use one points geometry; and
- no post-processing pipeline or real volumetric fog pass was added.

Mobile reduces the environment while preserving the encounter:

| Detail | Desktop | Mobile |
| --- | ---: | ---: |
| Interactive hero bushes | 8 | 4 |
| Distant bushes | 18 | 10 |
| Backdrop trees | 30 | 18 |
| Portal particles | 44 | 26 |
| Night stars | 2,000 | 800 |
| Faux god-rays | enabled outside Noon | disabled |

These are scene budgets, not measured frame-rate guarantees. Validate changes
on a real low-end phone before raising any count or enabling WebGL shadows or
post-processing.

## Truck and caretaker

`Truck3D.jsx` keeps a stylized vintage farm-truck profile while replacing the
old box stack with rounded bodywork, separate paint and trim materials, glass,
windshield divider, mirrors, door seam, grille slats, bumpers, fenders, bed
rails, wood floor, tail lamps, and layered wheel hubs. Wheel rotation comes from
actual world-space displacement. The driver's door follows the existing Noon
story phases.

`Euriel3D.jsx` keeps the caretaker procedural but replaces the sphere-and-pipe
silhouette with a readable face, hair masses, neck, layered clothing, hands,
boots, and articulated shoulder, elbow, hip, and knee joints. The gait adds
opposing arm swing, knee bend, torso bob, head counter-motion, and idle blinking.

The Noon controller still owns the original 55-second story loop. It now uses a
smoothed walking path and passes door and light state to the truck.

## Brand and content boundary

The experience may accurately describe Robinhood Chain and use its market
ecosystem as context. It must not imply that Robinhood, Warner Bros., or Cartoon
Network operates, sponsors, or endorses Courage.

- Do not recolor or reshape a third-party master logo into scenery.
- Do not use a third-party logo as the portal trail.
- Keep the trail and fallback face as original Courage signal symbols.
- Keep the independent-project disclaimer on the landing lore section.
- Keep `DexScreener` visible as the market-data provider.
- Do not describe search discovery as organic trend evidence.
- Do not present the world eligibility filter as token vetting.

Token logos are user- or issuer-supplied upstream content. They appear only as
live discovery data inside a brief encounter and are never used as the Courage
brand or as an endorsement.

## Verification checklist

Before merging a world change:

1. Run focused ESLint on each new or materially changed component.
2. Run `python -m py_compile` for modified backend modules.
3. Run `python -m unittest server.tests.test_robinhood_service_unit -v` for the
   market normalization contract.
4. Run `npm run build`.
5. Open Sunrise, Noon, Evening, and Disco at the default camera distance and
   confirm tree trunks meet the flat ground.
6. Orbit to the river clearing and inspect the portal from both sides.
7. Click a hero bush before and after live data arrives; it may show `TUNING...`
   but must never show a fabricated ticker.
8. Confirm the first view does not trigger an encounter without interaction.
9. Check a narrow viewport and a low-end physical phone.
10. Verify no temporary screenshots, browser profiles, or generated build output
    are staged.

The repository-wide ESLint command currently includes legacy and duplicated
source trees with a substantial existing error baseline. A clean focused lint
and production build are required for touched code; the global baseline should
be repaired in a separate, explicit cleanup rather than hidden in feature work.
