"use client";

import { RoundedBox } from "@react-three/drei";

import { AgentAvatar, type AgentAvatarSubject } from "@/components/office/AgentAvatar";
import { modernMaterials } from "@/lib/modernMaterials";

interface BossCabinProps {
  position: [number, number, number];
}

const WIDTH = 5.8;
const DEPTH = 3.8;
const HEIGHT = 1.85;
const FRAME = 0.05;
const PERMANENT_CEO: AgentAvatarSubject = {
  id: "office-ceo",
  name: "CEO",
  role: "Chief executive officer",
  status: "working",
  accent_color: "#5b4a91",
  mood: "neutral",
};

function GlassPanel({
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

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh position={[0, HEIGHT / 2, 0]} material={glass}>
        <boxGeometry args={[width, HEIGHT, 0.045]} />
      </mesh>
      {[0, HEIGHT].map((y) => (
        <mesh key={y} position={[0, y, 0]} material={frame} castShadow>
          <boxGeometry args={[width + FRAME, FRAME, 0.085]} />
        </mesh>
      ))}
      {[-width / 2, width / 2].map((x) => (
        <mesh key={x} position={[x, HEIGHT / 2, 0]} material={frame} castShadow>
          <boxGeometry args={[FRAME, HEIGHT, 0.085]} />
        </mesh>
      ))}
    </group>
  );
}

