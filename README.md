# ⛏️ MCraft

A Minecraft-inspired procedural 3D voxel world engine for the browser. MCraft now has an infinite seeded world foundation plus the first playable sandbox systems.

## Current features

- Infinite deterministic coordinate space driven by a world seed
- 16 × 16 horizontal chunks and 48-block vertical world height
- Procedural terrain with ocean, beach, plains, forest, jungle, taiga, desert, mountain and snow biomes
- 3D underground cave carving using absolute X/Y/Z coordinates
- Streaming chunk queue that generates one chunk per frame to avoid large freezes during travel
- Automatic unloading of distant chunks with a small regeneration cache
- Returning to an area recreates the same base terrain from the same seed and coordinates
- Deterministic oak, jungle and pine-style trees rendered from generated tree data
- Free-fly first-person controller with WASD, sprint, Space and Ctrl vertical movement
- Center-screen block targeting with left-click breaking and right-click placing
- Five selectable building blocks: grass, dirt, stone, sand and leaves
- Number keys 1–5 for quick block selection
- World edits persisted in browser `localStorage` per seed
- Chunk grid debug view
- Cave transparency preview
- Day/night toggle with `N`
- Responsive control panel for smaller screens
- High-performance renderer settings and capped pixel ratio

## Run

No build step is required. Serve the repository with a static HTTP server:

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000`.

Click the 3D world to capture the mouse.

### Controls

| Input | Action |
|---|---|
| WASD | Move |
| Shift | Sprint |
| Space / Ctrl | Move up / down |
| Left click | Break targeted block |
| Right click | Place selected block |
| 1–5 | Select block |
| N | Day / night |
| Esc | Release mouse |

## Architecture

```text
src/
├── main.js
├── style.css
└── world/
    ├── InfiniteWorldGenerator.js   # deterministic terrain, biomes, caves
    ├── StreamingWorld.js           # queued load/unload + edits + rendering
    ├── ChunkManager.js             # legacy chunk bookkeeping helpers
    └── VoxelChunkRenderer.js       # legacy renderer/debug implementation

assets/
└── ...                             # future GLB/model assets
```

### Determinism

Base terrain is generated from the world seed and absolute X/Z coordinates. Cave density additionally uses absolute Y, so chunk boundaries do not introduce seams or reset the cave pattern.

### Edits

Block edits are stored by absolute `x,y,z` coordinate and scoped to the current seed. The browser saves them under `localStorage`, so breaking or placing blocks survives chunk unloading and page reloads for that seed.

## Roadmap

1. Greedy meshing / face merging for much larger view distances
2. Better cave entrances plus underground water and lava
3. Data-driven GLB asset placement
4. Structures, villages and ponds
5. Character collision, gravity and jumping
6. Inventory, crafting and block drops
7. Full save/load world files
8. Mobs, health and gameplay systems
9. Web Worker chunk generation for even larger worlds
10. Multiplayer synchronization
