import * as THREE from 'three';
import { InfiniteWorldGenerator, CHUNK_SIZE, WORLD_HEIGHT, chunkKey, worldToChunk } from './InfiniteWorldGenerator.js';

const FACE_OFFSETS = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];

export class StreamingWorld {
  constructor(scene, materials, seed = '739182', loadRadius = 2) {
    this.scene = scene;
    this.materials = materials;
    this.seed = String(seed || '739182');
    this.generator = new InfiniteWorldGenerator(this.seed);
    this.loadRadius = Math.max(1, loadRadius | 0);
    this.unloadRadius = this.loadRadius + 1;
    this.chunks = new Map();
    this.cache = new Map();
    this.cacheLimit = 64;
    this.edits = new Map();
    this.root = new THREE.Group();
    this.root.name = 'MCraft_World';
    this.scene.add(this.root);
    this.lastCenter = null;
    this.pending = new Set();
    this.queue = [];
    this.gridVisible = false;
    this.preview = false;
  }

  setSeed(seed) {
    this.seed = String(seed || '739182');
    this.generator = new InfiniteWorldGenerator(this.seed);
    this.loadEdits();
    this.clear();
  }

  clear() {
    for (const entry of this.chunks.values()) this.disposeChunk(entry);
    this.chunks.clear();
    this.cache.clear();
    this.root.clear();
    this.pending.clear();
    this.queue.length = 0;
    this.lastCenter = null;
  }

