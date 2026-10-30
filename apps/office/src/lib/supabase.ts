import { ROOM_POS } from './layout'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { useHQ } from '../store'
import type { Agent, Approval, HQEvent, ScheduleItem, SkillRuntime, Task } from '../data/types'

// tolerate values pasted as NAME=value
const clean = (v?: string) => v?.trim().replace(/^[A-Z_]+=/, '').replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '') || undefined
const url = clean(import.meta.env.VITE_SUPABASE_URL)
const key = clean(import.meta.env.VITE_SUPABASE_ANON_KEY)

function makeClient(): SupabaseClient | null {
  if (!url || !key) return null
  try { return createClient(url, key) } catch (e) { console.warn('[supabase] invalid config, running local', e); return null }
}
export const supabase = makeClient()

/** Loads the current state from Supabase and keeps the store in sync through Realtime. */
export async function connectSupabase() {
  if (!supabase) return false
  try { return await load() } catch (e) { console.warn('[supabase] offline, running local', e); return false }
}

async function load() {
  if (!supabase) return false
  const hq = useHQ.getState()
  const [agents, tasks, events, schedule, skills, notes, approvals] = await Promise.all([
    supabase.from('agents').select('*'),
    supabase.from('tasks').select('*').order('updated_at', { ascending: false }).limit(1000),
    supabase.from('events').select('*').order('ts', { ascending: false }).limit(100),
    supabase.from('schedule').select('*'),
    supabase.from('skills_runtime').select('*'),
    supabase.from('events').select('id', { count: 'exact', head: true }).eq('type', 'brain_write'),
    supabase.from('approvals').select('*').order('ts', { ascending: true }).limit(1000),
  ])
  if (approvals.data) hq.set({ approvals: approvals.data as Approval[] })
  const ctl = await supabase.from('controle').select('*').eq('id', 'operacao').maybeSingle()
  if (ctl.data) hq.set({ pausa: { pausado: ctl.data.pausado, motivo: ctl.data.motivo, atualizado_em: ctl.data.atualizado_em },
    drive: { raiz: ctl.data.drive_raiz ?? undefined, dia: ctl.data.drive_dia ?? undefined, data: ctl.data.drive_dia_data ?? undefined } })
  if (agents.error) { console.warn('[supabase]', agents.error.message); return false }
  hq.set({
    live: 'supabase',
    // só agentes de salas que existem (o Funny Pets saiu do escritório em 30/10)
    agents: agents.data?.length ? (agents.data as Agent[]).filter((g) => g.team_id in ROOM_POS) : hq.agents,
    tasks: (tasks.data as Task[]) ?? [],
    events: (events.data as HQEvent[]) ?? [],
    schedule: schedule.data?.length ? (schedule.data as ScheduleItem[]) : hq.schedule,
    skills: skills.data?.length ? (skills.data as SkillRuntime[]) : hq.skills,
    brainNotes: notes.count ?? hq.brainNotes,
  })

  supabase
    .channel('hq')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, (p) => p.new && useHQ.getState().upsertTask(p.new as Task))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'agents' }, (p) => p.new && useHQ.getState().upsertAgent(p.new as Agent))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'skills_runtime' }, (p) => p.new && useHQ.getState().upsertSkill(p.new as SkillRuntime))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'controle' }, (p) => {
      const n = p.new as { pausado?: boolean; motivo?: string; atualizado_em?: string; drive_raiz?: string; drive_dia?: string; drive_dia_data?: string }
      if (n && 'pausado' in n) useHQ.getState().set({ pausa: { pausado: !!n.pausado, motivo: n.motivo ?? '', atualizado_em: n.atualizado_em },
        drive: { raiz: n.drive_raiz, dia: n.drive_dia, data: n.drive_dia_data } })
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'events' }, (p) => useHQ.getState().ingestEvent(p.new as HQEvent))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'schedule' }, async () => {
      const { data } = await supabase!.from('schedule').select('*')
      if (data) useHQ.getState().set({ schedule: data as ScheduleItem[] })
    })
    .subscribe((status, err) => console.info('[supabase] realtime', status, err?.message ?? ''))
  return true
}

/** The Approve / Review buttons write here; agents poll `approvals` and continue. */
export async function decide(task_id: string, decision: 'approved' | 'changes', feedback = '') {
  const ts = new Date().toISOString()
  const hq = useHQ.getState()
  hq.set({ approvals: [...hq.approvals, { task_id, decision, feedback, ts }] })
  const task = hq.tasks.find((t) => t.id === task_id)
  if (task) hq.upsertTask({ ...task, status: decision === 'approved' ? 'running' : 'waiting', etapa: decision === 'approved' ? 'APROVADO' : 'AJUSTES', updated_at: ts })
  hq.pushToast(task?.team_id ?? null, decision === 'approved' ? `Aprovado · ${task?.titulo}` : `Ajustes enviados · ${task?.titulo}`)
  if (supabase) {
    const { error } = await supabase.from('approvals').insert({ task_id, decision, feedback })
    if (error) console.warn('[supabase] approval', error.message)
  }
}

/** Botão "marcar como postado" da Agenda (a chave anon só pode mudar o status do post). */
export async function markPosted(id: string) {
  const hq = useHQ.getState()
  const item = hq.schedule.find((s) => s.id === id)
  hq.set({ schedule: hq.schedule.map((s) => (s.id === id ? { ...s, status: 'postado' } : s)) })
  hq.pushToast(null, `Postado · ${item?.titulo ?? ''} · ${item?.pagina ?? ''}`)
  if (supabase) {
    const { error } = await supabase.from('schedule').update({ status: 'postado' }).eq('id', id)
    if (error) console.warn('[supabase] schedule', error.message)
  }
}

/** Botão "Pausar operação": nenhum turno começa e a produção para antes do render até retomar. */
export async function setPausa(pausado: boolean, motivo = '') {
  const hq = useHQ.getState()
  const atualizado_em = new Date().toISOString()
  hq.set({ pausa: { pausado, motivo: pausado ? motivo : '', atualizado_em } })
  hq.pushToast(null, pausado ? `Operação pausada${motivo ? ` · ${motivo}` : ''}` : 'Operação retomada · os turnos perdidos rodam agora')
  if (supabase) {
    const { error } = await supabase.from('controle').update({ pausado, motivo: pausado ? motivo : '', atualizado_em }).eq('id', 'operacao')
    if (error) { console.warn('[supabase] pausa', error.message); hq.pushToast(null, 'Não consegui gravar a pausa: rode supabase/pausa.sql') }
  }
}
