import { useMemo } from "react";

import { getTiledVoxelMaterial } from "@/lib/voxelMaterials";

interface CubicleWallsProps {
  position: [number, number, number];
  rotationY?: number;
}

const WALL_HEIGHT = 1.3;
const BACK_Z = -0.55;
const FRONT_Z = 1.35;
const SIDE_X = 0.85;

/** U-shaped partition (back + two sides, open at the front) around a
 * desk+chair — this is what actually makes it read as a "cubicle" rather
 * than just an open desk, matching the reference's "10 Enclosed Cubicles"
 * feature. */
export function CubicleWalls({ position, rotationY = 0 }: CubicleWallsProps) {
  const backMat = useMemo(
    () => getTiledVoxelMaterial("cubicle_wall", 2 * SIDE_X, WALL_HEIGHT),
    [],
  );
  const sideMat = useMemo(
    () => getTiledVoxelMaterial("cubicle_wall", FRONT_Z - BACK_Z, WALL_HEIGHT),
    [],
  );

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh position={[0, WALL_HEIGHT / 2, BACK_Z]} material={backMat}>
        <boxGeometry args={[SIDE_X * 2, WALL_HEIGHT, 0.12]} />
      </mesh>
      <mesh
        position={[-SIDE_X, WALL_HEIGHT / 2, (BACK_Z + FRONT_Z) / 2]}
        rotation={[0, Math.PI / 2, 0]}
        material={sideMat}
      >
        <boxGeometry args={[FRONT_Z - BACK_Z, WALL_HEIGHT, 0.12]} />
      </mesh>
      <mesh
        position={[SIDE_X, WALL_HEIGHT / 2, (BACK_Z + FRONT_Z) / 2]}
        rotation={[0, Math.PI / 2, 0]}
        material={sideMat}
      >
        <boxGeometry args={[FRONT_Z - BACK_Z, WALL_HEIGHT, 0.12]} />
      </mesh>
    </group>
  );
}
