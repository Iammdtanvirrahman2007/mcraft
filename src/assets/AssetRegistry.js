const ASSETS = [
  {
    id: 'oak-tree',
    type: 'tree',
    model: './assets/trees/oak/model.glb',
    config: './assets/trees/oak/config.json'
  },
  {
    id: 'pond',
    type: 'water',
    model: './assets/water/pond/model.glb',
    config: './assets/water/pond/config.json'
  },
  {
    id: 'sea',
    type: 'water',
    model: './assets/water/sea/model.glb',
    config: './assets/water/sea/config.json'
  }
];

export class AssetRegistry {
  constructor(definitions = ASSETS) {
    this.assets = new Map(definitions.map(asset => [asset.id, asset]));
  }

  get(id) {
    return this.assets.get(id) || null;
  }

  byType(type) {
    return [...this.assets.values()].filter(asset => asset.type === type);
  }

  all() {
    return [...this.assets.values()];
  }
}

export const assetRegistry = new AssetRegistry();