  disposeChunk(entry) {
    entry.group.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose();
    });
    this.root.remove(entry.group);
  }

  editKey(x, y, z) { return `${x},${y},${z}`; }

  loadEdits() {
    this.edits.clear();
    try {
      const raw = localStorage.getItem(`mcraft-edits:${this.seed}`);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      for (const [key, type] of Object.entries(parsed)) this.edits.set(key, type);
    } catch { /* storage can be unavailable in private/restricted contexts */ }
  }

  saveEdits() {
    try {
      const object = Object.fromEntries(this.edits);
      localStorage.setItem(`mcraft-edits:${this.seed}`, JSON.stringify(object));
    } catch { /* ignore quota/storage errors */ }
  }

  blockAt(x, y, z) {
    if (y < 0 || y >= WORLD_HEIGHT) return false;
    const key = this.editKey(x, y, z);
    if (this.edits.has(key)) return this.edits.get(key) !== null;
    return this.generator.blockAt(x, y, z);
  }

  materializeEdits(data) {
    const map = new Map(data.blocks.map(b => [this.editKey(b.x, b.y, b.z), b]));
    for (const [key, type] of this.edits) {
      const [x, y, z] = key.split(',').map(Number);
      const inChunk = worldToChunk(x) === data.cx && worldToChunk(z) === data.cz;
      if (!inChunk || y < 0 || y >= WORLD_HEIGHT) continue;
      if (type === null) map.delete(key);
      else map.set(key, { x, y, z, type });
    }
    data.blocks = [...map.values()];
    data.solidBlocks = data.blocks.length;
  }

  exposed(block) {
    return FACE_OFFSETS.some(([dx,dy,dz]) => !this.blockAt(block.x + dx, block.y + dy, block.z + dz));
  }

  addInstancedBucket(group, type, blocks, castShadow = true) {
    if (!blocks.length) return;
    const material = this.materials[type] || this.materials.stone;
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material, blocks.length);
    const matrix = new THREE.Matrix4();
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      matrix.makeTranslation(b.x + 0.5, b.y + 0.5, b.z + 0.5);
      mesh.setMatrixAt(i, matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = castShadow;
    mesh.receiveShadow = true;
    mesh.userData.mcraftChunk = group.name;
    mesh.userData.blockType = type;
    mesh.userData.blocks = blocks;
    group.add(mesh);
  }

  buildChunk(cx, cz) {
    const key = chunkKey(cx, cz);
    if (this.chunks.has(key)) return this.chunks.get(key);

    let data = this.cache.get(key);
    if (data) this.cache.delete(key);
    else data = this.generator.generateChunk(cx, cz);
    this.materializeEdits(data);

    const group = new THREE.Group();
    group.name = `Chunk_${cx}_${cz}`;
    const buckets = new Map();
    for (const block of data.blocks) {
      if (!this.exposed(block)) continue;
      const list = buckets.get(block.type) || [];
      list.push(block);
      buckets.set(block.type, list);
    }
    for (const [type, blocks] of buckets) this.addInstancedBucket(group, type, blocks, type !== 'water');

    // Render deterministic trees that the generator already creates.
    for (const tree of data.trees) {
      const trunk = [];
      const leaves = [];
      const height = tree.type === 'pine' ? 5 : tree.type === 'jungle' ? 6 : 4;
      for (let y = 0; y < height; y++) trunk.push({ x: tree.x - 0.5, y: tree.y + y, z: tree.z - 0.5 });
      const top = tree.y + height;
      const radius = tree.type === 'jungle' ? 2 : 1;
      for (let y = top - 2; y <= top; y++) {
        const r = y === top ? 1 : radius;
        for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
          if (Math.abs(dx) + Math.abs(dz) <= r + 1) leaves.push({ x: tree.x - 0.5 + dx, y, z: tree.z - 0.5 + dz });
        }
      }
      this.addInstancedBucket(group, 'trunk', trunk, true);
      this.addInstancedBucket(group, 'leaves', leaves, true);
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
    this.setPreview(this.preview);
    return entry;
  }

  rebuildChunk(cx, cz) {
    const key = chunkKey(cx, cz);
    const old = this.chunks.get(key);
    if (old) this.disposeChunk(old);
    this.chunks.delete(key);
    this.cache.delete(key);
    this.buildChunk(cx, cz);
  }

  setBlock(x, y, z, type = null) {
    x = Math.floor(x); y = Math.floor(y); z = Math.floor(z);
    if (y < 0 || y >= WORLD_HEIGHT) return false;
    this.edits.set(this.editKey(x, y, z), type);
    this.saveEdits();
    this.rebuildChunk(worldToChunk(x), worldToChunk(z));
    return true;
  }

  setGridVisible(enabled) {
    this.gridVisible = !!enabled;
    this.root.traverse(obj => { if (obj.userData?.chunkGrid) obj.visible = this.gridVisible; });
  }

  setPreview(enabled) {
    this.preview = !!enabled;
    this.root.traverse(obj => {
      if (!obj.isInstancedMesh || !obj.material) return;
      obj.material.transparent = this.preview;
      obj.material.opacity = this.preview ? 0.28 : 1;
      obj.material.depthWrite = !this.preview;
      obj.material.needsUpdate = true;
    });
  }

  unload(cx, cz) {
    const key = chunkKey(cx, cz);
    const entry = this.chunks.get(key);
    if (!entry) return;
    this.disposeChunk(entry);
    this.chunks.delete(key);
    this.cache.set(key, entry.data);
    while (this.cache.size > this.cacheLimit) this.cache.delete(this.cache.keys().next().value);
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
    for (const target of targets) {
      const key = chunkKey(target.cx, target.cz);
      if (!this.chunks.has(key) && !this.pending.has(key)) {
        this.pending.add(key);
        this.queue.push(target);
      }
    }
    this.queue.sort((a,b) => a.d - b.d);

    // One chunk per frame keeps the camera responsive while traveling through new terrain.
    const next = this.queue.shift();
    if (next) {
      const key = chunkKey(next.cx, next.cz);
      if (!this.chunks.has(key)) this.buildChunk(next.cx, next.cz);
      this.pending.delete(key);
    }

    for (const key of [...this.chunks.keys()]) {
      const [cx, cz] = key.split(',').map(Number);
      if (Math.max(Math.abs(cx - centerX), Math.abs(cz - centerZ)) > this.unloadRadius) this.unload(cx, cz);
    }

    return {
      moved,
      centerX,
      centerZ,
      complete: targets.every(t => this.chunks.has(chunkKey(t.cx, t.cz))),
      queued: this.queue.length
    };
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
      queued: this.queue.length,
      edits: this.edits.size,
      dominantBiome: Object.entries(biomes).sort((a,b) => b[1]-a[1])[0]?.[0] || 'plains',
      center: this.lastCenter
    };
  }
}

export { CHUNK_SIZE, WORLD_HEIGHT };
