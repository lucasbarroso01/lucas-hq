import { useEffect } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Office } from './scene/Office'
import { TopBar } from './ui/TopBar'
import { MiniMap } from './ui/MiniMap'
import { Toasts } from './ui/Toasts'
import { TeamDrawer } from './ui/TeamDrawer'
import { TasksView } from './ui/TasksView'
import { AgendaView } from './ui/AgendaView'
import { DashboardView } from './ui/DashboardView'
import { BrainView } from './brain/BrainView'
import { ReviewModal } from './ui/ReviewModal'
import { TaskDetail } from './ui/TaskDetail'
import { NextPosts, PostAlarm } from './ui/NextPosts'
import { PauseBanner } from './ui/PauseButton'
import { useHQ } from './store'
import { connectSupabase } from './lib/supabase'
import { startDemo } from './lib/demo'

export function App() {
  const view = useHQ((s) => s.view)
  const selected = useHQ((s) => s.selectedTeam)
  useEffect(() => {
    const demo = new URLSearchParams(location.search).has('demo')
    let timer: number | undefined
    connectSupabase().then((ok) => { if (demo || !ok) { if (demo) timer = startDemo() } })
    return () => window.clearInterval(timer)
  }, [])
  return (
    <div className="relative h-full w-full">
      <div className="sky" />
      <div className="absolute inset-0 z-[1]" style={{ visibility: view === 'office' ? 'visible' : 'hidden' }}>
        <Office />
      </div>
      <TopBar />
      <PauseBanner />
      {view === 'office' && <MiniMap />}
      {view === 'office' && !selected && <NextPosts />}
      <PostAlarm />
      <Toasts />
      <AnimatePresence>{view === 'office' && selected && <TeamDrawer key={selected} teamId={selected} />}</AnimatePresence>
      {view === 'dashboard' && <DashboardView />}
      {view === 'tasks' && <TasksView />}
      {view === 'agenda' && <AgendaView />}
      {view === 'brain' && <BrainView />}
      <ReviewModal />
      <TaskDetail />
    </div>
  )
}
