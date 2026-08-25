import { useMemo } from "react";

import { getVoxelMaterial } from "@/lib/voxelMaterials";

interface DeskProps {
  position: [number, number, number];
  rotationY?: number;
}

const LEG_OFFSETS: [number, number][] = [
  [-0.55, -0.28],
  [0.55, -0.28],
  [-0.55, 0.28],
  [0.55, 0.28],
];

export function Desk({ position, rotationY = 0 }: DeskProps) {
  const darkOak = getVoxelMaterial("dark_oak");
  const iron = getVoxelMaterial("iron");
  const redWool = getVoxelMaterial("red_wool");
  const stoneBrick = getVoxelMaterial("stone_brick");
  const dirt = getVoxelMaterial("dirt");
  const cactus = getVoxelMaterial("cactus");
  const monitorScreen = getVoxelMaterial("monitor_screen");

  // BoxGeometry has 6 built-in material groups (one per face); passing an
  // array here targets [+x, -x, +y, -y, +z, -z] without needing per-face
  // `attach="material-N"` children. Face 4 (+z) faces the seated avatar.
  const monitorMaterials = useMemo(
    () => [iron, iron, iron, iron, monitorScreen, iron],
    [iron, monitorScreen],
  );

  const quartz = getVoxelMaterial("quartz");

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* Desk Top */}
      <mesh position={[0, 0.85, 0]} material={darkOak} castShadow receiveShadow>
        <boxGeometry args={[1.3, 0.08, 0.7]} />
      </mesh>
      {/* Desk Legs */}
      {LEG_OFFSETS.map(([x, z]) => (
        <mesh key={`${x}-${z}`} position={[x, 0.42, z]} material={iron} castShadow receiveShadow>
          <boxGeometry args={[0.06, 0.84, 0.06]} />
        </mesh>
      ))}

      {/* Monitor */}
      <mesh position={[0, 1.15, -0.25]} material={monitorMaterials} castShadow>
        <boxGeometry args={[0.58, 0.38, 0.06]} />
      </mesh>
      <mesh position={[0, 0.98, -0.28]} material={iron} castShadow>
        <boxGeometry args={[0.08, 0.14, 0.08]} />
      </mesh>
      {/* Keyboard */}
      <mesh position={[0, 0.9, 0.12]} material={iron} castShadow>
        <boxGeometry args={[0.38, 0.02, 0.15]} />
      </mesh>

      {/* Chair */}
      <group position={[0, 0, 0.85]}>
        <mesh position={[0, 0.45, 0]} material={redWool} castShadow receiveShadow>
          <boxGeometry args={[0.42, 0.08, 0.42]} />
        </mesh>
        <mesh position={[0, 0.7, 0.18]} material={redWool} castShadow receiveShadow>
          <boxGeometry args={[0.42, 0.45, 0.08]} />
        </mesh>
        <mesh position={[0, 0.24, 0]} material={iron} castShadow>
          <boxGeometry args={[0.07, 0.35, 0.07]} />
        </mesh>
        <mesh position={[0, 0.05, 0]} material={stoneBrick} castShadow receiveShadow>
          <boxGeometry args={[0.4, 0.06, 0.4]} />
        </mesh>
      </group>

      {/* Plant */}
      <mesh position={[-0.52, 0.98, -0.25]} material={dirt} castShadow>
        <boxGeometry args={[0.12, 0.14, 0.12]} />
      </mesh>
      <mesh position={[-0.52, 1.12, -0.25]} material={cactus} castShadow>
        <boxGeometry args={[0.09, 0.2, 0.09]} />
      </mesh>

      {/* Coffee Mug */}
      <mesh position={[0.48, 0.93, 0.1]} material={quartz} castShadow>
        <boxGeometry args={[0.09, 0.12, 0.09]} />
      </mesh>
    </group>
  );
}
