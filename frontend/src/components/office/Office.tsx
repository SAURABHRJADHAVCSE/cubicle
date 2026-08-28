"use client";

import { useEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";
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
  WORKSTATION_SLOTS,
} from "@/lib/officeLayout";
import { modernMaterials } from "@/lib/modernMaterials";
import { useOfficeStore } from "@/stores/officeStore";

const OFFICE_WIDTH = 16;
const OFFICE_DEPTH = 12.5;
const OFFICE_HEIGHT = 2.5;
const CAMERA_ELEVATION = THREE.MathUtils.degToRad(34);
const CAMERA_FILL = 0.93;
const BACKGROUND_COLOR = "#d7d0c4";

function CameraRig() {
  const { camera, size } = useThree();

  useEffect(() => {
    if (!(camera instanceof THREE.OrthographicCamera)) return;

    const distance = 24;
    const projectedHeight =
      OFFICE_DEPTH * Math.sin(CAMERA_ELEVATION) +
      OFFICE_HEIGHT * Math.cos(CAMERA_ELEVATION);
    const zoomForWidth = size.width / (OFFICE_WIDTH / CAMERA_FILL);
    const zoomForHeight = size.height / (projectedHeight / CAMERA_FILL);

    camera.position.set(
      0,
      0.65 + distance * Math.sin(CAMERA_ELEVATION),
      0.3 + distance * Math.cos(CAMERA_ELEVATION),
    );
    camera.lookAt(0, 0.65, 0.3);
    // R3F cameras are imperative scene objects; projection properties must
    // be updated directly when the canvas dimensions change.
    // eslint-disable-next-line react-hooks/immutability
    camera.zoom = Math.min(zoomForWidth, zoomForHeight);
    camera.near = 0.1;
    camera.far = 80;
    camera.updateProjectionMatrix();
  }, [camera, size.height, size.width]);

  return null;
}

function OfficeShell() {
  const floor = modernMaterials.floorWood();
  const edge = modernMaterials.floorEdge();
  const carpet = modernMaterials.workCarpet();
  const trim = modernMaterials.zoneTrim();
  const rearWall = modernMaterials.wallWarmGrey();
  const sideWall = modernMaterials.wallSlate();

  return (
    <group>
      <mesh position={[0, -0.12, 0]} material={edge} receiveShadow>
        <boxGeometry args={[OFFICE_WIDTH, 0.24, OFFICE_DEPTH]} />
      </mesh>
      <mesh position={[0, 0.015, 0]} material={floor} receiveShadow>
        <boxGeometry args={[OFFICE_WIDTH - 0.18, 0.05, OFFICE_DEPTH - 0.18]} />
      </mesh>

      <mesh position={[0, 0.05, 1.7]} material={carpet} receiveShadow>
        <boxGeometry args={[14.7, 0.035, 6.15]} />
      </mesh>
      <mesh position={[0, 0.074, -1.37]} material={trim} receiveShadow>
        <boxGeometry args={[14.7, 0.012, 0.075]} />
      </mesh>

      <mesh position={[0, 1.18, -OFFICE_DEPTH / 2]} material={rearWall} castShadow receiveShadow>
        <boxGeometry args={[OFFICE_WIDTH, 2.35, 0.16]} />
      </mesh>
      <mesh position={[-OFFICE_WIDTH / 2, 0.58, -0.2]} material={sideWall} castShadow receiveShadow>
        <boxGeometry args={[0.14, 1.15, OFFICE_DEPTH - 0.1]} />
      </mesh>
      <mesh position={[OFFICE_WIDTH / 2, 0.58, -0.2]} material={sideWall} castShadow receiveShadow>
        <boxGeometry args={[0.14, 1.15, OFFICE_DEPTH - 0.1]} />
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

  const deskAssignments = useMemo(() => computeDeskLayout(agents ?? []), [agents]);
  const queueAssignments = useMemo(() => computeQueueLayout(agents ?? []), [agents]);
  const deskByAgent = new Map(deskAssignments.map((desk) => [desk.agentId, desk]));
  const queueByAgent = new Map(queueAssignments.map((slot) => [slot.agentId, slot]));

  return (
    <>
      <color attach="background" args={[BACKGROUND_COLOR]} />
      <CameraRig />

      <hemisphereLight args={["#fff9ef", "#8d8790", 0.9]} />
      <ambientLight intensity={0.22} />
      <directionalLight
        position={[-7, 12, 10]}
        intensity={1.75}
        color="#fff4df"
        castShadow
        shadow-mapSize-width={1536}
        shadow-mapSize-height={1536}
        shadow-camera-left={-11}
        shadow-camera-right={11}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
        shadow-camera-near={1}
        shadow-camera-far={35}
        shadow-bias={-0.0002}
        shadow-normalBias={0.025}
      />
      <directionalLight position={[8, 6, -6]} intensity={0.35} color="#c7d2fe" />

      <OfficeShell />

      <WaitingArea position={[-4.65, 0.08, -4.15]} />
      <BossCabin position={[4.45, 0.08, -4.15]} />

      {WORKSTATION_SLOTS.map((slot, index) => (
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
          />
        );
      })}
    </>
  );
}
