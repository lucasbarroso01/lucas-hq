import { useMemo, useRef, useState } from 'react'
import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import type { MeshStandardMaterial } from 'three'
import { Color } from 'three'
import { useHQ } from '../store'
import type { Team } from '../data/types'
import { ROOM_D, ROOM_W, ROOM_POS } from '../lib/layout'
import { Bookshelf, Desk, Lamp, Plant, Sofa, TV } from './Furniture'

const DESK_SLOTS: [number, number][] = [[-1.9, -1.9], [1.6, -1.9], [-1.9, 0.4], [1.6, 0.4], [-1.9, 2.6], [1.6, 2.6]]

export function Room({ team, dimmed }: { team: Team; dimmed: boolean }) {
  const pos = ROOM_POS[team.id]
  const agents = useHQ((s) => s.agents.filter((a) => a.team_id === team.id))
  const subs = useHQ((s) => s.tasks.filter((t) => t.team_id === team.id && t.parent_id && t.status === 'running'))
  const runningTasks = useHQ((s) => s.tasks.filter((t) => t.team_id === team.id && t.status === 'running').length)
  const select = useHQ((s) => s.set)
  const selected = useHQ((s) => s.selectedTeam === team.id)
  const [hover, setHover] = useState(false)
  const working = agents.filter((a) => a.status === 'working').length
  const running = working > 0 || runningTasks > 0
  const glow = useRef<MeshStandardMaterial>(null)
  const floor = useRef<MeshStandardMaterial>(null)

  const base = useMemo(() => new Color(team.cor), [team.cor])
  const wallColor = useMemo(() => base.clone().lerp(new Color('#ffffff'), 0.25), [base])
  const floorOn = useMemo(() => new Color('#efe7da'), [])
  const floorOff = useMemo(() => new Color('#8f8a96'), [])

  useFrame(({ clock }, dt) => {
    if (glow.current) {
      const target = running ? 2.2 + Math.sin(clock.elapsedTime * 3) * 0.4 : 0.35
      glow.current.emissiveIntensity += (target - glow.current.emissiveIntensity) * Math.min(1, dt * 4)
    }
    if (floor.current) floor.current.color.lerp(running ? floorOn : floorOff, Math.min(1, dt * 3))
  })

  const desks = [
    ...agents.map((a, i) => ({ key: a.id, working: a.status === 'working', seed: i + team.id.length, sub: false })),
    ...subs.map((t, i) => ({ key: t.id, working: true, seed: 10 + i, sub: true })),
  ].slice(0, DESK_SLOTS.length)

  const W = ROOM_W, D = ROOM_D, H = 3
  return (
    <group
      position={[pos.x, 0, pos.z]}
      onClick={(e) => { e.stopPropagation(); select({ selectedTeam: team.id }) }}
      onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = 'pointer' }}
      onPointerOut={() => { setHover(false); document.body.style.cursor = '' }}
    >
      {/* base slab */}
      <mesh position={[0, -0.2, 0]} receiveShadow>
        <boxGeometry args={[W + 0.4, 0.4, D + 0.4]} />
        <meshStandardMaterial color={base.clone().multiplyScalar(0.55)} flatShading />
      </mesh>
      <mesh position={[0, 0.01, 0]} receiveShadow>
        <boxGeometry args={[W, 0.02, D]} />
        <meshStandardMaterial ref={floor} color="#efe7da" />
      </mesh>
      {/* rug */}
      <mesh position={[0.3, 0.025, 0.3]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[6.6, 5.4]} />
        <meshStandardMaterial color={base.clone().lerp(new Color('#ffffff'), 0.55)} />
      </mesh>
      {/* two back walls (the other two are removed so we can look inside) */}
      <mesh position={[-W / 2 - 0.1, H / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.2, H, D + 0.2]} />
        <meshStandardMaterial color={wallColor} flatShading />
      </mesh>
      <mesh position={[0, H / 2, -D / 2 - 0.1]} castShadow receiveShadow>
        <boxGeometry args={[W, H, 0.2]} />
        <meshStandardMaterial color={wallColor} flatShading />
      </mesh>
      {/* neon trim along the wall tops */}
      <mesh position={[0, H + 0.04, -D / 2 - 0.1]}>
        <boxGeometry args={[W, 0.08, 0.22]} />
        <meshStandardMaterial ref={glow} color={team.cor} emissive={team.cor} emissiveIntensity={1} toneMapped={false} />
      </mesh>
      <mesh position={[-W / 2 - 0.1, H + 0.04, 0]}>
        <boxGeometry args={[0.22, 0.08, D + 0.2]} />
        <meshStandardMaterial color={team.cor} emissive={team.cor} emissiveIntensity={running ? 1.8 : 0.3} toneMapped={false} />
      </mesh>
      {/* window on the left wall */}
      <mesh position={[-W / 2 + 0.01, 1.9, 1.4]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[2, 1]} />
        <meshStandardMaterial color="#1a2a66" emissive="#2a4aa8" emissiveIntensity={0.6} />
      </mesh>

      {desks.map((d, i) => (
        <group key={d.key} position={[DESK_SLOTS[i][0], 0, DESK_SLOTS[i][1]]}>
          <Desk color={d.sub ? '#cfc4ff' : team.cor} seed={d.seed} working={d.working} />
        </group>
      ))}

      <group position={[-W / 2 + 0.25, 0, -1.9]}><Bookshelf seed={team.id.length} /></group>
      <group position={[0.8, 2.0, -D / 2 + 0.04]}><TV color={team.cor} active={running} /></group>
      <group position={[W / 2 - 0.5, 0, -D / 2 + 0.5]}><Plant /></group>
      <group position={[-W / 2 + 0.5, 0, D / 2 - 0.5]}><Plant /></group>
      <group position={[-0.2, 0, -D / 2 + 0.5]}><Lamp color={team.cor} on={running} /></group>
      {desks.length <= 4 && (
        <group position={[W / 2 - 0.7, 0, 2.1]} rotation={[0, Math.PI, 0]}><Sofa color={base.clone().multiplyScalar(0.8).getStyle()} /></group>
      )}

      {/* selection outline */}
      {(selected || hover) && (
        <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[Math.max(W, D) * 0.62, Math.max(W, D) * 0.66, 64]} />
          <meshBasicMaterial color={team.cor} transparent opacity={selected ? 0.9 : 0.4} toneMapped={false} />
        </mesh>
      )}

      <Html position={[-1.5, H + 1.4, -1.5]} center distanceFactor={undefined} zIndexRange={[10, 0]} style={{ pointerEvents: 'none', opacity: dimmed ? 0.35 : 1, transition: 'opacity .3s' }}>
        <div className="room-label" style={{ ['--c' as string]: team.cor }}>
          <div className="flex items-center gap-1.5 font-semibold text-[13px] text-white whitespace-nowrap">
            <span>{team.icon}</span>{team.nome}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="font-mono text-[10px] text-white/70 whitespace-nowrap">
              <span style={{ color: running ? '#4ade80' : '#94a3b8' }}>●</span> {agents.length + subs.length} agentes · {working + subs.length} rodando
            </span>
            <span className="flex -space-x-1.5">
              {agents.slice(0, 3).map((a) => (
                <span key={a.id} className="avatar" style={{ background: team.cor }}>{a.nome[0].toUpperCase()}</span>
              ))}
            </span>
          </div>
        </div>
      </Html>
    </group>
  )
}
