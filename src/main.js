import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/controls/OrbitControls.js';
import { WorldGenerator } from './world/WorldGenerator.js';

const viewport = document.querySelector('#viewport');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9ec7e3);
scene.fog = new THREE.Fog(0x9ec7e3, 35, 105);

const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, .1, 250);
camera.position.set(42, 48, 52);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
viewport.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 0);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * .49;
controls.minDistance = 12;
controls.maxDistance = 115;

scene.add(new THREE.HemisphereLight(0xdff4ff, 0x526044, 2.2));
const sun = new THREE.DirectionalLight(0xffffff, 3.2);
sun.position.set(35, 70, 20);
sun.castShadow = true;
scene.add(sun);

const materials = {
  grass: new THREE.MeshStandardMaterial({ color: 0x5c9e48, roughness: 1 }),
  forest: new THREE.MeshStandardMaterial({ color: 0x4d8b43, roughness: 1 }),
  jungle: new THREE.MeshStandardMaterial({ color: 0x2f8c50, roughness: 1 }),
  taiga: new THREE.MeshStandardMaterial({ color: 0x568267, roughness: 1 }),
  desert: new THREE.MeshStandardMaterial({ color: 0xd9bd70, roughness: 1 }),
  beach: new THREE.MeshStandardMaterial({ color: 0xe3cf8b, roughness: 1 }),
  mountain: new THREE.MeshStandardMaterial({ color: 0x777d76, roughness: 1 }),
  snow: new THREE.MeshStandardMaterial({ color: 0xe9f0f0, roughness: .9 }),
  water: new THREE.MeshStandardMaterial({ color: 0x3c9fd0, transparent: true, opacity: .82, roughness: .1 }),
  trunk: new THREE.MeshStandardMaterial({ color: 0x76502f }),
  leaves: new THREE.MeshStandardMaterial({ color: 0x34713d }),
  village: new THREE.MeshStandardMaterial({ color: 0xb97845 }),
  roof: new THREE.MeshStandardMaterial({ color: 0x7a4432 })
};

let worldGroup = new THREE.Group();
scene.add(worldGroup);

function clearWorld() {
  scene.remove(worldGroup);
  worldGroup.traverse(obj => {
    if (obj.geometry) obj.geometry.dispose();
  });
  worldGroup = new THREE.Group();
  scene.add(worldGroup);
}

function addTree(x, y, z, scale = 1) {
  const trunk = new THREE.Mesh(new THREE.BoxGeometry(.34 * scale, 1.7 * scale, .34 * scale), materials.trunk);
  trunk.position.set(x, y + .85 * scale, z);
  trunk.castShadow = true;
  worldGroup.add(trunk);
  const leaves = new THREE.Mesh(new THREE.ConeGeometry(1.25 * scale, 2.9 * scale, 7), materials.leaves);
  leaves.position.set(x, y + 2.35 * scale, z);
  leaves.castShadow = true;
  worldGroup.add(leaves);
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
    worldGroup.add(body);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.15, 1.45, 4), materials.roof);
    roof.rotation.y = Math.PI / 4;
    roof.position.set(px, y + 2.82, pz);
    roof.castShadow = true;
    worldGroup.add(roof);
  }
}

function buildWorld(data) {
  clearWorld();
  const block = new THREE.BoxGeometry(1, 1, 1);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(data.size, data.size), materials.water);
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.28;
  worldGroup.add(water);

  for (const cell of data.cells) {
    const y = Math.max(.45, Math.floor(cell.height * 10) / 2 + .5);
    if (cell.biome === 'ocean') continue;
    const mat = materials[cell.biome] || materials.grass;
    const terrain = new THREE.Mesh(block, mat);
    terrain.scale.y = y;
    terrain.position.set(cell.x - data.size / 2, y / 2, cell.z - data.size / 2);
    terrain.receiveShadow = true;
    terrain.castShadow = cell.biome === 'mountain' || cell.biome === 'snow';
    worldGroup.add(terrain);
    if (cell.tree) addTree(cell.x - data.size / 2, y, cell.z - data.size / 2, cell.biome === 'jungle' ? 1.2 : .85);
  }

  for (const village of data.villages) {
    const cell = data.cells.find(c => c.x === village.x && c.z === village.z);
    if (!cell) continue;
    const y = Math.max(.5, Math.floor(cell.height * 10) / 2 + .5);
    addVillage(village.x - data.size / 2, y, village.z - data.size / 2, village.type === 'large' ? 2 : 1);
  }

  controls.target.set(0, 1, 0);
}

function generate() {
  const seed = document.querySelector('#seed').value.trim() || '739182';
  const size = Number(document.querySelector('#worldSize').value);
  const data = new WorldGenerator(size).generate(seed);
  buildWorld(data);
  document.querySelector('#biome').textContent = data.dominantBiome;
  document.querySelector('#trees').textContent = data.treeCount;
  document.querySelector('#villages').textContent = data.villages.length;
  document.querySelector('#water').textContent = `${data.waterPercent}%`;
}

document.querySelector('#generate').addEventListener('click', generate);
document.querySelector('#randomSeed').addEventListener('click', () => {
  document.querySelector('#seed').value = Math.floor(Math.random() * 999999999);
  generate();
});
document.querySelector('#seed').addEventListener('keydown', e => { if (e.key === 'Enter') generate(); });

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
generate();
animate();
