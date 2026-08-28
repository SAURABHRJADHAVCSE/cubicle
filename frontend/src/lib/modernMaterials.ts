import * as THREE from "three";

/** Flat, smooth PBR materials for the rebuilt office furniture — no
 * pixelated procedural texture maps (that's voxelMaterials.ts's look,
 * deliberately not reused here). Cached the same way voxelMaterials.ts
 * caches: one instance per named material, reused across every mesh that
 * wants it. */
const cache = new Map<string, THREE.MeshStandardMaterial>();

function material(key: string, params: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial {
  const cached = cache.get(key);
  if (cached) return cached;
  const mat = new THREE.MeshStandardMaterial(params);
  cache.set(key, mat);
  return mat;
}

// Restrained office-stationery palette, matching the 2D redesign's own ink
// indigo / warm paper direction rather than introducing a third color
// language for the 3D scene.
export const modernMaterials = {
  floorWood: () => material("floorWood", { color: "#d7d0c4", roughness: 0.72, metalness: 0.0 }),
  floorEdge: () => material("floorEdge", { color: "#8d8579", roughness: 0.68, metalness: 0.04 }),
  workCarpet: () => material("workCarpet", { color: "#c8ceda", roughness: 0.96, metalness: 0.0 }),
  zoneTrim: () => material("zoneTrim", { color: "#5146e5", roughness: 0.65, metalness: 0.04 }),
  deskWood: () => material("deskWood", { color: "#a8764f", roughness: 0.5, metalness: 0.02 }),
  deskLegMetal: () => material("deskLegMetal", { color: "#596273", roughness: 0.42, metalness: 0.55 }),
  chairSlate: () => material("chairSlate", { color: "#3f485a", roughness: 0.72, metalness: 0.04 }),
  chairBase: () => material("chairBase", { color: "#242a36", roughness: 0.42, metalness: 0.45 }),
  dividerFabric: () => material("dividerFabric", { color: "#d9dce4", roughness: 0.92, metalness: 0.0 }),
  dividerTrim: () => material("dividerTrim", { color: "#6b7282", roughness: 0.48, metalness: 0.42 }),
  monitorBody: () => material("monitorBody", { color: "#202632", roughness: 0.32, metalness: 0.42 }),
  monitorScreen: () =>
    material("monitorScreen", {
      color: "#151a24",
      roughness: 0.2,
      metalness: 0.1,
      emissive: new THREE.Color("#5146e5"),
      emissiveIntensity: 0.3,
    }),
  wallWarmGrey: () => material("wallWarmGrey", { color: "#e7e3dc", roughness: 0.86, metalness: 0.0 }),
  wallSlate: () => material("wallSlate", { color: "#757d8d", roughness: 0.62, metalness: 0.08 }),
  cabinGlass: () =>
    material("cabinGlass", { color: "#dce5f2", roughness: 0.12, metalness: 0.05, transparent: true, opacity: 0.38, depthWrite: false }),
  cabinFrame: () => material("cabinFrame", { color: "#293142", roughness: 0.38, metalness: 0.56 }),
  cabinDeskWood: () => material("cabinDeskWood", { color: "#845839", roughness: 0.42, metalness: 0.04 }),
  cabinChairLeather: () => material("cabinChairLeather", { color: "#352f78", roughness: 0.5, metalness: 0.03 }),
  sofaFabric: () => material("sofaFabric", { color: "#5f6680", roughness: 0.9, metalness: 0.0 }),
  sofaCushion: () => material("sofaCushion", { color: "#aab0c2", roughness: 0.92, metalness: 0.0 }),
  rug: () => material("rug", { color: "#bbb4a7", roughness: 0.98, metalness: 0.0 }),
  tableWood: () => material("tableWood", { color: "#946746", roughness: 0.52, metalness: 0.02 }),
  storageCabinet: () => material("storageCabinet", { color: "#4d5668", roughness: 0.58, metalness: 0.14 }),
  wallArt: () => material("wallArt", { color: "#5146e5", roughness: 0.56, metalness: 0.05 }),
  plantPot: () => material("plantPot", { color: "#6b5d4f", roughness: 0.7, metalness: 0.0 }),
  plantLeaf: () => material("plantLeaf", { color: "#4a6b4f", roughness: 0.7, metalness: 0.0 }),
};
