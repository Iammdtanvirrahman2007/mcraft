import * as THREE from 'three';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/controls/OrbitControls.js';
import { InfiniteWorld } from './world/InfiniteWorld.js';
import { VoxelChunkRenderer } from './world/VoxelChunkRenderer.js';

const viewport = document.querySelector('#viewport');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9ec7e3);
scene.fog = new THREE.Fog(0x9ec7e3, 65, 175);

const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, .1, 500);
camera.position.set(12, 14, 12);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
viewport.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 5, 0);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * .49;
controls.minDistance = 4;
controls.maxDistance = 90;

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
  stone: new THREE.MeshStandardMaterial({ color: 0x666a68, roughness: 1 })
};

const voxelWorld = new VoxelChunkRenderer(scene, materials);
const infiniteWorld = new InfiniteWorld(voxelWorld, {
  seed: document.querySelector('#seed').value || '739182',
  viewDistance: 2,
  unloadDistance: 4
});

const player = { x: 0, y: 8, z: 0, speed: .45 };
const keys = new Set();
addEventListener('keydown', e => keys.add(e.key.toLowerCase()));
addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));

function movePlayer() {
  let dx = 0, dz = 0;
  if (keys.has('w')) dz -= player.speed;
  if (keys.has('s')) dz += player.speed;
  if (keys.has('a')) dx -= player.speed;
  if (keys.has('d')) dx += player.speed;
  if (dx || dz) {
    player.x += dx;
    player.z += dz;
    camera.position.x += dx;
    camera.position.z += dz;
    controls.target.x += dx;
    controls.target.z += dz;
  }
  if (keys.has('q')) player.y = Math.min(35, player.y + player.speed);
  if (keys.has('e')) player.y = Math.max(3, player.y - player.speed);
  camera.position.y = player.y + 5;
}

function updateUI(status) {
  document.querySelector('#coord').textContent = `${status.x}, ${status.z}`;
  document.querySelector('#chunkCoord').textContent = `${status.chunkX}, ${status.chunkZ}`;
  document.querySelector('#chunks').textContent = status.loadedChunks;
  document.querySelector('#seedStatus').textContent = infiniteWorld.seed;
}

function regenerate() {
  const seed = document.querySelector('#seed').value.trim() || '739182';
  infiniteWorld.setSeed(seed);
  updateUI(infiniteWorld.update(player.x, player.z));
}

document.querySelector('#generate').addEventListener('click', regenerate);
document.querySelector('#randomSeed').addEventListener('click', () => {
  document.querySelector('#seed').value = Math.floor(Math.random() * 999999999);
  regenerate();
});
document.querySelector('#seed').addEventListener('keydown', e => {
  if (e.key === 'Enter') regenerate();
});
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

updateUI(infiniteWorld.update(player.x, player.z));

function animate() {
  requestAnimationFrame(animate);
  movePlayer();
  updateUI(infiniteWorld.update(player.x, player.z));
  controls.update();
  renderer.render(scene, camera);
}
animate();
