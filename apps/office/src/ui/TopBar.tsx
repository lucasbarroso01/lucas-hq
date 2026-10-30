import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useHQ, teamById, type View } from '../store'
import { PauseButton } from './PauseButton'
import { DriveButton } from './DriveButton'

const OPS = [['all', 'Todas'], ['maquina-viral', 'Máquina Viral'], ['agencia-lucas', 'Agência Lucas']] as const

export function TopBar() {
  const { view, operation, set, agents, tasks, unread, live } = useHQ()
  const running = agents.filter((a) => a.status === 'working').length + tasks.filter((t) => t.parent_id && t.status === 'running').length
  const total = agents.length + tasks.filter((t) => t.parent_id && t.status === 'running').length
  const [palette, setPalette] = useState(false)
  const tabs: [View, string][] = [['office', 'Office'], ['dashboard', 'Painel'], ['tasks', `Tarefas (${tasks.filter((t) => t.status !== 'done').length})`], ['agenda', 'Agenda'], ['brain', 'Cérebro']]

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette((p) => !p) }
      if (e.key === 'Escape') { setPalette(false); set({ selectedTeam: null }) }
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [set])

  return (
    <>
      <header className="glass absolute left-3 right-3 top-3 z-30 flex h-14 items-center gap-3 rounded-2xl px-3">
        <div className="flex items-center gap-2 pr-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-sky-400 to-violet-500 text-sm font-black text-white shadow-[0_0_18px_#7cc8ff88]">L</div>
          <span className="hidden whitespace-nowrap text-[15px] font-bold tracking-tight sm:block">Lucas HQ</span>
        </div>
        <div className="hidden rounded-xl bg-white/5 p-1 lg:flex">
          {OPS.map(([id, label]) => (
            <button key={id} onClick={() => set({ operation: id })}
              className={`whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-medium transition ${operation === id ? 'bg-white/15 text-white' : 'text-white/55 hover:text-white'}`}>
              {label}
            </button>
          ))}
        </div>
        <nav className="flex gap-0.5">
          {tabs.map(([id, label]) => (
            <button key={id} onClick={() => set({ view: id })}
              className={`relative whitespace-nowrap rounded-lg px-3 py-1.5 text-[13px] font-medium transition ${view === id ? 'text-white' : 'text-white/55 hover:text-white'}`}>
              {view === id && <motion.span layoutId="tab" className="absolute inset-0 rounded-lg bg-white/10" />}
              <span className="relative">{label}</span>
            </button>
          ))}
        </nav>
        <button onClick={() => setPalette(true)}
          className="ml-auto hidden min-w-0 max-w-xs flex-1 items-center gap-2 rounded-xl bg-white/5 px-3 py-1.5 text-left text-xs text-white/45 ring-1 ring-white/10 hover:bg-white/10 md:flex">
          <span>🔍</span><span className="truncate">Pergunte a qualquer agente</span>
          <span className="ml-auto font-mono text-[10px] text-white/40">⌘K</span>
        </button>
        <DriveButton />
        <PauseButton />
        <div className="hidden items-center gap-1.5 whitespace-nowrap rounded-full bg-emerald-400/10 px-3 py-1 font-mono text-[11px] text-emerald-300 ring-1 ring-emerald-400/25 sm:flex">
          <span className="animate-pulse">●</span> {total} agentes · {running} rodando
        </div>
        <span title={`fonte: ${live}`} className="hidden font-mono text-[10px] uppercase text-white/35 xl:block">{live}</span>
        <button title="Notificações (ativa os avisos de post)" onClick={() => { set({ unread: 0 }); try { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission() } catch { /* ignore */ } }} className="relative grid h-9 w-9 place-items-center rounded-xl hover:bg-white/10">
          🔔
          {unread > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[9px] font-bold">{unread > 99 ? '99+' : unread}</span>}
        </button>
        <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-amber-300 to-rose-400 text-xs font-bold text-night-950">LB</div>
      </header>
      <AnimatePresence>{palette && <Palette onClose={() => setPalette(false)} />}</AnimatePresence>
    </>
  )
}

function Palette({ onClose }: { onClose: () => void }) {
  const { agents, set } = useHQ()
  const [q, setQ] = useState('')
  const hits = agents.filter((a) => (a.nome + a.papel + (teamById(a.team_id)?.nome ?? '')).toLowerCase().includes(q.toLowerCase()))
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 grid place-items-start justify-center bg-black/40 pt-28" onClick={onClose}>
      <motion.div initial={{ y: -10, scale: 0.98 }} animate={{ y: 0, scale: 1 }} className="glass w-[min(560px,92vw)] overflow-hidden rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pergunte a qualquer agente…"
          className="w-full bg-transparent px-4 py-3.5 text-sm outline-none placeholder:text-white/35" />
        <div className="max-h-80 overflow-auto border-t border-white/10 p-1.5 scroll-thin">
          {hits.map((a) => {
            const t = teamById(a.team_id)!
            return (
              <button key={a.id} onClick={() => { set({ view: 'office', selectedTeam: a.team_id }); onClose() }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-white/10">
                <span className="avatar !h-7 !w-7 !text-[11px]" style={{ background: t.cor }}>{a.nome[0].toUpperCase()}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-mono text-xs text-white">{a.nome}</span>
                  <span className="block truncate text-[11px] text-white/50">{t.nome} · {a.doing_now}</span>
                </span>
              </button>
            )
          })}
        </div>
      </motion.div>
    </motion.div>
  )
}
