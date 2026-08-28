import * as THREE from 'three';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/controls/OrbitControls.js';
import { WorldGenerator } from './world/WorldGenerator.js';
import { VoxelChunkRenderer } from './world/VoxelChunkRenderer.js';

const viewport = document.querySelector('#viewport');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9ec7e3);
scene.fog = new THREE.Fog(0x9ec7e3, 55, 150);

const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, .1, 300);
camera.position.set(42, 35, 42);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
viewport.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 5, 0);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * .92;
controls.minDistance = 7;
controls.maxDistance = 150;

scene.add(new THREE.HemisphereLight(0xdff4ff, 0x30251b, 2.2));
const sun = new THREE.DirectionalLight(0xffffff, 3.2);
sun.position.set(35, 70, 20);
sun.castShadow = true;
scene.add(sun);

const materials = {
  grass: new THREE.MeshStandardMaterial({ color: 0x5c9e48, roughness: 1 }),
  plains: new THREE.MeshStandardMaterial({ color: 0x75a84d, roughness: 1 }),
  forest: new THREE.MeshStandardMaterial({ color: 0x4d8b43, roughness: 1 }),
  jungle: new THREE.MeshStandardMaterial({ color: 0x2f8c50, roughness: 1 }),
  taiga: new THREE.MeshStandardMaterial({ color: 0x568267, roughness: 1 }),
  desert: new THREE.MeshStandardMaterial({ color: 0xd9bd70, roughness: 1 }),
  beach: new THREE.MeshStandardMaterial({ color: 0xe3cf8b, roughness: 1 }),
  mountain: new THREE.MeshStandardMaterial({ color: 0x777d76, roughness: 1 }),
  snow: new THREE.MeshStandardMaterial({ color: 0xe9f0f0, roughness: .9 }),
  dirt: new THREE.MeshStandardMaterial({ color: 0x855a3b, roughness: 1 }),
  stone: new THREE.MeshStandardMaterial({ color: 0x666a68, roughness: 1 }),
  water: new THREE.MeshStandardMaterial({ color: 0x3c9fd0, transparent: true, opacity: .78, roughness: .1 }),
  trunk: new THREE.MeshStandardMaterial({ color: 0x76502f }),
  leaves: new THREE.MeshStandardMaterial({ color: 0x34713d }),
  village: new THREE.MeshStandardMaterial({ color: 0xb97845 }),
  roof: new THREE.MeshStandardMaterial({ color: 0x7a4432 })
};

const voxelWorld = new VoxelChunkRenderer(scene, materials);
const decorationGroup = new THREE.Group();
decorationGroup.name = 'MCraft_Decorations';
scene.add(decorationGroup);

function clearDecorations() {
  decorationGroup.traverse(object => {
    if (object.geometry) object.geometry.dispose();
  });
  decorationGroup.clear();
}

function addTree(x, y, z, scale = 1) {
  const trunk = new THREE.Mesh(new THREE.BoxGeometry(.34 * scale, 1.7 * scale, .34 * scale), materials.trunk);
  trunk.position.set(x, y + .85 * scale, z);
  trunk.castShadow = true;
  decorationGroup.add(trunk);
  const leaves = new THREE.Mesh(new THREE.ConeGeometry(1.25 * scale, 2.9 * scale, 7), materials.leaves);
  leaves.position.set(x, y + 2.35 * scale, z);
  leaves.castShadow = true;
  decorationGroup.add(leaves);
}

function addVillage(x, y, z, size = 1) {
  const count = size > 1 ? 5 : 3;
  for (let i = 0; i < count; i++) {
    const angle = i / count * Math.PI * 2;
    const px = x + Math.cos(angle) * (4 + i);
    const pz = z + Math.sin(angle) * (4 + i);
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.1, 2.6), materials.village);
    body.position.set(px, y + 1.05, pz);
    body.castShadow = true;
    decorationGroup.add(body);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.15, 1.45, 4), materials.roof);
    roof.rotation.y = Math.PI / 4;
    roof.position.set(px, y + 2.82, pz);
    roof.castShadow = true;
    decorationGroup.add(roof);
  }
}

function generate() {
  clearDecorations();
  const seed = document.querySelector('#seed').value.trim() || '739182';
  const size = Number(document.querySelector('#worldSize').value);
  const data = new WorldGenerator(size).generate(seed);
  const result = voxelWorld.build(data);

  for (const cell of data.cells) {
    if (!cell.tree || cell.biome === 'ocean') continue;
    const y = Math.max(2, Math.min(19, Math.floor(cell.height * 14) + 3));
    addTree(cell.x - data.size / 2 + .5, y, cell.z - data.size / 2 + .5, cell.biome === 'jungle' ? 1.2 : .85);
  }

  for (const village of data.villages) {
    const cell = data.cells.find(c => c.x === village.x && c.z === village.z);
    if (!cell) continue;
    const y = Math.max(2, Math.min(19, Math.floor(cell.height * 14) + 3));
    addVillage(village.x - data.size / 2 + .5, y, village.z - data.size / 2 + .5, village.type === 'large' ? 2 : 1);
  }

  controls.target.set(0, 5, 0);
  document.querySelector('#biome').textContent = data.dominantBiome;
  document.querySelector('#trees').textContent = data.treeCount;
  document.querySelector('#villages').textContent = data.villages.length;
  document.querySelector('#water').textContent = `${data.waterPercent}%`;
  document.querySelector('#caves').textContent = `${data.caves.chamberCount} / ${data.caves.entranceCount}`;
  document.querySelector('#chunks').textContent = result.chunks;
  document.querySelector('#blocks').textContent = result.solidBlocks.toLocaleString();
}

document.querySelector('#generate').addEventListener('click', generate);
document.querySelector('#randomSeed').addEventListener('click', () => {
  document.querySelector('#seed').value = Math.floor(Math.random() * 999999999);
  generate();
});
document.querySelector('#seed').addEventListener('keydown', e => { if (e.key === 'Enter') generate(); });
document.querySelector('#cavePreview').addEventListener('click', event => {
  const enabled = !voxelWorld.preview;
  voxelWorld.setPreview(enabled);
  event.currentTarget.textContent = enabled ? '🧱 Hide Underground' : '🕳️ Show Underground';
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

generate();
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();
