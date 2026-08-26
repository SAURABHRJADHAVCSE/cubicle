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
  oak: "#b88e5e",
  dark_oak: "#3d2d24",
  stone_brick: "#334155",
  red_wool: "#9f1239",
  quartz: "#f8fafc",
  glass: "#8b86c9",
  iron: "#64748b",
  dirt: "#583e2e",
  cactus: "#15803d",
  leaves: "#16a34a",
  monitor_screen: "#0f172a",
  sea_lantern: "#f3c969",
  cake_side: "#b45309",
  cake_top: "#f8fafc",
  skin: "#f3a683",
  cubicle_wall: "#475569",
};

/**
 * Draws a detailed 32x32 pixel-art block texture on a <canvas>.
 */
export function generateBlockTexture(type: BlockType): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext("2d")!;

  // Fill base color
  ctx.fillStyle = BASE_COLORS[type];
  ctx.fillRect(0, 0, 32, 32);

  // Subtle pixel noise
  if (type !== "glass" && type !== "monitor_screen" && type !== "cake_top") {
    for (let i = 0; i < 80; i++) {
      const x = (i * 13) % 32;
      const y = (i * 17) % 32;
      const light = i % 2 === 0;
      ctx.fillStyle = light ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";
      ctx.fillRect(x, y, 1, 1);
    }
  }

  if (type === "oak") {
    // Warm wood plank lines
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.fillRect(0, 15, 32, 2);
    ctx.fillRect(0, 31, 32, 1);
    // Wood grain accents
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(4, 4, 12, 1);
    ctx.fillRect(18, 20, 10, 1);
  } else if (type === "dark_oak") {
    // Walnut wood plank lines
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fillRect(0, 15, 32, 2);
    ctx.fillRect(0, 31, 32, 1);
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    ctx.fillRect(2, 6, 16, 1);
    ctx.fillRect(14, 22, 12, 1);
  } else if (type === "red_wool") {
    // Woven velvet carpet / rug pattern
    ctx.fillStyle = "#be123c";
    for (let y = 0; y < 32; y += 4) {
      for (let x = 0; x < 32; x += 4) {
        if ((x + y) % 8 === 0) ctx.fillRect(x, y, 2, 2);
      }
    }
    // Gold border trim effect
    ctx.fillStyle = "rgba(253, 224, 71, 0.25)";
    ctx.fillRect(0, 0, 32, 2);
    ctx.fillRect(0, 30, 32, 2);
  } else if (type === "stone_brick") {
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(0, 15, 32, 2);
    ctx.fillRect(0, 31, 32, 1);
    ctx.fillRect(15, 0, 2, 15);
    ctx.fillRect(31, 16, 1, 15);
  } else if (type === "quartz") {
    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, 30, 30);
  } else if (type === "glass") {
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, 30, 30);
    // Diagonal glass sheen lines
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.beginPath();
    ctx.moveTo(4, 4); ctx.lineTo(12, 4); ctx.lineTo(4, 12); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(14, 14); ctx.lineTo(22, 14); ctx.lineTo(14, 22); ctx.fill();
  } else if (type === "monitor_screen") {
    // Glowing IDE screen with syntax highlighting
    ctx.fillStyle = "#020617";
    ctx.fillRect(0, 0, 32, 32);

    // Code lines
    ctx.fillStyle = "#818cf8"; // indigo keyword
    ctx.fillRect(3, 4, 6, 2);
    ctx.fillStyle = "#a855f7"; // purple var
    ctx.fillRect(10, 4, 10, 2);

    ctx.fillStyle = "#22c55e"; // green string
    ctx.fillRect(6, 9, 14, 2);

    ctx.fillStyle = "#eab308"; // yellow fn
    ctx.fillRect(6, 14, 8, 2);
    ctx.fillStyle = "#818cf8";
    ctx.fillRect(15, 14, 10, 2);

    ctx.fillStyle = "#ec4899"; // pink return
    ctx.fillRect(6, 19, 12, 2);

    ctx.fillStyle = "#818cf8";
    ctx.fillRect(3, 24, 4, 2);
    // Cursor glow
    ctx.fillStyle = "#60a5fa";
    ctx.fillRect(8, 24, 2, 3);
  } else if (type === "sea_lantern") {
    ctx.strokeStyle = "#f3c969";
    ctx.lineWidth = 3;
    ctx.strokeRect(2, 2, 28, 28);
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.fillRect(10, 10, 12, 12);
  } else if (type === "cubicle_wall") {
    // Sleek dual tone office divider
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.fillRect(0, 16, 32, 1);
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.fillRect(0, 0, 32, 2);
    ctx.fillRect(0, 0, 2, 32);
    ctx.fillRect(30, 0, 2, 32);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

export function generateSignTexture(text: string, textColor = "#facc15"): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;

  // Dark plaque background with metallic border
  ctx.fillStyle = "#1e293b";
  ctx.fillRect(0, 0, 256, 128);
  ctx.strokeStyle = "#475569";
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, 248, 120);

  ctx.strokeStyle = textColor;
  ctx.lineWidth = 2;
  ctx.strokeRect(10, 10, 236, 108);

  ctx.fillStyle = textColor;
  ctx.font = "bold 32px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 128, 64);

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  return texture;
}
