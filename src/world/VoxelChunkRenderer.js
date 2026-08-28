import * as THREE from 'three';
import { CHUNK_SIZE, ChunkManager } from './ChunkManager.js';
import { WorldGenerator } from './WorldGenerator.js';

const WORLD_HEIGHT = 20;

function getTop(cell) {
  if (!cell || cell.biome === 'ocean') return 2;
  return Math.max(2, Math.min(WORLD_HEIGHT - 1, Math.floor(cell.height * 14) + 3));
}

function blockMaterial(materials, y, top, biome) {
  if (y === top - 1) return materials[biome] || materials.grass;
  if (y >= top - 3) return materials.dirt;
  return materials.stone;
}

function key(x, y, z) { return `${x},${y},${z}`; }

export class VoxelChunkRenderer {
  constructor(scene, materials) {
    this.scene = scene;
    this.materials = materials;
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.chunkManager = new ChunkManager(CHUNK_SIZE);
    this.blockSize = 1;
    this.preview = false;
    this.chunkGroups = new Map();
    this.chunkGenerator = new WorldGenerator(CHUNK_SIZE);
  }

  clear() {
    for (const [id, group] of this.chunkGroups) {
      group.traverse(object => { if (object.geometry) object.geometry.dispose(); });
      this.group.remove(group);
    }
    this.chunkGroups.clear();
    this.group.clear();
  }

  setPreview(enabled) {
    this.preview = enabled;
    this.group.traverse(object => {
      if (!object.isInstancedMesh || !object.material) return;
      object.material.transparent = enabled;
      object.material.opacity = enabled ? .22 : 1;
      object.material.depthWrite = !enabled;
      object.material.needsUpdate = true;
    });
  }

  build(world) {
    this.clear();
    const chunks = this.chunkManager.buildFromWorld(world);
    for (const chunk of chunks) this.renderChunk(chunk, world);
    return { chunks: chunks.length, solidBlocks: this.countSolidBlocks(chunks) };
  }

  buildChunk(cx, cz, seed) {
    const id = `${cx},${cz}`;
    if (this.chunkGroups.has(id)) return { cx, cz };

    const offsetX = cx * CHUNK_SIZE;
    const offsetZ = cz * CHUNK_SIZE;
    const local = this.chunkGenerator.generate(seed, offsetX, offsetZ);
    const chunk = {
      cx,
      cz,
      size: CHUNK_SIZE,
      cells: local.cells,
      caves: local.caves,
      structures: local.villages
    };

    this.renderChunk(chunk, local);
    return { cx, cz };
  }

  unloadChunk(cx, cz) {
    const id = `${cx},${cz}`;
    const group = this.chunkGroups.get(id);
    if (!group) return;
    group.traverse(object => { if (object.geometry) object.geometry.dispose(); });
    this.group.remove(group);
    this.chunkGroups.delete(id);
  }

  renderChunk(chunk, world) {
    const id = `${chunk.cx},${chunk.cz}`;
    this.unloadChunk(chunk.cx, chunk.cz);

    const group = new THREE.Group();
    group.name = `Chunk_${chunk.cx}_${chunk.cz}`;
    group.userData.chunkX = chunk.cx;
    group.userData.chunkZ = chunk.cz;

    const cells = chunk.cells || [];
    const biomeByColumn = new Map(cells.map(cell => [`${cell.x},${cell.z}`, { cell, top: getTop(cell) }]));
    const solid = new Set();
    for (const { cell, top } of biomeByColumn.values()) {
      if (cell.biome === 'ocean') continue;
      for (let y = 0; y < top; y++) solid.add(key(cell.x, y, cell.z));
    }

    const carve = (x, y, z, radius = 0) => {
      const r = Math.max(0, Math.ceil(radius));
      for (let dx = -r; dx <= r; dx++) {
        for (let dy = -r; dy <= r; dy++) {
          for (let dz = -r; dz <= r; dz++) {
            if (dx * dx + dy * dy + dz * dz <= radius * radius + .25) solid.delete(key(x + dx, y + dy, z + dz));
          }
        }
      }
    };

    for (const tunnel of world.caves?.tunnels || []) carve(tunnel.x, Math.max(2, Math.min(WORLD_HEIGHT - 2, Math.floor(tunnel.depth))), tunnel.z, Math.max(1, tunnel.radius));
    for (const chamber of world.caves?.chambers || []) carve(chamber.x, Math.max(2, Math.min(WORLD_HEIGHT - 2, Math.floor(chamber.depth))), chamber.z, Math.max(1.8, chamber.radius));
    for (const entrance of world.caves?.entrances || []) {
      const column = biomeByColumn.get(`${entrance.x},${entrance.z}`);
      if (!column) continue;
      for (let y = Math.max(1, Math.floor(entrance.depth)); y < column.top; y++) carve(entrance.x, y, entrance.z, entrance.radius * .65);
    }

    const buckets = new Map();
    for (const { cell, top } of biomeByColumn.values()) {
      for (let y = 0; y < top; y++) {
        if (!solid.has(key(cell.x, y, cell.z))) continue;
        const exposed = [[cell.x + 1, y, cell.z], [cell.x - 1, y, cell.z], [cell.x, y + 1, cell.z], [cell.x, y - 1, cell.z], [cell.x, y, cell.z + 1], [cell.x, y, cell.z - 1]].some(([x, yy, z]) => !solid.has(key(x, yy, z)));
        if (!exposed) continue;
        const material = blockMaterial(this.materials, y, top, cell.biome);
        const list = buckets.get(material) || [];
        list.push({ x: cell.x, y, z: cell.z });
        buckets.set(material, list);
      }
    }

    for (const [material, blocks] of buckets) {
      const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material, blocks.length);
      const matrix = new THREE.Matrix4();
      blocks.forEach((block, index) => {
        matrix.makeTranslation(block.x + .5, block.y + .5, block.z + .5);
        mesh.setMatrixAt(index, matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }

    const outline = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(CHUNK_SIZE, WORLD_HEIGHT, CHUNK_SIZE)),
      new THREE.LineBasicMaterial({ color: 0x263238, transparent: true, opacity: .22 })
    );
    outline.position.set(CHUNK_SIZE / 2, WORLD_HEIGHT / 2, CHUNK_SIZE / 2);
    group.position.set(chunk.cx * CHUNK_SIZE, 0, chunk.cz * CHUNK_SIZE);
    group.add(outline);

    this.group.add(group);
    this.chunkGroups.set(id, group);
    this.setPreview(this.preview);
  }

  countSolidBlocks(chunks) {
    let total = 0;
    for (const chunk of chunks) for (const cell of chunk.cells || []) total += getTop(cell);
    return total;
  }
}

export { WORLD_HEIGHT };
