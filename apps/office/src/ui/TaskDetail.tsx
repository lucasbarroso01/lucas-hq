import { AnimatePresence, motion } from 'framer-motion'
import { useHQ, teamById } from '../store'
import { WF_STEPS } from '../lib/demo'
import { decide } from '../lib/supabase'
import { Ring, ago } from './bits'
import { TeamChip } from './TasksView'
import type { HQEvent, Task } from '../data/types'

export const driveSearch = (q: string) => `https://drive.google.com/drive/search?q=${encodeURIComponent(q)}`

const LABEL: Record<HQEvent['type'], [string, string]> = {
  tool_run: ['etapa', 'text-sky-300'],
  handoff: ['passou', 'text-amber-300'],
  brain_read: ['leu memória', 'text-cyan-300'],
  brain_write: ['escreveu memória', 'text-violet-300'],
  toast: ['aviso', 'text-white/60'],
}

/** Everything a task produced: steps, live log, notes, QA and the links to Drive. */
export function TaskDetail() {
  const { detailTask, tasks, events, set } = useHQ()
  const task = tasks.find((t) => t.id === detailTask)
  const close = () => set({ detailTask: null })
  return (
    <AnimatePresence>
      {task && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={close}>
          <motion.div initial={{ scale: 0.97, y: 10 }} animate={{ scale: 1, y: 0 }} onClick={(e) => e.stopPropagation()}
            className="glass flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl">
            <Body task={task} tasks={tasks} events={events} close={close} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function Body({ task, tasks, events, close }: { task: Task; tasks: Task[]; events: HQEvent[]; close: () => void }) {
  const set = useHQ((s) => s.set)
  const team = teamById(task.team_id)!
  const subs = tasks.filter((t) => t.parent_id === task.id).sort((a, b) => a.titulo.localeCompare(b.titulo))
  const ids = new Set([task.id, ...subs.map((s) => s.id)])
  const since = new Date(task.created_at).getTime() - 60_000
  const log = events.filter((e) =>
    e.payload.task ? ids.has(e.payload.task) : e.team_id === task.team_id && new Date(e.ts).getTime() >= since,
  ).slice(0, 60)
  const steps = task.team_id === 'producao-wf' ? WF_STEPS : null
  const stepIdx = steps ? steps.indexOf(task.etapa) : -1
  const folder = task.payload?.drive_folder

  return (
    <>
      <div className="relative px-5 pb-4 pt-5" style={{ background: `linear-gradient(135deg, ${team.cor}33, transparent 70%)` }}>
        <button onClick={close} className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-lg text-white/60 hover:bg-white/10">✕</button>
        <TeamChip id={task.team_id} />
        <div className="mt-2 flex items-center gap-4">
          {task.status === 'done' ? <span className="grid h-14 w-14 place-items-center rounded-full bg-emerald-400/15 text-2xl text-emerald-300">✓</span>
            : <Ring value={task.progress} color={team.cor} size={56} />}
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold">{task.titulo}</h2>
            <p className="font-mono text-[11px] text-white/55">
              {task.agent_id ?? '—'} · {task.etapa || '—'} · {statusPt(task.status)} · atualizado {ago(task.updated_at)}
              {task.qa_score != null && <> · <span className="text-emerald-300">QA {task.qa_score}/10</span></>}
            </p>
          </div>
        </div>
        {steps && (
          <div className="mt-3 flex gap-1">
            {steps.map((s, j) => (
              <span key={s} className="chip" style={j <= stepIdx || task.status === 'done' ? { background: `${team.cor}33`, borderColor: team.cor, color: '#fff' } : { borderColor: '#ffffff1a', color: '#ffffff55' }}>{s}</span>
            ))}
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          {task.drive_url ? (
            <a href={task.drive_url} target="_blank" rel="noreferrer" className="rounded-lg bg-emerald-400 px-3 py-1.5 text-xs font-bold text-night-950 hover:bg-emerald-300">▶ Abrir vídeo no Drive</a>
          ) : (
            <a href={driveSearch(task.titulo.replace(/\s*\(.*\)$/, ''))} target="_blank" rel="noreferrer" className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-bold ring-1 ring-white/20 hover:bg-white/20">🔎 Procurar no Drive</a>
          )}
          {folder && <a href={folder} target="_blank" rel="noreferrer" className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-bold ring-1 ring-white/20 hover:bg-white/20">📁 Pasta do dia</a>}
          <button onClick={() => { set({ detailTask: null, view: 'office', selectedTeam: task.team_id }) }}
            className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-bold ring-1 ring-white/20 hover:bg-white/20">👀 Ver no escritório</button>
          {task.status === 'waiting' && (
            task.payload?.scenes
              ? <button onClick={() => set({ detailTask: null, reviewTask: task.id })} className="rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-bold text-night-950">Revisar cenas</button>
              : <button onClick={() => { decide(task.id, 'approved'); close() }} className="rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-bold text-night-950 hover:bg-amber-300">Aprovar</button>
          )}
        </div>
      </div>

      <div className="grid flex-1 gap-5 overflow-y-auto px-5 pb-6 pt-4 scroll-thin md:grid-cols-[1fr_1fr]">
        <section>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/50">Trabalho ao vivo <span className="animate-pulse text-emerald-300">●</span></h3>
          {log.length === 0 && <p className="text-sm text-white/40">Nenhum registro ainda. Os passos aparecem aqui conforme os agentes rodam.</p>}
          <ol className="space-y-1.5">
            {log.map((e) => {
              const [label, cls] = LABEL[e.type]
              const text = e.type === 'handoff' ? `${e.payload.text ?? ''} → ${teamById(e.payload.to_team)?.nome ?? e.payload.to_team}` : (e.payload.text ?? e.payload.note ?? e.payload.tool ?? '')
              return (
                <li key={e.id} className="rounded-lg bg-white/5 px-2.5 py-1.5 ring-1 ring-white/5">
                  <div className="flex items-center gap-1.5 font-mono text-[10px]">
                    <span className={cls}>{label}</span>
                    {e.agent_id && <span className="text-white/50">· {e.agent_id}</span>}
                    <span className="ml-auto text-white/35">{new Date(e.ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                  </div>
                  <div className="text-[12px] text-white/85">{text}</div>
                </li>
              )
            })}
          </ol>
        </section>
        <section className="space-y-4">
          {subs.length > 0 && (
            <div>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/50">Vídeos ({subs.length})</h3>
              <div className="space-y-1.5">
                {subs.map((s) => (
                  <button key={s.id} onClick={() => set({ detailTask: s.id })} className="flex w-full items-center gap-2 rounded-lg bg-white/5 px-2.5 py-1.5 text-left ring-1 ring-white/5 hover:bg-white/10">
                    <span className="font-mono text-[11px]">{s.titulo}</span>
                    <span className="ml-auto font-mono text-[10px] text-white/45">{s.status === 'done' ? '✓' : `${Math.round(s.progress)}%`} · {s.etapa}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/50">Notas do agente</h3>
            {task.payload?.notes
              ? <pre className="whitespace-pre-wrap rounded-lg bg-black/25 p-3 font-sans text-[12.5px] leading-relaxed text-white/85 ring-1 ring-white/10">{task.payload.notes}</pre>
              : <p className="text-sm text-white/40">Sem notas ainda (título, gancho, duração e legenda aparecem aqui quando o editor terminar).</p>}
          </div>
          {task.payload?.scenes && (
            <div>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/50">Cenas</h3>
              <ol className="space-y-1.5">{task.payload.scenes.map((s, i) => <li key={i} className="rounded-lg bg-white/5 px-2.5 py-1.5 text-[12px] ring-1 ring-white/5">{s}</li>)}</ol>
            </div>
          )}
        </section>
      </div>
    </>
  )
}

export const statusPt = (s: Task['status']) => ({
  na_fila: 'na fila', running: 'rodando', waiting: 'aguardando você', waiting_upstream: 'esperando etapa anterior',
  done: 'concluída', error: 'erro', atrasado: 'atrasada',
})[s]
