import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Mesh, MeshStandardMaterial } from 'three'
import { Character } from './Character'

export function Desk({ color, seed, working, label }: { color: string; seed: number; working: boolean; label?: string }) {
  const s1 = useRef<MeshStandardMaterial>(null)
  const s2 = useRef<MeshStandardMaterial>(null)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime + seed
    const f = working ? 1.6 + Math.sin(t * 7) * 0.35 + (Math.sin(t * 23) > 0.92 ? 0.8 : 0) : 0.25
    if (s1.current) s1.current.emissiveIntensity = f
    if (s2.current) s2.current.emissiveIntensity = f * 0.9
  })
  return (
    <group>
      {/* desk top + legs; monitors face -x where the person sits */}
      <mesh position={[0, 0.72, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.9, 0.06, 1.5]} />
        <meshStandardMaterial color="#c99a6b" flatShading />
      </mesh>
      {[[-0.38, -0.68], [0.38, -0.68], [-0.38, 0.68], [0.38, 0.68]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.35, z]}>
          <boxGeometry args={[0.05, 0.7, 0.05]} />
          <meshStandardMaterial color="#5b4636" />
        </mesh>
      ))}
      {[-0.36, 0.36].map((z, i) => (
        <group key={i} position={[0.22, 1.05, z]} rotation={[0, (i ? -1 : 1) * 0.18, 0]}>
          <mesh>
            <boxGeometry args={[0.05, 0.42, 0.62]} />
            <meshStandardMaterial color="#1b1f2e" />
          </mesh>
          <mesh position={[-0.03, 0, 0]}>
            <planeGeometry args={[0.56, 0.36]} />
            <meshStandardMaterial ref={i ? s2 : s1} color="#0b1530" emissive={color} emissiveIntensity={1} toneMapped={false} side={2} />
          </mesh>
          <mesh position={[0.02, -0.28, 0]}>
            <boxGeometry args={[0.04, 0.16, 0.04]} />
            <meshStandardMaterial color="#1b1f2e" />
          </mesh>
        </group>
      ))}
      {/* keyboard */}
      <mesh position={[-0.12, 0.765, 0]}>
        <boxGeometry args={[0.2, 0.02, 0.5]} />
        <meshStandardMaterial color="#e8e8f0" />
      </mesh>
      {/* chair */}
      <group position={[-0.75, 0, 0]}>
        <mesh position={[0, 0.45, 0]} castShadow>
          <boxGeometry args={[0.5, 0.08, 0.5]} />
          <meshStandardMaterial color="#2c3354" flatShading />
        </mesh>
        <mesh position={[-0.24, 0.8, 0]}>
          <boxGeometry args={[0.07, 0.62, 0.5]} />
          <meshStandardMaterial color="#2c3354" flatShading />
        </mesh>
        <mesh position={[0, 0.22, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 0.44]} />
          <meshStandardMaterial color="#888" />
        </mesh>
        <group position={[0.02, 0.0, 0]} rotation={[0, Math.PI / 2, 0]}>
          <Character color={label ? color : color} seed={seed} mode={working ? 'typing' : 'idle'} />
        </group>
      </group>
    </group>
  )
}

export function Lamp({ color, on }: { color: string; on: boolean }) {
  return (
    <group>
      <mesh position={[0, 0.7, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 1.4]} />
        <meshStandardMaterial color="#333" />
      </mesh>
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.2, 0.22, 0.04, 12]} />
        <meshStandardMaterial color="#333" />
      </mesh>
      <mesh position={[0, 1.45, 0]}>
        <coneGeometry args={[0.24, 0.3, 12, 1, true]} />
        <meshStandardMaterial color="#fff6dd" emissive={on ? '#ffd58a' : '#3a3020'} emissiveIntensity={on ? 2.2 : 0.4} toneMapped={false} side={2} />
      </mesh>
      {on && <pointLight position={[0, 1.3, 0]} color={color} intensity={4} distance={4.5} decay={2} />}
    </group>
  )
}

