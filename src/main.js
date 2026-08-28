import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { StreamingWorld } from './world/StreamingWorld.js';
import { CHUNK_SIZE, WORLD_HEIGHT } from './world/InfiniteWorldGenerator.js';

const $ = selector => document.querySelector(selector);
const viewport = $('#viewport');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9ec7e3);
scene.fog = new THREE.Fog(0x9ec7e3, 70, 190);

const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 600);
camera.position.set(0, 24, 0);

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
viewport.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xe8f6ff, 0x352a20, 2.0));
const sun = new THREE.DirectionalLight(0xffffff, 3.0);
sun.position.set(60, 90, 35);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
scene.add(sun);

// Texture system: upload/replace files in assets/textures/ and the game picks them up automatically.
// Recommended: 16x16 square pixel-art JPG/PNG. 32x32 and 64x64 are also supported.
const textureLoader = new THREE.TextureLoader();
const textureFiles = {
  grass: 'grass.jpg',
  dirt: 'dirt.jpg',
  stone: 'stone.jpg',
  sand: 'sand.jpg',
  leaves: 'leaves.jpg',
  trunk: 'trunk.jpg',
  water: 'water.jpg',
  snow: 'snow.jpg',
  mountain: 'mountain.jpg',
  plains: 'plains.jpg',
  forest: 'forest.jpg',
  jungle: 'jungle.jpg',
  taiga: 'taiga.jpg',
  desert: 'desert.jpg',
  beach: 'beach.jpg'
};

const fallbackColors = {
  grass: 0x5c9e48, plains: 0x7fae55, forest: 0x4d8b43, jungle: 0x2f8c50,
  taiga: 0x568267, desert: 0xd9bd70, beach: 0xe3cf8b, mountain: 0x777d76,
  snow: 0xe9f0f0, dirt: 0x855a3b, stone: 0x666a68, sand: 0xd9bd70,
  water: 0x3c9fd0, trunk: 0x76502f, leaves: 0x34713d
};

const materials = {};
const textures = {};
for (const [type, filename] of Object.entries(textureFiles)) {
  const material = new THREE.MeshStandardMaterial({
    color: fallbackColors[type] ?? 0xffffff,
    roughness: type === 'water' ? 0.1 : 1,
    transparent: type === 'water',
    opacity: type === 'water' ? 0.78 : 1
  });
  materials[type] = material;

  const texture = textureLoader.load(
    `./assets/textures/${filename}`,
    loaded => {
      loaded.colorSpace = THREE.SRGBColorSpace;
      loaded.magFilter = THREE.NearestFilter;
      loaded.minFilter = THREE.NearestFilter;
      loaded.wrapS = THREE.RepeatWrapping;
      loaded.wrapT = THREE.RepeatWrapping;
      loaded.generateMipmaps = false;
      material.map = loaded;
      material.color.setHex(0xffffff);
      material.needsUpdate = true;
      textures[type] = loaded;
    },
    undefined,
    () => {
      // Missing files intentionally keep the built-in fallback color.
      console.info(`[MCraft] Optional texture not found: assets/textures/${filename}`);
    }
  );
  textures[type] = texture;
}

const world = new StreamingWorld(scene, materials, $('#seed').value || '739182', 2);
const controls = new PointerLockControls(camera, renderer.domElement);
const raycaster = new THREE.Raycaster();
const center = new THREE.Vector2(0, 0);
raycaster.far = 7;

const blockPalette = ['grass', 'dirt', 'stone', 'sand', 'leaves'];
let selectedBlock = 'grass';
let dayTime = 0.28;
let lastInteraction = 0;

renderer.domElement.addEventListener('click', () => controls.lock());
controls.addEventListener('lock', () => { $('#status').textContent = 'Streaming world...'; });
controls.addEventListener('unlock', () => { $('#status').textContent = 'Mouse released'; });

const keys = new Set();
addEventListener('keydown', event => {
  keys.add(event.code);
  if (event.code.startsWith('Digit')) {
    const index = Number(event.code.slice(5)) - 1;
    if (index >= 0 && index < blockPalette.length) selectBlock(blockPalette[index]);
  }
  if (event.code === 'KeyN') toggleDayNight();
});
addEventListener('keyup', event => keys.delete(event.code));

