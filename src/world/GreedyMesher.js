import * as THREE from 'three';

// Lightweight greedy voxel mesher. It merges coplanar faces of the same block type.
const DIRS = [
  [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]
];
const AXIS = [[2, 1], [2, 1], [0, 1]];

export function buildGreedyChunkMesh(data, materialMap) {
  const blocks = new Map();
  for (const b of data.blocks) blocks.set(`${b.x},${b.y},${b.z}`, b.type);

  const positions = [];
  const normals = [];
  const uvs = [];
  const groups = [];

  const pushQuad = (a, b, c, d, normal, type, w, h) => {
    const base = positions.length / 3;
    for (const p of [a, b, c, d]) positions.push(p[0], p[1], p[2]);
    for (let i = 0; i < 4; i++) normals.push(normal[0], normal[1], normal[2]);
    uvs.push(0, 0, w, 0, w, h, 0, h);
    groups.push({ start: base, count: 4, type });
  };

  const has = (x, y, z) => blocks.has(`${x},${y},${z}`);
  const typeAt = (x, y, z) => blocks.get(`${x},${y},${z}`);

  // Surface-face merging per axis. Each face is represented by its type and merged in 2D.
  for (let axis = 0; axis < 3; axis++) {
    const u = AXIS[axis][0], v = AXIS[axis][1];
    const normalSign = [1, -1];
    for (const sign of normalSign) {
      for (let plane = 0; plane <= (axis === 0 ? 16 : axis === 2 ? 16 : 48); plane++) {
        const maxU = axis === 0 ? 16 : axis === 2 ? 16 : 16;
        const maxV = axis === 1 ? 16 : 48;
        const mask = Array.from({ length: maxV }, () => Array(maxU).fill(null));
        for (let vv = 0; vv < maxV; vv++) for (let uu = 0; uu < maxU; uu++) {
          const p = [0, 0, 0]; p[axis] = plane;
          p[u] = uu; p[v] = vv;
          const q = [...p]; q[axis] += sign;
          const x = p[0], y = p[1], z = p[2];
          const nx = q[0], ny = q[1], nz = q[2];
          const type = sign > 0 ? typeAt(x - (axis === 0 ? 1 : 0), y - (axis === 1 ? 1 : 0), z - (axis === 2 ? 1 : 0)) : typeAt(x, y, z);
          if (!type) continue;
          if (has(nx, ny, nz)) continue;
          mask[vv][uu] = type;
        }
        for (let vv = 0; vv < maxV; vv++) for (let uu = 0; uu < maxU; uu++) {
          const type = mask[vv][uu]; if (!type) continue;
          let w = 1; while (uu + w < maxU && mask[vv][uu + w] === type) w++;
          let h = 1; outer: while (vv + h < maxV) { for (let k = 0; k < w; k++) if (mask[vv + h][uu + k] !== type) break outer; h++; }
          for (let y = vv; y < vv + h; y++) for (let x = uu; x < uu + w; x++) mask[y][x] = null;
          const p = [0, 0, 0]; p[axis] = plane; p[u] = uu; p[v] = vv;
          const p1 = [...p], p2 = [...p], p3 = [...p], p4 = [...p];
          p2[u] += w; p3[u] += w; p3[v] += h; p4[v] += h;
          const n = [0, 0, 0]; n[axis] = sign;
          if (sign > 0) pushQuad(p1, p2, p3, p4, n, type, w, h);
          else pushQuad(p4, p3, p2, p1, n, type, w, h);
        }
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeBoundingSphere();

  // Greedy mesh currently uses one shared material; keep block grouping metadata for future texture atlas support.
  const material = materialMap.stone || Object.values(materialMap)[0];
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.userData.greedyGroups = groups;
  mesh.userData.blocks = data.blocks;
  return mesh;
}