const BOOK_COLORS = ['#e9b23a', '#3b6fe0', '#d9474b', '#2bb673', '#9a5cf0', '#e5893b', '#22b8c9', '#f0f0f0']
export function Bookshelf({ seed }: { seed: number }) {
  const books = useMemo(() => {
    const out: { y: number; z: number; h: number; c: string }[] = []
    let r = seed * 9301 + 49297
    const rnd = () => ((r = (r * 9301 + 49297) % 233280) / 233280)
    for (let shelf = 0; shelf < 3; shelf++) {
      let z = -0.6
      while (z < 0.55) {
        const w = 0.07 + rnd() * 0.06
        out.push({ y: 0.25 + shelf * 0.55, z: z + w / 2, h: 0.28 + rnd() * 0.16, c: BOOK_COLORS[Math.floor(rnd() * BOOK_COLORS.length)] })
        z += w + 0.01
      }
    }
    return out
  }, [seed])
  return (
    <group>
      <mesh position={[0, 0.85, 0]}>
        <boxGeometry args={[0.4, 1.7, 1.4]} />
        <meshStandardMaterial color="#6b4b35" flatShading />
      </mesh>
      {books.map((b, i) => (
        <mesh key={i} position={[0.12, b.y + b.h / 2 - 0.06, b.z]}>
          <boxGeometry args={[0.24, b.h, 0.065]} />
          <meshStandardMaterial color={b.c} flatShading />
        </mesh>
      ))}
    </group>
  )
}

export function Plant() {
  return (
    <group>
      <mesh position={[0, 0.2, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.15, 0.4, 8]} />
        <meshStandardMaterial color="#d36b4c" flatShading />
      </mesh>
      {[[0, 0.75, 0, 0.32], [0.12, 0.55, 0.1, 0.24], [-0.1, 0.6, -0.08, 0.22]].map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]} castShadow>
          <icosahedronGeometry args={[r, 0]} />
          <meshStandardMaterial color={i ? '#3f9a54' : '#2f7e45'} flatShading />
        </mesh>
      ))}
    </group>
  )
}

export function Sofa({ color }: { color: string }) {
  return (
    <group>
      <mesh position={[0, 0.25, 0]} castShadow>
        <boxGeometry args={[0.8, 0.4, 1.8]} />
        <meshStandardMaterial color={color} flatShading />
      </mesh>
      <mesh position={[-0.32, 0.6, 0]} castShadow>
        <boxGeometry args={[0.18, 0.5, 1.8]} />
        <meshStandardMaterial color={color} flatShading />
      </mesh>
      {[-0.85, 0.85].map((z) => (
        <mesh key={z} position={[0, 0.45, z]}>
          <boxGeometry args={[0.8, 0.3, 0.14]} />
          <meshStandardMaterial color={color} flatShading />
        </mesh>
      ))}
    </group>
  )
}

/** Wall TV with an animated bar chart. Mounted on a wall facing +z. */
export function TV({ color, active }: { color: string; active: boolean }) {
  const bars = useRef<Mesh[]>([])
  useFrame(({ clock }) => {
    bars.current.forEach((m, i) => {
      if (!m) return
      const h = active ? 0.25 + 0.65 * Math.abs(Math.sin(clock.elapsedTime * 0.8 + i * 0.9)) : 0.2 + i * 0.04
      m.scale.y = h
      m.position.y = -0.42 + h * 0.42
    })
  })
  return (
    <group>
      <mesh>
        <boxGeometry args={[1.9, 1.15, 0.06]} />
        <meshStandardMaterial color="#111522" />
      </mesh>
      <mesh position={[0, 0, 0.035]}>
        <planeGeometry args={[1.78, 1.03]} />
        <meshStandardMaterial color="#0a1330" emissive="#0c1a44" emissiveIntensity={active ? 1.2 : 0.4} />
      </mesh>
      {Array.from({ length: 7 }, (_, i) => (
        <mesh key={i} ref={(m) => { if (m) bars.current[i] = m }} position={[-0.72 + i * 0.24, 0, 0.045]}>
          <boxGeometry args={[0.14, 0.84, 0.01]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={active ? 1.8 : 0.5} toneMapped={false} />
        </mesh>
      ))}
    </group>
  )
}
