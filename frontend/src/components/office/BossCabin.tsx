import { useMemo } from "react";

import { createSignMaterial, getTiledVoxelMaterial, getVoxelMaterial, preventZFighting } from "@/lib/voxelMaterials";

interface BossCabinProps {
  /** Center position of the cabin footprint (floor level). */
  position: [number, number, number];
  onSelect?: () => void;
}

const CABIN_WIDTH = 3.0;
const CABIN_DEPTH = 2.6;
const CABIN_HEIGHT = 2.2;

/** A enclosed private executive office — glass-walled ("CEO Cabin"),
 * with a luxury L-shaped mahogany desk, leather chair, trophy cabinet, and nameplate. */
export function BossCabin({ position, onSelect }: BossCabinProps) {
  const darkOak = getVoxelMaterial("dark_oak");
  const iron = getVoxelMaterial("iron");
  const redWool = getVoxelMaterial("red_wool");
  const seaLantern = getVoxelMaterial("sea_lantern");
  const monitorScreen = getVoxelMaterial("monitor_screen");
  const marble = useMemo(() => preventZFighting(getTiledVoxelMaterial("marble_tile", CABIN_WIDTH, CABIN_DEPTH)), []);
  const glassBack = useMemo(() => getTiledVoxelMaterial("glass", CABIN_WIDTH, CABIN_HEIGHT), []);
  const glassSide = useMemo(() => getTiledVoxelMaterial("glass", CABIN_DEPTH, CABIN_HEIGHT), []);
  const signMat = useMemo(() => createSignMaterial("CEO SUITE", "#ffaa00"), []);

  const doorGap = 1.0;

  return (
    <group
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.();
      }}
    >
      {/* Polished Marble Subfloor Box */}
      <mesh position={[0, 0.06, 0]} material={marble} receiveShadow>
        <boxGeometry args={[CABIN_WIDTH, 0.04, CABIN_DEPTH]} />
      </mesh>

      {/* Glass Walls */}
      <mesh position={[0, CABIN_HEIGHT / 2, -CABIN_DEPTH / 2]} material={glassBack}>
        <boxGeometry args={[CABIN_WIDTH, CABIN_HEIGHT, 0.08]} />
      </mesh>
      <mesh position={[-CABIN_WIDTH / 2, CABIN_HEIGHT / 2, 0]} rotation={[0, Math.PI / 2, 0]} material={glassSide}>
        <boxGeometry args={[CABIN_DEPTH, CABIN_HEIGHT, 0.08]} />
      </mesh>
      {/* Front wall with doorway */}
      <mesh
        position={[(CABIN_WIDTH / 2 + doorGap / 2) / 2, CABIN_HEIGHT / 2, CABIN_DEPTH / 2]}
        rotation={[0, Math.PI / 2, 0]}
        material={glassSide}
      >
        <boxGeometry args={[CABIN_WIDTH / 2 - doorGap / 2, CABIN_HEIGHT, 0.08]} />
      </mesh>
      <mesh
        position={[-(CABIN_WIDTH / 2 + doorGap / 2) / 2, CABIN_HEIGHT / 2, CABIN_DEPTH / 2]}
        rotation={[0, Math.PI / 2, 0]}
        material={glassSide}
      >
        <boxGeometry args={[CABIN_WIDTH / 2 - doorGap / 2, CABIN_HEIGHT, 0.08]} />
      </mesh>

      {/* Nameplate */}
      <mesh position={[0, CABIN_HEIGHT + 0.15, CABIN_DEPTH / 2 + 0.05]} material={signMat}>
        <boxGeometry args={[1.6, 0.55, 0.06]} />
      </mesh>

      {/* L-Shaped Executive Desk Setup */}
      <group position={[0, 0, -0.55]}>
        <mesh position={[0, 0.85, 0]} material={darkOak}>
          <boxGeometry args={[1.6, 0.08, 0.7]} />
        </mesh>
        <mesh position={[-0.55, 0.85, 0.5]} material={darkOak}>
          <boxGeometry args={[0.5, 0.08, 0.7]} />
        </mesh>
        <mesh position={[-0.7, 0.42, -0.28]} material={iron}>
          <boxGeometry args={[0.08, 0.84, 0.08]} />
        </mesh>
        <mesh position={[0.7, 0.42, -0.28]} material={iron}>
          <boxGeometry args={[0.08, 0.84, 0.08]} />
        </mesh>
        {/* CEO Curved Monitor */}
        <mesh position={[0, 1.18, -0.2]} material={monitorScreen}>
          <boxGeometry args={[0.65, 0.38, 0.05]} />
        </mesh>

        {/* Executive Leather Armchair */}
        <group position={[0, 0, -0.65]}>
          <mesh position={[0, 0.5, 0]} material={redWool}>
            <boxGeometry args={[0.5, 0.1, 0.5]} />
          </mesh>
          <mesh position={[0, 0.85, -0.22]} material={redWool}>
            <boxGeometry args={[0.5, 0.6, 0.1]} />
          </mesh>
          <mesh position={[-0.28, 0.65, 0]} material={iron}>
            <boxGeometry args={[0.06, 0.3, 0.4]} />
          </mesh>
          <mesh position={[0.28, 0.65, 0]} material={iron}>
            <boxGeometry args={[0.06, 0.3, 0.4]} />
          </mesh>
        </group>
      </group>

      {/* Trophy & Awards Bookshelf on Side Wall */}
      <group position={[-CABIN_WIDTH / 2 + 0.3, 0, 0.2]}>
        <mesh position={[0, 0.9, 0]} material={darkOak}>
          <boxGeometry args={[0.3, 1.7, 0.9]} />
        </mesh>
        {/* Glowing Trophy */}
        <mesh position={[0, 1.1, 0]} material={seaLantern}>
          <boxGeometry args={[0.16, 0.28, 0.16]} />
        </mesh>
      </group>
    </group>
  );
}
