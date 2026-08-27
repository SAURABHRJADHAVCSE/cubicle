import * as THREE from "three";

import { generateBlockTexture, generateSignTexture, type BlockType } from "@/lib/voxelTextures";

const materialCache = new Map<BlockType, THREE.MeshStandardMaterial>();

const TRANSPARENT_TYPES = new Set<BlockType>(["glass", "leaves"]);
const EMISSIVE_TYPES = new Set<BlockType>(["sea_lantern", "monitor_screen", "server_rack", "arcade_screen"]);

export function getVoxelMaterial(type: BlockType): THREE.MeshStandardMaterial {
  const cached = materialCache.get(type);
  if (cached) return cached;

  const map = generateBlockTexture(type);
  const params: THREE.MeshStandardMaterialParameters = {
    map,
    roughness: 0.6,
    metalness: 0.1,
  };

  if (type === "iron") {
    params.metalness = 0.8;
    params.roughness = 0.3;
  } else if (type === "glass") {
    params.roughness = 0.1;
    params.metalness = 0.1;
    params.transparent = true;
    params.opacity = 0.45;
  } else if (type === "quartz") {
    params.roughness = 0.25;
  } else if (type === "oak" || type === "dark_oak" || type === "wood_parquet") {
    params.roughness = 0.45;
  } else if (type === "marble_tile") {
    params.roughness = 0.2;
    params.metalness = 0.15;
  } else if (type === "grass") {
    params.roughness = 0.9;
    params.metalness = 0.0;
  } else if (type === "red_wool") {
    params.roughness = 0.95;
    params.metalness = 0.0;
  } else if (type === "server_rack") {
    params.roughness = 0.3;
    params.metalness = 0.7;
  }

  if (TRANSPARENT_TYPES.has(type) && type !== "glass") params.transparent = true;
  if (type === "leaves") params.alphaTest = 0.5;

  if (EMISSIVE_TYPES.has(type)) {
    if (type === "sea_lantern") {
      params.emissive = new THREE.Color("#f3c969");
      params.emissiveIntensity = 0.7;
    } else if (type === "monitor_screen") {
      params.emissive = new THREE.Color("#4f46e5");
      params.emissiveIntensity = 0.35;
    } else if (type === "server_rack") {
      params.emissive = new THREE.Color("#0284c7");
      params.emissiveIntensity = 0.25;
    } else if (type === "arcade_screen") {
      params.emissive = new THREE.Color("#8b5cf6");
      params.emissiveIntensity = 0.6;
    }
  }

  const material = new THREE.MeshStandardMaterial(params);
  materialCache.set(type, material);
  return material;
}

export function getTiledVoxelMaterial(
  type: BlockType,
  repeatX: number,
  repeatY: number,
): THREE.MeshStandardMaterial {
  const base = getVoxelMaterial(type);
  const material = base.clone();
  material.map = base.map!.clone();
  material.map.needsUpdate = true;
  material.map.repeat.set(repeatX, repeatY);
  return material;
}

/** Nudges a material's rendered depth slightly toward the camera so it wins
 * z-fighting against a coplanar surface underneath it — e.g. a room's own
 * floor tile sitting exactly on top of the main office floor slab. */
export function preventZFighting<T extends THREE.Material>(material: T): T {
  material.polygonOffset = true;
  material.polygonOffsetFactor = -4;
  material.polygonOffsetUnits = -4;
  return material;
}

export function createSignMaterial(text: string, textColor?: string): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    map: generateSignTexture(text, textColor),
    roughness: 0.3,
    metalness: 0.4,
  });
}
