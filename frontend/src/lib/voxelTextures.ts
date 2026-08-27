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
  | "cubicle_wall"
  | "server_rack"
  | "vending_machine"
  | "grass"
  | "wood_parquet"
  | "marble_tile"
  | "arcade_screen"
  | "whiteboard";

const BASE_COLORS: Record<BlockType, string> = {
  oak: "#b88e5e",
  dark_oak: "#3d2d24",
  stone_brick: "#334155",
  red_wool: "#1e293b",
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
  cubicle_wall: "#334155",
  server_rack: "#0f172a",
  vending_machine: "#1e1b4b",
  grass: "#15803d",
  wood_parquet: "#cbd5e1",
  marble_tile: "#f1f5f9",
  arcade_screen: "#312e81",
  whiteboard: "#f8fafc",
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
  if (
    type !== "glass" &&
    type !== "monitor_screen" &&
    type !== "cake_top" &&
    type !== "server_rack" &&
    type !== "arcade_screen" &&
    type !== "whiteboard"
  ) {
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
  } else if (type === "wood_parquet") {
    // Elegant light oak / grey-beige parquet flooring
    ctx.fillStyle = "#e2e8f0";
    ctx.fillRect(0, 0, 16, 16);
    ctx.fillRect(16, 16, 16, 16);
    ctx.fillStyle = "rgba(148,163,184,0.3)";
    ctx.fillRect(0, 15, 32, 1);
    ctx.fillRect(15, 0, 1, 32);
  } else if (type === "marble_tile") {
    // Elegant polished marble grid
    ctx.strokeStyle = "rgba(148, 163, 184, 0.4)";
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, 32, 32);
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.fillRect(2, 2, 8, 8);
  } else if (type === "grass") {
    // Lawn grass texture
    ctx.fillStyle = "#166534";
    for (let i = 0; i < 40; i++) {
      const gx = (i * 7) % 32;
      const gy = (i * 11) % 32;
      ctx.fillRect(gx, gy, 2, 3);
    }
  } else if (type === "server_rack") {
    // High-tech server rack front
    ctx.fillStyle = "#020617";
    ctx.fillRect(0, 0, 32, 32);
    // Server blade slots
    for (let y = 2; y < 30; y += 6) {
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(2, y, 28, 4);
      // Blinking LEDs
      ctx.fillStyle = y % 12 === 2 ? "#22c55e" : "#3b82f6";
      ctx.fillRect(4, y + 1, 2, 2);
      ctx.fillStyle = "#38bdf8";
      ctx.fillRect(7, y + 1, 2, 2);
    }
  } else if (type === "vending_machine") {
    // Vending machine front glass & snacks
    ctx.fillStyle = "#1e1b4b";
    ctx.fillRect(0, 0, 32, 32);
    ctx.fillStyle = "#38bdf8";
    ctx.fillRect(4, 4, 24, 18);
    // Soda cans / snack rows
    ctx.fillStyle = "#ef4444";
    ctx.fillRect(6, 6, 4, 5);
    ctx.fillStyle = "#eab308";
    ctx.fillRect(12, 6, 4, 5);
    ctx.fillStyle = "#22c55e";
    ctx.fillRect(18, 6, 4, 5);
    // Keypad & coin dispenser slot
    ctx.fillStyle = "#94a3b8";
    ctx.fillRect(4, 24, 24, 6);
  } else if (type === "arcade_screen") {
    // Arcade CRT game screen
    ctx.fillStyle = "#09090b";
    ctx.fillRect(0, 0, 32, 32);
    ctx.fillStyle = "#a855f7"; // Neon arcade ship
    ctx.fillRect(13, 20, 6, 4);
    ctx.fillRect(15, 16, 2, 4);
    // Stars / invaders
    ctx.fillStyle = "#facc15";
    ctx.fillRect(6, 6, 3, 3);
    ctx.fillRect(22, 8, 3, 3);
  } else if (type === "whiteboard") {
    // Office whiteboard with chart drawing
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 32, 32);
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1;
    ctx.strokeRect(1, 1, 30, 30);
    // Bar chart lines
    ctx.fillStyle = "#3b82f6";
    ctx.fillRect(4, 18, 4, 10);
    ctx.fillStyle = "#22c55e";
    ctx.fillRect(10, 12, 4, 16);
    ctx.fillStyle = "#a855f7";
    ctx.fillRect(16, 6, 4, 22);
  } else if (type === "red_wool") {
    // Woven corporate navy carpet runner
    ctx.fillStyle = "#334155";
    for (let y = 0; y < 32; y += 4) {
      for (let x = 0; x < 32; x += 4) {
        if ((x + y) % 8 === 0) ctx.fillRect(x, y, 2, 2);
      }
    }
    // Silver border trim effect
    ctx.fillStyle = "rgba(226, 232, 240, 0.4)";
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

