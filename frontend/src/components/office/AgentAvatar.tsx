"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Html, RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import { useOfficeStore } from "@/stores/officeStore";
import type { AgentMood, AgentStatus } from "@/types/agent";

function hashSeed(id: string): number {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  }
  return (hash % 1000) / 100;
}

const STATUS_COLORS: Record<AgentStatus, string> = {
  idle: "#22c55e",
  working: "#3b82f6",
  thinking: "#a855f7",
  break: "#f59e0b",
  offline: "#6b7280",
};

const SKIN_TONES = ["#f0c3a5", "#d9a07d", "#b97855", "#8d553b", "#603a2d"];
const HAIR_COLORS = ["#211c1b", "#3a2923", "#5a3827", "#272b34", "#6b5543"];
const WALK_SPEED = 1.85;
const TURN_SPEED = 8;
const ARRIVED_EPSILON = 0.025;
const FIGURE_Z = 0.72;
const BREAK_ROOM_FRONT_Z = -3.1;
const BREAK_ROOM_RIGHT_X = -2.1;
// Centre of the real gap between the two front glass dividers.
const BREAK_ROOM_EXIT = new THREE.Vector3(-3.82, 0, -2.65);
const OFFICE_CROSS_AISLE_Z = -1.05;
const MODEL_FORWARD_OFFSET = Math.PI;
const UP_AXIS = new THREE.Vector3(0, 1, 0);

function buildTravelRoute(start: THREE.Vector3, destination: THREE.Vector3): THREE.Vector3[] {
  const startsInBreakRoom = start.z < BREAK_ROOM_FRONT_Z && start.x < BREAK_ROOM_RIGHT_X;
  const endsInBreakRoom = destination.z < BREAK_ROOM_FRONT_Z && destination.x < BREAK_ROOM_RIGHT_X;

  if (startsInBreakRoom && endsInBreakRoom) return [destination.clone()];

  if (startsInBreakRoom && !endsInBreakRoom) {
    return [
      BREAK_ROOM_EXIT.clone(),
      new THREE.Vector3(BREAK_ROOM_EXIT.x, 0, OFFICE_CROSS_AISLE_Z),
      new THREE.Vector3(destination.x, 0, OFFICE_CROSS_AISLE_Z),
      destination.clone(),
    ];
  }
  if (!startsInBreakRoom && endsInBreakRoom) {
    return [
      new THREE.Vector3(start.x, 0, OFFICE_CROSS_AISLE_Z),
      new THREE.Vector3(BREAK_ROOM_EXIT.x, 0, OFFICE_CROSS_AISLE_Z),
      BREAK_ROOM_EXIT.clone(),
      destination.clone(),
    ];
  }

  // Work-area moves use the same front cross-aisle instead of cutting
  // diagonally through desks. Each agent joins the lane, walks along it,
  // then turns squarely into the destination workstation column.
  return [
    new THREE.Vector3(start.x, 0, OFFICE_CROSS_AISLE_Z),
    new THREE.Vector3(destination.x, 0, OFFICE_CROSS_AISLE_Z),
    destination.clone(),
  ];
}

export interface AgentAvatarSubject {
  id: string;
  character_id?: string | null;
  name?: string;
  role?: string;
  status: AgentStatus;
  accent_color: string;
  mood: AgentMood;
}

interface AgentAvatarProps {
  agent: AgentAvatarSubject;
  targetPosition: [number, number, number];
  targetRotationY: number;
  animationStateOverride?: "idle" | "working" | "walking" | "celebrating";
  restWhenIdle?: boolean;
}

