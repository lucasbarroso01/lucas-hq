import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { useHQ } from '../store'
import type { Agent, HQEvent, ScheduleItem, SkillRuntime, Task } from '../data/types'

// tolerate values pasted as NAME=value
const clean = (v?: string) => v?.trim().replace(/^[A-Z_]+=/, '') || undefined
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
  const [agents, tasks, events, schedule, skills, notes] = await Promise.all([
    supabase.from('agents').select('*'),
    supabase.from('tasks').select('*').order('updated_at', { ascending: false }).limit(200),
    supabase.from('events').select('*').order('ts', { ascending: false }).limit(100),
    supabase.from('schedule').select('*'),
    supabase.from('skills_runtime').select('*'),
    supabase.from('events').select('id', { count: 'exact', head: true }).eq('type', 'brain_write'),
  ])
  if (agents.error) { console.warn('[supabase]', agents.error.message); return false }
  hq.set({
    live: 'supabase',
    agents: agents.data?.length ? (agents.data as Agent[]) : hq.agents,
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
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'events' }, (p) => useHQ.getState().ingestEvent(p.new as HQEvent))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'schedule' }, async () => {
      const { data } = await supabase!.from('schedule').select('*')
      if (data) useHQ.getState().set({ schedule: data as ScheduleItem[] })
    })
    .subscribe()
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
