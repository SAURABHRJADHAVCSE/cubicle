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
  const animationState = useOfficeStore(
    (s) => s.agents[agent.id]?.animationState ?? "idle",
  );
  const ringColor = STATUS_COLORS[agent.status];
  const skinMat = getVoxelMaterial("skin");
  const shoeMat = useMemo(
    () => new THREE.MeshLambertMaterial({ color: "#2b2b31" }),
    [],
  );
  const shirtMat = useMemo(
    () => new THREE.MeshLambertMaterial({ color: agent.accent_color }),
    [agent.accent_color],
  );

  // Chair seat top sits at world y≈0.49 (Desk.tsx: seat box at y=0.45,
  // height 0.08) — the group origin below is that seat surface, so
  // "hip"-relative offsets keep the avatar sitting ON the seat instead of
  // dangling its legs down past it toward the floor.
  const SEAT_TOP_Y = 0.49;
  const SEAT_Z = 0.8;
  const seed = useMemo(() => hashSeed(agent.id), [agent.id]);

  // Autonomous idle motion — not driven by the user or camera, purely a
  // per-agent timer running on its own. Only kicks in when idle (not
  // busy) and stays inside the cubicle's open interior (x within the
  // ±0.85 walls, z between the desk and the doorway) so it can never
  // clip through the cubicle partitions. This is deliberately scoped to
  // "the character looks alive at its own desk," not room-scale walking
  // (e.g. to the cafeteria) — that needs real pathfinding around cubicle
  // walls/furniture, which is a bigger follow-up, not attempted here.
  useFrame(({ clock }, delta) => {
    if (!groupRef.current) return;
    const t = clock.elapsedTime;
    switch (animationState) {
      case "working":
      case "walking":
        // TODO(V0.2 social scheduler): "walking" should lerp toward
        // targetPosition once real room-scale movement exists.
        groupRef.current.position.set(0, SEAT_TOP_Y + Math.sin(t * 4) * 0.03, SEAT_Z);
        groupRef.current.rotation.y = 0;
        break;
      case "celebrating": {
        // Task-complete celebration: a bouncy jump (always upward, not a
        // symmetric sway) combined with a continuous spin, for the ~3s
        // window officeStore.triggerCelebration holds this state.
        const jump = Math.abs(Math.sin(t * 6)) * 0.35;
        groupRef.current.position.set(0, SEAT_TOP_Y + jump, SEAT_Z);
        groupRef.current.rotation.y += delta * 6;
        break;
      }
      case "idle":
      default:
        groupRef.current.position.set(
          Math.sin(t * 0.35 + seed) * 0.18,
          SEAT_TOP_Y + Math.sin(t * 1.5 + seed) * 0.05,
          SEAT_Z + Math.sin(t * 0.22 + seed * 1.3) * 0.25,
        );
        groupRef.current.rotation.y = Math.sin(t * 0.3 + seed) * 0.3;
        break;
    }
  });

  return (
    <group position={position}>
      <mesh position={[0, 0.02, SEAT_Z]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.3, 0.03, 8, 24]} />
        <meshStandardMaterial color={ringColor} />
      </mesh>

      <group ref={groupRef} position={[0, SEAT_TOP_Y, SEAT_Z]}>
        <mesh position={[0, 0.21, 0]} material={shirtMat}>
          <boxGeometry args={[0.32, 0.42, 0.2]} />
        </mesh>
        <mesh position={[0, 0.55, 0]} material={skinMat}>
          <boxGeometry args={[0.26, 0.26, 0.26]} />
        </mesh>
        <mesh position={[-0.24, 0.19, 0]} material={shirtMat}>
          <boxGeometry args={[0.1, 0.36, 0.12]} />
        </mesh>
        <mesh position={[0.24, 0.19, 0]} material={shirtMat}>
          <boxGeometry args={[0.1, 0.36, 0.12]} />
        </mesh>
        {/* Seated legs are tucked under the torso, at/just below the seat
            surface, rather than dangling down toward the floor. */}
        <mesh position={[-0.09, -0.05, 0.05]} material={shoeMat}>
          <boxGeometry args={[0.12, 0.14, 0.18]} />
        </mesh>
        <mesh position={[0.09, -0.05, 0.05]} material={shoeMat}>
          <boxGeometry args={[0.12, 0.14, 0.18]} />
        </mesh>
        {agent.mood === "excited" && (
          <mesh position={[0, 0.78, 0]}>
            <coneGeometry args={[0.09, 0.16, 8]} />
            <meshStandardMaterial color="#facc15" />
          </mesh>
        )}
      </group>
    </group>
  );
}
