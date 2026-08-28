# ⛏️ MCraft

A Minecraft-inspired procedural 3D world engine for the browser. The current focus is a deterministic, chunk-based infinite world foundation; player gameplay will be layered on top later.

## Current foundation

- Infinite coordinate space driven by a world seed
- 16 × 16 horizontal chunks
- 48-block vertical world height
- Per-chunk procedural terrain and biomes
- Ocean / beach / plains / forest / jungle / taiga / desert / mountain / snow
- Underground 3D cave carving using absolute world coordinates
- Caves are not forced to have surface entrances
- Chunk loading around the camera/player coordinate
- Automatic unloading of distant chunks
- Returning to a chunk regenerates the same base terrain from the same seed + coordinates
- Free-fly test controller for moving across chunk boundaries
- Chunk grid debug view
- Underground transparency preview

## Run

No build step is required. Serve the repository with a static HTTP server:

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000`.

Click the 3D world to capture the mouse. Use `WASD` to travel, `Space` / `Ctrl` to move vertically, and `Esc` to release the mouse.

## Architecture

```text
src/
├── main.js
├── style.css
└── world/
    ├── InfiniteWorldGenerator.js   # deterministic terrain, biomes, caves
    ├── StreamingWorld.js           # load/unload chunks around coordinates
    ├── ChunkManager.js             # chunk bookkeeping helpers
    └── VoxelChunkRenderer.js       # voxel rendering/debug preview

assets/
└── ...                             # future GLB/model assets
```

### Determinism

Base terrain is generated from:

```text
world seed + absolute X/Z coordinate
```

Cave density also uses absolute X/Y/Z coordinates, so crossing a chunk boundary does not require a new local noise seed and the cave pattern can continue consistently.

## Next milestones

1. Optimized chunk meshing / greedy meshing
2. Rare, intentional cave entrances and underground water/lava
3. Data-driven GLB asset placement per chunk
4. Trees, buildings, villages, ponds and structures from external assets
5. Actual player controller and collision
6. Block breaking / placing
7. Inventory and crafting
8. Chunk modification persistence
9. Save/load world data
10. Mobs and gameplay systems
