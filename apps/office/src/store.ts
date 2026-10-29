import { create } from 'zustand'
import { AGENTS, BRAIN_NOTES, SCHEDULE, SKILLS, TASKS, TEAMS } from './data/seed'
import type { Agent, Approval, HQEvent, Operation, ScheduleItem, SkillRuntime, Task, Team } from './data/types'

export type View = 'office' | 'tasks' | 'agenda' | 'brain'

export interface Walker { id: string; from: string; to: string; color: string; born: number }
export interface Pulse { id: string; team_id: string; dir: 'in' | 'out'; born: number }
export interface Toast { id: string; team_id: string | null; text: string; born: number }

interface State {
  teams: Team[]
  agents: Agent[]
  tasks: Task[]
  events: HQEvent[]
  approvals: Approval[]
  schedule: ScheduleItem[]
  skills: SkillRuntime[]
  brainNotes: number
  brainToday: number
  brainFlash: number

  view: View
  operation: 'all' | Operation
  selectedTeam: string | null
  reviewTask: string | null
  detailTask: string | null
  live: 'supabase' | 'demo' | 'local'
  camera: { x: number; z: number; zoom: number }
  pausa: { pausado: boolean; motivo: string; atualizado_em?: string }
  drive: { raiz?: string; dia?: string; data?: string }

  walkers: Walker[]
  pulses: Pulse[]
  toasts: Toast[]
  unread: number

  set: (p: Partial<State>) => void
  upsertTask: (t: Task) => void
  upsertAgent: (a: Agent) => void
  upsertSkill: (s: SkillRuntime) => void
  ingestEvent: (e: HQEvent) => void
  pushToast: (team_id: string | null, text: string) => void
}

let n = 0
const uid = () => `${Date.now().toString(36)}-${(n++).toString(36)}`

export const useHQ = create<State>((set, get) => ({
  teams: TEAMS,
  agents: AGENTS,
  tasks: TASKS,
  events: [],
  approvals: [],
  schedule: SCHEDULE,
  skills: SKILLS,
  brainNotes: BRAIN_NOTES,
  brainToday: 0,
  brainFlash: 0,

  view: 'office',
  operation: 'all',
  selectedTeam: null,
  reviewTask: null,
  detailTask: null,
  live: 'local',
  camera: { x: 0, z: 0, zoom: 1 },
  pausa: { pausado: false, motivo: '' },
  drive: {},

  walkers: [],
  pulses: [],
  toasts: [],
  unread: 0,

  set: (p) => set(p),
  upsertTask: (t) => set((s) => {
    const i = s.tasks.findIndex((x) => x.id === t.id)
    const tasks = i < 0 ? [t, ...s.tasks] : s.tasks.map((x) => (x.id === t.id ? { ...x, ...t } : x))
    return { tasks }
  }),
  upsertAgent: (a) => set((s) => {
    const i = s.agents.findIndex((x) => x.id === a.id)
    return { agents: i < 0 ? [...s.agents, a] : s.agents.map((x) => (x.id === a.id ? { ...x, ...a } : x)) }
  }),
  upsertSkill: (k) => set((s) => {
    const i = s.skills.findIndex((x) => x.team_id === k.team_id && x.skill === k.skill)
    return { skills: i < 0 ? [...s.skills, k] : s.skills.map((x, j) => (j === i ? k : x)) }
  }),
  ingestEvent: (e) => {
    const now = performance.now()
    set((s) => ({ events: [e, ...s.events].slice(0, 200) }))
    const team = e.team_id
    if ((e.type === 'brain_read' || e.type === 'brain_write') && team) {
      set((s) => ({
        pulses: [...s.pulses.filter((p) => now - p.born < 4000), { id: uid(), team_id: team, dir: e.type === 'brain_write' ? 'in' : 'out', born: now }],
        brainNotes: s.brainNotes + (e.type === 'brain_write' ? 1 : 0),
        brainToday: s.brainToday + (e.type === 'brain_write' ? 1 : 0),
        brainFlash: now,
      }))
    }
    if (e.type === 'handoff' && team && e.payload.to_team) {
      const color = get().teams.find((t) => t.id === team)?.cor ?? '#fff'
      set((s) => ({ walkers: [...s.walkers.filter((w) => now - w.born < 20000), { id: uid(), from: team, to: e.payload.to_team!, color, born: now }] }))
    }
    if (e.type === 'toast' || e.type === 'handoff') {
      const text = e.payload.text ?? ''
      if (text) get().pushToast(team, text)
    }
  },
  pushToast: (team_id, text) => {
    const t = { id: uid(), team_id, text, born: Date.now() }
    set((s) => ({ toasts: [t, ...s.toasts].slice(0, 4), unread: s.unread + 1 }))
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== t.id) })), 5200)
  },
}))

export const teamById = (id: string | null | undefined) => TEAMS.find((t) => t.id === id)
