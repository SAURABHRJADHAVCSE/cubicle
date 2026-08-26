"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import { getVoxelMaterial } from "@/lib/voxelMaterials";
import { useOfficeStore } from "@/stores/officeStore";
import type { Agent, AgentStatus } from "@/types/agent";

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

interface AgentAvatarProps {
  agent: Agent;
  position: [number, number, number];
}

export function AgentAvatar({ agent, position }: AgentAvatarProps) {
  const groupRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Mesh>(null);
  const rightArmRef = useRef<THREE.Mesh>(null);

  const animationState = useOfficeStore(
    (s) => s.agents[agent.id]?.animationState ?? "idle",
  );
  const ringColor = STATUS_COLORS[agent.status];
  const skinMat = getVoxelMaterial("skin");

  const shoeMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#1e293b", roughness: 0.5 }),
    [],
  );
  const shirtMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: agent.accent_color, roughness: 0.4 }),
    [agent.accent_color],
  );
  const hairMat = useMemo(
    () => new THREE.MeshStandardMaterial({
      color: ["#1e1b4b", "#451a03", "#78350f", "#334155", "#0f172a"][hashSeed(agent.id) % 5],
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
  const hasGlasses = seed % 2 === 0;
  const hasHeadset = seed % 3 === 0;

  useFrame(({ clock }, delta) => {
    if (!groupRef.current) return;
    const t = clock.elapsedTime;
    const isWorking = animationState === "working";

    if (isWorking) {
      groupRef.current.position.set(0, SEAT_TOP_Y + Math.sin(t * 6) * 0.015, SEAT_Z - 0.05);
      groupRef.current.rotation.y = 0;
      if (leftArmRef.current && rightArmRef.current) {
        leftArmRef.current.rotation.x = -Math.PI / 3 + Math.sin(t * 14) * 0.12;
        rightArmRef.current.rotation.x = -Math.PI / 3 + Math.cos(t * 14) * 0.12;
      }
    } else if (animationState === "celebrating") {
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
    <group position={position} scale={1.12}>
      {/* Seat glowing status ring */}
      <mesh position={[0, 0.02, SEAT_Z]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.34, 0.04, 12, 32]} />
        <meshStandardMaterial color={ringColor} emissive={ringColor} emissiveIntensity={0.8} />
      </mesh>

      {/* Ambient status light aura */}
      <pointLight position={[0, 0.4, SEAT_Z]} color={ringColor} intensity={0.8} distance={2.5} />

      <group ref={groupRef} position={[0, SEAT_TOP_Y, SEAT_Z]}>
        {/* Torso */}
        <mesh position={[0, 0.22, 0]} material={shirtMat} castShadow receiveShadow>
          <boxGeometry args={[0.32, 0.42, 0.2]} />
        </mesh>
        {/* Collar / Tie accent */}
        <mesh position={[0, 0.36, -0.105]} material={glassesMat}>
          <boxGeometry args={[0.08, 0.12, 0.02]} />
        </mesh>

        {/* Head */}
        <mesh position={[0, 0.57, 0]} material={skinMat} castShadow receiveShadow>
          <boxGeometry args={[0.3, 0.3, 0.3]} />
        </mesh>

        {/* Hair block */}
        <mesh position={[0, 0.72, -0.02]} material={hairMat} castShadow>
          <boxGeometry args={[0.32, 0.08, 0.32]} />
        </mesh>

        {/* Eyes */}
        <mesh position={[-0.07, 0.58, -0.155]} material={eyeMat}>
          <boxGeometry args={[0.04, 0.04, 0.02]} />
        </mesh>
        <mesh position={[0.07, 0.58, -0.155]} material={eyeMat}>
          <boxGeometry args={[0.04, 0.04, 0.02]} />
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
          <boxGeometry args={[0.09, 0.36, 0.11]} />
        </mesh>
        {/* Right Arm */}
        <mesh ref={rightArmRef} position={[0.22, 0.19, 0]} material={shirtMat} castShadow>
          <boxGeometry args={[0.09, 0.36, 0.11]} />
        </mesh>

        {/* Seated Legs */}
        <mesh position={[-0.09, -0.05, 0.05]} material={shoeMat} castShadow>
          <boxGeometry args={[0.12, 0.14, 0.18]} />
        </mesh>
        <mesh position={[0.09, -0.05, 0.05]} material={shoeMat} castShadow>
          <boxGeometry args={[0.12, 0.14, 0.18]} />
        </mesh>

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
