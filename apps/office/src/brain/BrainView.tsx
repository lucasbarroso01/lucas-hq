import { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Html, Line } from '@react-three/drei'
import { Bloom, EffectComposer } from '@react-three/postprocessing'
import { AdditiveBlending, BufferAttribute, BufferGeometry, type Points } from 'three'
import { useHQ, teamById } from '../store'
import { ago } from '../ui/bits'
import type { Agent } from '../data/types'

function Vortex() {
  const ref = useRef<Points>(null)
  const geo = useMemo(() => {
    const N = 4000
    const pos = new Float32Array(N * 3), col = new Float32Array(N * 3)
    for (let i = 0; i < N; i++) {
      const r = Math.pow(Math.random(), 0.6) * 3.2
      const a = Math.random() * Math.PI * 2 + r * 1.6
      pos.set([Math.cos(a) * r, (Math.random() - 0.5) * (3.2 - r) * 0.7, Math.sin(a) * r], i * 3)
      const k = r / 3.2
      col.set([0.5 + 0.4 * k, 0.75 - 0.3 * k, 1], i * 3)
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(pos, 3))
    g.setAttribute('color', new BufferAttribute(col, 3))
    return g
  }, [])
  useFrame(({ clock }) => {
    if (!ref.current) return
    const flash = Math.max(0, 1 - (performance.now() - useHQ.getState().brainFlash) / 700)
    ref.current.rotation.y = clock.elapsedTime * 0.25
    ref.current.scale.setScalar(1 + flash * 0.15)
  })
  return (
    <points ref={ref} geometry={geo}>
      <pointsMaterial size={0.045} vertexColors transparent opacity={0.9} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
    </points>
  )
}

const ORBIT = 6
function AgentNode({ agent, i, n }: { agent: Agent; i: number; n: number }) {
  const team = teamById(agent.team_id)!
  const g = useRef<any>(null)
  const line = useRef<any>(null)
  const ev = useHQ((s) => s.events.find((e) => e.team_id === agent.team_id && (e.type === 'brain_read' || e.type === 'brain_write')))
  useFrame(({ clock }) => {
    const a = (i / n) * Math.PI * 2 + clock.elapsedTime * 0.08
    g.current?.position.set(Math.cos(a) * ORBIT, Math.sin(a * 2 + i) * 0.6, Math.sin(a) * ORBIT)
    if (line.current && g.current) {
      const p = g.current.position
      line.current.geometry.setPositions([p.x, p.y, p.z, 0, 0, 0])
      const age = ev ? (Date.now() - new Date(ev.ts).getTime()) / 1500 : 9
      line.current.material.opacity = 0.12 + Math.max(0, 1 - age) * 0.85
    }
  })
  const fresh = ev && Date.now() - new Date(ev.ts).getTime() < 4000
  const state = fresh ? (ev!.type === 'brain_write' ? 'escrevendo' : 'lendo memória') : agent.status === 'working' ? 'escaneando' : 'ocioso'
  return (
    <>
      <Line ref={line} points={[[0, 0, 0], [0, 0, 0]]} color={team.cor} lineWidth={1.6} transparent opacity={0.15} toneMapped={false} />
      <group ref={g}>
        <mesh>
          <icosahedronGeometry args={[0.28, 1]} />
          <meshStandardMaterial color={team.cor} emissive={team.cor} emissiveIntensity={fresh ? 3 : 1.1} toneMapped={false} />
        </mesh>
        <Html center position={[0, 0.65, 0]} style={{ pointerEvents: 'none' }}>
          <div className="whitespace-nowrap text-center">
            <div className="font-mono text-[10px] font-semibold text-white">{agent.nome}</div>
            <div className="font-mono text-[9px]" style={{ color: fresh ? team.cor : '#ffffff70' }}>{state}</div>
          </div>
        </Html>
      </group>
    </>
  )
}

export function BrainView() {
  const { agents, events, brainNotes, brainToday } = useHQ()
  const feed = events.filter((e) => e.type === 'brain_read' || e.type === 'brain_write').slice(0, 30)
  return (
    <div className="absolute inset-0 z-10">
      <Canvas camera={{ position: [0, 5, 12], fov: 45 }}>
        <ambientLight intensity={0.4} />
        <pointLight position={[0, 0, 0]} intensity={40} color="#7cc8ff" />
        <Vortex />
        <mesh>
          <octahedronGeometry args={[0.7, 0]} />
          <meshStandardMaterial color="#e0f4ff" emissive="#8fd0ff" emissiveIntensity={3} toneMapped={false} flatShading />
        </mesh>
        {agents.map((a, i) => <AgentNode key={a.id} agent={a} i={i} n={agents.length} />)}
        <EffectComposer><Bloom intensity={1.1} luminanceThreshold={0.4} mipmapBlur /></EffectComposer>
      </Canvas>
      <div className="pointer-events-none absolute left-6 top-24">
        <h1 className="text-2xl font-bold">O Cérebro</h1>
        <p className="text-sm text-white/50">Memória compartilhada · server-memory (brain/memory.jsonl)</p>
        <div className="mt-4 flex gap-3">
          <div className="glass rounded-xl px-4 py-2"><div className="text-[10px] uppercase text-white/45">Total de notas</div><div className="font-mono text-xl font-bold">{brainNotes}</div></div>
          <div className="glass rounded-xl px-4 py-2"><div className="text-[10px] uppercase text-white/45">Hoje</div><div className="font-mono text-xl font-bold text-emerald-300">+{brainToday}</div></div>
        </div>
      </div>
      <aside className="glass absolute bottom-4 right-4 top-[84px] w-[min(340px,calc(100vw-32px))] overflow-y-auto rounded-2xl p-4 scroll-thin">
        <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-white/50">Últimas memórias</h3>
        {feed.length === 0 && <p className="text-sm text-white/35">Sem leituras/escritas ainda. Abra com <span className="font-mono">?demo=1</span> para simular.</p>}
        <div className="space-y-2">
          {feed.map((e) => {
            const t = teamById(e.team_id)
            const w = e.type === 'brain_write'
            return (
              <div key={e.id} className="rounded-xl bg-white/5 px-3 py-2 ring-1 ring-white/5">
                <div className="flex items-center gap-1.5 font-mono text-[10px]">
                  <span style={{ color: t?.cor }}>{t?.nome}</span>
                  <span className={w ? 'text-violet-300' : 'text-sky-300'}>· {w ? 'ESCREVEU' : 'LEU'}</span>
                  <span className="ml-auto text-white/35">{ago(e.ts)}</span>
                </div>
                <div className="mt-0.5 text-[12px] text-white/85">“{e.payload.note}”</div>
              </div>
            )
          })}
        </div>
      </aside>
    </div>
  )
}
