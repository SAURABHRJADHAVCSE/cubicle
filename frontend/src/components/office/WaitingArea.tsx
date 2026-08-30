"use client";

import { RoundedBox } from "@react-three/drei";

import { modernMaterials } from "@/lib/modernMaterials";

interface WaitingAreaProps {
  position: [number, number, number];
  onSelect?: () => void;
}

const LOUNGE_FLOOR_TOP = 0.048;
const GLASS_HEIGHT = 1.55;
const GLASS_FRAME = 0.045;

function CafeChair({
  position,
  rotationY,
}: {
  position: [number, number, number];
  rotationY: number;
}) {
  const upholstery = modernMaterials.chairSlate();
  const metal = modernMaterials.chairBase();

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <RoundedBox
        args={[0.52, 0.1, 0.48]}
        radius={0.075}
        smoothness={4}
        position={[0, 0.46, 0]}
        material={upholstery}
        castShadow
        receiveShadow
      />
      <RoundedBox
        args={[0.5, 0.46, 0.09]}
        radius={0.07}
        smoothness={4}
        position={[0, 0.69, 0.2]}
        rotation={[-0.08, 0, 0]}
        material={upholstery}
        castShadow
      />
      {[-0.18, 0.18].flatMap((x) =>
        [-0.16, 0.16].map((z) => (
          <mesh key={`${x}-${z}`} position={[x, 0.22, z]} material={metal} castShadow>
            <cylinderGeometry args={[0.018, 0.022, 0.42, 8]} />
          </mesh>
        )),
      )}
    </group>
  );
}

function GlassDivider({
  width,
  position,
  rotationY = 0,
}: {
  width: number;
  position: [number, number, number];
  rotationY?: number;
}) {
  const glass = modernMaterials.cabinGlass();
  const frame = modernMaterials.cabinFrame();
  const glassCenterY = LOUNGE_FLOOR_TOP + GLASS_HEIGHT / 2;

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh position={[0, glassCenterY, 0]} material={glass}>
        <boxGeometry args={[width, GLASS_HEIGHT - GLASS_FRAME * 2, 0.035]} />
      </mesh>
      {[
        LOUNGE_FLOOR_TOP + GLASS_FRAME / 2,
        LOUNGE_FLOOR_TOP + GLASS_HEIGHT - GLASS_FRAME / 2,
      ].map((y) => (
        <mesh key={y} position={[0, y, 0]} material={frame} castShadow>
          <boxGeometry args={[width + 0.05, GLASS_FRAME, 0.065]} />
        </mesh>
      ))}
      {[-width / 2, width / 2].map((x) => (
        <mesh key={x} position={[x, glassCenterY, 0]} material={frame} castShadow>
          <boxGeometry args={[GLASS_FRAME, GLASS_HEIGHT, 0.065]} />
        </mesh>
      ))}
    </group>
  );
}

/** Cafeteria + quiet lounge. Idle agents occupy the eight seats around the
 * communal table; the front-right opening is the navigation exit used by
 * AgentAvatar before it enters the central workstation aisle. */