export function AgentAvatar({
  agent,
  targetPosition,
  targetRotationY,
  animationStateOverride,
  restWhenIdle = false,
}: AgentAvatarProps) {
  const rootRef = useRef<THREE.Group>(null);
  const figureRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const leftForearmRef = useRef<THREE.Group>(null);
  const rightForearmRef = useRef<THREE.Group>(null);
  const leftLegRef = useRef<THREE.Group>(null);
  const rightLegRef = useRef<THREE.Group>(null);
  const leftKneeRef = useRef<THREE.Group>(null);
  const rightKneeRef = useRef<THREE.Group>(null);
  const [initialPosition] = useState(() => new THREE.Vector3(...targetPosition));
  const currentPosition = useRef(initialPosition.clone());
  const lastDestination = useRef(new THREE.Vector3(...targetPosition));
  const destinationVector = useRef(new THREE.Vector3(...targetPosition));
  const travelRoute = useRef<THREE.Vector3[]>([]);
  const travelDirection = useRef(new THREE.Vector3());
  const desiredRotation = useRef(new THREE.Quaternion());
  const walkPhase = useRef(0);

  const storedAnimationState = useOfficeStore(
    (state) => state.agents[agent.id]?.animationState ?? "idle",
  );
  const animationState = animationStateOverride ?? storedAnimationState;
  const seed = useMemo(
    () => hashSeed(agent.character_id || agent.id),
    [agent.character_id, agent.id],
  );
  const statusColor = STATUS_COLORS[agent.status];
  const hasGlasses = Math.floor(seed) % 3 === 0;
  const hairStyle = Math.floor(seed * 13) % 3;

  const materials = useMemo(() => {
    const accent = new THREE.Color(agent.accent_color || "#4f46e5");
    const jacket = accent.clone().offsetHSL(0, -0.08, -0.12);
    const trousers = accent.clone().offsetHSL(0, -0.32, -0.32);
    const skin = SKIN_TONES[Math.floor(seed * 7) % SKIN_TONES.length];
    const hair = HAIR_COLORS[Math.floor(seed * 11) % HAIR_COLORS.length];
    const make = (color: THREE.ColorRepresentation, roughness: number, metalness = 0) =>
      new THREE.MeshStandardMaterial({ color, roughness, metalness });

    return {
      skin: make(skin, 0.62),
      hair: make(hair, 0.72),
      jacket: make(jacket, 0.84),
      shirt: make("#f4f1eb", 0.88),
      trousers: make(trousers, 0.88),
      shoe: make("#252525", 0.42, 0.03),
      eye: make("#29231f", 0.72),
      mouth: make("#80564d", 0.78),
      detail: make("#4b5563", 0.34, 0.42),
    };
  }, [agent.accent_color, seed]);

  useEffect(
    () => () => {
      Object.values(materials).forEach((material) => material.dispose());
    },
    [materials],
  );

  useFrame(({ clock }, delta) => {
    if (!rootRef.current || !figureRef.current) return;

    const time = clock.elapsedTime;
    const destination = destinationVector.current.set(...targetPosition);
    if (!lastDestination.current.equals(destination)) {
      travelRoute.current = buildTravelRoute(rootRef.current.position, destination);
      lastDestination.current.copy(destination);
    }

    let target = travelRoute.current[0] ?? destination;
    if (
      travelRoute.current.length > 0 &&
      rootRef.current.position.distanceTo(target) <= ARRIVED_EPSILON
    ) {
      rootRef.current.position.copy(target);
      currentPosition.current.copy(target);
      travelRoute.current.shift();
      target = travelRoute.current[0] ?? destination;
    }

    const distance = rootRef.current.position.distanceTo(target);
    const isWalking = distance > ARRIVED_EPSILON || travelRoute.current.length > 0;

    if (isWalking) {
      const direction = travelDirection.current.copy(target).sub(rootRef.current.position);
      const remainingDistance = direction.length();
      if (remainingDistance > 0) {
        const step = Math.min(remainingDistance, WALK_SPEED * delta);
        direction.multiplyScalar(step / remainingDistance);
        currentPosition.current.copy(rootRef.current.position).add(direction);
      }
      rootRef.current.position.copy(currentPosition.current);
      const deltaX = target.x - rootRef.current.position.x;
      const deltaZ = target.z - rootRef.current.position.z;
      if (Math.hypot(deltaX, deltaZ) > 0.01) {
        desiredRotation.current.setFromAxisAngle(
          UP_AXIS,
          Math.atan2(deltaX, deltaZ) + MODEL_FORWARD_OFFSET,
        );
        rootRef.current.quaternion.slerp(
          desiredRotation.current,
          1 - Math.exp(-TURN_SPEED * delta),
        );
      }
    } else {
      rootRef.current.position.copy(destination);
      currentPosition.current.copy(destination);
      desiredRotation.current.setFromAxisAngle(
        UP_AXIS,
        targetRotationY,
      );
      rootRef.current.quaternion.slerp(
        desiredRotation.current,
        1 - Math.exp(-TURN_SPEED * delta),
      );
    }

    const leftArm = leftArmRef.current;
    const rightArm = rightArmRef.current;
    const leftForearm = leftForearmRef.current;
    const rightForearm = rightForearmRef.current;
    const leftLeg = leftLegRef.current;
    const rightLeg = rightLegRef.current;
    const leftKnee = leftKneeRef.current;
    const rightKnee = rightKneeRef.current;

    if (isWalking) {
      walkPhase.current += delta * 7.6;
      const stride = Math.sin(walkPhase.current);
      const stepLift = Math.abs(Math.sin(walkPhase.current * 2));
      figureRef.current.position.set(0, 0.02 + stepLift * 0.028, FIGURE_Z);
      figureRef.current.rotation.set(0.045, 0, -stride * 0.015);
      if (leftArm && rightArm) {
        leftArm.rotation.x = stride * 0.56;
        rightArm.rotation.x = -stride * 0.56;
      }
      if (leftForearm && rightForearm) {
        leftForearm.rotation.x = 0.08;
        rightForearm.rotation.x = 0.08;
      }
      if (leftLeg && rightLeg) {
        leftLeg.rotation.x = -stride * 0.54;
        rightLeg.rotation.x = stride * 0.54;
      }
      if (leftKnee && rightKnee) {
        leftKnee.rotation.x = Math.max(0, stride) * -0.35;
        rightKnee.rotation.x = Math.max(0, -stride) * -0.35;
      }
      return;
    }

    if (animationState === "working") {
      const typing = Math.sin(time * 13) * 0.05;
      figureRef.current.position.set(0, -0.08 + Math.sin(time * 3) * 0.006, FIGURE_Z - 0.03);
      figureRef.current.rotation.set(0.035, 0, 0);
      if (leftArm && rightArm) {
        leftArm.rotation.x = 0.72 + typing;
        rightArm.rotation.x = 0.72 - typing;
      }
      if (leftForearm && rightForearm) {
        leftForearm.rotation.x = 0.62 + typing;
        rightForearm.rotation.x = 0.62 - typing;
      }
      if (leftLeg && rightLeg && leftKnee && rightKnee) {
        leftLeg.rotation.x = 1.18;
        rightLeg.rotation.x = 1.18;
        leftKnee.rotation.x = -1.18;
        rightKnee.rotation.x = -1.18;
      }
      return;
    }

    if (animationState === "idle" && restWhenIdle) {
      figureRef.current.position.set(0, -0.08 + Math.sin(time * 1.4 + seed) * 0.006, FIGURE_Z);
      figureRef.current.rotation.set(0, Math.sin(time * 0.3 + seed) * 0.025, 0);
      if (leftArm && rightArm && leftForearm && rightForearm) {
        leftArm.rotation.x = 0.28;
        rightArm.rotation.x = 0.28;
        leftForearm.rotation.x = 0.34;
        rightForearm.rotation.x = 0.34;
      }
      if (leftLeg && rightLeg && leftKnee && rightKnee) {
        leftLeg.rotation.x = 1.18;
        rightLeg.rotation.x = 1.18;
        leftKnee.rotation.x = -1.18;
        rightKnee.rotation.x = -1.18;
      }
      return;
    }

    if (animationState === "celebrating") {
      figureRef.current.position.set(0, 0.02 + Math.abs(Math.sin(time * 7)) * 0.2, FIGURE_Z);
      figureRef.current.rotation.y += delta * 5;
      if (leftArm && rightArm) {
        leftArm.rotation.x = 2.65;
        rightArm.rotation.x = 2.65;
      }
    } else {
      figureRef.current.position.set(0, 0.02 + Math.sin(time * 1.35 + seed) * 0.008, FIGURE_Z);
      figureRef.current.rotation.set(0, Math.sin(time * 0.35 + seed) * 0.08, 0);
      if (leftArm && rightArm) {
        leftArm.rotation.x = Math.sin(time * 0.9 + seed) * 0.025;
        rightArm.rotation.x = Math.cos(time * 0.9 + seed) * 0.025;
      }
    }
    if (leftForearm && rightForearm) {
      leftForearm.rotation.x = 0.06;
      rightForearm.rotation.x = 0.06;
    }
    if (leftLeg && rightLeg && leftKnee && rightKnee) {
      leftLeg.rotation.x = 0;
      rightLeg.rotation.x = 0;
      leftKnee.rotation.x = 0;
      rightKnee.rotation.x = 0;
    }
  });

  return (
    <group ref={rootRef} position={initialPosition}>
      {agent.name && (
        <Html position={[0, 1.78, FIGURE_Z]} center zIndexRange={[20, 0]}>
          <div className="pointer-events-none flex min-w-max items-center gap-1.5 rounded-md border border-[#777166]/70 bg-[#fffdf8]/95 px-2 py-1 text-[#292724] shadow-[0_3px_10px_rgba(38,35,31,0.16)] backdrop-blur-sm">
            <span className="size-1.5 rounded-full" style={{ backgroundColor: statusColor }} />
            <span className="text-[9px] font-extrabold uppercase leading-none tracking-[0.045em]">
              {agent.name}
            </span>
            <span className="border-l border-[#b8b0a3] pl-1.5 text-[8px] font-bold capitalize text-[#6b655c]">
              {agent.status}
            </span>
          </div>
        </Html>
      )}

      <mesh position={[0, 0.025, FIGURE_Z]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.24, 0.016, 10, 32]} />
        <meshStandardMaterial
          color={statusColor}
          emissive={statusColor}
          emissiveIntensity={0.18}
          roughness={0.55}
        />
      </mesh>

      <group ref={figureRef} position={[0, 0.02, FIGURE_Z]} scale={0.96}>
        {/* A restrained architectural-figure silhouette: defined pelvis,
            tapered chest and shoulder line instead of one toy-like tube. */}
        <RoundedBox
          args={[0.3, 0.18, 0.21]}
          radius={0.055}
          smoothness={4}
          position={[0, 0.75, 0]}
          material={materials.trousers}
          castShadow
          receiveShadow
        />
        <mesh position={[0, 1, 0]} material={materials.jacket} castShadow receiveShadow>
          <cylinderGeometry args={[0.205, 0.15, 0.5, 18]} />
        </mesh>
        <mesh position={[0, 1.18, 0]} rotation={[0, 0, Math.PI / 2]} material={materials.jacket} castShadow>
          <capsuleGeometry args={[0.065, 0.3, 6, 12]} />
        </mesh>
        <RoundedBox
          args={[0.145, 0.22, 0.022]}
          radius={0.018}
          smoothness={3}
          position={[0, 1.075, -0.193]}
          material={materials.shirt}
        />
        {([-1, 1] as const).map((side) => (
          <RoundedBox
            key={`lapel-${side}`}
            args={[0.075, 0.23, 0.018]}
            radius={0.012}
            smoothness={3}
            position={[side * 0.055, 1.09, -0.207]}
            rotation={[0, 0, side * 0.24]}
            material={materials.jacket}
          />
        ))}
        <mesh position={[0, 0.765, -0.112]} material={materials.detail}>
          <boxGeometry args={[0.295, 0.035, 0.018]} />
        </mesh>
        <mesh position={[0, 1.29, 0]} material={materials.skin} castShadow>
          <cylinderGeometry args={[0.052, 0.058, 0.12, 16]} />
        </mesh>

        {/* Smaller, slightly elongated head: the full figure now reads near
            adult proportions while remaining legible from the office camera. */}
        <mesh
          position={[0, 1.445, -0.01]}
          scale={[0.94, 1.06, 0.9]}
          material={materials.skin}
          castShadow
          receiveShadow
        >
          <sphereGeometry args={[0.122, 24, 20]} />
        </mesh>
        {[-0.116, 0.116].map((x) => (
          <mesh
            key={`ear-${x}`}
            position={[x, 1.445, -0.005]}
            scale={[0.55, 1, 0.7]}
            material={materials.skin}
          >
            <sphereGeometry args={[0.024, 12, 10]} />
          </mesh>
        ))}

        {/* A cropped scalp cap avoids the old double-sphere helmet. Stable
            seed-based details create distinct, professional hair profiles. */}
        <mesh
          position={[0, 1.45, -0.006]}
          scale={[1.02, 1.08, 0.95]}
          material={materials.hair}
          castShadow
        >
          <sphereGeometry args={[0.128, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.43]} />
        </mesh>
        {hairStyle === 0 && (
          <>
            <RoundedBox
              args={[0.16, 0.04, 0.026]}
              radius={0.014}
              smoothness={3}
              position={[-0.018, 1.535, -0.112]}
              rotation={[0, 0, 0.13]}
              material={materials.hair}
              castShadow
            />
            <RoundedBox
              args={[0.035, 0.09, 0.055]}
              radius={0.012}
              smoothness={3}
              position={[-0.098, 1.49, -0.087]}
              material={materials.hair}
            />
          </>
        )}
        {hairStyle === 1 && (
          <RoundedBox
            args={[0.205, 0.035, 0.03]}
            radius={0.012}
            smoothness={3}
            position={[0, 1.525, -0.111]}
            rotation={[0, 0, -0.04]}
            material={materials.hair}
            castShadow
          />
        )}
        {hairStyle === 2 &&
          ([-1, 1] as const).map((side) => (
            <RoundedBox
              key={`hair-side-${side}`}
              args={[0.038, 0.16, 0.075]}
              radius={0.016}
              smoothness={3}
              position={[side * 0.102, 1.438, 0.008]}
              material={materials.hair}
              castShadow
            />
          ))}

        {/* Restrained facial planes—brows, inset eyes, nose and a mouth line
            read as a face without returning to oversized cartoon features. */}
        {[-0.043, 0.043].map((x) => (
          <group key={`face-${x}`}>
            <mesh position={[x, 1.458, -0.122]} scale={[1, 0.58, 0.42]} material={materials.eye}>
              <sphereGeometry args={[0.008, 10, 8]} />
            </mesh>
            <RoundedBox
              args={[0.048, 0.008, 0.009]}
              radius={0.003}
              smoothness={2}
              position={[x, 1.482, -0.121]}
              rotation={[0, 0, x < 0 ? -0.05 : 0.05]}
              material={materials.hair}
            />
          </group>
        ))}
        <mesh position={[0, 1.435, -0.128]} scale={[0.68, 1.1, 0.72]} material={materials.skin}>
          <sphereGeometry args={[0.016, 12, 10]} />
        </mesh>
        <mesh position={[0, 1.4, -0.125]} rotation={[0, 0, Math.PI / 2]} material={materials.mouth}>
          <capsuleGeometry args={[0.004, 0.032, 4, 8]} />
        </mesh>

        {hasGlasses && (
          <group position={[0, 1.458, -0.127]}>
            {[-0.046, 0.046].map((x) => (
              <mesh key={x} position={[x, 0, 0]} scale={[1, 0.78, 1]} material={materials.detail}>
                <torusGeometry args={[0.034, 0.004, 6, 16]} />
              </mesh>
            ))}
            <mesh material={materials.detail}>
              <boxGeometry args={[0.03, 0.005, 0.006]} />
            </mesh>
          </group>
        )}

        {([-1, 1] as const).map((side) => {
          const armRef = side === -1 ? leftArmRef : rightArmRef;
          const forearmRef = side === -1 ? leftForearmRef : rightForearmRef;
          return (
            <group key={side} ref={armRef} position={[side * 0.23, 1.17, 0]}>
              <mesh position={[0, -0.145, 0]} material={materials.jacket} castShadow>
                <capsuleGeometry args={[0.047, 0.2, 6, 12]} />
              </mesh>
              <group ref={forearmRef} position={[0, -0.29, 0]}>
                <mesh position={[0, -0.115, 0]} material={materials.jacket} castShadow>
                  <capsuleGeometry args={[0.042, 0.15, 6, 12]} />
                </mesh>
                <mesh
                  position={[0, -0.245, -0.012]}
                  scale={[0.78, 1.05, 0.7]}
                  material={materials.skin}
                  castShadow
                >
                  <sphereGeometry args={[0.047, 12, 10]} />
                </mesh>
              </group>
            </group>
          );
        })}

        {([-1, 1] as const).map((side) => {
          const legRef = side === -1 ? leftLegRef : rightLegRef;
          const kneeRef = side === -1 ? leftKneeRef : rightKneeRef;
          return (
            <group key={side} ref={legRef} position={[side * 0.09, 0.75, 0]}>
              <mesh position={[0, -0.18, 0]} material={materials.trousers} castShadow>
                <capsuleGeometry args={[0.058, 0.25, 6, 12]} />
              </mesh>
              <group ref={kneeRef} position={[0, -0.36, 0]}>
                <mesh position={[0, -0.16, 0]} material={materials.trousers} castShadow>
                  <capsuleGeometry args={[0.052, 0.22, 6, 12]} />
                </mesh>
                <RoundedBox
                  args={[0.12, 0.075, 0.22]}
                  radius={0.03}
                  smoothness={3}
                  position={[0, -0.325, -0.045]}
                  material={materials.shoe}
                  castShadow
                />
              </group>
            </group>
          );
        })}

        {agent.mood === "excited" && (
          <group position={[0, 1.78, 0]}>
            {[-1, 0, 1].map((offset) => (
              <mesh key={offset} position={[offset * 0.12, Math.abs(offset) * 0.03, 0]} rotation={[0, 0, offset * -0.22]}>
                <capsuleGeometry args={[0.012, 0.08, 4, 6]} />
                <meshStandardMaterial color="#d39a28" emissive="#d39a28" emissiveIntensity={0.35} />
              </mesh>
            ))}
          </group>
        )}
      </group>
    </group>
  );
}