export function BossCabin({ position }: BossCabinProps) {
  const floor = modernMaterials.rug();
  const wall = modernMaterials.wallWarmGrey();
  const frame = modernMaterials.cabinFrame();
  const desk = modernMaterials.cabinDeskWood();
  const chair = modernMaterials.cabinChairLeather();
  const visitorChair = modernMaterials.sofaFabric();
  const metal = modernMaterials.deskLegMetal();
  const screen = modernMaterials.monitorScreen();
  const storage = modernMaterials.storageCabinet();
  const art = modernMaterials.wallArt();
  const plantPot = modernMaterials.plantPot();
  const plantLeaf = modernMaterials.plantLeaf();
  const doorGap = 1.15;
  const frontPanelWidth = (WIDTH - doorGap) / 2;

  return (
    <group position={position}>
      <RoundedBox
        args={[WIDTH, 0.045, DEPTH]}
        radius={0.09}
        smoothness={4}
        position={[0, 0.025, 0]}
        material={floor}
        receiveShadow
      />

      <mesh position={[0, HEIGHT / 2, -DEPTH / 2]} material={wall} castShadow receiveShadow>
        <boxGeometry args={[WIDTH, HEIGHT, 0.12]} />
      </mesh>
      <mesh position={[0, 0.05, -DEPTH / 2 + 0.075]} material={frame}>
        <boxGeometry args={[WIDTH, 0.1, 0.08]} />
      </mesh>

      <GlassPanel width={DEPTH} position={[-WIDTH / 2, 0, 0]} rotationY={Math.PI / 2} />
      <GlassPanel width={DEPTH} position={[WIDTH / 2, 0, 0]} rotationY={Math.PI / 2} />
      <GlassPanel
        width={frontPanelWidth}
        position={[-(doorGap + frontPanelWidth) / 2, 0, DEPTH / 2]}
      />
      <GlassPanel
        width={frontPanelWidth}
        position={[(doorGap + frontPanelWidth) / 2, 0, DEPTH / 2]}
      />

      <group position={[0, 0, -0.55]}>
        <RoundedBox
          args={[2.55, 0.11, 0.9]}
          radius={0.08}
          smoothness={4}
          position={[0, 0.76, 0]}
          material={desk}
          castShadow
          receiveShadow
        />
        <RoundedBox
          args={[1.35, 0.025, 0.5]}
          radius={0.025}
          smoothness={3}
          position={[0, 0.83, 0.03]}
          material={chair}
          receiveShadow
        />
        {[-0.98, 0.98].flatMap((x) =>
          [-0.31, 0.31].map((z) => (
            <mesh key={`${x}-${z}`} position={[x, 0.39, z]} material={metal} castShadow>
              <boxGeometry args={[0.065, 0.72, 0.065]} />
            </mesh>
          )),
        )}
        <mesh position={[0, 0.83, -0.25]} material={metal}>
          <boxGeometry args={[0.04, 0.18, 0.04]} />
        </mesh>
        <RoundedBox
          args={[0.74, 0.44, 0.055]}
          radius={0.05}
          smoothness={4}
          position={[0, 1.08, -0.25]}
          material={screen}
          castShadow
        />
        <RoundedBox
          args={[0.5, 0.025, 0.16]}
          radius={0.018}
          smoothness={3}
          position={[0, 0.855, 0.18]}
          material={metal}
        />
      </group>

      <group position={[0, 0, -1.28]}>
        <RoundedBox
          args={[0.68, 0.11, 0.62]}
          radius={0.1}
          smoothness={5}
          position={[0, 0.49, 0]}
          material={chair}
          castShadow
          receiveShadow
        />
        <RoundedBox
          args={[0.68, 0.72, 0.11]}
          radius={0.11}
          smoothness={5}
          position={[0, 0.87, -0.23]}
          rotation={[-0.09, 0, 0]}
          material={chair}
          castShadow
        />
        <mesh position={[0, 0.24, 0]} material={metal}>
          <cylinderGeometry args={[0.04, 0.04, 0.46, 10]} />
        </mesh>
        <mesh position={[0, 0.03, 0]} material={metal}>
          <cylinderGeometry args={[0.28, 0.28, 0.045, 16]} />
        </mesh>
      </group>

      <AgentAvatar
        agent={PERMANENT_CEO}
        targetPosition={[0, 0, -0.56]}
        targetRotationY={Math.PI}
        animationStateOverride="working"
      />

      {[-0.62, 0.62].map((x) => (
        <group key={x} position={[x, 0, 0.72]} rotation={[0, Math.PI, 0]}>
          <RoundedBox
            args={[0.52, 0.1, 0.5]}
            radius={0.08}
            smoothness={4}
            position={[0, 0.43, 0]}
            material={visitorChair}
            castShadow
            receiveShadow
          />
          <RoundedBox
            args={[0.52, 0.5, 0.09]}
            radius={0.08}
            smoothness={4}
            position={[0, 0.69, 0.18]}
            material={visitorChair}
            castShadow
          />
          {[-0.19, 0.19].flatMap((legX) =>
            [-0.17, 0.17].map((legZ) => (
              <mesh key={`${legX}-${legZ}`} position={[legX, 0.2, legZ]} material={metal}>
                <cylinderGeometry args={[0.022, 0.022, 0.4, 8]} />
              </mesh>
            )),
          )}
        </group>
      ))}

      <mesh position={[WIDTH / 2 - 0.34, 0.48, -0.85]} material={storage} castShadow receiveShadow>
        <boxGeometry args={[0.5, 0.92, 1.05]} />
      </mesh>
      {[-0.18, 0.18].map((z) => (
        <mesh key={z} position={[WIDTH / 2 - 0.595, 0.48, -0.85 + z]} material={metal}>
          <boxGeometry args={[0.025, 0.12, 0.025]} />
        </mesh>
      ))}
      <group position={[-WIDTH / 2 + 0.38, 0, -DEPTH / 2 + 0.38]}>
        <mesh position={[0, 0.2, 0]} material={plantPot} castShadow>
          <cylinderGeometry args={[0.16, 0.12, 0.4, 14]} />
        </mesh>
        {[
          [-0.1, 0.48, 0],
          [0.09, 0.5, 0.03],
          [0, 0.63, -0.02],
        ].map(([x, y, z], index) => (
          <mesh key={index} position={[x, y, z]} scale={[0.85, 1.25, 0.85]} material={plantLeaf} castShadow>
            <sphereGeometry args={[0.18, 12, 10]} />
          </mesh>
        ))}
      </group>
      {[-0.58, 0, 0.58].map((x) => (
        <mesh key={x} position={[x, 1.45, -DEPTH / 2 + 0.07]} material={art}>
          <boxGeometry args={[0.38, 0.42, 0.035]} />
        </mesh>
      ))}
    </group>
  );
}
