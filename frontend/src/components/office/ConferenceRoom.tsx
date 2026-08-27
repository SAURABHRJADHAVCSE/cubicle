"use client";

import { useMemo } from "react";

import { createSignMaterial, getTiledVoxelMaterial, getVoxelMaterial, preventZFighting } from "@/lib/voxelMaterials";

interface ConferenceRoomProps {
  position: [number, number, number];
  onSelect?: () => void;
}

const ROOM_WIDTH = 3.6;
const ROOM_DEPTH = 2.8;
const ROOM_HEIGHT = 2.4;

export function ConferenceRoom({ position, onSelect }: ConferenceRoomProps) {
  const oakMat = getVoxelMaterial("oak");
  const darkOakMat = getVoxelMaterial("dark_oak");
  const ironMat = getVoxelMaterial("iron");
  const redWoolMat = getVoxelMaterial("red_wool");
  const whiteboardMat = getVoxelMaterial("whiteboard");
  const monitorMat = getVoxelMaterial("monitor_screen");

  const floorTileMat = useMemo(
    () => preventZFighting(getTiledVoxelMaterial("marble_tile", ROOM_WIDTH, ROOM_DEPTH)),
    [],
  );
  const glassMat = useMemo(
    () => getTiledVoxelMaterial("glass", ROOM_WIDTH, ROOM_HEIGHT),
    [],
  );
  const signMat = useMemo(() => createSignMaterial("WAR ROOM", "#a855f7"), []);

  const chairPositions: [number, number][] = [
    [-0.9, -0.6],
    [0, -0.6],
    [0.9, -0.6],
    [-0.9, 0.6],
    [0, 0.6],
    [0.9, 0.6],
  ];

  return (
    <group
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.();
      }}
    >
      {/* Marble Tile Subfloor Box */}
      <mesh position={[0, 0.02, 0]} material={floorTileMat} receiveShadow>
        <boxGeometry args={[ROOM_WIDTH, 0.04, ROOM_DEPTH]} />
      </mesh>

      {/* Glass Enclosure */}
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
      <mesh position={[-1.1, ROOM_HEIGHT / 2, ROOM_DEPTH / 2]} material={glassMat}>
        <boxGeometry args={[1.4, ROOM_HEIGHT, 0.08]} />
      </mesh>

      {/* Signboard */}
      <mesh position={[0, ROOM_HEIGHT + 0.15, ROOM_DEPTH / 2 + 0.05]} material={signMat}>
        <boxGeometry args={[1.8, 0.5, 0.06]} />
      </mesh>

      {/* Conference Table */}
      <group position={[0, 0, 0]}>
        <mesh position={[0, 0.82, 0]} material={darkOakMat} castShadow receiveShadow>
          <boxGeometry args={[2.2, 0.08, 1.1]} />
        </mesh>
        <mesh position={[-0.9, 0.41, 0]} material={ironMat}>
          <boxGeometry args={[0.1, 0.82, 0.8]} />
        </mesh>
        <mesh position={[0.9, 0.41, 0]} material={ironMat}>
          <boxGeometry args={[0.1, 0.82, 0.8]} />
        </mesh>

        {/* Chairs */}
        {chairPositions.map(([cx, cz]) => (
          <group key={`${cx}-${cz}`} position={[cx, 0, cz]}>
            <mesh position={[0, 0.45, 0]} material={redWoolMat} castShadow>
              <boxGeometry args={[0.36, 0.06, 0.36]} />
            </mesh>
            <mesh position={[0, 0.7, cz < 0 ? -0.15 : 0.15]} material={redWoolMat} castShadow>
              <boxGeometry args={[0.36, 0.42, 0.06]} />
            </mesh>
            <mesh position={[0, 0.22, 0]} material={ironMat}>
              <boxGeometry args={[0.06, 0.44, 0.06]} />
            </mesh>
          </group>
        ))}
      </group>

      {/* Whiteboard with Chart Graphics */}
      <mesh position={[-ROOM_WIDTH / 2 + 0.06, 1.3, 0]} rotation={[0, Math.PI / 2, 0]} material={whiteboardMat}>
        <boxGeometry args={[1.6, 1.0, 0.04]} />
      </mesh>
      <mesh position={[-ROOM_WIDTH / 2 + 0.08, 1.3, 0]} rotation={[0, Math.PI / 2, 0]} material={oakMat}>
        <boxGeometry args={[1.7, 1.1, 0.02]} />
      </mesh>

      {/* Presentation TV Screen on Back Wall */}
      <mesh position={[0, 1.6, -ROOM_DEPTH / 2 + 0.08]} material={monitorMat}>
        <boxGeometry args={[1.4, 0.8, 0.05]} />
      </mesh>
    </group>
  );
}
