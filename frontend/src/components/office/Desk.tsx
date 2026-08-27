import { useMemo } from "react";

import { getVoxelMaterial } from "@/lib/voxelMaterials";

interface DeskProps {
  position: [number, number, number];
  rotationY?: number;
  onSelect?: () => void;
}

const LEG_OFFSETS: [number, number][] = [
  [-0.65, -0.32],
  [0.65, -0.32],
  [-0.65, 0.32],
  [0.65, 0.32],
];

export function Desk({ position, rotationY = 0, onSelect }: DeskProps) {
  const darkOak = getVoxelMaterial("dark_oak");
  const iron = getVoxelMaterial("iron");
  const redWool = getVoxelMaterial("red_wool");
  const stoneBrick = getVoxelMaterial("stone_brick");
  const dirt = getVoxelMaterial("dirt");
  const cactus = getVoxelMaterial("cactus");
  const monitorScreen = getVoxelMaterial("monitor_screen");
  const quartz = getVoxelMaterial("quartz");
  const cubicleWallMat = getVoxelMaterial("cubicle_wall");

  const monitorMaterials = useMemo(
    () => [iron, iron, iron, iron, monitorScreen, iron],
    [iron, monitorScreen],
  );

  return (
    <group
      position={position}
      rotation={[0, rotationY, 0]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.();
      }}
    >
      {/* Desk Top */}
      <mesh position={[0, 0.85, 0]} material={darkOak} castShadow receiveShadow>
        <boxGeometry args={[1.5, 0.08, 0.78]} />
      </mesh>
      {/* Desk Legs */}
      {LEG_OFFSETS.map(([x, z]) => (
        <mesh key={`${x}-${z}`} position={[x, 0.42, z]} material={iron} castShadow receiveShadow>
          <boxGeometry args={[0.06, 0.84, 0.06]} />
        </mesh>
      ))}

      {/* Dual Curved / Angled Monitors */}
      {/* Main Center Monitor */}
      <mesh position={[-0.18, 1.16, -0.26]} rotation={[0, 0.1, 0]} material={monitorMaterials} castShadow>
        <boxGeometry args={[0.55, 0.36, 0.05]} />
      </mesh>
      {/* Secondary Right Monitor */}
      <mesh position={[0.34, 1.16, -0.22]} rotation={[0, -0.3, 0]} material={monitorMaterials} castShadow>
        <boxGeometry args={[0.5, 0.36, 0.05]} />
      </mesh>
      {/* Monitor Stand Arm */}
      <mesh position={[0.08, 0.98, -0.28]} material={iron} castShadow>
        <boxGeometry args={[0.2, 0.16, 0.08]} />
      </mesh>

      {/* Desktop PC Tower Case with Glowing RGB Strip */}
      <group position={[0.62, 0.4, 0.1]}>
        <mesh position={[0, 0, 0]} material={cubicleWallMat} castShadow>
          <boxGeometry args={[0.22, 0.45, 0.45]} />
        </mesh>
        <mesh position={[-0.115, 0, 0]} material={quartz}>
          <boxGeometry args={[0.02, 0.38, 0.38]} />
        </mesh>
        <pointLight position={[-0.05, 0, 0]} color="#60a5fa" intensity={0.5} distance={1.2} />
      </group>

      {/* Mechanical Keyboard & Mouse pad */}
      <mesh position={[-0.05, 0.9, 0.14]} material={iron} castShadow>
        <boxGeometry args={[0.42, 0.02, 0.16]} />
      </mesh>
      <mesh position={[0.28, 0.895, 0.14]} material={cubicleWallMat} receiveShadow>
        <boxGeometry args={[0.2, 0.01, 0.22]} />
      </mesh>

      {/* Ergonomic Mesh Office Chair */}
      <group position={[0, 0, 0.88]}>
        <mesh position={[0, 0.45, 0]} material={redWool} castShadow receiveShadow>
          <boxGeometry args={[0.46, 0.08, 0.46]} />
        </mesh>
        <mesh position={[0, 0.74, 0.2]} material={redWool} castShadow receiveShadow>
          <boxGeometry args={[0.46, 0.48, 0.08]} />
        </mesh>
        {/* Armrests */}
        <mesh position={[-0.25, 0.6, 0]} material={iron}>
          <boxGeometry args={[0.04, 0.24, 0.3]} />
        </mesh>
        <mesh position={[0.25, 0.6, 0]} material={iron}>
          <boxGeometry args={[0.04, 0.24, 0.3]} />
        </mesh>
        <mesh position={[0, 0.24, 0]} material={iron} castShadow>
          <boxGeometry args={[0.07, 0.35, 0.07]} />
        </mesh>
        <mesh position={[0, 0.05, 0]} material={stoneBrick} castShadow receiveShadow>
          <boxGeometry args={[0.45, 0.06, 0.45]} />
        </mesh>
      </group>

      {/* Desk Succulent Plant */}
      <mesh position={[-0.6, 0.98, -0.22]} material={dirt} castShadow>
        <boxGeometry args={[0.12, 0.14, 0.12]} />
      </mesh>
      <mesh position={[-0.6, 1.12, -0.22]} material={cactus} castShadow>
        <boxGeometry args={[0.09, 0.2, 0.09]} />
      </mesh>

      {/* Ceramic Coffee Mug */}
      <mesh position={[-0.45, 0.93, 0.18]} material={quartz} castShadow>
        <boxGeometry args={[0.09, 0.12, 0.09]} />
      </mesh>
    </group>
  );
}
