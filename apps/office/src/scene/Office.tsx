import { useEffect, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, OrthographicCamera } from '@react-three/drei'
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing'
import { Vector3 } from 'three'
type OC = { target: Vector3; update: () => void }
import { useHQ } from '../store'
import { ROOM_POS } from '../lib/layout'
import { Brain } from './Brain'
import { EnergyLines, Ground, Roads } from './Roads'
import { Room } from './Room'
import { Pulses, Walkers } from './Motion'

export const ISO_OFFSET = new Vector3(40, 40, 40)
export const BASE_ZOOM = 21

/** Smoothly flies to the selected room and reports camera state for the mini-map. */
function CameraRig() {
  const controls = useThree((s) => s.controls) as unknown as OC | null
  const camera = useThree((s) => s.camera)
  const selected = useHQ((s) => s.selectedTeam)
  const flyTo = useRef<{ target: Vector3; zoom: number } | null>(null)
  const lastReport = useRef(0)

  useEffect(() => {
    if (selected && ROOM_POS[selected]) {
      const p = ROOM_POS[selected]
      // offset target a bit so the room isn't hidden behind the drawer
      flyTo.current = { target: new Vector3(p.x + 3.5, 0, p.z - 3.5), zoom: 38 }
    } else if (selected === null && controls) {
      flyTo.current = { target: new Vector3(0, 0, 0), zoom: BASE_ZOOM }
    }
  }, [selected, controls])

  useFrame((_, dt) => {
    if (!controls) return
    const f = flyTo.current
    if (f) {
      const k = Math.min(1, dt * 3.5)
      controls.target.lerp(f.target, k)
      camera.zoom += (f.zoom - camera.zoom) * k
      camera.position.copy(controls.target).add(ISO_OFFSET)
      camera.updateProjectionMatrix()
      controls.update()
      if (controls.target.distanceTo(f.target) < 0.05 && Math.abs(camera.zoom - f.zoom) < 0.1) flyTo.current = null
    }
    const now = performance.now()
    if (now - lastReport.current > 120) {
      lastReport.current = now
      useHQ.getState().set({ camera: { x: controls.target.x, z: controls.target.z, zoom: camera.zoom / BASE_ZOOM } })
    }
  })
  useEffect(() => {
    const onFly = (e: Event) => {
      const { x, z } = (e as CustomEvent).detail
      flyTo.current = { target: new Vector3(x, 0, z), zoom: camera.zoom }
    }
    window.addEventListener('hq:fly', onFly)
    return () => window.removeEventListener('hq:fly', onFly)
  }, [camera])
  return null
}

export function Office() {
  const teams = useHQ((s) => s.teams)
  const op = useHQ((s) => s.operation)
  const dim = (id: string) => op !== 'all' && teams.find((t) => t.id === id)?.operacao !== op
  return (
    <Canvas shadows dpr={[1, 2]} gl={{ antialias: true, alpha: true }} onPointerMissed={() => useHQ.getState().set({ selectedTeam: null })}>
      <OrthographicCamera makeDefault position={ISO_OFFSET.toArray()} zoom={BASE_ZOOM} near={-200} far={400} />
      <OrbitControls
        makeDefault
        enableRotate={false}
        enableDamping
        screenSpacePanning={false}
        minZoom={9}
        maxZoom={70}
        target={[0, 0, 0]}
        mouseButtons={{ LEFT: 2, MIDDLE: 1, RIGHT: 2 }}
        touches={{ ONE: 1, TWO: 2 }}
      />
      <CameraRig />
      <ambientLight intensity={0.55} color="#8fa2ff" />
      <hemisphereLight args={['#b9c8ff', '#1a1f3a', 0.6]} />
      <directionalLight
        position={[20, 35, 10]} intensity={1.6} color="#fff1dc" castShadow
        shadow-mapSize={[2048, 2048]} shadow-camera-left={-40} shadow-camera-right={40} shadow-camera-top={40} shadow-camera-bottom={-40}
        shadow-bias={-0.0005}
      />
      <Ground />
      <Roads />
      <Brain />
      <EnergyLines dimFor={dim} />
      {teams.map((t) => <Room key={t.id} team={t} dimmed={dim(t.id)} />)}
      <Pulses />
      <Walkers />
      <EffectComposer multisampling={4}>
        <Bloom intensity={0.9} luminanceThreshold={0.75} luminanceSmoothing={0.2} mipmapBlur />
        <Vignette eskil={false} offset={0.25} darkness={0.55} />
      </EffectComposer>
    </Canvas>
  )
}
