"use client";

import { RoundedBox } from "@react-three/drei";

import { modernMaterials } from "@/lib/modernMaterials";

interface WaitingAreaProps {
  position: [number, number, number];
  onSelect?: () => void;
}

export function WaitingArea({ position, onSelect }: WaitingAreaProps) {
  const sofa = modernMaterials.sofaFabric();
  const cushion = modernMaterials.sofaCushion();
  const rug = modernMaterials.rug();
  const wood = modernMaterials.tableWood();
  const metal = modernMaterials.deskLegMetal();
  const pot = modernMaterials.plantPot();
  const leaf = modernMaterials.plantLeaf();

  return (
    <group
      position={position}
      onClick={(event) => {
        event.stopPropagation();
        onSelect?.();
      }}
    >
      <RoundedBox
        args={[5.2, 0.035, 3.6]}
        radius={0.1}
        smoothness={4}
        position={[0, 0.025, 0]}
        material={rug}
        receiveShadow
      />

      <group position={[0, 0, -1.15]}>
        <RoundedBox
          args={[2.75, 0.38, 0.86]}
          radius={0.14}
          smoothness={5}
          position={[0, 0.28, 0]}
          material={sofa}
          castShadow
          receiveShadow
        />
        <RoundedBox
          args={[2.72, 0.58, 0.18]}
          radius={0.11}
          smoothness={5}
          position={[0, 0.62, -0.34]}
          rotation={[-0.08, 0, 0]}
          material={sofa}
          castShadow
        />
        {[-0.78, 0, 0.78].map((x) => (
          <RoundedBox
            key={x}
            args={[0.68, 0.16, 0.6]}
            radius={0.1}
            smoothness={5}
            position={[x, 0.49, 0.04]}
            material={cushion}
            castShadow
          />
        ))}
      </group>

      {[-1.65, 1.65].map((x) => (
        <group
          key={x}
          position={[x, 0, 1.08]}
          rotation={[0, x < 0 ? Math.PI / 7 : -Math.PI / 7, 0]}
        >
          <RoundedBox
            args={[0.68, 0.22, 0.65]}
            radius={0.13}
            smoothness={5}
            position={[0, 0.42, 0]}
            material={sofa}
            castShadow
            receiveShadow
          />
          <RoundedBox
            args={[0.68, 0.54, 0.14]}
            radius={0.12}
            smoothness={5}
            position={[0, 0.69, -0.27]}
            rotation={[-0.1, 0, 0]}
            material={sofa}
            castShadow
          />
          {[-0.24, 0.24].flatMap((legX) =>
            [-0.22, 0.22].map((legZ) => (
              <mesh key={`${legX}-${legZ}`} position={[legX, 0.19, legZ]} material={metal}>
                <cylinderGeometry args={[0.02, 0.025, 0.36, 8]} />
              </mesh>
            )),
          )}
        </group>
      ))}

      <RoundedBox
        args={[1.05, 0.09, 0.7]}
        radius={0.13}
        smoothness={5}
        position={[0, 0.34, 0.15]}
        material={wood}
        castShadow
        receiveShadow
      />
      <mesh position={[0, 0.16, 0.15]} material={metal}>
        <cylinderGeometry args={[0.06, 0.06, 0.3, 12]} />
      </mesh>
      <mesh position={[0, 0.04, 0.15]} material={metal}>
        <cylinderGeometry args={[0.28, 0.28, 0.04, 18]} />
      </mesh>

      <group position={[2.2, 0, -1.25]}>
        <mesh position={[0, 0.2, 0]} material={pot} castShadow>
          <cylinderGeometry args={[0.22, 0.17, 0.4, 14]} />
        </mesh>
        {[
          [-0.12, 0.62, 0],
          [0.13, 0.72, 0.05],
          [0, 0.84, -0.08],
        ].map(([x, y, z], index) => (
          <mesh key={index} position={[x, y, z]} material={leaf} castShadow>
            <sphereGeometry args={[0.24, 10, 8]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}
