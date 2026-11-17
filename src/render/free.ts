// Letting go of what a layer made (the island's layers: render/island.ts): every geometry and material under the objects given,
// each once. Textures are left to their owners (a material's uniforms often hold the page's shared ones: the height field's,
// the light's).
import * as THREE from "three";

export function freeObjects(objects: Iterable<THREE.Object3D>): void {
  const geos = new Set<THREE.BufferGeometry>(), mats = new Set<THREE.Material>();
  for (const o of objects) o.traverse(c => {
    const m = c as THREE.Mesh;
    if (m.geometry) geos.add(m.geometry);
    if (m.material) for (const x of Array.isArray(m.material) ? m.material : [m.material]) mats.add(x);
  });
  for (const g of geos) g.dispose();
  for (const m of mats) m.dispose();
}

/** Letting go of only the GPU buffers under the objects given (each geometry once), and the textures named: for a part taken out
 *  whose materials stay alive on purpose so their shader programs stay linked for what replaces it (the sea chart's islands:
 *  render/chart/seaChart.ts `reset`; a material nothing holds is collected, its program kept). Shared textures stay with their owners. */
export function freeGeometries(objects: Iterable<THREE.Object3D>, textures: Iterable<THREE.Texture | undefined> = []): void {
  const geos = new Set<THREE.BufferGeometry>();
  for (const o of objects) o.traverse(c => { const m = c as THREE.Mesh; if (m.geometry) geos.add(m.geometry); });
  for (const g of geos) g.dispose();
  for (const t of textures) t?.dispose();
}
