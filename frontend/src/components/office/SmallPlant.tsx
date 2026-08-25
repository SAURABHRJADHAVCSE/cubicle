import { getVoxelMaterial } from "@/lib/voxelMaterials";

interface SmallPlantProps {
  position: [number, number, number];
}

/** A small potted plant — deliberately tiny (not oversized leaf-block
 * "trees") so it reads as tasteful desk/corner decor. */
export function SmallPlant({ position }: SmallPlantProps) {
  const dirt = getVoxelMaterial("dirt");
  const leaves = getVoxelMaterial("leaves");

  return (
    <group position={position}>
      <mesh position={[0, 0.1, 0]} material={dirt}>
        <boxGeometry args={[0.22, 0.2, 0.22]} />
      </mesh>
      <mesh position={[0, 0.28, 0]} material={leaves}>
        <boxGeometry args={[0.28, 0.28, 0.28]} />
      </mesh>
      <mesh position={[0, 0.46, 0]} material={leaves}>
        <boxGeometry args={[0.16, 0.16, 0.16]} />
      </mesh>
    </group>
  );
}
