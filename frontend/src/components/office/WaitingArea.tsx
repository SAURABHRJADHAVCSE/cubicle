"use client";

import { modernMaterials } from "@/lib/modernMaterials";

interface WaitingAreaProps {
  position: [number, number, number];
  onSelect?: () => void;
}

/** Idle-agent lounge — a sofa, two chairs, a small table, and a rug. Open
 * on all sides (no dividers), deliberately reading as a break from the
 * cubicle rows rather than another workstation. */
export function WaitingArea({ position, onSelect }: WaitingAreaProps) {
  const sofaFabric = modernMaterials.sofaFabric();
  const cushion = modernMaterials.sofaCushion();
  const rug = modernMaterials.rug();
  const tableWood = modernMaterials.tableWood();
  const leg = modernMaterials.deskLegMetal();

  return (
    <group
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.();
      }}
    >
      {/* Rug — subtly differentiates this zone from the main floor without
          a hard edge or a wall. */}
      <mesh position={[0, 0.008, 0]} rotation={[-Math.PI / 2, 0, 0]} material={rug} receiveShadow>
        <planeGeometry args={[4.6, 3.4]} />
      </mesh>

      {/* Sofa: seat base, backrest, two arms, three loose cushions */}
      <group position={[0, 0, -1.1]}>
        <mesh position={[0, 0.24, 0]} material={sofaFabric} castShadow receiveShadow>
          <boxGeometry args={[2.4, 0.36, 0.8]} />
        </mesh>
        <mesh position={[0, 0.55, -0.32]} material={sofaFabric} castShadow>
          <boxGeometry args={[2.4, 0.5, 0.16]} />
        </mesh>
        <mesh position={[-1.14, 0.42, 0]} material={sofaFabric} castShadow>
          <boxGeometry args={[0.12, 0.4, 0.8]} />
        </mesh>
        <mesh position={[1.14, 0.42, 0]} material={sofaFabric} castShadow>
          <boxGeometry args={[0.12, 0.4, 0.8]} />
        </mesh>
        {[-0.7, 0, 0.7].map((x) => (
          <mesh key={x} position={[x, 0.46, 0.05]} material={cushion} castShadow>
            <boxGeometry args={[0.6, 0.14, 0.6]} />
          </mesh>
        ))}
      </group>

      {/* Two loose chairs facing the sofa across the table */}
      {[-1.5, 1.5].map((x) => (
        <group key={x} position={[x, 0, 1.2]} rotation={[0, x < 0 ? Math.PI / 5 : -Math.PI / 5, 0]}>
          <mesh position={[0, 0.24, 0]} material={sofaFabric} castShadow receiveShadow>
            <boxGeometry args={[0.55, 0.32, 0.55]} />
          </mesh>
          <mesh position={[0, 0.5, -0.24]} material={sofaFabric} castShadow>
            <boxGeometry args={[0.55, 0.4, 0.1]} />
          </mesh>
        </group>
      ))}

      {/* Small round table between sofa and chairs */}
      <mesh position={[0, 0.22, 0.1]} material={tableWood} castShadow receiveShadow>
        <cylinderGeometry args={[0.42, 0.42, 0.05, 16]} />
      </mesh>
      <mesh position={[0, 0.1, 0.1]} material={leg}>
        <cylinderGeometry args={[0.04, 0.04, 0.2, 8]} />
      </mesh>
      <mesh position={[0, 0.02, 0.1]} material={leg}>
        <cylinderGeometry args={[0.2, 0.2, 0.03, 16]} />
      </mesh>
    </group>
  );
}
