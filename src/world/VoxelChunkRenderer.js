import * as THREE from 'three';
import { CHUNK_SIZE, ChunkManager } from './ChunkManager.js';

const WORLD_HEIGHT = 20;

function getTop(cell) {
  if (!cell || cell.biome === 'ocean') return 2;
  return Math.max(2, Math.min(WORLD_HEIGHT - 1, Math.floor(cell.height * 14) + 3));
}

function blockMaterial(materials, y, top, biome) {
  if (y === top) return materials[biome] || materials.grass;
  if (y >= top - 2) return materials.dirt;
  return materials.stone;
}

function key(x, y, z) {
  return `${x},${y},${z}`;
}

export class VoxelChunkRenderer {
  constructor(scene, materials) {
    this.scene = scene;
    this.materials = materials;
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.chunkManager = new ChunkManager(CHUNK_SIZE);
    this.blockSize = 1;
  }

  clear() {
    this.group.traverse(object => {
      if (object.geometry) object.geometry.dispose();
    });
    this.group.clear();
  }

  build(world) {
    this.clear();
    const chunks = this.chunkManager.buildFromWorld(world);
    const cells = new Map(world.cells.map(cell => [key(cell.x, 0, cell.z), cell]));
    const solid = new Set();
    const biomeByColumn = new Map();

    for (const cell of world.cells) {
      const top = getTop(cell);
      biomeByColumn.set(`${cell.x},${cell.z}`, { cell, top });
      if (cell.biome === 'ocean') continue;
      for (let y = 0; y < top; y++) solid.add(key(cell.x, y, cell.z));
    }

    const carve = (x, y, z, radius = 0) => {
      const r = Math.max(0, Math.ceil(radius));
      for (let dx = -r; dx <= r; dx++) {
        for (let dy = -r; dy <= r; dy++) {
          for (let dz = -r; dz <= r; dz++) {
            if (dx * dx + dy * dy + dz * dz <= radius * radius + 0.25) {
              solid.delete(key(x + dx, y + dy, z + dz));
            }
          }
        }
      }
    };

    for (const tunnel of world.caves?.tunnels || []) {
      const depth = Math.max(2, Math.min(WORLD_HEIGHT - 2, Math.floor(tunnel.depth)));
      carve(tunnel.x, depth, tunnel.z, Math.max(1, tunnel.radius));
    }
    for (const chamber of world.caves?.chambers || []) {
      const depth = Math.max(2, Math.min(WORLD_HEIGHT - 2, Math.floor(chamber.depth)));
      carve(chamber.x, depth, chamber.z, Math.max(1.8, chamber.radius));
    }

    // Optional surface openings remove a small vertical shaft only where the cave generator chose one.
    for (const entrance of world.caves?.entrances || []) {
      const column = biomeByColumn.get(`${entrance.x},${entrance.z}`);
      if (!column) continue;
      for (let y = Math.max(1, Math.floor(entrance.depth)); y < column.top; y++) {
        carve(entrance.x, y, entrance.z, entrance.radius * 0.65);
      }
    }

    const chunkGroups = new Map();
    for (const chunk of chunks) chunkGroups.set(ChunkManager.key(chunk.cx, chunk.cz), chunk);

    for (const chunk of chunks) {
      const materialBuckets = new Map();
      for (let x = chunk.cx * CHUNK_SIZE; x < chunk.cx * CHUNK_SIZE + CHUNK_SIZE; x++) {
        for (let z = chunk.cz * CHUNK_SIZE; z < chunk.cz * CHUNK_SIZE + CHUNK_SIZE; z++) {
          const column = biomeByColumn.get(`${x},${z}`);
          if (!column) continue;
          for (let y = 0; y < column.top; y++) {
            if (!solid.has(key(x, y, z))) continue;
            const exposed = [
              [x + 1, y, z], [x - 1, y, z], [x, y + 1, z],
              [x, y - 1, z], [x, y, z + 1], [x, y, z - 1]
            ].some(([nx, ny, nz]) => !solid.has(key(nx, ny, nz)));
            if (!exposed) continue;
            const material = blockMaterial(this.materials, y, column.top - 1, column.cell.biome);
            const bucket = materialBuckets.get(material) || [];
            bucket.push({ x, y, z });
            materialBuckets.set(material, bucket);
          }
        }
      }

      const group = new THREE.Group();
      group.name = `Chunk_${chunk.cx}_${chunk.cz}`;
      for (const [material, blocks] of materialBuckets) {
        const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(this.blockSize, this.blockSize, this.blockSize), material, blocks.length);
        const matrix = new THREE.Matrix4();
        blocks.forEach((block, index) => {
          matrix.makeTranslation(block.x - world.size / 2 + 0.5, block.y + 0.5, block.z - world.size / 2 + 0.5);
          mesh.setMatrixAt(index, matrix);
        });
        mesh.instanceMatrix.needsUpdate = true;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
      }

      const outline = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(CHUNK_SIZE, WORLD_HEIGHT, CHUNK_SIZE)),
        new THREE.LineBasicMaterial({ color: 0x263238, transparent: true, opacity: 0.28 })
      );
      outline.position.set(
        chunk.cx * CHUNK_SIZE - world.size / 2 + CHUNK_SIZE / 2,
        WORLD_HEIGHT / 2,
        chunk.cz * CHUNK_SIZE - world.size / 2 + CHUNK_SIZE / 2
      );
      group.add(outline);
      this.group.add(group);
    }

    // Ocean remains a separate continuous surface for now.
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(world.size, world.size),
      this.materials.water
    );
    water.rotation.x = -Math.PI / 2;
    water.position.y = 2.05;
    this.group.add(water);

    return { chunks: chunks.length, solidBlocks: solid.size };
  }
}

export { WORLD_HEIGHT };