export function WaitingArea({ position, onSelect }: WaitingAreaProps) {
  const floor = modernMaterials.rug();
  const wood = modernMaterials.tableWood();
  const counter = modernMaterials.deskWood();
  const cabinet = modernMaterials.storageCabinet();
  const metal = modernMaterials.deskLegMetal();
  const appliance = modernMaterials.monitorBody();
  const screen = modernMaterials.monitorScreen();
  const sofa = modernMaterials.sofaFabric();
  const cushion = modernMaterials.sofaCushion();
  const pot = modernMaterials.plantPot();
  const leaf = modernMaterials.plantLeaf();
  const accent = modernMaterials.wallArt();
  const chairXs = [-2.05, -1.15, -0.25, 0.65];

  return (
    <group
      position={position}
      onClick={(event) => {
        event.stopPropagation();
        onSelect?.();
      }}
    >
      <RoundedBox
        args={[7.2, 0.045, 3.8]}
        radius={0.1}
        smoothness={4}
        position={[0, 0.025, 0]}
        material={floor}
        receiveShadow
      />

      {/* One continuous enclosure: two front panes form the doorway, the
          header makes that opening intentional, and the full-depth side
          pane now meets the front corner instead of stopping behind it. */}
      <GlassDivider width={4.8} position={[-1.2, 0, 1.9]} />
      <GlassDivider width={1.05} position={[3.075, 0, 1.9]} />
      <GlassDivider width={3.8} position={[3.6, 0, 0]} rotationY={Math.PI / 2} />
      <mesh
        position={[
          1.875,
          LOUNGE_FLOOR_TOP + GLASS_HEIGHT - GLASS_FRAME / 2,
          1.9,
        ]}
        material={modernMaterials.cabinFrame()}
        castShadow
      >
        <boxGeometry args={[1.4, GLASS_FRAME, 0.065]} />
      </mesh>

      {/* Full kitchenette: refrigerator, cabinets, worktop, sink and coffee station. */}
      <RoundedBox
        args={[0.76, 1.52, 0.68]}
        radius={0.08}
        smoothness={4}
        position={[-3.02, 0.77, -1.42]}
        material={cabinet}
        castShadow
        receiveShadow
      />
      <mesh position={[-3.41, 0.82, -1.22]} material={metal}>
        <boxGeometry args={[0.025, 0.42, 0.025]} />
      </mesh>
      <RoundedBox
        args={[0.52, 0.42, 0.025]}
        radius={0.025}
        smoothness={3}
        position={[-3.02, 1.12, -1.065]}
        material={screen}
      />

      {[-1.95, -1.05, -0.15, 0.75, 1.65].map((x) => (
        <group key={x}>
          <RoundedBox
            args={[0.82, 0.66, 0.66]}
            radius={0.045}
            smoothness={3}
            position={[x, 0.35, -1.43]}
            material={cabinet}
            castShadow
            receiveShadow
          />
          <mesh position={[x + 0.26, 0.4, -1.085]} material={metal}>
            <boxGeometry args={[0.14, 0.025, 0.025]} />
          </mesh>
        </group>
      ))}
      <RoundedBox
        args={[4.9, 0.1, 0.82]}
        radius={0.055}
        smoothness={4}
        position={[-0.15, 0.73, -1.4]}
        material={counter}
        castShadow
        receiveShadow
      />
      <RoundedBox
        args={[4.8, 0.08, 0.26]}
        radius={0.035}
        smoothness={3}
        position={[-0.15, 1.46, -1.7]}
        material={wood}
        castShadow
      />

      <mesh position={[-0.9, 0.79, -1.42]} rotation={[-Math.PI / 2, 0, 0]} material={metal}>
        <torusGeometry args={[0.23, 0.035, 8, 24]} />
      </mesh>
      <mesh position={[-0.72, 1.02, -1.58]} material={metal} castShadow>
        <torusGeometry args={[0.16, 0.022, 8, 18, Math.PI]} />
      </mesh>

      <RoundedBox
        args={[0.58, 0.52, 0.48]}
        radius={0.06}
        smoothness={4}
        position={[1.35, 1.01, -1.43]}
        material={appliance}
        castShadow
      />
      <RoundedBox
        args={[0.34, 0.14, 0.02]}
        radius={0.02}
        smoothness={3}
        position={[1.35, 1.08, -1.18]}
        material={screen}
      />
      <mesh position={[1.35, 0.78, -1.27]} material={metal}>
        <cylinderGeometry args={[0.055, 0.055, 0.16, 10]} />
      </mesh>
      {[1.85, 2.15].map((x) => (
        <mesh key={x} position={[x, 0.86, -1.35]} material={cushion} castShadow>
          <cylinderGeometry args={[0.085, 0.07, 0.18, 14]} />
        </mesh>
      ))}

      {/* A single long table makes the waiting state visually legible. */}
      <RoundedBox
        args={[3.95, 0.11, 0.9]}
        radius={0.09}
        smoothness={5}
        position={[-0.7, 0.72, 0]}
        material={wood}
        castShadow
        receiveShadow
      />
      {[-2.35, 0.95].flatMap((x) =>
        [-0.28, 0.28].map((z) => (
          <mesh key={`${x}-${z}`} position={[x, 0.36, z]} material={metal} castShadow>
            <cylinderGeometry args={[0.035, 0.045, 0.7, 10]} />
          </mesh>
        )),
      )}
      {chairXs.flatMap((x) => [
        <CafeChair key={`${x}-front`} position={[x, 0, 0.72]} rotationY={0} />,
        <CafeChair key={`${x}-rear`} position={[x, 0, -0.72]} rotationY={Math.PI} />,
      ])}
      {[-1.25, -0.7, -0.15].map((x) => (
        <group key={x} position={[x, 0.82, 0]}>
          <mesh material={cushion} castShadow>
            <cylinderGeometry args={[0.075, 0.065, 0.16, 14]} />
          </mesh>
          <mesh position={[0.09, 0.02, 0]} rotation={[Math.PI / 2, 0, 0]} material={cushion}>
            <torusGeometry args={[0.07, 0.018, 6, 12, Math.PI]} />
          </mesh>
        </group>
      ))}

      {/* Quiet corner for breaks that do not need a table seat. */}
      <group position={[2.42, 0, -0.42]} rotation={[0, -0.12, 0]}>
        <RoundedBox
          args={[1.55, 0.3, 0.72]}
          radius={0.13}
          smoothness={5}
          position={[0, 0.33, 0]}
          material={sofa}
          castShadow
          receiveShadow
        />
        <RoundedBox
          args={[1.52, 0.56, 0.14]}
          radius={0.11}
          smoothness={5}
          position={[0, 0.62, 0.28]}
          rotation={[-0.08, 0, 0]}
          material={sofa}
          castShadow
        />
        {[-0.38, 0.38].map((x) => (
          <RoundedBox
            key={x}
            args={[0.6, 0.12, 0.5]}
            radius={0.09}
            smoothness={4}
            position={[x, 0.5, -0.01]}
            material={cushion}
            castShadow
          />
        ))}
      </group>
      <mesh position={[2.25, 0.28, 0.65]} material={wood} castShadow>
        <cylinderGeometry args={[0.38, 0.38, 0.08, 24]} />
      </mesh>
      <mesh position={[2.25, 0.14, 0.65]} material={metal}>
        <cylinderGeometry args={[0.045, 0.045, 0.28, 12]} />
      </mesh>

      <group position={[3.05, 0, -1.3]}>
        <mesh position={[0, 0.18, 0]} material={pot} castShadow>
          <cylinderGeometry args={[0.16, 0.12, 0.36, 14]} />
        </mesh>
        {[
          [-0.1, 0.48, 0],
          [0.1, 0.52, 0.02],
          [0, 0.64, -0.03],
        ].map(([x, y, z], index) => (
          <mesh key={index} position={[x, y, z]} scale={[0.82, 1.18, 0.82]} material={leaf} castShadow>
            <sphereGeometry args={[0.18, 12, 10]} />
          </mesh>
        ))}
      </group>

      {/* Three wall markers make the zone read as a designed hospitality space. */}
      {[-0.45, 0, 0.45].map((x) => (
        <RoundedBox
          key={x}
          args={[0.3, 0.42, 0.035]}
          radius={0.035}
          smoothness={3}
          position={[x, 1.62, -1.87]}
          material={accent}
        />
      ))}
    </group>
  );
}
