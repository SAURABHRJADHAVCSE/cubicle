import * as THREE from "three";

/** Flat, smooth PBR materials for the rebuilt office furniture — no
 * pixelated procedural texture maps (that's voxelMaterials.ts's look,
 * deliberately not reused here). Cached the same way voxelMaterials.ts
 * caches: one instance per named material, reused across every mesh that
 * wants it. */
const cache = new Map<string, THREE.MeshStandardMaterial>();
let officeTileTexture: THREE.CanvasTexture | null = null;

function getOfficeTileTexture(): THREE.CanvasTexture {
  if (officeTileTexture) return officeTileTexture;

  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext("2d")!;
  const tileSize = 32;

  context.fillStyle = "#aebdb9";
  context.fillRect(0, 0, canvas.width, canvas.height);

  for (let row = 0; row < 4; row += 1) {
    for (let column = 0; column < 4; column += 1) {
      context.fillStyle = (row + column) % 2 === 0 ? "#aebdb9" : "#a5b5b1";
      context.fillRect(column * tileSize, row * tileSize, tileSize, tileSize);
      context.strokeStyle = "rgba(69, 88, 88, 0.28)";
      context.lineWidth = 2;
      context.strokeRect(column * tileSize, row * tileSize, tileSize, tileSize);
      context.fillStyle = "rgba(255, 255, 255, 0.09)";
      context.fillRect(column * tileSize + 5, row * tileSize + 5, 2, 2);
    }
  }

  officeTileTexture = new THREE.CanvasTexture(canvas);
  officeTileTexture.colorSpace = THREE.SRGBColorSpace;
  officeTileTexture.wrapS = THREE.RepeatWrapping;
  officeTileTexture.wrapT = THREE.RepeatWrapping;
  officeTileTexture.repeat.set(4, 3.5);
  officeTileTexture.magFilter = THREE.NearestFilter;
  officeTileTexture.minFilter = THREE.LinearMipmapLinearFilter;
  return officeTileTexture;
}

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
  floorWood: () => material("floorWood", { color: "#ffffff", map: getOfficeTileTexture(), roughness: 0.88, metalness: 0.0 }),
  floorEdge: () => material("floorEdge", { color: "#353947", roughness: 0.62, metalness: 0.14 }),
  workCarpet: () => material("workCarpet", { color: "#8fa19e", roughness: 0.97, metalness: 0.0 }),
  zoneTrim: () => material("zoneTrim", { color: "#4f46e5", roughness: 0.65, metalness: 0.04 }),
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
  wallWarmGrey: () => material("wallWarmGrey", { color: "#eee8df", roughness: 0.88, metalness: 0.0 }),
  wallSlate: () => material("wallSlate", { color: "#3d4350", roughness: 0.62, metalness: 0.12 }),
  cabinGlass: () =>
    material("cabinGlass", { color: "#d8e7e6", roughness: 0.16, metalness: 0.02, transparent: true, opacity: 0.24, depthWrite: false }),
  cabinFrame: () => material("cabinFrame", { color: "#56606d", roughness: 0.42, metalness: 0.48 }),
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
