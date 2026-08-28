import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/GLTFLoader.js';

export class AssetLoader {
  constructor() {
    this.loader = new GLTFLoader();
    this.cache = new Map();
  }

  async load(asset) {
    if (!asset?.model) throw new Error('Asset is missing a model path.');
    if (this.cache.has(asset.model)) return this.cache.get(asset.model).clone(true);

    const gltf = await this.loader.loadAsync(asset.model);
    const template = gltf.scene;
    template.traverse(object => {
      if (object.isMesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
    this.cache.set(asset.model, template);
    return template.clone(true);
  }

  has(modelPath) {
    return this.cache.has(modelPath);
  }

  clear() {
    this.cache.clear();
  }
}

export const assetLoader = new AssetLoader();
