"use client";

import { useMemo } from "react";

import { createSignMaterial, getTiledVoxelMaterial, getVoxelMaterial, preventZFighting } from "@/lib/voxelMaterials";

interface ServerRoomProps {
  position: [number, number, number];
  onSelect?: () => void;
}

const ROOM_WIDTH = 3.6;
const ROOM_DEPTH = 2.8;
const ROOM_HEIGHT = 2.4;

export function ServerRoom({ position, onSelect }: ServerRoomProps) {
  const serverRackMat = getVoxelMaterial("server_rack");
  const ironMat = getVoxelMaterial("iron");
  const monitorMat = getVoxelMaterial("monitor_screen");
  const darkOakMat = getVoxelMaterial("dark_oak");
  const floorTileMat = useMemo(
    () => preventZFighting(getTiledVoxelMaterial("stone_brick", ROOM_WIDTH, ROOM_DEPTH)),
    [],
  );
  const glassMat = useMemo(
    () => getTiledVoxelMaterial("glass", ROOM_WIDTH, ROOM_HEIGHT),
    [],
  );
  const signMat = useMemo(() => createSignMaterial("SERVER CORE", "#38bdf8"), []);

  return (
    <group
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.();
      }}
    >
      {/* Metallic Grid Subfloor Box */}
      <mesh position={[0, 0.02, 0]} material={floorTileMat} receiveShadow>
        <boxGeometry args={[ROOM_WIDTH, 0.04, ROOM_DEPTH]} />
      </mesh>

      {/* Glass Back Wall */}
      <mesh position={[0, ROOM_HEIGHT / 2, -ROOM_DEPTH / 2]} material={glassMat}>
        <boxGeometry args={[ROOM_WIDTH, ROOM_HEIGHT, 0.08]} />
      </mesh>
      {/* Glass Side Walls */}
      <mesh
        position={[-ROOM_WIDTH / 2, ROOM_HEIGHT / 2, 0]}
        rotation={[0, Math.PI / 2, 0]}
        material={glassMat}
      >
        <boxGeometry args={[ROOM_DEPTH, ROOM_HEIGHT, 0.08]} />
      </mesh>

      {/* Front Glass Partition with Entrance Gap */}
      <mesh position={[-1.1, ROOM_HEIGHT / 2, ROOM_DEPTH / 2]} material={glassMat}>
        <boxGeometry args={[1.4, ROOM_HEIGHT, 0.08]} />
      </mesh>
      <mesh position={[1.1, ROOM_HEIGHT / 2, ROOM_DEPTH / 2]} material={glassMat}>
        <boxGeometry args={[1.4, ROOM_HEIGHT, 0.08]} />
      </mesh>

      {/* Signboard */}
      <mesh position={[0, ROOM_HEIGHT + 0.15, ROOM_DEPTH / 2 + 0.05]} material={signMat}>
        <boxGeometry args={[1.8, 0.5, 0.06]} />
      </mesh>

      {/* Server Rack Towers */}
      {[-1.0, 0, 1.0].map((rx) => (
        <group key={rx} position={[rx, 0, -0.6]}>
          {/* Main Tower Body */}
          <mesh position={[0, 1.0, 0]} material={serverRackMat} castShadow receiveShadow>
            <boxGeometry args={[0.7, 1.9, 0.6]} />
          </mesh>
          {/* Top Exhaust Vent */}
          <mesh position={[0, 1.98, 0]} material={ironMat}>
            <boxGeometry args={[0.6, 0.06, 0.5]} />
          </mesh>
          {/* Status LEDs */}
          <pointLight position={[0, 1.2, 0.35]} color="#38bdf8" intensity={0.6} distance={2.5} />
        </group>
      ))}

      {/* Server Terminal Console Desk */}
      <group position={[0, 0, 0.6]}>
        <mesh position={[0, 0.5, 0]} material={darkOakMat}>
          <boxGeometry args={[1.0, 0.1, 0.5]} />
        </mesh>
        <mesh position={[-0.45, 0.25, 0]} material={ironMat}>
          <boxGeometry args={[0.06, 0.5, 0.4]} />
        </mesh>
        <mesh position={[0.45, 0.25, 0]} material={ironMat}>
          <boxGeometry args={[0.06, 0.5, 0.4]} />
        </mesh>
        {/* Terminal Screen */}
        <mesh position={[0, 0.8, -0.1]} material={monitorMat}>
          <boxGeometry args={[0.5, 0.35, 0.05]} />
        </mesh>
      </group>

      {/* Ambient Server Room Blue Light */}
      <pointLight position={[0, 1.8, 0]} color="#0284c7" intensity={1.0} distance={4} />
    </group>
  );
}
