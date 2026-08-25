"use client";

import { useEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";

import { AgentAvatar } from "@/components/office/AgentAvatar";
import { BossCabin } from "@/components/office/BossCabin";
import { Cafeteria } from "@/components/office/Cafeteria";
import { CubicleWalls } from "@/components/office/CubicleWalls";
import { Desk } from "@/components/office/Desk";
import { RecreationArea } from "@/components/office/RecreationArea";
import { SmallPlant } from "@/components/office/SmallPlant";
import { useAgents } from "@/hooks/useAgents";
import { useOfficeSocket } from "@/hooks/useOfficeSocket";
import { computeDeskExtent, computeDeskLayout } from "@/lib/officeLayout";
import { getTiledVoxelMaterial, getVoxelMaterial } from "@/lib/voxelMaterials";
import { useOfficeStore } from "@/stores/officeStore";

// Neutral warm tone, not stark white — a flat near-white background made
// the whole scene look like it was floating in empty page space rather
// than sitting on a ground.
const BACKGROUND_COLOR = "#cfc9b8";
const GROUND_COLOR = "#b7b09c";

const FRONT_PADDING = 2.5; // breathing room between the open front edge (camera side) and the desks
const DESK_BACK_PADDING = 1.5; // gap between the last desk row and the divider
const DIVIDER_GAP = 1.4; // width of the fence/hedge divider strip
const BACK_ZONE_DEPTH = 7; // shared depth of the cafeteria/cabin/rec strip
const BACK_PADDING = 1.2; // gap between the back strip's furniture and the back edge
// Widened significantly — the back strip now holds three side-by-side
// zones (cafeteria, boss cabin, recreation) instead of one, and the desk
// zone itself needs headroom to grow as more agents are added.
const MIN_ROOM_WIDTH = 22;

/** Camera is intentionally fixed — no OrbitControls — so it can never be
 * dragged/zoomed to point anywhere awkward. A classic voxel-game 3/4
 * oblique angle (~55° from vertical) shows both the footprint and the
 * height of everything, which is what actually reads as "3D." */
function CameraRig({ width, depth }: { width: number; depth: number }) {
  const { camera } = useThree();
  useEffect(() => {
    const angleFromVertical = (55 * Math.PI) / 180;
    const distance = depth * 0.85 + width * 0.25 + 2;
    camera.position.set(
      0,
      distance * Math.cos(angleFromVertical),
      distance * Math.sin(angleFromVertical),
    );
    camera.lookAt(0, 0.5, 0);
  }, [camera, width, depth]);
  return null;
}

/** Standalone lamp post — floor-standing (pole + lantern block + light). */
function LampPost({ position }: { position: [number, number, number] }) {
  const dark = getVoxelMaterial("dark_oak");
  const lantern = getVoxelMaterial("sea_lantern");
  return (
    <group position={position}>
      <mesh position={[0, 0.9, 0]} material={dark}>
        <boxGeometry args={[0.1, 1.8, 0.1]} />
      </mesh>
      <mesh position={[0, 1.85, 0]} material={lantern}>
        <boxGeometry args={[0.35, 0.35, 0.35]} />
      </mesh>
      <pointLight position={[0, 1.85, 0]} color="#ffffee" intensity={0.7} distance={9} />
    </group>
  );
}

export function Office() {
  const { data: agents } = useAgents();
  const syncFromRoster = useOfficeStore((s) => s.syncFromRoster);
  useOfficeSocket();

  useEffect(() => {
    if (agents) syncFromRoster(agents);
  }, [agents, syncFromRoster]);

  const rawLayout = computeDeskLayout(agents ?? []);
  const byId = new Map((agents ?? []).map((a) => [a.id, a]));
  const deskExtent = computeDeskExtent(rawLayout);
  const deskZoneDepth = deskExtent.depth + DESK_BACK_PADDING;

  const depth = FRONT_PADDING + deskZoneDepth + DIVIDER_GAP + BACK_ZONE_DEPTH + BACK_PADDING;
  const width = Math.max(deskExtent.width + FRONT_PADDING * 2, MIN_ROOM_WIDTH);

  // Desks sit toward the open front edge (near the camera); the back
  // strip (cafeteria / boss cabin / recreation) sits beyond a fence
  // divider, split into three equal-width zones left to right.
  const deskZoneCenterZ = depth / 2 - FRONT_PADDING - deskZoneDepth / 2;
  const dividerZ = deskZoneCenterZ - deskZoneDepth / 2 - DIVIDER_GAP / 2;
  const backZoneBackEdge = -depth / 2 + BACK_PADDING;
  const counterZ = backZoneBackEdge + 0.7;
  const tablesZ = dividerZ - BACK_ZONE_DEPTH / 2 + 0.5;
  const zoneWidth = width / 3;
  const cafeteriaCenterX = -zoneWidth;
  const cabinCenterX = 0;
  const recCenterX = zoneWidth;

  const layout = useMemo(
    () =>
      rawLayout.map((d) => ({
        ...d,
        position: [d.position[0], d.position[1], d.position[2] + deskZoneCenterZ] as [
          number,
          number,
          number,
        ],
      })),
    [rawLayout, deskZoneCenterZ],
  );

  const floorMat = useMemo(() => getTiledVoxelMaterial("oak", width, depth), [width, depth]);
  const aisleMat = useMemo(
    () => getTiledVoxelMaterial("red_wool", 1.8, deskZoneDepth),
    [deskZoneDepth],
  );
  const dividerMat = getVoxelMaterial("oak");

  const fencePosts = useMemo(() => {
    const posts: number[] = [];
    const gapHalf = 1.3;
    for (let x = -width / 2 + 1; x <= width / 2 - 1; x += 1.4) {
      if (x > -gapHalf && x < gapHalf) continue;
      posts.push(x);
    }
    return posts;
  }, [width]);

  const lampPositions = useMemo<[number, number, number][]>(
    () => [
      [-width / 2 + 0.5, 0, dividerZ],
      [width / 2 - 0.5, 0, dividerZ],
    ],
    [width, dividerZ],
  );

  const plantPositions = useMemo<[number, number, number][]>(
    () => [
      [-width / 2 + 0.6, 0, -depth / 2 + 0.6],
      [width / 2 - 0.6, 0, -depth / 2 + 0.6],
      [-width / 2 + 0.6, 0, deskZoneCenterZ + deskZoneDepth / 2 - 0.4],
      [width / 2 - 0.6, 0, deskZoneCenterZ + deskZoneDepth / 2 - 0.4],
    ],
    [width, depth, deskZoneCenterZ, deskZoneDepth],
  );

  return (
    <>
      <color attach="background" args={[BACKGROUND_COLOR]} />
      <fog attach="fog" args={[BACKGROUND_COLOR, 24, 48]} />

      <CameraRig width={width} depth={depth} />

      <ambientLight intensity={0.75} />
      <directionalLight position={[width / 2, 12, -depth / 3]} intensity={0.6} />

      <mesh position={[0, -0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width * 2.4, depth * 2.4]} />
        <meshLambertMaterial color={GROUND_COLOR} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} material={floorMat}>
        <planeGeometry args={[width, depth]} />
      </mesh>
      <mesh position={[0, 0.01, deskZoneCenterZ]} rotation={[-Math.PI / 2, 0, 0]} material={aisleMat}>
        <planeGeometry args={[1.8, deskZoneDepth]} />
      </mesh>

      {fencePosts.map((x) => (
        <mesh key={x} position={[x, 0.45, dividerZ]} material={dividerMat}>
          <boxGeometry args={[0.14, 0.9, 0.14]} />
        </mesh>
      ))}

      {lampPositions.map((p) => (
        <LampPost key={`${p[0]}-${p[2]}`} position={p} />
      ))}

      {plantPositions.map((p) => (
        <SmallPlant key={`${p[0]}-${p[2]}`} position={p} />
      ))}

      <Cafeteria
        zoneCenterX={cafeteriaCenterX}
        zoneWidth={zoneWidth}
        counterZ={counterZ}
        tablesZ={tablesZ}
        dividerZ={dividerZ}
      />

      {/* Boss cabin sits between the cafeteria and recreation zones —
          flanked by neighbors instead of floating alone. */}
      <BossCabin position={[cabinCenterX, 0, tablesZ]} />

      <RecreationArea zoneCenterX={recCenterX} poolZ={tablesZ} tennisZ={(tablesZ + counterZ) / 2} />

      {layout.map(({ agentId, position, rotationY }) => {
        const agent = byId.get(agentId);
        if (!agent) return null;
        return (
          <group key={agentId}>
            <CubicleWalls position={position} rotationY={rotationY} />
            <Desk position={position} rotationY={rotationY} />
            <AgentAvatar agent={agent} position={position} />
          </group>
        );
      })}
    </>
  );
}
