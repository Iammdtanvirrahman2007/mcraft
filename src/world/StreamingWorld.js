import * as THREE from 'three';
import { InfiniteWorldGenerator, CHUNK_SIZE, WORLD_HEIGHT, SEA_LEVEL, chunkKey, worldToChunk } from './InfiniteWorldGenerator.js';

const FACE_OFFSETS = [
  [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]
];

export class StreamingWorld {
  constructor(scene, materials, seed = '739182', loadRadius = 2) {
    this.scene = scene;
    this.materials = materials;
    this.seedText = String(seed || '739182');
    this.generator = new InfiniteWorldGenerator(this.seedText);
    this.loadRadius = loadRadius;
    this.unloadRadius = loadRadius + 1;
    this.chunks = new Map();
    this.root = new THREE.Group();
    this.root.name = 'MCraft_StreamingWorld';
    this.scene.add(this.root);
    this.lastCenter = null;
    this.loading = false;
    this.preview = false;
  }

  setSeed(seed) {
    this.seedText = String(seed || '739182');
    this.generator = new InfiniteWorldGenerator(this.seedText);
    this.clear();
  }

  clear() {
    for (const entry of this.chunks.values()) this.disposeChunk(entry);
    this.chunks.clear();
    this.root.clear();
    this.lastCenter = null;
  }

  disposeChunk(entry) {
    entry.group.traverse(object => {
      if (object.geometry) object.geometry.dispose();
      if (object.material && object.material !== this.materials) {
        // Materials are shared by registry, so do not dispose them here.
      }
    });
    this.root.remove(entry.group);
  }

  isLoaded(cx, cz) {
    return this.chunks.has(chunkKey(cx, cz));
  }

  blockAt(x, y, z) {
    return this.generator.blockAt(x, y, z);
  }

  shouldRenderBlock(block) {
    for (const [dx, dy, dz] of FACE_OFFSETS) {
      if (!this.blockAt(block.x + dx, block.y + dy, block.z + dz)) return true;
    }
    return false;
  }

  buildChunk(cx, cz) {
    const data = this.generator.generateChunk(cx, cz);
    const group = new THREE.Group();
    group.name = `Chunk_${cx}_${cz}`;

    const buckets = new Map();
    for (const block of data.blocks) {
      if (!this.shouldRenderBlock(block)) continue;
      const list = buckets.get(block.type) || [];
      list.push(block);
      buckets.set(block.type, list);
    }

    for (const [type, blocks] of buckets) {
      const material = this.materials[type] || this.materials.stone;
      const mesh = new THREE.InstancedMesh(
        new THREE.BoxGeometry(1, 1, 1),
        material,
        blocks.length
      );
      const matrix = new THREE.Matrix4();
      for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];
        matrix.makeTranslation(block.x + 0.5, block.y + 0.5, block.z + 0.5);
        mesh.setMatrixAt(i, matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
      mesh.castShadow = type !== 'water';
      mesh.receiveShadow = true;
      mesh.userData.chunkKey = data.key;
      group.add(mesh);
    }

    const outline = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(CHUNK_SIZE, WORLD_HEIGHT, CHUNK_SIZE)),
      new THREE.LineBasicMaterial({ color: 0x29333a, transparent: true, opacity: 0.18 })
    );
    outline.position.set(cx * CHUNK_SIZE + CHUNK_SIZE / 2, WORLD_HEIGHT / 2, cz * CHUNK_SIZE + CHUNK_SIZE / 2);
    outline.visible = false;
    group.add(outline);

    group.position.set(0, 0, 0);
    this.root.add(group);
    const entry = { data, group };
    this.chunks.set(data.key, entry);
    return entry;
  }

  unload(cx, cz) {
    const key = chunkKey(cx, cz);
    const entry = this.chunks.get(key);
    if (!entry) return;
    this.disposeChunk(entry);
    this.chunks.delete(key);
  }

  update(playerX, playerZ) {
    const centerX = worldToChunk(playerX);
    const centerZ = worldToChunk(playerZ);
    const movedChunk = !this.lastCenter || centerX !== this.lastCenter.cx || centerZ !== this.lastCenter.cz;
    if (!movedChunk && !this.loading) return false;

    this.lastCenter = { cx: centerX, cz: centerZ };

    const desired = [];
    for (let dz = -this.loadRadius; dz <= this.loadRadius; dz++) {
      for (let dx = -this.loadRadius; dx <= this.loadRadius; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) <= this.loadRadius) {
          desired.push({ cx: centerX + dx, cz: centerZ + dz, d: Math.hypot(dx, dz) });
        }
      }
    }
    desired.sort((a, b) => a.d - b.d);

    this.loading = true;
    // Load a small batch per update so crossing a chunk does not freeze for a long time.
    let loadedThisPass = 0;
    for (const target of desired) {
      if (!this.isLoaded(target.cx, target.cz)) {
        this.buildChunk(target.cx, target.cz);
        loadedThisPass++;
        if (loadedThisPass >= 2) break;
      }
    }

    for (const key of [...this.chunks.keys()]) {
      const [cx, cz] = key.split(',').map(Number);
      if (Math.max(Math.abs(cx - centerX), Math.abs(cz - centerZ)) > this.unloadRadius) {
        this.unload(cx, cz);
      }
    }

    this.loading = desired.some(target => !this.isLoaded(target.cx, target.cz));
    return true;
  }

  getStats() {
    let blocks = 0;
    let caveBlocks = 0;
    let trees = 0;
    const biomeCounts = {};
    for (const entry of this.chunks.values()) {
      blocks += entry.data.solidBlocks;
      caveBlocks += entry.data.caveBlocks;
      trees += entry.data.treeCount;
      biomeCounts[entry.data.dominantBiome] = (biomeCounts[entry.data.dominantBiome] || 0) + 1;
    }
    const dominant = Object.entries(biomeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'plains';
    return {
      loadedChunks: this.chunks.size,
      blocks,
      caveBlocks,
      trees,
      dominantBiome: dominant,
      center: this.lastCenter
    };
  }
}

export { CHUNK_SIZE, WORLD_HEIGHT, SEA_LEVEL };
