"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

import { AgentAvatar } from "@/components/office/AgentAvatar";
import { BossCabin } from "@/components/office/BossCabin";
import { Cafeteria } from "@/components/office/Cafeteria";
import { ConferenceRoom } from "@/components/office/ConferenceRoom";
import { CubicleWalls } from "@/components/office/CubicleWalls";
import { Desk } from "@/components/office/Desk";
import { RecreationArea } from "@/components/office/RecreationArea";
import { ReceptionLobby } from "@/components/office/ReceptionLobby";
import { ServerRoom } from "@/components/office/ServerRoom";
import { SmallPlant } from "@/components/office/SmallPlant";
import type { CameraPreset, SelectedObjectType } from "@/components/office/TycoonHUD";
import { useAgents } from "@/hooks/useAgents";
import { useOfficeSocket } from "@/hooks/useOfficeSocket";
import { computeDeskExtent, computeDeskLayout } from "@/lib/officeLayout";
import { getTiledVoxelMaterial, getVoxelMaterial } from "@/lib/voxelMaterials";
import { useOfficeStore } from "@/stores/officeStore";

const BACKGROUND_COLOR = "#0f172a";
const FOG_COLOR = "#1e293b";

const OFFICE_WIDTH = 38;
const OFFICE_DEPTH = 26;

interface OfficeProps {
  onSelectObject?: (obj: SelectedObjectType) => void;
  activePreset?: CameraPreset;
}

function CameraRig({ preset = "overview" }: { preset: CameraPreset }) {
  const { camera } = useThree();
  const targetPos = useRef(new THREE.Vector3());
  const targetLook = useRef(new THREE.Vector3());

  useEffect(() => {
    switch (preset) {
      case "reception":
        targetPos.current.set(0, 6, 14.5);
        targetLook.current.set(0, 1, 8.5);
        break;
      case "desks":
        targetPos.current.set(0, 9, 8.5);
        targetLook.current.set(0, 0.5, 0.5);
        break;
      case "servers":
        targetPos.current.set(-11, 6, 6.5);
        targetLook.current.set(-11, 1, 1.5);
        break;
      case "ceosuite":
        targetPos.current.set(0, 6, -2.5);
        targetLook.current.set(0, 1, -7.5);
        break;
      case "cafeteria":
        targetPos.current.set(11, 6, 6.5);
        targetLook.current.set(11, 0.8, 1.5);
        break;
      case "recroom":
        targetPos.current.set(11, 6, -2.5);
        targetLook.current.set(11, 0.8, -7.5);
        break;
      case "warroom":
        targetPos.current.set(-11, 6, -2.5);
        targetLook.current.set(-11, 1, -7.5);
        break;
      case "overview":
      default:
        targetPos.current.set(22, 22, 26);
        targetLook.current.set(0, 0.5, 0);
        break;
    }
  }, [preset]);

  useFrame((_, delta) => {
    camera.position.lerp(targetPos.current, delta * 3.5);
    camera.lookAt(targetLook.current);
  });

  return null;
}

function PartitionWall({
  position,
  args,
}: {
  position: [number, number, number];
  args: [number, number, number];
}) {
  const wallMat = getVoxelMaterial("cubicle_wall");
  return (
    <mesh position={position} material={wallMat} castShadow receiveShadow>
      <boxGeometry args={args} />
    </mesh>
  );
}

function OfficeColumn({ position }: { position: [number, number, number] }) {
  const iron = getVoxelMaterial("iron");
  return (
    <mesh position={position} material={iron} castShadow receiveShadow>
      <boxGeometry args={[0.4, 3.2, 0.4]} />
    </mesh>
  );
}

