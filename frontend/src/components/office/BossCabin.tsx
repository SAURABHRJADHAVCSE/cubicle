import { useMemo } from "react";

import { createSignMaterial, getTiledVoxelMaterial, getVoxelMaterial } from "@/lib/voxelMaterials";

interface BossCabinProps {
  /** Center position of the cabin footprint (floor level). */
  position: [number, number, number];
}

const CABIN_WIDTH = 2.6;
const CABIN_DEPTH = 2.4;
const CABIN_HEIGHT = 2.2;

/** A small enclosed private office — glass-walled (matches the reference's
 * "CEO Cabin"), distinct from the shared open desk area, with a nameplate
 * over the doorway. */
export function BossCabin({ position }: BossCabinProps) {
  const darkOak = getVoxelMaterial("dark_oak");
  const iron = getVoxelMaterial("iron");
  const monitorScreen = getVoxelMaterial("monitor_screen");
  const quartz = useMemo(() => getTiledVoxelMaterial("quartz", CABIN_WIDTH, CABIN_DEPTH), []);
  const glassBack = useMemo(() => getTiledVoxelMaterial("glass", CABIN_WIDTH, CABIN_HEIGHT), []);
  const glassSide = useMemo(() => getTiledVoxelMaterial("glass", CABIN_DEPTH, CABIN_HEIGHT), []);
  const signMat = useMemo(() => createSignMaterial("BOSS CABIN", "#ffaa00"), []);

  const doorGap = 0.9;

  return (
    <group position={position}>
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} material={quartz}>
        <planeGeometry args={[CABIN_WIDTH, CABIN_DEPTH]} />
      </mesh>

      <mesh position={[0, CABIN_HEIGHT / 2, -CABIN_DEPTH / 2]} material={glassBack}>
        <boxGeometry args={[CABIN_WIDTH, CABIN_HEIGHT, 0.08]} />
      </mesh>
      <mesh position={[-CABIN_WIDTH / 2, CABIN_HEIGHT / 2, 0]} rotation={[0, Math.PI / 2, 0]} material={glassSide}>
        <boxGeometry args={[CABIN_DEPTH, CABIN_HEIGHT, 0.08]} />
      </mesh>
      {/* Front (+Z) wall, split with a doorway gap in the middle */}
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

      <mesh position={[0, CABIN_HEIGHT + 0.15, CABIN_DEPTH / 2 + 0.05]} material={signMat}>
        <boxGeometry args={[1.5, 0.55, 0.06]} />
      </mesh>

      <group position={[0, 0, -0.55]}>
        <mesh position={[0, 0.85, 0]} material={darkOak}>
          <boxGeometry args={[1.3, 0.08, 0.6]} />
        </mesh>
        <mesh position={[-0.55, 0.42, -0.24]} material={iron}>
          <boxGeometry args={[0.06, 0.84, 0.06]} />
        </mesh>
        <mesh position={[0.55, 0.42, -0.24]} material={iron}>
          <boxGeometry args={[0.06, 0.84, 0.06]} />
        </mesh>
        <mesh position={[-0.55, 0.42, 0.24]} material={iron}>
          <boxGeometry args={[0.06, 0.84, 0.06]} />
        </mesh>
        <mesh position={[0.55, 0.42, 0.24]} material={iron}>
          <boxGeometry args={[0.06, 0.84, 0.06]} />
        </mesh>
        <mesh position={[0, 1.1, -0.2]} material={monitorScreen}>
          <boxGeometry args={[0.4, 0.28, 0.05]} />
        </mesh>
      </group>
    </group>
  );
}
