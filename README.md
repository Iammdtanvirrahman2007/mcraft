# ⛏️ MCraft

A Minecraft-inspired procedural 3D world generator for the browser. The project starts with the world-generation tool; player gameplay will be added later.

## Current milestone

- Seed-based procedural terrain
- Ocean and beach generation
- Forest, jungle, taiga, desert, mountain and snow biomes
- Procedural trees
- Procedural village preview
- World-size selector
- Random seed button
- Interactive 3D orbit camera

## Run

No build step is required for the current prototype. Serve the repository with any static HTTP server, then open `index.html`.

For example, with Python:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## Architecture

```text
src/
├── main.js
├── style.css
└── world/
    └── WorldGenerator.js
```

The next versions will split the world system into terrain, biome, water, tree, structure, village, asset and chunk managers. Assets will eventually live under `assets/` and be data-driven so new buildings, villages, trees and mobs can be added without rewriting the generator.

## Roadmap

1. Chunk-based world streaming
2. Better noise and biome transitions
3. Rivers and ponds
4. Data-driven building/village templates
5. Asset registry and texture atlas
6. Mob definitions and spawning
7. Player controller
8. Block breaking/placing
9. Inventory and crafting
10. Save/load worlds
