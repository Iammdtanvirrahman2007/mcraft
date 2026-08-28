import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { StreamingWorld } from './world/StreamingWorld.js';
import { CHUNK_SIZE, WORLD_HEIGHT } from './world/InfiniteWorldGenerator.js';

const viewport = document.querySelector('#viewport');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9ec7e3);
scene.fog = new THREE.Fog(0x9ec7e3, 70, 190);

const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 600);
camera.position.set(0, 24, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
viewport.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xe8f6ff, 0x352a20, 2.0));
const sun = new THREE.DirectionalLight(0xffffff, 3.0);
sun.position.set(60, 90, 35);
sun.castShadow = true;
scene.add(sun);

const materials = {
  grass: new THREE.MeshStandardMaterial({ color: 0x5c9e48, roughness: 1 }),
  plains: new THREE.MeshStandardMaterial({ color: 0x7fae55, roughness: 1 }),
  forest: new THREE.MeshStandardMaterial({ color: 0x4d8b43, roughness: 1 }),
  jungle: new THREE.MeshStandardMaterial({ color: 0x2f8c50, roughness: 1 }),
  taiga: new THREE.MeshStandardMaterial({ color: 0x568267, roughness: 1 }),
  desert: new THREE.MeshStandardMaterial({ color: 0xd9bd70, roughness: 1 }),
  beach: new THREE.MeshStandardMaterial({ color: 0xe3cf8b, roughness: 1 }),
  mountain: new THREE.MeshStandardMaterial({ color: 0x777d76, roughness: 1 }),
  snow: new THREE.MeshStandardMaterial({ color: 0xe9f0f0, roughness: 0.9 }),
  dirt: new THREE.MeshStandardMaterial({ color: 0x855a3b, roughness: 1 }),
  stone: new THREE.MeshStandardMaterial({ color: 0x666a68, roughness: 1 }),
  sand: new THREE.MeshStandardMaterial({ color: 0xd9bd70, roughness: 1 }),
  water: new THREE.MeshStandardMaterial({ color: 0x3c9fd0, transparent: true, opacity: 0.78, roughness: 0.1 }),
  trunk: new THREE.MeshStandardMaterial({ color: 0x76502f, roughness: 1 }),
  leaves: new THREE.MeshStandardMaterial({ color: 0x34713d, roughness: 1 })
};

const world = new StreamingWorld(scene, materials, document.querySelector('#seed').value || '739182', 2);
const controls = new PointerLockControls(camera, renderer.domElement);

renderer.domElement.addEventListener('click', () => controls.lock());
controls.addEventListener('lock', () => { document.querySelector('#status').textContent = 'Streaming world...'; });
controls.addEventListener('unlock', () => { document.querySelector('#status').textContent = 'Mouse released'; });

const keys = new Set();
addEventListener('keydown', event => keys.add(event.code));
addEventListener('keyup', event => keys.delete(event.code));

const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
let lastTime = performance.now();

function movePlayer(delta) {
  const speed = keys.has('ShiftLeft') || keys.has('ShiftRight') ? 22 : 10;
  direction.set(0, 0, 0);
  if (keys.has('KeyW')) direction.z -= 1;
  if (keys.has('KeyS')) direction.z += 1;
  if (keys.has('KeyA')) direction.x -= 1;
  if (keys.has('KeyD')) direction.x += 1;
  if (keys.has('Space')) direction.y += 1;
  if (keys.has('ControlLeft') || keys.has('ControlRight')) direction.y -= 1;
  if (direction.lengthSq()) direction.normalize().multiplyScalar(speed * delta);
  controls.moveRight(direction.x);
  controls.moveForward(-direction.z);
  camera.position.y += direction.y;
  camera.position.y = Math.max(1.5, Math.min(WORLD_HEIGHT - 1, camera.position.y));
}

function updateUI() {
  const x = Math.floor(camera.position.x);
  const z = Math.floor(camera.position.z);
  const cx = Math.floor(camera.position.x / CHUNK_SIZE);
  const cz = Math.floor(camera.position.z / CHUNK_SIZE);
  const stats = world.getStats();
  document.querySelector('#coord').textContent = `${x}, ${z}`;
  document.querySelector('#chunkCoord').textContent = `${cx}, ${cz}`;
  document.querySelector('#chunks').textContent = String(stats.loadedChunks);
  document.querySelector('#blocks').textContent = stats.blocks.toLocaleString();
  document.querySelector('#caveBlocks').textContent = stats.caves.toLocaleString();
  document.querySelector('#seedStatus').textContent = world.seed;
  document.querySelector('#status').textContent = `Loaded ${stats.loadedChunks} chunks${stats.loadedChunks ? ` • ${stats.dominantBiome}` : ''}`;
}

function regenerate() {
  const seed = document.querySelector('#seed').value.trim() || '739182';
  world.setSeed(seed);
  world.update(camera.position.x, camera.position.z);
  updateUI();
}

document.querySelector('#generate').addEventListener('click', regenerate);
document.querySelector('#randomSeed').addEventListener('click', () => {
  document.querySelector('#seed').value = Math.floor(Math.random() * 999999999);
  regenerate();
});
document.querySelector('#seed').addEventListener('keydown', event => { if (event.key === 'Enter') regenerate(); });
document.querySelector('#toggleGrid').addEventListener('click', event => {
  const enabled = !world.gridVisible;
  world.setGridVisible(enabled);
  event.currentTarget.textContent = enabled ? '▦ Hide Chunk Grid' : '▦ Show Chunk Grid';
});
document.querySelector('#cavePreview').addEventListener('click', event => {
  const enabled = !world.preview;
  world.setPreview(enabled);
  event.currentTarget.textContent = enabled ? '🧱 Normal View' : '🕳️ Cave Preview';
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

world.update(camera.position.x, camera.position.z);
updateUI();

function animate(now) {
  requestAnimationFrame(animate);
  const delta = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  movePlayer(delta);
  world.update(camera.position.x, camera.position.z);
  updateUI();
  renderer.render(scene, camera);
}
requestAnimationFrame(animate);
