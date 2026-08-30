"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

import { AgentAvatar } from "@/components/office/AgentAvatar";
import { BossCabin } from "@/components/office/BossCabin";
import { ModernDesk } from "@/components/office/ModernDesk";
import { WaitingArea } from "@/components/office/WaitingArea";
import { useAgents } from "@/hooks/useAgents";
import { useOfficeSocket } from "@/hooks/useOfficeSocket";
import {
  computeDeskLayout,
  computeQueueLayout,
  computeRowDepth,
  computeWorkstationSlots,
  DESKS_PER_ROW,
} from "@/lib/officeLayout";
import { modernMaterials } from "@/lib/modernMaterials";
import { useOfficeStore } from "@/stores/officeStore";

const OFFICE_DEPTH = 14.5;
const SCENE_FLOOR_WIDTH = 36;
const SCENE_FLOOR_NEAR_Z = -17;
const DEFAULT_SCENE_FLOOR_FAR_Z = 17;
const WORK_CARPET_NEAR_Z = -1.55;
const DEFAULT_WORK_CARPET_FAR_Z = 6.55;
const OFFICE_HEIGHT = 2.6;
const CAMERA_ELEVATION = THREE.MathUtils.degToRad(38);
const CAMERA_FOV = 30;
const CAMERA_FILL = 1.03;
const CAMERA_TARGET_Y = 0.65;
const CAMERA_TARGET_Z = 0.45;
const BACKGROUND_COLOR = "#eee8df";

/* Three.js cameras are intentionally mutated by the render loop. Keeping the
 * exception around this rig avoids weakening immutability checks elsewhere. */
