"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";

import { useOfficeStore } from "@/stores/officeStore";
import type { AgentMood, AgentStatus } from "@/types/agent";

/** Deterministic per-agent phase offset so idle sway isn't synchronized
 * across every avatar in the room. */
function hashSeed(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return (h % 1000) / 100;
}

const STATUS_COLORS: Record<AgentStatus, string> = {
  idle: "#22c55e",
  working: "#3b82f6",
  thinking: "#a855f7",
  break: "#f59e0b",
  offline: "#6b7280",
};

/** Only what AgentAvatar actually renders from — narrower than the full
 * `Agent` record so BossCabin can reuse this component for a synthetic "you,
 * the CEO" figure that isn't a real agent row at all. */
export interface AgentAvatarSubject {
  id: string;
  name?: string;
  role?: string;
  status: AgentStatus;
  accent_color: string;
  mood: AgentMood;
}

interface AgentAvatarProps {
  agent: AgentAvatarSubject;
  /** World position this avatar should be at right now — the desk if it has
   * a task, a queue slot near reception if it doesn't (see Office.tsx). Not
   * applied directly: the root group lerps toward it every frame so a
   * status change reads as the agent actually walking there, not
   * teleporting. */
  targetPosition: [number, number, number];
  targetRotationY: number;
}

const WALK_SPEED = 2.4; // world units/sec the lerp converges at, tuned by eye
const ARRIVED_EPSILON = 0.04;

