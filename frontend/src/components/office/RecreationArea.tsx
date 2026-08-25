import { useMemo } from "react";
import * as THREE from "three";

import { createSignMaterial, getVoxelMaterial } from "@/lib/voxelMaterials";

interface RecreationAreaProps {
  zoneCenterX: number;
  poolZ: number;
  tennisZ: number;
}

const FELT_GREEN = "#2f6b3a";
const TABLE_BLUE = "#1f5f8b";

function PoolTable({ x, z }: { x: number; z: number }) {
  const darkOak = getVoxelMaterial("dark_oak");
  const feltMat = useMemo(() => new THREE.MeshLambertMaterial({ color: FELT_GREEN }), []);
  const legOffsets: [number, number][] = [
    [-0.9, -0.5],
    [0.9, -0.5],
    [-0.9, 0.5],
    [0.9, 0.5],
  ];

  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.8, 0]} material={feltMat}>
        <boxGeometry args={[2.2, 0.1, 1.2]} />
      </mesh>
      <mesh position={[0, 0.74, 0]} material={darkOak}>
        <boxGeometry args={[2.3, 0.06, 1.3]} />
      </mesh>
      {legOffsets.map(([lx, lz]) => (
        <mesh key={`${lx}-${lz}`} position={[lx, 0.37, lz]} material={darkOak}>
          <boxGeometry args={[0.14, 0.74, 0.14]} />
        </mesh>
      ))}
    </group>
  );
}

function TableTennis({ x, z }: { x: number; z: number }) {
  const darkOak = getVoxelMaterial("dark_oak");
  const iron = getVoxelMaterial("iron");
  const tableMat = useMemo(() => new THREE.MeshLambertMaterial({ color: TABLE_BLUE }), []);

  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.76, 0]} material={tableMat}>
        <boxGeometry args={[2.4, 0.06, 1.4]} />
      </mesh>
      <mesh position={[0, 0.86, 0]} material={iron}>
        <boxGeometry args={[0.03, 0.14, 1.4]} />
      </mesh>
      {[-1.0, 1.0].map((lx) =>
        [-0.55, 0.55].map((lz) => (
          <mesh key={`${lx}-${lz}`} position={[lx, 0.38, lz]} material={darkOak}>
            <boxGeometry args={[0.1, 0.76, 0.1]} />
          </mesh>
        )),
      )}
    </group>
  );
}

/** Recreation corner — a pool table and a table-tennis table, giving the
 * floor plan somewhere to grow into besides more desks, and matching the
 * "something different" the user asked to fill the room's extra space
 * with. */
export function RecreationArea({ zoneCenterX, poolZ, tennisZ }: RecreationAreaProps) {
  const signMat = useMemo(() => createSignMaterial("REC ROOM"), []);

  return (
    <group position={[zoneCenterX, 0, 0]}>
      <mesh position={[0, 1.9, poolZ + 1.1]} material={signMat}>
        <boxGeometry args={[1.4, 0.7, 0.06]} />
      </mesh>
      <PoolTable x={0} z={poolZ} />
      <TableTennis x={0} z={tennisZ} />
    </group>
  );
}