/* eslint-disable react-hooks/immutability */
function CameraRig({ maxScroll }: { maxScroll: number }) {
  const { camera, gl, size } = useThree();
  const scrollTarget = useRef(0);
  const scrollCurrent = useRef(0);
  const baseCameraPosition = useRef(new THREE.Vector3());
  const lookTarget = useRef(new THREE.Vector3());

  useLayoutEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return;

    const aspect = size.width / Math.max(1, size.height);
    const fovRadians = THREE.MathUtils.degToRad(CAMERA_FOV);
    const projectedHeight =
      13.6 * Math.sin(CAMERA_ELEVATION) +
      OFFICE_HEIGHT * Math.cos(CAMERA_ELEVATION);
    const distanceForHeight =
      projectedHeight / 2 / Math.tan(fovRadians / 2) / CAMERA_FILL;
    const distanceForWidth =
      18.1 / 2 / (Math.tan(fovRadians / 2) * aspect) / CAMERA_FILL;
    const distance = Math.max(distanceForHeight, distanceForWidth);
    const horizontalDistance = distance * Math.cos(CAMERA_ELEVATION);

    // No yaw: the room stays square to the viewport. Scroll moves this base
    // position and its look target together, preserving the exact angle.
    baseCameraPosition.current.set(
      0,
      CAMERA_TARGET_Y + distance * Math.sin(CAMERA_ELEVATION),
      CAMERA_TARGET_Z + horizontalDistance,
    );
    camera.position.copy(baseCameraPosition.current);
    camera.position.z += scrollCurrent.current;
    lookTarget.current.set(
      0,
      CAMERA_TARGET_Y,
      CAMERA_TARGET_Z + scrollCurrent.current,
    );
    camera.lookAt(lookTarget.current);
    camera.fov = CAMERA_FOV;
    camera.near = 0.1;
    camera.far = 100;
    camera.updateProjectionMatrix();
  }, [camera, size.height, size.width]);

  useEffect(() => {
    scrollTarget.current = THREE.MathUtils.clamp(
      scrollTarget.current,
      0,
      maxScroll,
    );
    scrollCurrent.current = THREE.MathUtils.clamp(
      scrollCurrent.current,
      0,
      maxScroll,
    );
  }, [maxScroll]);

  useEffect(() => {
    const canvas = gl.domElement;
    let lastTouchY: number | null = null;

    const moveScrollTarget = (delta: number) => {
      const next = THREE.MathUtils.clamp(
        scrollTarget.current + delta,
        0,
        maxScroll,
      );
      const moved = Math.abs(next - scrollTarget.current) > 0.001;
      scrollTarget.current = next;
      return moved;
    };

    const handleWheel = (event: WheelEvent) => {
      if (moveScrollTarget(event.deltaY * 0.008)) event.preventDefault();
    };
    const handleTouchStart = (event: TouchEvent) => {
      lastTouchY = event.touches[0]?.clientY ?? null;
    };
    const handleTouchMove = (event: TouchEvent) => {
      const touchY = event.touches[0]?.clientY;
      if (lastTouchY === null || touchY === undefined) return;
      const moved = moveScrollTarget((lastTouchY - touchY) * 0.025);
      lastTouchY = touchY;
      if (moved) event.preventDefault();
    };
    const handleTouchEnd = () => {
      lastTouchY = null;
    };

    canvas.addEventListener("wheel", handleWheel, { passive: false });
    canvas.addEventListener("touchstart", handleTouchStart, { passive: true });
    canvas.addEventListener("touchmove", handleTouchMove, { passive: false });
    canvas.addEventListener("touchend", handleTouchEnd);
    canvas.addEventListener("touchcancel", handleTouchEnd);

    return () => {
      canvas.removeEventListener("wheel", handleWheel);
      canvas.removeEventListener("touchstart", handleTouchStart);
      canvas.removeEventListener("touchmove", handleTouchMove);
      canvas.removeEventListener("touchend", handleTouchEnd);
      canvas.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, [gl, maxScroll]);

  useFrame((_, delta) => {
    const smoothing = 1 - Math.exp(-8 * delta);
    scrollCurrent.current = THREE.MathUtils.lerp(
      scrollCurrent.current,
      scrollTarget.current,
      smoothing,
    );

    camera.position.copy(baseCameraPosition.current);
    camera.position.z += scrollCurrent.current;
    lookTarget.current.set(
      0,
      CAMERA_TARGET_Y,
      CAMERA_TARGET_Z + scrollCurrent.current,
    );
    camera.lookAt(lookTarget.current);
  });

  return null;
}
/* eslint-enable react-hooks/immutability */

function OfficeShell({ rowDepth }: { rowDepth: number }) {
  const floor = modernMaterials.floorWood();
  const carpet = modernMaterials.workCarpet();
  const trim = modernMaterials.zoneTrim();
  const rearWall = modernMaterials.wallWarmGrey();
  const carpetFarZ = Math.max(DEFAULT_WORK_CARPET_FAR_Z, rowDepth);
  const carpetDepth = carpetFarZ - WORK_CARPET_NEAR_Z;
  const carpetCenterZ = (carpetFarZ + WORK_CARPET_NEAR_Z) / 2;
  const floorFarZ = Math.max(DEFAULT_SCENE_FLOOR_FAR_Z, rowDepth + 8);
  const floorDepth = floorFarZ - SCENE_FLOOR_NEAR_Z;
  const floorCenterZ = (floorFarZ + SCENE_FLOOR_NEAR_Z) / 2;

  return (
    <group>
      {/* Overscanned interior floor: every camera ray lands inside the office,
          so the room never reads as a small stage floating on a backdrop. */}
      <mesh position={[0, -0.035, floorCenterZ]} material={floor} receiveShadow>
        <boxGeometry args={[SCENE_FLOOR_WIDTH, 0.09, floorDepth]} />
      </mesh>

      <mesh position={[0, 0.055, carpetCenterZ]} material={carpet} receiveShadow>
        <boxGeometry args={[17.6, 0.035, carpetDepth]} />
      </mesh>
      <mesh position={[0, 0.078, -1.55]} material={trim} receiveShadow>
        <boxGeometry args={[17.6, 0.012, 0.07]} />
      </mesh>

      {/* This wall extends above the highest camera ray. Its former 2.6-unit
          height left a thin glimpse of the overscan floor in the top-right. */}
      <mesh position={[0, 2.5, -OFFICE_DEPTH / 2]} material={rearWall} castShadow receiveShadow>
        <boxGeometry args={[SCENE_FLOOR_WIDTH, 5, 0.22]} />
      </mesh>
      <mesh position={[0, 0.12, -OFFICE_DEPTH / 2 + 0.1]} material={trim} receiveShadow>
        <boxGeometry args={[SCENE_FLOOR_WIDTH, 0.24, 0.08]} />
      </mesh>
    </group>
  );
}

export function Office() {
  const { data: agents } = useAgents();
  const syncFromRoster = useOfficeStore((state) => state.syncFromRoster);
  useOfficeSocket();

  useEffect(() => {
    if (agents) syncFromRoster(agents);
  }, [agents, syncFromRoster]);

  const agentCount = agents?.length ?? 0;
  const workstationCount = Math.max(
    DESKS_PER_ROW,
    Math.ceil((agentCount + 1) / DESKS_PER_ROW) * DESKS_PER_ROW,
  );
  const workstationSlots = useMemo(
    () => computeWorkstationSlots(workstationCount),
    [workstationCount],
  );
  const deskAssignments = useMemo(() => computeDeskLayout(agents ?? []), [agents]);
  const queueAssignments = useMemo(() => computeQueueLayout(agents ?? []), [agents]);
  const rowDepth = useMemo(
    () => computeRowDepth(workstationSlots),
    [workstationSlots],
  );
  const maxCameraScroll = Math.max(0, rowDepth - DEFAULT_WORK_CARPET_FAR_Z);
  const deskByAgent = new Map(deskAssignments.map((desk) => [desk.agentId, desk]));
  const queueByAgent = new Map(queueAssignments.map((slot) => [slot.agentId, slot]));

  return (
    <>
      <color attach="background" args={[BACKGROUND_COLOR]} />
      <CameraRig maxScroll={maxCameraScroll} />

      <hemisphereLight args={["#fff9ef", "#71817e", 1.05]} />
      <ambientLight intensity={0.26} />
      <directionalLight
        position={[-7, 12, 10]}
        intensity={1.5}
        color="#fff4df"
        castShadow
        shadow-mapSize-width={1536}
        shadow-mapSize-height={1536}
        shadow-camera-left={-11}
        shadow-camera-right={11}
        shadow-camera-top={Math.max(10, rowDepth + 2)}
        shadow-camera-bottom={-Math.max(10, rowDepth + 2)}
        shadow-camera-near={1}
        shadow-camera-far={60}
        shadow-bias={-0.0002}
        shadow-normalBias={0.025}
        shadow-radius={5}
      />
      <directionalLight position={[8, 6, -6]} intensity={0.28} color="#c7d2fe" />

      <OfficeShell rowDepth={rowDepth} />

      <WaitingArea position={[-5.7, 0.08, -5.05]} />
      <BossCabin position={[5.1, 0.08, -5.05]} />

      {workstationSlots.map((slot, index) => (
        <ModernDesk
          key={`workstation-${index}`}
          position={slot.position}
          rotationY={slot.rotationY}
        />
      ))}

      {(agents ?? []).map((agent) => {
        const desk = deskByAgent.get(agent.id);
        if (!desk) return null;

        const isWorking = agent.status === "working" || agent.status === "thinking";
        const waitingSlot = queueByAgent.get(agent.id);
        const destination = isWorking || !waitingSlot ? desk : waitingSlot;

        return (
          <AgentAvatar
            key={agent.id}
            agent={agent}
            targetPosition={destination.position}
            targetRotationY={destination.rotationY}
            restWhenIdle={!isWorking}
          />
        );
      })}
    </>
  );
}
