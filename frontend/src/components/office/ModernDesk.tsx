"use client";

import { RoundedBox } from "@react-three/drei";

import { modernMaterials } from "@/lib/modernMaterials";

interface ModernDeskProps {
  position: [number, number, number];
  rotationY: number;
  onSelect?: () => void;
}

export function ModernDesk({ position, rotationY, onSelect }: ModernDeskProps) {
  const desk = modernMaterials.deskWood();
  const metal = modernMaterials.deskLegMetal();
  const chair = modernMaterials.chairSlate();
  const chairBase = modernMaterials.chairBase();
  const monitorBody = modernMaterials.monitorBody();
  const monitorScreen = modernMaterials.monitorScreen();
  const divider = modernMaterials.dividerFabric();
  const dividerTrim = modernMaterials.dividerTrim();

  return (
    <group
      position={position}
      rotation={[0, rotationY, 0]}
      onClick={(event) => {
        event.stopPropagation();
        onSelect?.();
      }}
    >
      <RoundedBox
        args={[2.85, 0.88, 0.1]}
        radius={0.07}
        smoothness={4}
        position={[0, 0.55, -0.7]}
        material={divider}
        castShadow
        receiveShadow
      />
      <RoundedBox
        args={[2.96, 0.055, 0.14]}
        radius={0.025}
        smoothness={3}
        position={[0, 1, -0.7]}
        material={dividerTrim}
        castShadow
      />
      {[-1.41, 1.41].map((x) => (
        <RoundedBox
          key={x}
          args={[0.09, 0.88, 0.72]}
          radius={0.04}
          smoothness={3}
          position={[x, 0.55, -0.36]}
          material={divider}
          castShadow
          receiveShadow
        />
      ))}

      <RoundedBox
        args={[2.3, 0.1, 0.82]}
        radius={0.07}
        smoothness={4}
        position={[0, 0.76, 0]}
        material={desk}
        castShadow
        receiveShadow
      />
      <RoundedBox
        args={[1.75, 0.34, 0.055]}
        radius={0.025}
        smoothness={3}
        position={[0, 0.49, -0.34]}
        material={desk}
        castShadow
      />
      {[-0.98, 0.98].flatMap((x) =>
        [-0.31, 0.31].map((z) => (
          <mesh key={`${x}-${z}`} position={[x, 0.38, z]} material={metal} castShadow>
            <cylinderGeometry args={[0.035, 0.045, 0.72, 10]} />
          </mesh>
        )),
      )}

      <mesh position={[0, 0.85, -0.25]} material={metal} castShadow>
        <cylinderGeometry args={[0.035, 0.05, 0.17, 10]} />
      </mesh>
      <RoundedBox
        args={[0.68, 0.4, 0.07]}
        radius={0.05}
        smoothness={4}
        position={[0, 1.08, -0.25]}
        material={monitorBody}
        castShadow
      />
      <RoundedBox
        args={[0.59, 0.31, 0.015]}
        radius={0.025}
        smoothness={3}
        position={[0, 1.08, -0.209]}
        material={monitorScreen}
      />
      <RoundedBox
        args={[0.48, 0.025, 0.17]}
        radius={0.025}
        smoothness={3}
        position={[0, 0.825, 0.11]}
        material={monitorBody}
        castShadow
      />
      <mesh position={[0.73, 0.86, 0.08]} material={dividerTrim} castShadow>
        <cylinderGeometry args={[0.08, 0.065, 0.17, 16]} />
      </mesh>

      <group position={[0, 0, 0.72]}>
        <RoundedBox
          args={[0.56, 0.1, 0.52]}
          radius={0.08}
          smoothness={4}
          position={[0, 0.47, 0]}
          material={chair}
          castShadow
          receiveShadow
        />
        <RoundedBox
          args={[0.54, 0.58, 0.1]}
          radius={0.09}
          smoothness={5}
          position={[0, 0.77, 0.22]}
          rotation={[-0.1, 0, 0]}
          material={chair}
          castShadow
        />
        <mesh position={[0, 0.25, 0]} material={chairBase}>
          <cylinderGeometry args={[0.035, 0.035, 0.44, 12]} />
        </mesh>
        {[0, Math.PI / 2, Math.PI, (Math.PI * 3) / 2].map((rotation) => (
          <group key={rotation} rotation={[0, rotation, 0]}>
            <RoundedBox
              args={[0.055, 0.035, 0.36]}
              radius={0.018}
              smoothness={3}
              position={[0, 0.055, 0.16]}
              material={chairBase}
            />
            <mesh position={[0, 0.035, 0.34]} material={chairBase}>
              <sphereGeometry args={[0.045, 10, 8]} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}