export function AgentAvatar({ agent, targetPosition, targetRotationY }: AgentAvatarProps) {
  const rootRef = useRef<THREE.Group>(null);
  const currentPos = useRef(new THREE.Vector3(...targetPosition));
  const isWalkingRef = useRef(false);
  const groupRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Mesh>(null);
  const rightArmRef = useRef<THREE.Mesh>(null);
  const leftLegRef = useRef<THREE.Group>(null);
  const rightLegRef = useRef<THREE.Group>(null);

  // Only ever read inside useFrame below, never in the JSX — R3F re-registers
  // the useFrame callback every render, so it always sees the latest value
  // here without a stale-closure risk, and this avoids a render subscription
  // for a value nothing in the render output actually uses.
  const storedAnimationState = useOfficeStore(
    (s) => s.agents[agent.id]?.animationState ?? "idle",
  );
  const ringColor = STATUS_COLORS[agent.status];
  const skinMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#d99b78", roughness: 0.72 }),
    [],
  );

  const shoeMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#1e293b", roughness: 0.5 }),
    [],
  );
  const shirtMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: agent.accent_color || "#6366f1", roughness: 0.4 }),
    [agent.accent_color],
  );
  const hairMat = useMemo(
    () => new THREE.MeshStandardMaterial({
      color: ["#1e1b4b", "#451a03", "#78350f", "#334155", "#0f172a"][Math.floor(hashSeed(agent.id)) % 5],
      roughness: 0.7
    }),
    [agent.id],
  );
  const eyeMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#0f172a" }),
    [],
  );
  const glassesMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#f8fafc", metalness: 0.8, roughness: 0.2 }),
    [],
  );
  const headsetMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#818cf8", metalness: 0.6, roughness: 0.3 }),
    [],
  );

  const SEAT_TOP_Y = 0.49;
  const SEAT_Z = 0.8;
  const seed = useMemo(() => hashSeed(agent.id), [agent.id]);
  const hasGlasses = Math.floor(seed) % 2 === 0;
  const hasHeadset = Math.floor(seed) % 3 === 0;

  useFrame(({ clock }, delta) => {
    if (!rootRef.current || !groupRef.current) return;
    const t = clock.elapsedTime;

    // Root group: world position/facing — walks toward wherever this agent
    // should currently be (desk if working, queue slot if not) instead of
    // snapping there the instant `targetPosition` changes.
    const target = new THREE.Vector3(...targetPosition);
    const distance = rootRef.current.position.distanceTo(target);
    const isWalking = distance > ARRIVED_EPSILON;
    isWalkingRef.current = isWalking;
    if (isWalking) {
      currentPos.current.lerp(target, Math.min(1, delta * WALK_SPEED));
      rootRef.current.position.copy(currentPos.current);
      // Face the direction of travel while actually moving.
      const dx = target.x - rootRef.current.position.x;
      const dz = target.z - rootRef.current.position.z;
      if (Math.hypot(dx, dz) > 0.01) rootRef.current.rotation.y = Math.atan2(dx, dz);
    } else {
      rootRef.current.position.copy(target);
      currentPos.current.copy(target);
      rootRef.current.rotation.y = targetRotationY;
    }

    // Inner group: local pose — walking overrides whatever the task-status
    // pose would be, since an agent en route to its desk shouldn't play the
    // "working" typing animation for the second before it actually sits.
    if (isWalking) {
      const stride = Math.sin(t * 9);
      groupRef.current.position.set(0, SEAT_TOP_Y + Math.abs(Math.sin(t * 9)) * 0.05, SEAT_Z);
      groupRef.current.rotation.y = 0;
      if (leftArmRef.current && rightArmRef.current) {
        leftArmRef.current.rotation.x = stride * 0.5;
        rightArmRef.current.rotation.x = -stride * 0.5;
      }
      if (leftLegRef.current && rightLegRef.current) {
        leftLegRef.current.rotation.x = -stride * 0.5;
        rightLegRef.current.rotation.x = stride * 0.5;
      }
      return;
    }
    // Arrived — legs return to the seated/standing rest pose regardless of
    // which state renders next below.
    if (leftLegRef.current && rightLegRef.current) {
      leftLegRef.current.rotation.x = 0;
      rightLegRef.current.rotation.x = 0;
    }

    if (storedAnimationState === "working") {
      groupRef.current.position.set(0, SEAT_TOP_Y + Math.sin(t * 6) * 0.015, SEAT_Z - 0.05);
      groupRef.current.rotation.y = 0;
      if (leftArmRef.current && rightArmRef.current) {
        leftArmRef.current.rotation.x = -Math.PI / 3 + Math.sin(t * 14) * 0.12;
        rightArmRef.current.rotation.x = -Math.PI / 3 + Math.cos(t * 14) * 0.12;
      }
    } else if (storedAnimationState === "celebrating") {
      const jump = Math.abs(Math.sin(t * 8)) * 0.35;
      groupRef.current.position.set(0, SEAT_TOP_Y + jump, SEAT_Z);
      groupRef.current.rotation.y += delta * 6;
    } else {
      groupRef.current.position.set(
        Math.sin(t * 0.4 + seed) * 0.08,
        SEAT_TOP_Y + Math.sin(t * 1.5 + seed) * 0.02,
        SEAT_Z + Math.sin(t * 0.3 + seed * 1.3) * 0.08,
      );
      groupRef.current.rotation.y = Math.sin(t * 0.3 + seed) * 0.2;
      if (leftArmRef.current && rightArmRef.current) {
        leftArmRef.current.rotation.x = Math.sin(t * 2 + seed) * 0.08;
        rightArmRef.current.rotation.x = Math.cos(t * 2 + seed) * 0.08;
      }
    }
  });

  return (
    <group ref={rootRef} position={targetPosition} scale={0.94}>
      {agent.name && (
        <Html position={[0, 1.5, SEAT_Z]} center zIndexRange={[20, 0]}>
          <div className="pointer-events-none flex min-w-max items-center gap-1.5 rounded-[4px] border border-[#777166] bg-[#fffaf0]/95 px-2 py-1 text-[#292724] shadow-[0_2px_0_rgba(38,35,31,0.18)] backdrop-blur-sm">
            <span className="size-1.5 rounded-[2px]" style={{ backgroundColor: ringColor }} />
            <span className="text-[9px] font-extrabold uppercase leading-none tracking-[0.04em]">{agent.name}</span>
            <span className="border-l border-[#b8b0a3] pl-1.5 text-[8px] font-bold capitalize text-[#6b655c]">{agent.status}</span>
          </div>
        </Html>
      )}

      {/* Grounded status ring */}
      <mesh position={[0, 0.02, SEAT_Z]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.27, 0.022, 10, 24]} />
        <meshStandardMaterial color={ringColor} emissive={ringColor} emissiveIntensity={0.3} />
      </mesh>

      <group ref={groupRef} position={[0, SEAT_TOP_Y, SEAT_Z]}>
        {/* Soft low-poly torso */}
        <mesh position={[0, 0.22, 0]} material={shirtMat} castShadow receiveShadow>
          <capsuleGeometry args={[0.17, 0.28, 6, 12]} />
        </mesh>
        {/* Collar / Tie accent */}
        <mesh position={[0, 0.36, -0.105]} material={glassesMat}>
          <boxGeometry args={[0.065, 0.13, 0.018]} />
        </mesh>

        {/* Head and hair cap */}
        <mesh position={[0, 0.61, 0.015]} material={hairMat} castShadow>
          <sphereGeometry args={[0.205, 16, 12]} />
        </mesh>
        <mesh position={[0, 0.57, 0]} material={skinMat} castShadow receiveShadow>
          <sphereGeometry args={[0.19, 16, 12]} />
        </mesh>

        {/* Eyes */}
        <mesh position={[-0.065, 0.585, -0.18]} material={eyeMat}>
          <sphereGeometry args={[0.018, 8, 6]} />
        </mesh>
        <mesh position={[0.065, 0.585, -0.18]} material={eyeMat}>
          <sphereGeometry args={[0.018, 8, 6]} />
        </mesh>

        {/* Glasses */}
        {hasGlasses && (
          <group position={[0, 0.58, -0.16]}>
            <mesh position={[-0.07, 0, 0]} material={glassesMat}>
              <boxGeometry args={[0.08, 0.06, 0.02]} />
            </mesh>
            <mesh position={[0.07, 0, 0]} material={glassesMat}>
              <boxGeometry args={[0.08, 0.06, 0.02]} />
            </mesh>
            <mesh position={[0, 0, 0]} material={glassesMat}>
              <boxGeometry args={[0.06, 0.02, 0.02]} />
            </mesh>
          </group>
        )}

        {/* Headset */}
        {hasHeadset && (
          <group position={[0, 0.62, 0]}>
            <mesh position={[0, 0.14, 0]} material={headsetMat}>
              <boxGeometry args={[0.34, 0.04, 0.1]} />
            </mesh>
            <mesh position={[-0.17, 0, 0]} material={headsetMat}>
              <boxGeometry args={[0.04, 0.12, 0.1]} />
            </mesh>
            <mesh position={[0.17, 0, 0]} material={headsetMat}>
              <boxGeometry args={[0.04, 0.12, 0.1]} />
            </mesh>
          </group>
        )}

        {/* Left Arm */}
        <mesh ref={leftArmRef} position={[-0.22, 0.19, 0]} material={shirtMat} castShadow>
          <capsuleGeometry args={[0.055, 0.24, 5, 8]} />
        </mesh>
        {/* Right Arm */}
        <mesh ref={rightArmRef} position={[0.22, 0.19, 0]} material={shirtMat} castShadow>
          <capsuleGeometry args={[0.055, 0.24, 5, 8]} />
        </mesh>

        {/* Seated/walking legs — each is a group pivoted at the hip (not the
            box's own center), so the walk-cycle swing below rotates it from
            the top like a real leg instead of spinning around its middle. */}
        <group ref={leftLegRef} position={[-0.09, 0.02, 0.05]}>
          <mesh position={[0, -0.07, 0]} material={shoeMat} castShadow>
            <capsuleGeometry args={[0.06, 0.15, 4, 8]} />
          </mesh>
        </group>
        <group ref={rightLegRef} position={[0.09, 0.02, 0.05]}>
          <mesh position={[0, -0.07, 0]} material={shoeMat} castShadow>
            <capsuleGeometry args={[0.06, 0.15, 4, 8]} />
          </mesh>
        </group>

        {/* Mood crown / celebrate indicator */}
        {agent.mood === "excited" && (
          <mesh position={[0, 0.85, 0]}>
            <coneGeometry args={[0.09, 0.18, 8]} />
            <meshStandardMaterial color="#facc15" emissive="#facc15" emissiveIntensity={0.8} />
          </mesh>
        )}
      </group>
    </group>
  );
}
