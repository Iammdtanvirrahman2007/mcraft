import * as THREE from 'three';
import { InfiniteWorldGenerator, CHUNK_SIZE, WORLD_HEIGHT, chunkKey, worldToChunk } from './InfiniteWorldGenerator.js';

const FACE_OFFSETS = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];

export class StreamingWorld {
  constructor(scene, materials, seed = '739182', loadRadius = 2) {
    this.scene = scene;
    this.materials = materials;
    this.seed = String(seed || '739182');
    this.generator = new InfiniteWorldGenerator(this.seed);
    this.loadRadius = loadRadius;
    this.unloadRadius = loadRadius + 1;
    this.chunks = new Map();
    this.root = new THREE.Group();
    this.root.name = 'MCraft_World';
    this.scene.add(this.root);
    this.lastCenter = null;
    this.pending = new Set();
    this.gridVisible = false;
    this.preview = false;
  }

  setSeed(seed) {
    this.seed = String(seed || '739182');
    this.generator = new InfiniteWorldGenerator(this.seed);
    this.clear();
  }

  clear() {
    for (const entry of this.chunks.values()) this.disposeChunk(entry);
    this.chunks.clear();
    this.root.clear();
    this.pending.clear();
    this.lastCenter = null;
  }

  disposeChunk(entry) {
    entry.group.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material && obj.material.isMaterial && obj.material.userData?.mcraftOwned) obj.material.dispose();
    });
    this.root.remove(entry.group);
  }

  blockAt(x, y, z) {
    return this.generator.blockAt(x, y, z);
  }

  exposed(block) {
    return FACE_OFFSETS.some(([dx,dy,dz]) => !this.blockAt(block.x + dx, block.y + dy, block.z + dz));
  }

  buildChunk(cx, cz) {
    const key = chunkKey(cx, cz);
    if (this.chunks.has(key)) return this.chunks.get(key);
    const data = this.generator.generateChunk(cx, cz);
    const group = new THREE.Group();
    group.name = `Chunk_${cx}_${cz}`;
    const buckets = new Map();

    for (const block of data.blocks) {
      if (!this.exposed(block)) continue;
      const list = buckets.get(block.type) || [];
      list.push(block);
      buckets.set(block.type, list);
    }

    for (const [type, blocks] of buckets) {
      const material = this.materials[type] || this.materials.stone;
      const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1), material, blocks.length);
      const matrix = new THREE.Matrix4();
      for (let i = 0; i < blocks.length; i++) {
        const b = blocks[i];
        matrix.makeTranslation(b.x + 0.5, b.y + 0.5, b.z + 0.5);
        mesh.setMatrixAt(i, matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
      mesh.castShadow = type !== 'water';
      mesh.receiveShadow = true;
      mesh.userData.mcraftChunk = key;
      group.add(mesh);
    }

    const grid = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(CHUNK_SIZE, WORLD_HEIGHT, CHUNK_SIZE)),
      new THREE.LineBasicMaterial({ color: 0x1b2328, transparent: true, opacity: 0.22 })
    );
    grid.position.set(cx * CHUNK_SIZE + CHUNK_SIZE / 2, WORLD_HEIGHT / 2, cz * CHUNK_SIZE + CHUNK_SIZE / 2);
    grid.visible = this.gridVisible;
    grid.userData.chunkGrid = true;
    group.add(grid);

    this.root.add(group);
    const entry = { data, group };
    this.chunks.set(key, entry);
    return entry;
  }

  setGridVisible(enabled) {
    this.gridVisible = enabled;
    this.root.traverse(obj => { if (obj.userData?.chunkGrid) obj.visible = enabled; });
  }

  setPreview(enabled) {
    this.preview = enabled;
    this.root.traverse(obj => {
      if (!obj.isInstancedMesh || !obj.material) return;
      obj.material.transparent = enabled;
      obj.material.opacity = enabled ? 0.28 : 1;
      obj.material.depthWrite = !enabled;
      obj.material.needsUpdate = true;
    });
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
    const moved = !this.lastCenter || centerX !== this.lastCenter.cx || centerZ !== this.lastCenter.cz;
    this.lastCenter = { cx: centerX, cz: centerZ };

    const targets = [];
    for (let dz = -this.loadRadius; dz <= this.loadRadius; dz++) {
      for (let dx = -this.loadRadius; dx <= this.loadRadius; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) <= this.loadRadius) {
          targets.push({ cx: centerX + dx, cz: centerZ + dz, d: Math.hypot(dx, dz) });
        }
      }
    }
    targets.sort((a,b) => a.d - b.d);

    let added = 0;
    for (const target of targets) {
      const key = chunkKey(target.cx, target.cz);
      if (!this.chunks.has(key) && !this.pending.has(key)) {
        this.pending.add(key);
        this.buildChunk(target.cx, target.cz);
        this.pending.delete(key);
        added++;
        if (added >= 2) break;
      }
    }

    for (const key of [...this.chunks.keys()]) {
      const [cx, cz] = key.split(',').map(Number);
      if (Math.max(Math.abs(cx - centerX), Math.abs(cz - centerZ)) > this.unloadRadius) this.unload(cx, cz);
    }

    const complete = targets.every(t => this.chunks.has(chunkKey(t.cx, t.cz)));
    return { moved, centerX, centerZ, complete };
  }

  getStats() {
    let blocks = 0, caves = 0, trees = 0;
    const biomes = {};
    for (const entry of this.chunks.values()) {
      blocks += entry.data.solidBlocks;
      caves += entry.data.caveBlocks;
      trees += entry.data.trees.length;
      biomes[entry.data.dominantBiome] = (biomes[entry.data.dominantBiome] || 0) + 1;
    }
    return {
      loadedChunks: this.chunks.size,
      blocks,
      caves,
      trees,
      dominantBiome: Object.entries(biomes).sort((a,b) => b[1]-a[1])[0]?.[0] || 'plains',
      center: this.lastCenter
    };
  }
}

export { CHUNK_SIZE, WORLD_HEIGHT };
