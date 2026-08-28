"use client";

import { modernMaterials } from "@/lib/modernMaterials";

interface ModernDeskProps {
  position: [number, number, number];
  rotationY: number;
  onSelect?: () => void;
}

/** A single modern cubicle workstation — desk, chair, monitor, and a low
 * fabric divider behind it. Replaces the old Desk.tsx + CubicleWalls.tsx
 * pair (voxel-block desk + floor-to-ceiling glass-block walls) with a
 * single low-poly unit: waist-height fabric divider instead of a full
 * wall, no pixelated texture maps, believable proportions (desk ~0.75
 * high, divider ~1.05 — you can see over it while seated). */
export function ModernDesk({ position, rotationY, onSelect }: ModernDeskProps) {
  const desk = modernMaterials.deskWood();
  const leg = modernMaterials.deskLegMetal();
  const chairSlate = modernMaterials.chairSlate();
  const chairBase = modernMaterials.chairBase();
  const monitorBody = modernMaterials.monitorBody();
  const monitorScreen = modernMaterials.monitorScreen();
  const divider = modernMaterials.dividerFabric();
  const dividerTrim = modernMaterials.dividerTrim();

  return (
    <group
      position={position}
      rotation={[0, rotationY, 0]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.();
      }}
    >
      {/* Low fabric divider — waist height, not floor-to-ceiling, so agents
          and desks stay visible from the front-facing camera. */}
      <mesh position={[0, 0.56, -0.72]} material={divider} castShadow receiveShadow>
        <boxGeometry args={[2.75, 1.12, 0.07]} />
      </mesh>
      <mesh position={[0, 1.11, -0.72]} material={dividerTrim} castShadow>
        <boxGeometry args={[2.82, 0.05, 0.1]} />
      </mesh>
      <mesh position={[-1.38, 0.56, -0.36]} material={divider} castShadow receiveShadow>
        <boxGeometry args={[0.07, 1.12, 0.72]} />
      </mesh>
      <mesh position={[1.38, 0.56, -0.36]} material={divider} castShadow receiveShadow>
        <boxGeometry args={[0.07, 1.12, 0.72]} />
      </mesh>

      {/* Desk top + slim metal legs */}
      <mesh position={[0, 0.74, 0]} material={desk} castShadow receiveShadow>
        <boxGeometry args={[2.15, 0.07, 0.72]} />
      </mesh>
      <mesh position={[-0.92, 0.37, -0.28]} material={leg} castShadow>
        <boxGeometry args={[0.05, 0.72, 0.05]} />
      </mesh>
      <mesh position={[0.92, 0.37, -0.28]} material={leg} castShadow>
        <boxGeometry args={[0.05, 0.72, 0.05]} />
      </mesh>
      <mesh position={[-0.92, 0.37, 0.28]} material={leg} castShadow>
        <boxGeometry args={[0.05, 0.72, 0.05]} />
      </mesh>
      <mesh position={[0.92, 0.37, 0.28]} material={leg} castShadow>
        <boxGeometry args={[0.05, 0.72, 0.05]} />
      </mesh>

      {/* Monitor, slim stand */}
      <mesh position={[0, 0.79, -0.22]} material={leg}>
        <boxGeometry args={[0.04, 0.1, 0.04]} />
      </mesh>
      <mesh position={[0, 0.98, -0.22]} material={monitorBody}>
        <boxGeometry args={[0.58, 0.34, 0.04]} />
      </mesh>
      <mesh position={[0, 0.98, -0.205]} material={monitorScreen}>
        <boxGeometry args={[0.51, 0.27, 0.012]} />
      </mesh>

      {/* Ergonomic chair — seat, backrest, slim base */}
      <group position={[0, 0, 0.62]}>
        <mesh position={[0, 0.46, 0]} material={chairSlate} castShadow receiveShadow>
          <boxGeometry args={[0.46, 0.06, 0.44]} />
        </mesh>
        <mesh position={[0, 0.72, 0.19]} material={chairSlate} castShadow>
          <boxGeometry args={[0.42, 0.5, 0.06]} />
        </mesh>
        <mesh position={[0, 0.24, 0]} material={chairBase}>
          <cylinderGeometry args={[0.03, 0.03, 0.44, 8]} />
        </mesh>
        <mesh position={[0, 0.03, 0]} material={chairBase}>
          <cylinderGeometry args={[0.22, 0.22, 0.04, 12]} />
        </mesh>
      </group>
    </group>
  );
}
