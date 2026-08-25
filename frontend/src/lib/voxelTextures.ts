import * as THREE from "three";

export type BlockType =
  | "oak"
  | "dark_oak"
  | "stone_brick"
  | "red_wool"
  | "quartz"
  | "glass"
  | "iron"
  | "dirt"
  | "cactus"
  | "leaves"
  | "monitor_screen"
  | "sea_lantern"
  | "cake_side"
  | "cake_top"
  | "skin"
  | "cubicle_wall";

const BASE_COLORS: Record<BlockType, string> = {
  oak: "#8f7044",
  dark_oak: "#3c2712",
  stone_brick: "#787878",
  red_wool: "#a12727",
  quartz: "#eee6e0",
  glass: "#a4c2d3",
  iron: "#d8d8d8",
  dirt: "#543b27",
  cactus: "#2b5319",
  leaves: "#418023",
  monitor_screen: "#1c3d2a",
  sea_lantern: "#add5ce",
  cake_side: "#825531",
  cake_top: "#ffffff",
  skin: "#e8b18a",
  cubicle_wall: "#5e7c99",
};

/**
 * Draws a 16x16 pixel-art block texture on a <canvas>, ported from the
 * reference Minecraft-office scene the user supplied. NearestFilter (set
 * by the caller) is what gives it the blocky look — this function just
 * needs to produce a correctly-detailed 16x16 source image.
 */
export function generateBlockTexture(type: BlockType): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = BASE_COLORS[type];
  ctx.fillRect(0, 0, 16, 16);

  if (type !== "glass" && type !== "monitor_screen" && type !== "cake_top") {
    for (let i = 0; i < 256; i++) {
      const x = i % 16;
      const y = Math.floor(i / 16);
      const noise = Math.random() * 0.15;
      ctx.fillStyle = Math.random() > 0.5 ? `rgba(0,0,0,${noise})` : `rgba(255,255,255,${noise})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }

  if (type === "oak" || type === "dark_oak") {
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    for (let y = 0; y < 16; y += 4) ctx.fillRect(0, y, 16, 1);
  } else if (type === "stone_brick") {
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, 7, 16, 1);
    ctx.fillRect(0, 15, 16, 1);
    ctx.fillRect(7, 0, 1, 7);
    ctx.fillRect(15, 8, 1, 7);
  } else if (type === "quartz") {
    ctx.strokeStyle = "#dcd4ce";
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, 16, 16);
  } else if (type === "glass") {
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, 16, 16);
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillRect(2, 2, 4, 4);
    ctx.fillRect(7, 2, 2, 2);
  } else if (type === "leaves") {
    for (let i = 0; i < 40; i++) {
      ctx.clearRect((Math.random() * 16) | 0, (Math.random() * 16) | 0, 1, 1);
    }
  } else if (type === "monitor_screen") {
    ctx.fillStyle = "#1c3d2a";
    ctx.fillRect(1, 1, 14, 14);
    ctx.fillStyle = "#55b685";
    ctx.fillRect(2, 2, 3, 1);
    ctx.fillRect(2, 4, 6, 1);
    ctx.fillRect(2, 6, 4, 1);
    ctx.fillRect(2, 8, 7, 1);
    ctx.fillRect(2, 10, 2, 1);
  } else if (type === "iron") {
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, 16, 16);
  } else if (type === "cactus") {
    ctx.fillStyle = "#1c3d10";
    for (let x = 2; x < 16; x += 4) ctx.fillRect(x, 0, 1, 16);
  } else if (type === "sea_lantern") {
    ctx.strokeStyle = "#5da49b";
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, 16, 16);
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillRect(4, 4, 8, 8);
  } else if (type === "cake_side") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 16, 5);
    ctx.fillRect(2, 5, 2, 2);
    ctx.fillRect(7, 5, 2, 4);
    ctx.fillRect(12, 5, 3, 1);
    ctx.fillStyle = "#a12727";
    ctx.fillRect(3, 2, 2, 2);
    ctx.fillRect(10, 1, 2, 2);
  } else if (type === "skin") {
    ctx.fillStyle = "rgba(0,0,0,0.15)";
    ctx.fillRect(5, 9, 2, 2);
    ctx.fillRect(9, 9, 2, 2);
  } else if (type === "cubicle_wall") {
    ctx.fillStyle = "rgba(255,255,255,0.1)";
    for (let i = 0; i < 16; i += 2) {
      ctx.fillRect(i, 0, 1, 16);
      ctx.fillRect(0, i, 16, 1);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

/**
 * Bakes a wooden nameplate sign with text onto a canvas — plain
 * `ctx.font`/`fillText` against the browser's default system font, not
 * drei's <Text> (troika-three-text), which needs to fetch a font file
 * over the network for SDF glyph generation. This has no network
 * dependency at all: cheap, synchronous, works offline.
 */
export function generateSignTexture(text: string, textColor = "#ffffff"): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#4a2f18";
  ctx.fillRect(0, 0, 128, 64);
  ctx.strokeStyle = "#2d1c0e";
  ctx.lineWidth = 4;
  ctx.strokeRect(0, 0, 128, 64);

  ctx.fillStyle = textColor;
  ctx.font = "bold 20px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 64, 34);

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  return texture;
}
