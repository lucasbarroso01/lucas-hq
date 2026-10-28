import { useRef } from 'react'
import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, type Group, type Mesh, type MeshStandardMaterial } from 'three'
import { useHQ } from '../store'

export function Brain() {
  const crystal = useRef<Mesh>(null)
  const crystalMat = useRef<MeshStandardMaterial>(null)
  const rings = useRef<Group>(null)
  const notes = useHQ((s) => s.brainNotes)

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const flash = Math.max(0, 1 - (performance.now() - useHQ.getState().brainFlash) / 700)
    if (crystal.current) {
      crystal.current.rotation.y = t * 0.6
      crystal.current.rotation.x = Math.sin(t * 0.4) * 0.3
      crystal.current.position.y = 2.6 + Math.sin(t * 1.4) * 0.18
      crystal.current.scale.setScalar(1 + flash * 0.35)
    }
    if (crystalMat.current) crystalMat.current.emissiveIntensity = 2.4 + Math.sin(t * 2) * 0.4 + flash * 5
    rings.current?.children.forEach((r, i) => {
      const p = (Math.sin(t * 1.6 - i * 0.9) + 1) / 2
      r.scale.setScalar(1 + p * 0.06 + flash * 0.1)
      const m = (r as Mesh).material as MeshStandardMaterial
      m.emissiveIntensity = 0.8 + p * 1.8 + flash * 3
    })
  })

  return (
    <group>
      <mesh position={[0, 0.15, 0]} receiveShadow>
        <cylinderGeometry args={[6, 6.4, 0.3, 48]} />
        <meshStandardMaterial color="#1a2350" flatShading />
      </mesh>
      <mesh position={[0, 0.32, 0]}>
        <cylinderGeometry args={[4.8, 5, 0.1, 48]} />
        <meshStandardMaterial color="#232f6a" />
      </mesh>
      <group ref={rings}>
        {[5.4, 4.0, 2.6].map((r, i) => (
          <mesh key={r} position={[0, 0.4 + i * 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <torusGeometry args={[r, 0.07, 8, 96]} />
            <meshStandardMaterial color="#7fd8ff" emissive={['#5b9dff', '#9a7cff', '#5ef0ff'][i]} emissiveIntensity={1.5} toneMapped={false} />
          </mesh>
        ))}
      </group>
      {/* pedestal */}
      <mesh position={[0, 0.8, 0]}>
        <cylinderGeometry args={[0.8, 1.2, 0.8, 8]} />
        <meshStandardMaterial color="#2c3a80" flatShading />
      </mesh>
      <mesh ref={crystal} position={[0, 2.6, 0]}>
        <octahedronGeometry args={[1.1, 0]} />
        <meshStandardMaterial ref={crystalMat} color="#cfeeff" emissive="#7cc8ff" emissiveIntensity={2.5} flatShading toneMapped={false} />
      </mesh>
      {/* light column */}
      <mesh position={[0, 9, 0]}>
        <cylinderGeometry args={[0.55, 1.1, 16, 24, 1, true]} />
        <meshBasicMaterial color="#6fb6ff" transparent opacity={0.13} blending={AdditiveBlending} depthWrite={false} side={2} />
      </mesh>
      <mesh position={[0, 9, 0]}>
        <cylinderGeometry args={[0.18, 0.3, 16, 12, 1, true]} />
        <meshBasicMaterial color="#bfe4ff" transparent opacity={0.35} blending={AdditiveBlending} depthWrite={false} />
      </mesh>
      <pointLight position={[0, 3, 0]} color="#7cc8ff" intensity={30} distance={18} decay={1.6} />
      <Html position={[0, 9, 0]} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
        <div className="room-label text-center" style={{ ['--c' as string]: '#7cc8ff' }}>
          <div className="font-bold text-[13px] tracking-wide text-white whitespace-nowrap">🧠 O CÉREBRO</div>
          <div className="font-mono text-[10px] text-sky-200/80 whitespace-nowrap">{notes} notas · memória compartilhada</div>
        </div>
      </Html>
    </group>
  )
}
