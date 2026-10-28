import { useMemo } from 'react'
import { Line } from '@react-three/drei'
import { useHQ } from '../store'
import { RING_RADIUS, ROAD_RADIUS, ROOM_D, ROOM_POS, ringPoint } from '../lib/layout'

export function Ground() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.42, 0]} receiveShadow>
        <circleGeometry args={[RING_RADIUS + 9, 96]} />
        <meshStandardMaterial color="#141c3e" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.43, 0]}>
        <circleGeometry args={[RING_RADIUS + 9.6, 96]} />
        <meshBasicMaterial color="#3b4fa8" transparent opacity={0.25} />
      </mesh>
    </group>
  )
}

export function Roads() {
  const teams = useHQ((s) => s.teams)
  const dashes = useMemo(() => {
    const out: { x: number; z: number; r: number }[] = []
    const N = 90
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2
      out.push({ x: Math.cos(a) * ROAD_RADIUS, z: Math.sin(a) * ROAD_RADIUS, r: -a })
    }
    return out
  }, [])
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.38, 0]} receiveShadow>
        <ringGeometry args={[ROAD_RADIUS - 1.1, ROAD_RADIUS + 1.1, 128]} />
        <meshStandardMaterial color="#232838" />
      </mesh>
      {dashes.map((d, i) => (
        <mesh key={i} position={[d.x, -0.36, d.z]} rotation={[-Math.PI / 2, 0, d.r]}>
          <planeGeometry args={[0.08, 0.4]} />
          <meshBasicMaterial color="#e9d79a" />
        </mesh>
      ))}
      {teams.map((t) => {
        const p = ROOM_POS[t.id]
        const inner = ROAD_RADIUS
        const outer = RING_RADIUS - ROOM_D / 2 + 0.3
        const len = outer - inner
        const [cx, cz] = ringPoint(p.angle, inner + len / 2)
        return (
          <group key={t.id} position={[cx, -0.37, cz]} rotation={[0, -p.angle, 0]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
              <planeGeometry args={[len, 1.8]} />
              <meshStandardMaterial color="#232838" />
            </mesh>
            {Array.from({ length: Math.floor(len / 0.8) }, (_, i) => (
              <mesh key={i} position={[-len / 2 + 0.4 + i * 0.8, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[0.4, 0.08]} />
                <meshBasicMaterial color="#e9d79a" />
              </mesh>
            ))}
          </group>
        )
      })}
      {/* street lamps along the ring */}
      {Array.from({ length: 9 }, (_, i) => {
        const a = (i / 9) * Math.PI * 2 + 0.35
        const [x, z] = ringPoint(a, ROAD_RADIUS + 1.5)
        return (
          <group key={i} position={[x, -0.4, z]}>
            <mesh position={[0, 0.9, 0]}><cylinderGeometry args={[0.05, 0.06, 1.8]} /><meshStandardMaterial color="#3a4060" /></mesh>
            <mesh position={[0, 1.85, 0]}><sphereGeometry args={[0.14, 10, 8]} /><meshStandardMaterial color="#fff" emissive="#ffe0a0" emissiveIntensity={3} toneMapped={false} /></mesh>
          </group>
        )
      })}
    </group>
  )
}

/** Energy lines from each room to the brain. */
export function EnergyLines({ dimFor }: { dimFor: (id: string) => boolean }) {
  const teams = useHQ((s) => s.teams)
  return (
    <group>
      {teams.map((t) => {
        const p = ROOM_POS[t.id]
        const [x, z] = ringPoint(p.angle, RING_RADIUS - 2)
        return (
          <Line key={t.id} points={[[x, 3.4, z], [x * 0.55, 4.2, z * 0.55], [0, 2.8, 0]]} color={t.cor} lineWidth={2}
            transparent opacity={dimFor(t.id) ? 0.12 : 0.45} toneMapped={false} />
        )
      })}
    </group>
  )
}
