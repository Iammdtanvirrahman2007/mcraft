export const CHUNK_SIZE = 16;

export class ChunkGenerator {
  constructor(WorldGenerator) {
    this.WorldGenerator = WorldGenerator;
  }

  generateChunk(chunkX, chunkZ, seedInput) {
    const localSeed = `${seedInput}:${chunkX}:${chunkZ}`;
    const world = new this.WorldGenerator(CHUNK_SIZE).generate(localSeed);
    return {
      chunkX,
      chunkZ,
      size: CHUNK_SIZE,
      blocks: world.cells,
      caves: world.caves || [],
      structures: world.villages || []
    };
  }
}