export function Office({ onSelectObject, activePreset = "overview" }: OfficeProps) {
  const { data: agents } = useAgents();
  const syncFromRoster = useOfficeStore((s) => s.syncFromRoster);
  useOfficeSocket();

  useEffect(() => {
    if (agents) syncFromRoster(agents);
  }, [agents, syncFromRoster]);

  const rawLayout = computeDeskLayout(agents ?? []);
  const byId = new Map((agents ?? []).map((a) => [a.id, a]));

  const deskCenterZ = 0.5;

  const layout = useMemo(
    () =>
      rawLayout.map((d) => ({
        ...d,
        position: [d.position[0], d.position[1], d.position[2] + deskCenterZ] as [
          number,
          number,
          number,
        ],
      })),
    [rawLayout, deskCenterZ],
  );

  const floorMat = useMemo(
    () => getTiledVoxelMaterial("wood_parquet", OFFICE_WIDTH, OFFICE_DEPTH),
    [],
  );
  const aisleMat = useMemo(
    () => getTiledVoxelMaterial("red_wool", 2.8, OFFICE_DEPTH - 2),
    [],
  );
  const foundationMat = getVoxelMaterial("dark_oak");
  const edgeMat = getVoxelMaterial("stone_brick");
  const glassWallMat = useMemo(
    () => getTiledVoxelMaterial("glass", OFFICE_WIDTH, 2.2),
    [],
  );

  return (
    <>
      {/* Clean Corporate Studio Environment */}
      <color attach="background" args={[BACKGROUND_COLOR]} />
      <fog attach="fog" args={[FOG_COLOR, 45, 120]} />

      <CameraRig preset={activePreset} />

      {/* Warm Corporate Studio Lighting with Anti-Blinking Shadow Bias */}
      <hemisphereLight args={["#f8fafc", "#334155", 1.5]} />
      <ambientLight intensity={0.75} />
      <directionalLight
        position={[24, 30, 24]}
        intensity={1.8}
        color="#fffbeb"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.0008}
      />
      <directionalLight position={[-20, 18, -20]} intensity={0.5} color="#818cf8" />

      {/* Extended Outer Floor (Smooth Non-Aliasing Studio Floor - Eliminating Moiré Shimmering!) */}
      <mesh position={[0, -0.22, 0]} receiveShadow>
        <boxGeometry args={[140, 0.1, 140]} />
        <meshStandardMaterial color="#0b0f19" roughness={0.95} metalness={0.05} />
      </mesh>

      {/* Outer Building Foundation Base Slab */}
      <mesh position={[0, -0.1, 0]} material={foundationMat} receiveShadow>
        <boxGeometry args={[OFFICE_WIDTH + 0.6, 0.2, OFFICE_DEPTH + 0.6]} />
      </mesh>

      {/* Main Solid Office Parquet Floor Slab (Y = 0.02, height 0.04) */}
      <mesh position={[0, 0.02, 0]} material={floorMat} receiveShadow>
        <boxGeometry args={[OFFICE_WIDTH, 0.04, OFFICE_DEPTH]} />
      </mesh>

      {/* Central Corridor Executive Navy Carpet Runner (Y = 0.05, height 0.02) */}
      <mesh position={[0, 0.05, 0]} material={aisleMat} receiveShadow>
        <boxGeometry args={[2.8, 0.02, OFFICE_DEPTH - 1.0]} />
      </mesh>

      {/* Perimeter Exterior Trim Walls & Glass Facades */}
      <mesh position={[0, 0.28, -OFFICE_DEPTH / 2]} material={edgeMat} receiveShadow>
        <boxGeometry args={[OFFICE_WIDTH, 0.52, 0.24]} />
      </mesh>
      <mesh position={[0, 0.28, OFFICE_DEPTH / 2]} material={edgeMat} receiveShadow>
        <boxGeometry args={[OFFICE_WIDTH, 0.52, 0.24]} />
      </mesh>
      <mesh position={[-OFFICE_WIDTH / 2, 0.28, 0]} material={edgeMat} receiveShadow>
        <boxGeometry args={[0.24, 0.52, OFFICE_DEPTH]} />
      </mesh>
      <mesh position={[OFFICE_WIDTH / 2, 0.28, 0]} material={edgeMat} receiveShadow>
        <boxGeometry args={[0.24, 0.52, OFFICE_DEPTH]} />
      </mesh>

      {/* Outer Glass Window Walls */}
      <mesh position={[0, 1.25, -OFFICE_DEPTH / 2 + 0.06]} material={glassWallMat}>
        <boxGeometry args={[OFFICE_WIDTH - 0.5, 1.6, 0.06]} />
      </mesh>
      <mesh position={[0, 1.25, OFFICE_DEPTH / 2 - 0.06]} material={glassWallMat}>
        <boxGeometry args={[OFFICE_WIDTH - 0.5, 1.6, 0.06]} />
      </mesh>

      {/* Interior Partition Walls (Structuring Wings & Corridors) */}
      <PartitionWall position={[-6.8, 1.2, 4.5]} args={[0.12, 2.4, 8.0]} />
      <PartitionWall position={[-6.8, 1.2, -4.5]} args={[0.12, 2.4, 8.0]} />
      <PartitionWall position={[6.8, 1.2, 4.5]} args={[0.12, 2.4, 8.0]} />
      <PartitionWall position={[6.8, 1.2, -4.5]} args={[0.12, 2.4, 8.0]} />

      {/* Architectural Support Columns */}
      <OfficeColumn position={[-6.8, 1.6, 8.5]} />
      <OfficeColumn position={[6.8, 1.6, 8.5]} />
      <OfficeColumn position={[-6.8, 1.6, 0]} />
      <OfficeColumn position={[6.8, 1.6, 0]} />
      <OfficeColumn position={[-6.8, 1.6, -8.5]} />
      <OfficeColumn position={[6.8, 1.6, -8.5]} />

      {/* Indoor Potted Palm Plants */}
      <SmallPlant position={[-5.8, 0, 8.5]} />
      <SmallPlant position={[5.8, 0, 8.5]} />
      <SmallPlant position={[-5.8, 0, -4.0]} />
      <SmallPlant position={[5.8, 0, -4.0]} />
      <SmallPlant position={[-16.5, 0, 8.5]} />
      <SmallPlant position={[16.5, 0, 8.5]} />
      <SmallPlant position={[-16.5, 0, -8.5]} />
      <SmallPlant position={[16.5, 0, -8.5]} />

      {/* Front Entrance Reception Lobby (Center Front: Z = +8.5, X = 0) */}
      <ReceptionLobby
        position={[0, 0, 8.5]}
        onSelect={() => onSelectObject?.({ type: "reception" })}
      />

      {/* AI Data Server Core Room (Mid-Left Wing: Z = +1.5, X = -11) */}
      <ServerRoom
        position={[-11, 0, 1.5]}
        onSelect={() => onSelectObject?.({ type: "server" })}
      />

      {/* War Room Strategy Hub (Back-Left Wing: Z = -7.5, X = -11) */}
      <ConferenceRoom
        position={[-11, 0, -7.5]}
        onSelect={() => onSelectObject?.({ type: "warroom" })}
      />

      {/* Corporate Cafeteria (Mid-Right Wing: Z = +1.5, X = +11) */}
      <Cafeteria
        position={[11, 0, 1.5]}
        onSelect={() => onSelectObject?.({ type: "cafeteria" })}
      />

      {/* Recreation & Arcade Lounge (Back-Right Wing: Z = -7.5, X = +11) */}
      <RecreationArea
        position={[11, 0, -7.5]}
        onSelect={() => onSelectObject?.({ type: "recroom" })}
      />

      {/* Executive CEO Suite (Back Center Wing: Z = -7.5, X = 0) */}
      <BossCabin
        position={[0, 0, -7.5]}
        onSelect={() => onSelectObject?.({ type: "ceosuite" })}
      />

      {/* Open Office Workstations Grid (Center Main Floor: Z = 0.5) */}
      {layout.map(({ agentId, position, rotationY }) => {
        const agent = byId.get(agentId);
        if (!agent) return null;
        return (
          <group key={agentId}>
            <CubicleWalls position={position} rotationY={rotationY} />
            <Desk
              position={position}
              rotationY={rotationY}
              onSelect={() => onSelectObject?.({ type: "agent", agent })}
            />
            <AgentAvatar agent={agent} position={position} />
          </group>
        );
      })}
    </>
  );
}