const direction = new THREE.Vector3();
let lastTime = performance.now();

function selectBlock(type) {
  selectedBlock = type;
  $('#selectedBlock').textContent = type;
}

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

function raycastBlock() {
  raycaster.setFromCamera(center, camera);
  const hits = raycaster.intersectObject(world.root, true);
  return hits.find(hit => hit.object?.isInstancedMesh && hit.instanceId !== undefined && hit.object.userData?.blocks?.[hit.instanceId]);
}

function interact(button) {
  if (!controls.isLocked || performance.now() - lastInteraction < 120) return;
  lastInteraction = performance.now();
  const hit = raycastBlock();
  if (!hit) return;
  const block = hit.object.userData.blocks[hit.instanceId];
  if (!block) return;

  if (button === 0) {
    world.setBlock(block.x, block.y, block.z, null);
  } else if (button === 2) {
    const normal = hit.face?.normal;
    if (!normal) return;
    const x = block.x + Math.round(normal.x);
    const y = block.y + Math.round(normal.y);
    const z = block.z + Math.round(normal.z);
    const px = Math.floor(camera.position.x);
    const py = Math.floor(camera.position.y);
    const pz = Math.floor(camera.position.z);
    if (x === px && z === pz && (y === py || y === py - 1)) return;
    if (!world.blockAt(x, y, z)) world.setBlock(x, y, z, selectedBlock);
  }
}

renderer.domElement.addEventListener('mousedown', event => {
  if (event.button === 0 || event.button === 2) interact(event.button);
});
renderer.domElement.addEventListener('contextmenu', event => event.preventDefault());

function toggleDayNight() {
  dayTime = dayTime > 0.5 ? 0.28 : 0.72;
  const night = dayTime > 0.5;
  scene.background.setHex(night ? 0x101b32 : 0x9ec7e3);
  scene.fog.color.setHex(night ? 0x101b32 : 0x9ec7e3);
  sun.intensity = night ? 0.75 : 3.0;
  $('#dayNight').textContent = night ? '🌙 Night' : '☀️ Day';
}

function updateUI() {
  const x = Math.floor(camera.position.x);
  const z = Math.floor(camera.position.z);
  const cx = Math.floor(camera.position.x / CHUNK_SIZE);
  const cz = Math.floor(camera.position.z / CHUNK_SIZE);
  const stats = world.getStats();
  $('#coord').textContent = `${x}, ${z}`;
  $('#chunkCoord').textContent = `${cx}, ${cz}`;
  $('#chunks').textContent = String(stats.loadedChunks);
  $('#blocks').textContent = stats.blocks.toLocaleString();
  $('#caveBlocks').textContent = stats.caves.toLocaleString();
  $('#seedStatus').textContent = world.seed;
  $('#selectedBlock').textContent = selectedBlock;
  $('#status').textContent = stats.queued ? `Loaded ${stats.loadedChunks} chunks • ${stats.queued} queued` : `Loaded ${stats.loadedChunks} chunks${stats.loadedChunks ? ` • ${stats.dominantBiome}` : ''}`;
}

function regenerate() {
  const seed = $('#seed').value.trim() || '739182';
  world.setSeed(seed);
  world.update(camera.position.x, camera.position.z);
  updateUI();
}

$('#generate').addEventListener('click', regenerate);
$('#randomSeed').addEventListener('click', () => {
  $('#seed').value = Math.floor(Math.random() * 999999999);
  regenerate();
});
$('#seed').addEventListener('keydown', event => { if (event.key === 'Enter') regenerate(); });
$('#toggleGrid').addEventListener('click', event => {
  const enabled = !world.gridVisible;
  world.setGridVisible(enabled);
  event.currentTarget.textContent = enabled ? '▦ Hide Chunk Grid' : '▦ Show Chunk Grid';
});
$('#cavePreview').addEventListener('click', event => {
  const enabled = !world.preview;
  world.setPreview(enabled);
  event.currentTarget.textContent = enabled ? '🧱 Normal View' : '🕳️ Cave Preview';
});
$('#dayNight').addEventListener('click', toggleDayNight);

for (const button of document.querySelectorAll('[data-block]')) {
  button.addEventListener('click', () => selectBlock(button.dataset.block));
}

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
