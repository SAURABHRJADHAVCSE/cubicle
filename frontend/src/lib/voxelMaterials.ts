import * as THREE from "three";

import { generateBlockTexture, generateSignTexture, type BlockType } from "@/lib/voxelTextures";

const materialCache = new Map<BlockType, THREE.MeshLambertMaterial>();

const TRANSPARENT_TYPES = new Set<BlockType>(["glass", "leaves"]);
const EMISSIVE_TYPES = new Set<BlockType>(["sea_lantern"]);

/** Lazily builds + caches one shared material per block type — the canvas
 * texture only needs generating once regardless of how many desks/walls
 * use it. Not built at module scope so nothing touches the DOM canvas API
 * until a component actually renders (this module is only ever reached
 * from the ssr:false OfficeCanvas subtree, but staying lazy is cheap
 * insurance).
 */
export function getVoxelMaterial(type: BlockType): THREE.MeshLambertMaterial {
  const cached = materialCache.get(type);
  if (cached) return cached;

  const map = generateBlockTexture(type);
  const params: THREE.MeshLambertMaterialParameters = { map };
  if (TRANSPARENT_TYPES.has(type)) params.transparent = true;
  if (type === "glass") params.opacity = 0.4;
  if (type === "leaves") params.alphaTest = 0.5;
  if (EMISSIVE_TYPES.has(type)) {
    params.emissive = new THREE.Color("#ffffee");
    params.emissiveIntensity = 0.6;
  }

  const material = new THREE.MeshLambertMaterial(params);
  materialCache.set(type, material);
  return material;
}

/** A tiled variant of a cached material — clones the material + its
 * texture (so `.repeat` doesn't mutate the shared instance) for surfaces
 * that need the block pattern repeated across a larger area, e.g. floors.
 */
export function getTiledVoxelMaterial(
  type: BlockType,
  repeatX: number,
  repeatY: number,
): THREE.MeshLambertMaterial {
  const base = getVoxelMaterial(type);
  const material = base.clone();
  material.map = base.map!.clone();
  material.map.needsUpdate = true;
  material.map.repeat.set(repeatX, repeatY);
  return material;
}

/** Nameplate sign material — not cached (text varies per call), but cheap
 * enough to build once per mount. */
export function createSignMaterial(text: string, textColor?: string): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ map: generateSignTexture(text, textColor) });
}
