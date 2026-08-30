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

const OFFICE_WIDTH = 19;
const OFFICE_DEPTH = 14.5;
const OFFICE_HEIGHT = 2.6;
const CAMERA_ELEVATION = THREE.MathUtils.degToRad(38);
const CAMERA_YAW = THREE.MathUtils.degToRad(6);
const CAMERA_FOV = 30;
const CAMERA_FILL = 0.92;
const BACKGROUND_COLOR = "#e8e7e3";

function CameraRig() {
  const { camera, size } = useThree();

  useEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return;

    const aspect = size.width / Math.max(1, size.height);
    const fovRadians = THREE.MathUtils.degToRad(CAMERA_FOV);
    const projectedHeight =
      OFFICE_DEPTH * Math.sin(CAMERA_ELEVATION) +
      OFFICE_HEIGHT * Math.cos(CAMERA_ELEVATION);
    const distanceForHeight =
      projectedHeight / 2 / Math.tan(fovRadians / 2) / CAMERA_FILL;
    const distanceForWidth =
      OFFICE_WIDTH / 2 / (Math.tan(fovRadians / 2) * aspect) / CAMERA_FILL;
    const distance = Math.max(distanceForHeight, distanceForWidth);
    const horizontalDistance = distance * Math.cos(CAMERA_ELEVATION);
    const target = new THREE.Vector3(0, 0.65, 0.45);

    camera.position.set(
      target.x + horizontalDistance * Math.sin(CAMERA_YAW),
      target.y + distance * Math.sin(CAMERA_ELEVATION),
      target.z + horizontalDistance * Math.cos(CAMERA_YAW),
    );
    camera.lookAt(target);
    // eslint-disable-next-line react-hooks/immutability
    camera.fov = CAMERA_FOV;
    camera.near = 0.1;
    camera.far = 100;
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
      <mesh position={[0, -0.1, 0]} material={edge} receiveShadow>
        <boxGeometry args={[OFFICE_WIDTH, 0.2, OFFICE_DEPTH]} />
      </mesh>
      <mesh position={[0, 0.015, 0]} material={floor} receiveShadow>
        <boxGeometry args={[OFFICE_WIDTH - 0.2, 0.045, OFFICE_DEPTH - 0.2]} />
      </mesh>

      <mesh position={[0, 0.055, 2.5]} material={carpet} receiveShadow>
        <boxGeometry args={[17.6, 0.035, 8.1]} />
      </mesh>
      <mesh position={[0, 0.078, -1.55]} material={trim} receiveShadow>
        <boxGeometry args={[17.6, 0.012, 0.07]} />
      </mesh>

      <mesh position={[0, 0.95, -OFFICE_DEPTH / 2]} material={rearWall} castShadow receiveShadow>
        <boxGeometry args={[OFFICE_WIDTH, 1.9, 0.18]} />
      </mesh>
      <mesh position={[-OFFICE_WIDTH / 2, 0.5, -0.2]} material={sideWall} castShadow receiveShadow>
        <boxGeometry args={[0.14, 1, OFFICE_DEPTH - 0.1]} />
      </mesh>
      <mesh position={[OFFICE_WIDTH / 2, 0.5, -0.2]} material={sideWall} castShadow receiveShadow>
        <boxGeometry args={[0.14, 1, OFFICE_DEPTH - 0.1]} />
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
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
        shadow-camera-near={1}
        shadow-camera-far={35}
        shadow-bias={-0.0002}
        shadow-normalBias={0.025}
        shadow-radius={5}
      />
      <directionalLight position={[8, 6, -6]} intensity={0.28} color="#c7d2fe" />

      <OfficeShell />

      <WaitingArea position={[-5.7, 0.08, -5.05]} />
      <BossCabin position={[5.1, 0.08, -5.05]} />

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
