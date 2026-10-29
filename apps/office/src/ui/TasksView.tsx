import { useState } from 'react'
import { motion } from 'framer-motion'
import { useHQ, teamById } from '../store'
import { Ring, ago } from './bits'
import { decide } from '../lib/supabase'
import type { Task } from '../data/types'
import { driveSearch, statusPt } from './TaskDetail'
import { driveHref } from './DriveButton'


type F = 'all' | 'running' | 'waiting' | 'done'

export function TasksView() {
  const { tasks: all, operation, set, drive } = useHQ()
  const DRIVE_HOME = driveHref(drive).href
  const [f, setF] = useState<F>('all')
  const tasks = all.filter((t) => operation === 'all' || t.operacao === operation)
  const by = (s: Task['status']) => tasks.filter((t) => t.status === s)
  const counts = { all: tasks.length, running: by('running').length, waiting: by('waiting').length, done: by('done').length }
  const labels: [F, string][] = [['all', 'Todas'], ['running', 'Rodando'], ['waiting', 'Aguardando'], ['done', 'Concluídas']]

  return (
    <Page title="Tarefas" subtitle="Tudo que os times estão fazendo agora · clique numa tarefa para ver o trabalho">
      <div className="mb-6 flex flex-wrap gap-1.5">
        {labels.map(([id, l]) => (
          <button key={id} onClick={() => setF(id)} className={`rounded-xl px-3 py-1.5 text-xs font-medium ring-1 ${f === id ? 'bg-white/15 text-white ring-white/20' : 'text-white/55 ring-white/10 hover:text-white'}`}>
            {l} <span className="ml-1 font-mono text-white/45">{counts[id]}</span>
          </button>
        ))}
        <a href={DRIVE_HOME} target="_blank" rel="noreferrer" className="rounded-xl bg-emerald-400/15 px-3 py-1.5 text-xs font-bold text-emerald-200 ring-1 ring-emerald-400/30 hover:bg-emerald-400/25">
          📁 Vídeos prontos no Drive ↗
        </a>
      </div>
      <div className="grid gap-8">
        {(f === 'all' || f === 'running') && (
          <Group title="Rodando" items={by('running')} render={(t) => {
            const team = teamById(t.team_id)!
            return (
              <Card key={t.id} task={t}>
                <Ring value={t.progress} color={team.cor} size={48} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{t.titulo}</div>
                  <div className="mt-1 flex items-center gap-2">
                    <TeamChip id={t.team_id} />
                    <span className="font-mono text-[10px] text-white/45">{t.agent_id} · {t.etapa}</span>
                  </div>
                </div>
                <SeeWork id={t.id} />
              </Card>
            )
          }} />
        )}
        {(f === 'all' || f === 'waiting') && (
          <Group title="Aguardando você" items={by('waiting')} render={(t) => (
            <Card key={t.id} task={t} highlight>
              <span className="grid h-12 w-12 place-items-center rounded-full bg-amber-400/15 text-xl">⏳</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{t.titulo}</div>
                <div className="mt-1 flex items-center gap-2"><TeamChip id={t.team_id} /><span className="font-mono text-[10px] text-white/45">{t.etapa} · {ago(t.updated_at)}</span></div>
              </div>
              <SeeWork id={t.id} />
              {t.payload?.scenes ? (
                <button onClick={(e) => { e.stopPropagation(); set({ reviewTask: t.id }) }} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-bold ring-1 ring-white/20 hover:bg-white/20">Revisar</button>
              ) : (
                <button onClick={(e) => { e.stopPropagation(); decide(t.id, 'approved') }} className="rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-bold text-night-950 shadow-[0_0_18px_#fbbf2466] hover:bg-amber-300">Aprovar</button>
              )}
            </Card>
          )} />
        )}
        {f === 'all' && (
          <Group title="Fila, esperando e atrasos" items={tasks.filter((t) => ['na_fila', 'waiting_upstream', 'atrasado', 'error'].includes(t.status))} render={(t) => (
            <Card key={t.id} task={t}>
              <span className="grid h-12 w-12 place-items-center rounded-full bg-white/10 text-xl">{({ na_fila: '📥', waiting_upstream: '⏳', atrasado: '⏰', error: '⚠️' } as Record<string, string>)[t.status]}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{t.titulo}</div>
                <div className="mt-1 flex items-center gap-2"><TeamChip id={t.team_id} /><span className="font-mono text-[10px] text-white/45">{statusPt(t.status)} · {ago(t.updated_at)}</span></div>
              </div>
              <SeeWork id={t.id} />
            </Card>
          )} />
        )}
        {(f === 'all' || f === 'done') && (
          <Group title="Concluídas hoje" items={by('done')} render={(t) => (
            <Card key={t.id} task={t}>
              <span className="grid h-12 w-12 place-items-center rounded-full bg-emerald-400/15 text-xl text-emerald-300">✓</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{t.titulo}</div>
                <div className="mt-1 flex items-center gap-2"><TeamChip id={t.team_id} /><span className="font-mono text-[10px] text-white/45">{ago(t.updated_at)}{t.qa_score ? ` · QA ${t.qa_score}/10` : ''}</span></div>
              </div>
              <SeeWork id={t.id} />
              <DriveBtn t={t} />
            </Card>
          )} />
        )}
      </div>
    </Page>
  )
}

export function TeamChip({ id }: { id: string }) {
  const t = teamById(id)
  if (!t) return null
  return <span className="chip" style={{ borderColor: `${t.cor}88`, background: `${t.cor}22`, color: '#fff' }}>{t.icon} {t.nome}</span>
}

function Group({ title, items, render }: { title: string; items: Task[]; render: (t: Task) => React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-white/50">{title} <span className="font-mono">({items.length})</span></h3>
      {items.length ? <div className="grid gap-2 md:grid-cols-2">{items.map(render)}</div> : <p className="text-sm text-white/35">Nada aqui.</p>}
    </section>
  )
}

function SeeWork({ id }: { id: string }) {
  const set = useHQ((s) => s.set)
  return (
    <button onClick={(e) => { e.stopPropagation(); set({ detailTask: id }) }}
      className="whitespace-nowrap rounded-lg bg-white/10 px-2.5 py-1.5 text-xs font-bold ring-1 ring-white/20 hover:bg-white/20">👀 Ver trabalho</button>
  )
}

function DriveBtn({ t }: { t: Task }) {
  return (
    <a href={t.drive_url || driveSearch(t.titulo)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
      className="whitespace-nowrap rounded-lg bg-emerald-400 px-2.5 py-1.5 text-xs font-bold text-night-950 hover:bg-emerald-300">
      {t.drive_url ? '▶ Drive' : '🔎 Drive'}
    </a>
  )
}

function Card({ children, highlight, task }: { children: React.ReactNode; highlight?: boolean; task: Task }) {
  const set = useHQ((s) => s.set)
  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} onClick={() => set({ detailTask: task.id })}
      className={`flex cursor-pointer items-center gap-3 rounded-2xl bg-white/[.04] p-3 ring-1 transition hover:bg-white/[.08] ${highlight ? 'ring-amber-300/30' : 'ring-white/10'}`}>
      {children}
    </motion.div>
  )
}

export function Page({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <motion.main initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 z-10 overflow-y-auto px-4 pb-10 pt-24 scroll-thin md:px-10">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="mb-6 text-sm text-white/50">{subtitle}</p>
        {children}
      </div>
    </motion.main>
  )
}
