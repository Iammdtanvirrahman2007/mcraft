export const CHUNK_SIZE = 16;

export class ChunkManager {
  constructor(chunkSize = CHUNK_SIZE) {
    this.chunkSize = chunkSize;
    this.chunks = new Map();
  }

  static key(cx, cz) {
    return `${cx},${cz}`;
  }

  buildFromWorld(world) {
    this.chunks.clear();
    const addChunk = (cx, cz) => {
      const key = ChunkManager.key(cx, cz);
      if (!this.chunks.has(key)) {
        this.chunks.set(key, { cx, cz, size: this.chunkSize, cells: [], caves: [], structures: [] });
      }
      return this.chunks.get(key);
    };

    for (const cell of world.cells) {
      addChunk(Math.floor(cell.x / this.chunkSize), Math.floor(cell.z / this.chunkSize)).cells.push(cell);
    }
    for (const cave of world.caves?.tunnels || []) {
      addChunk(Math.floor(cave.x / this.chunkSize), Math.floor(cave.z / this.chunkSize)).caves.push(cave);
    }
    for (const cave of world.caves?.chambers || []) {
      addChunk(Math.floor(cave.x / this.chunkSize), Math.floor(cave.z / this.chunkSize)).caves.push({ ...cave, kind: 'chamber' });
    }
    for (const entrance of world.caves?.entrances || []) {
      addChunk(Math.floor(entrance.x / this.chunkSize), Math.floor(entrance.z / this.chunkSize)).caves.push({ ...entrance, kind: 'entrance' });
    }
    for (const structure of world.villages || []) {
      addChunk(Math.floor(structure.x / this.chunkSize), Math.floor(structure.z / this.chunkSize)).structures.push(structure);
    }

    return this.getAll();
  }

  get(cx, cz) {
    return this.chunks.get(ChunkManager.key(cx, cz));
  }

  getAll() {
    return [...this.chunks.values()];
  }
}
