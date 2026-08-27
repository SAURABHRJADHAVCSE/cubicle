"use client";

import { useMemo } from "react";
import * as THREE from "three";

import { createSignMaterial, getTiledVoxelMaterial, getVoxelMaterial, preventZFighting } from "@/lib/voxelMaterials";

interface RecreationAreaProps {
  position: [number, number, number];
  onSelect?: () => void;
}

const ROOM_WIDTH = 5.4;
const ROOM_DEPTH = 4.2;
const ROOM_HEIGHT = 2.4;

const FELT_GREEN = "#2f6b3a";
const TABLE_BLUE = "#1f5f8b";

function ArcadeCabinet({ x, z }: { x: number; z: number }) {
  const arcadeScreenMat = getVoxelMaterial("arcade_screen");
  const darkOak = getVoxelMaterial("dark_oak");
  const iron = getVoxelMaterial("iron");

  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.9, 0]} material={darkOak} castShadow>
        <boxGeometry args={[0.7, 1.8, 0.65]} />
      </mesh>
      <mesh position={[0, 1.25, 0.28]} material={arcadeScreenMat}>
        <boxGeometry args={[0.55, 0.45, 0.1]} />
      </mesh>
      <mesh position={[0, 0.8, 0.32]} material={iron}>
        <boxGeometry args={[0.6, 0.1, 0.22]} />
      </mesh>
      <mesh position={[0, 1.7, 0.28]} material={iron}>
        <boxGeometry args={[0.65, 0.18, 0.1]} />
      </mesh>
      <pointLight position={[0, 1.25, 0.45]} color="#a855f7" intensity={0.8} distance={2} />
    </group>
  );
}

function LoungeSofa({ x, z }: { x: number; z: number }) {
  const redWool = getVoxelMaterial("red_wool");
  const darkOak = getVoxelMaterial("dark_oak");

  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.3, 0]} material={redWool} castShadow>
        <boxGeometry args={[1.5, 0.3, 0.65]} />
      </mesh>
      <mesh position={[0, 0.6, -0.26]} material={redWool} castShadow>
        <boxGeometry args={[1.5, 0.6, 0.16]} />
      </mesh>
      <mesh position={[-0.68, 0.45, 0]} material={darkOak}>
        <boxGeometry args={[0.14, 0.45, 0.65]} />
      </mesh>
      <mesh position={[0.68, 0.45, 0]} material={darkOak}>
        <boxGeometry args={[0.14, 0.45, 0.65]} />
      </mesh>
    </group>
  );
}

function PoolTable({ x, z }: { x: number; z: number }) {
  const darkOak = getVoxelMaterial("dark_oak");
  const feltMat = useMemo(() => new THREE.MeshLambertMaterial({ color: FELT_GREEN }), []);
  const legOffsets: [number, number][] = [
    [-0.8, -0.45],
    [0.8, -0.45],
    [-0.8, 0.45],
    [0.8, 0.45],
  ];

  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.8, 0]} material={feltMat}>
        <boxGeometry args={[1.9, 0.1, 1.1]} />
      </mesh>
      <mesh position={[0, 0.74, 0]} material={darkOak}>
        <boxGeometry args={[2.0, 0.06, 1.2]} />
      </mesh>
      {legOffsets.map(([lx, lz]) => (
        <mesh key={`${lx}-${lz}`} position={[lx, 0.37, lz]} material={darkOak}>
          <boxGeometry args={[0.12, 0.74, 0.12]} />
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
        <boxGeometry args={[2.0, 0.06, 1.2]} />
      </mesh>
      <mesh position={[0, 0.86, 0]} material={iron}>
        <boxGeometry args={[0.03, 0.14, 1.2]} />
      </mesh>
      {[-0.8, 0.8].map((lx) =>
        [-0.45, 0.45].map((lz) => (
          <mesh key={`${lx}-${lz}`} position={[lx, 0.38, lz]} material={darkOak}>
            <boxGeometry args={[0.08, 0.76, 0.08]} />
          </mesh>
        )),
      )}
    </group>
  );
}

export function RecreationArea({ position, onSelect }: RecreationAreaProps) {
  const floorTileMat = useMemo(
    () => preventZFighting(getTiledVoxelMaterial("red_wool", ROOM_WIDTH, ROOM_DEPTH)),
    [],
  );
  const glassMat = useMemo(
    () => getTiledVoxelMaterial("glass", ROOM_WIDTH, ROOM_HEIGHT),
    [],
  );
  const signMat = useMemo(() => createSignMaterial("REC ROOM"), []);

  return (
    <group
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.();
      }}
    >
      {/* Carpet Subfloor Box */}
      <mesh position={[0, 0.06, 0]} material={floorTileMat} receiveShadow>
        <boxGeometry args={[ROOM_WIDTH, 0.04, ROOM_DEPTH]} />
      </mesh>

      {/* Glass Walls */}
      <mesh position={[0, ROOM_HEIGHT / 2, -ROOM_DEPTH / 2]} material={glassMat}>
        <boxGeometry args={[ROOM_WIDTH, ROOM_HEIGHT, 0.08]} />
      </mesh>
      <mesh
        position={[ROOM_WIDTH / 2, ROOM_HEIGHT / 2, 0]}
        rotation={[0, Math.PI / 2, 0]}
        material={glassMat}
      >
        <boxGeometry args={[ROOM_DEPTH, ROOM_HEIGHT, 0.08]} />
      </mesh>

      {/* Signboard */}
      <mesh position={[0, ROOM_HEIGHT + 0.15, ROOM_DEPTH / 2 + 0.05]} material={signMat}>
        <boxGeometry args={[1.4, 0.5, 0.06]} />
      </mesh>

      <ArcadeCabinet x={1.8} z={-0.8} />
      <LoungeSofa x={-1.4} z={-0.8} />
      <PoolTable x={-1.2} z={0.9} />
      <TableTennis x={1.2} z={0.9} />
    </group>
  );
}
