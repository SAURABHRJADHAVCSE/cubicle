"use client";

import { useMemo } from "react";

import { createSignMaterial, getTiledVoxelMaterial, getVoxelMaterial, preventZFighting } from "@/lib/voxelMaterials";

interface ReceptionLobbyProps {
  position: [number, number, number];
  onSelect?: () => void;
}

const LOBBY_WIDTH = 6.4;
const LOBBY_DEPTH = 4.2;

export function ReceptionLobby({ position, onSelect }: ReceptionLobbyProps) {
  const darkOak = getVoxelMaterial("dark_oak");
  const quartz = getVoxelMaterial("quartz");
  const iron = getVoxelMaterial("iron");
  const redWool = getVoxelMaterial("red_wool");
  const monitorScreen = getVoxelMaterial("monitor_screen");

  const marbleMat = useMemo(
    () => preventZFighting(getTiledVoxelMaterial("marble_tile", LOBBY_WIDTH, LOBBY_DEPTH)),
    [],
  );
  const glassMat = useMemo(
    () => getTiledVoxelMaterial("glass", LOBBY_WIDTH, 2.2),
    [],
  );
  const signMat = useMemo(() => createSignMaterial("CUBICLE HQ", "#38bdf8"), []);

  return (
    <group
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.();
      }}
    >
      {/* Polished Marble Subfloor Box */}
      <mesh position={[0, 0.02, 0]} material={marbleMat} receiveShadow>
        <boxGeometry args={[LOBBY_WIDTH, 0.04, LOBBY_DEPTH]} />
      </mesh>

      {/* Front Entrance Glass Walls with Center Doorway */}
      <mesh position={[-2.1, 1.1, LOBBY_DEPTH / 2]} material={glassMat}>
        <boxGeometry args={[2.2, 2.2, 0.08]} />
      </mesh>
      <mesh position={[2.1, 1.1, LOBBY_DEPTH / 2]} material={glassMat}>
        <boxGeometry args={[2.2, 2.2, 0.08]} />
      </mesh>

      {/* Main Reception Desk */}
      <group position={[0, 0, -0.4]}>
        {/* Curved / Angled Front Counter */}
        <mesh position={[0, 0.55, 0]} material={quartz} castShadow receiveShadow>
          <boxGeometry args={[3.2, 1.1, 0.65]} />
        </mesh>
        <mesh position={[0, 1.12, 0]} material={darkOak} castShadow>
          <boxGeometry args={[3.4, 0.08, 0.75]} />
        </mesh>
        {/* Receptionist Computer Monitor */}
        <mesh position={[0, 1.35, -0.1]} material={monitorScreen}>
          <boxGeometry args={[0.55, 0.35, 0.05]} />
        </mesh>
        {/* Illuminated Logo Sign on Counter Front */}
        <mesh position={[0, 0.6, 0.34]} material={signMat}>
          <boxGeometry args={[1.8, 0.55, 0.04]} />
        </mesh>
      </group>

      {/* Visitor Waiting Lounge Couches */}
      <group position={[-2.2, 0, 0.6]}>
        <mesh position={[0, 0.3, 0]} material={redWool} castShadow>
          <boxGeometry args={[1.6, 0.3, 0.7]} />
        </mesh>
        <mesh position={[0, 0.6, -0.28]} material={redWool} castShadow>
          <boxGeometry args={[1.6, 0.6, 0.18]} />
        </mesh>
        {/* Coffee Table */}
        <mesh position={[0, 0.22, 0.65]} material={darkOak} castShadow>
          <boxGeometry args={[1.1, 0.06, 0.55]} />
        </mesh>
      </group>

      {/* Security Turnstile Gates */}
      <group position={[2.3, 0, 0.2]}>
        <mesh position={[-0.45, 0.5, 0]} material={iron} castShadow>
          <boxGeometry args={[0.12, 1.0, 0.8]} />
        </mesh>
        <mesh position={[0.45, 0.5, 0]} material={iron} castShadow>
          <boxGeometry args={[0.12, 1.0, 0.8]} />
        </mesh>
        {/* Turnstile Barrier Arm */}
        <mesh position={[0, 0.6, 0]} material={quartz}>
          <boxGeometry args={[0.78, 0.06, 0.06]} />
        </mesh>
      </group>
    </group>
  );
}
