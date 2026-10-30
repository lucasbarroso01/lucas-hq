import * as React from 'react'
import { CheckCircle2, CircleAlert, Clock3, Film, Brain, ArrowRightLeft, Wrench, ThumbsUp, ThumbsDown, Loader2 } from 'lucide-react'
import { CardFace, EASE, Pills, Tile, cx, smooth, useCountUp, useMounted, useReducedMotion } from '@/components/ui/web3-bento'
import { useHQ } from '../store'
import { UploadReferencia } from './UploadReferencia'
import { EXP, toMin } from '../lib/expediente'
import type { HQEvent, Task } from '../data/types'

/* Painel: tudo o que o escritório fez, em números. Layout e peças do bento (components/ui/web3-bento). */

const ACC = 'oklch(0.86 0.16 85)'   // âmbar: produção, aprovado
const ACC2 = 'oklch(0.7 0.17 25)'   // coral: erro, devolvido
const DIA = 86400000
type Janela = '7d' | '30d' | 'Tudo'

const dayKey = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
const nowBR = () => new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
const fmtN = (v: number, d = 0) => v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })
const ago = (iso: string) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  return m < 1 ? 'agora' : m < 60 ? `${m} min` : m < 1440 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} d`
}
const isVideo = (t: Task) => t.team_id === 'producao-wf' || /wf|worldframe/i.test(t.titulo)

function lastDays(n: number) {
  const out: string[] = []
  for (let i = n - 1; i >= 0; i--) out.push(dayKey(new Date(Date.now() - i * DIA)))
  return out
}

/* ---------- Hero: saudação + entregas + faixa dos 30 dias ---------- */
function HeroTile({ tasks }: { tasks: Task[] }) {
  const reduced = useReducedMotion()
  const mounted = useMounted()
  const days = lastDays(30)
  const per = days.map((d) => ({
    ok: tasks.filter((t) => t.status === 'done' && dayKey(new Date(t.updated_at)) === d).length,
    err: tasks.filter((t) => t.status === 'error' && dayKey(new Date(t.updated_at)) === d).length,
  }))
  const max = Math.max(1, ...per.map((p) => p.ok + p.err))
  const videos = tasks.filter((t) => isVideo(t) && t.status === 'done').length
  const shown = useCountUp(videos, !reduced)
  const total = per.reduce((s, p) => s + p.ok, 0)
  const erros = per.reduce((s, p) => s + p.err, 0)
  const [hover, setHover] = React.useState<number | null>(null)
  const h = nowBR().getHours()
  const saud = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
  const label = (i: number) => new Date(days[i] + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })

  return (
    <Tile className="sm:col-span-2 lg:col-span-2 lg:col-start-1 lg:row-start-1">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0">
          <p className="text-[28px] font-semibold leading-[1.1] tracking-[-0.03em] sm:text-[34px]">
            {saud}, <span style={{ color: ACC }}>Lucas</span>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">O que o escritório entregou nos últimos 30 dias.</p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-[12px] text-muted-foreground">Vídeos produzidos</p>
          <p className="font-mono text-[34px] font-semibold leading-none tracking-[-0.04em] tabular-nums sm:text-[40px]">{fmtN(Math.round(shown))}</p>
          <p className="mt-1.5 font-mono text-[12px] tabular-nums">
            <span style={{ color: ACC }}>{fmtN(total)} tarefas concluídas</span>
            <span className="text-muted-foreground"> · </span>
            <span style={{ color: ACC2 }}>{fmtN(erros)} erros</span>
          </p>
        </div>
      </div>
      <div className="mt-6 flex flex-1 flex-col">
        <div className="flex flex-1 items-end gap-[3px]" style={{ minHeight: 64 }} onPointerLeave={() => setHover(null)}>
          {per.map((p, i) => {
            const v = p.ok + p.err
            return (
              <button key={i} type="button" onPointerEnter={() => setHover(i)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}
                aria-label={`${label(i)}: ${p.ok} concluídas, ${p.err} erros`}
                className="relative flex flex-1 flex-col justify-end overflow-hidden rounded-[4px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                style={{ height: mounted ? `${8 + (v / max) * 92}%` : '6%', opacity: hover === null ? 0.45 + (v / max) * 0.55 : hover === i ? 1 : 0.25,
                  transition: `height 900ms ${EASE} ${i * 18}ms, opacity 200ms ease`, background: v ? undefined : 'var(--color-muted)' }}>
                {v > 0 && <span style={{ height: `${(p.err / v) * 100}%`, background: ACC2 }} />}
                {v > 0 && <span style={{ height: `${(p.ok / v) * 100}%`, background: ACC }} />}
              </button>
            )
          })}
        </div>
        <div className="mt-2 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
          <span>{label(0)}</span>
          <span className="text-foreground" aria-live="polite">
            {hover !== null ? `${label(hover)} · ${per[hover].ok} feitas · ${per[hover].err} erros` : 'Tarefas por dia'}
          </span>
          <span>Hoje</span>
        </div>
      </div>
    </Tile>
  )
}

/* ---------- Operações: pilha de cartões ---------- */
function OperacoesTile({ tasks, events }: { tasks: Task[]; events: HQEvent[] }) {
  const reduced = useReducedMotion()
  const mounted = useMounted()
  const pad = (n: number) => String(n).padStart(4, '0')
  const cards = [
    { id: 'b2b', label: 'Agência Lucas', last4: pad(tasks.filter((t) => t.operacao === 'agencia-lucas').length), holder: 'Briefings e roteiros B2B',
      balance: `${tasks.filter((t) => t.operacao === 'agencia-lucas' && t.status === 'done').length} entregues`, color: 'oklch(0.8 0.1 300)', color2: 'oklch(0.64 0.15 285)', ink: 'oklch(0.2 0.06 290)' },
    { id: 'acervo', label: 'Acervo de Virais', last4: pad(events.filter((e) => e.team_id === 'acervo').length), holder: 'Referências fichadas',
      balance: `${tasks.filter((t) => t.team_id === 'acervo' && t.status === 'done').length} rodadas`, color: 'oklch(0.82 0.11 55)', color2: 'oklch(0.7 0.15 30)', ink: 'oklch(0.25 0.05 40)' },
    { id: 'wf', label: 'Worldframe', last4: pad(tasks.filter(isVideo).length), holder: '5 vídeos por dia',
      balance: `${tasks.filter((t) => isVideo(t) && t.status === 'done').length} vídeos`, color: ACC, color2: 'oklch(0.74 0.16 55)', ink: 'oklch(0.24 0.05 70)' },
  ]
  const [order, setOrder] = React.useState(() => cards.map((c) => c.id))
  const PEEK = 46, depth = order.length - 1
  const front = cards.find((c) => c.id === order[order.length - 1])!
  return (
    <Tile title={<span>Operações <sup className="font-mono text-[10px]">{cards.length}</sup></span>} className="lg:col-start-3 lg:row-start-1">
      <div className="relative -mx-5 -mb-5 flex flex-1 flex-col justify-end overflow-hidden pt-1">
        <div className="relative">
          {order.map((id, pos) => {
            const c = cards.find((x) => x.id === id)!
            const fromFront = order.length - 1 - pos, isFront = fromFront === 0
            return (
              <button key={id} type="button" onClick={() => !isFront && setOrder((o) => [...o.filter((x) => x !== id), id])}
                aria-label={`${c.label}${isFront ? ', selecionado' : ', trazer para frente'}`} aria-pressed={isFront}
                className="absolute left-1/2 block w-[calc(100%-32px)] max-w-[300px] rounded-[12px] p-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                style={{ top: (depth - fromFront) * PEEK, zIndex: pos + 1, transform: `translateX(-50%) scale(${1 - fromFront * 0.055}) translateY(${mounted ? 0 : 20}px)`,
                  transformOrigin: 'top center', opacity: mounted ? 1 : 0, color: c.ink, boxShadow: '0 -10px 28px -14px oklch(0 0 0 / 0.75)',
                  transition: reduced ? 'none' : `top 650ms cubic-bezier(0.34, 1.35, 0.64, 1), transform 650ms cubic-bezier(0.34, 1.35, 0.64, 1), opacity 500ms ease ${pos * 90}ms`,
                  cursor: isFront ? 'default' : 'pointer' }}>
                <span className="relative block w-full" style={{ paddingTop: '63.08%' }}>
                  <span className="absolute inset-0 block"><CardFace c={c} glare={30 + fromFront * 18} /></span>
                </span>
              </button>
            )
          })}
          <div aria-hidden className="invisible mx-auto w-[calc(100%-32px)] max-w-[300px]" style={{ marginTop: depth * PEEK }}><div style={{ paddingTop: '30%' }} /></div>
        </div>
        <div className="relative z-10 flex shrink-0 items-end justify-between gap-3 px-5 pb-4" aria-live="polite"
          style={{ height: 88, background: 'color-mix(in oklch, var(--color-card) 72%, transparent)', backdropFilter: 'blur(18px) saturate(1.3)',
            borderTop: '1px solid color-mix(in oklch, var(--color-foreground) 10%, transparent)' }}>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold">{front.label}</p>
            <p className="mt-1 truncate text-[11px] text-muted-foreground">{front.holder} · {Number(front.last4)} tarefas</p>
          </div>
          <p className="shrink-0 font-mono text-[15px] font-semibold tabular-nums">{front.balance}</p>
        </div>
      </div>
    </Tile>
  )
}

/* ---------- Qualidade: nota média do QA (medidor) ---------- */
function QualidadeTile({ tasks }: { tasks: Task[] }) {
  const [j, setJ] = React.useState<Janela>('30d')
  const corte = j === 'Tudo' ? 0 : Date.now() - (j === '7d' ? 7 : 30) * DIA
  const notas = tasks.filter((t) => t.qa_score != null && new Date(t.updated_at).getTime() >= corte).map((t) => t.qa_score as number)
  const media = notas.length ? notas.reduce((s, n) => s + n, 0) / notas.length : 0
  const t = media / 10, len = Math.PI * 62, angle = -90 + t * 180
  const aprov = notas.filter((n) => n >= 8).length
  return (
    <Tile title="Qualidade (QA)" className="lg:col-start-4 lg:row-start-1" action={<span className="font-mono text-[11px] text-muted-foreground">{notas.length} notas</span>}>
      <div className="flex flex-1 flex-col items-center justify-center">
        <svg width="150" height="86" viewBox="0 0 150 86" aria-hidden>
          <path d="M 13 78 A 62 62 0 0 1 137 78" fill="none" strokeWidth="10" strokeLinecap="round" style={{ stroke: 'var(--color-muted)' }} />
          <path d="M 13 78 A 62 62 0 0 1 137 78" fill="none" strokeWidth="10" strokeLinecap="round" strokeDasharray={len}
            style={{ stroke: media >= 8 ? ACC : ACC2, strokeDashoffset: len * (1 - t), transition: `stroke-dashoffset 900ms ${EASE}` }} />
          <g style={{ transform: `rotate(${angle}deg)`, transformOrigin: '75px 78px', transition: `transform 900ms ${EASE}` }}>
            <line x1="75" y1="78" x2="75" y2="30" strokeWidth="2.5" strokeLinecap="round" style={{ stroke: 'var(--color-foreground)' }} />
          </g>
          <circle cx="75" cy="78" r="5" style={{ fill: 'var(--color-foreground)' }} />
        </svg>
        <p className="mt-2 font-mono text-[26px] font-semibold leading-none tabular-nums">{notas.length ? fmtN(media, 1) : '–'} <span className="text-sm text-muted-foreground">/ 10</span></p>
        <p className="mt-1 font-mono text-[11px] tabular-nums text-muted-foreground">{aprov} aprovados · {notas.length - aprov} devolvidos</p>
      </div>
      <div className="mt-4 flex justify-center"><Pills label="Janela" value={j} options={['7d', '30d', 'Tudo']} onChange={setJ} /></div>
    </Tile>
  )
}

/* ---------- Produção acumulada vs meta ---------- */
function ProducaoTile({ tasks }: { tasks: Task[] }) {
  const uid = React.useId().replace(/:/g, '')
  const reduced = useReducedMotion()
  const mounted = useMounted()
  const [j, setJ] = React.useState<'7d' | '30d'>('30d')
  const [hover, setHover] = React.useState<number | null>(null)
  const meta = EXP.paginas.Worldframe.posts.length
  const days = lastDays(j === '7d' ? 7 : 30)
  let acc = 0
  const a = days.map((d) => (acc += tasks.filter((t) => isVideo(t) && t.status === 'done' && dayKey(new Date(t.updated_at)) === d).length))
  // meta conta só a partir do primeiro dia com produção (o escritório começou no meio do período)
  const ini = Math.max(0, a.findIndex((v) => v > 0))
  const b = days.map((_, i) => Math.max(0, i - ini + 1) * meta)
  const W = 640, H = 220, hi = Math.max(1, ...a, ...b)
  const y = (v: number) => H - 16 - (v / hi) * (H - 40)
  const pa = a.map((v, i) => [(i / (a.length - 1)) * W, y(v)] as const)
  const pb = b.map((v, i) => [(i / (b.length - 1)) * W, y(v)] as const)
  const idx = hover ?? a.length - 1
  const pct = b[b.length - 1] ? (a[a.length - 1] / b[b.length - 1]) * 100 : 0
  const left = `${(pa[idx][0] / W) * 100}%`
  return (
    <Tile title="Vídeos produzidos vs meta" className="sm:col-span-2 lg:col-span-2 lg:col-start-1 lg:row-span-2 lg:row-start-2"
      action={<Pills label="Período" value={j} options={['7d', '30d']} onChange={setJ} />}>
      <div className="flex flex-wrap items-end gap-x-8 gap-y-2">
        <div>
          <p className="flex items-center gap-2 text-[12px] text-muted-foreground"><span className="h-[3px] w-4 rounded-full" style={{ background: ACC }} />Produzidos</p>
          <p className="mt-1 font-mono text-[22px] font-semibold tabular-nums">{fmtN(a[idx])}</p>
        </div>
        <div>
          <p className="flex items-center gap-2 text-[12px] text-muted-foreground"><span className="h-0 w-4 border-t-2 border-dashed border-muted-foreground" />Meta ({meta}/dia)</p>
          <p className="mt-1 font-mono text-[22px] font-semibold tabular-nums text-muted-foreground">{fmtN(b[idx])}</p>
        </div>
        <span className="ml-auto rounded-full px-2.5 py-1 font-mono text-[11px] font-semibold tabular-nums"
          style={{ background: `color-mix(in oklch, ${pct >= 90 ? ACC : ACC2} 18%, transparent)`, color: pct >= 90 ? ACC : ACC2 }}>
          {fmtN(pct)}% da meta
        </span>
      </div>
      <div className="relative mt-4 flex-1 touch-pan-y" style={{ minHeight: 220 }}
        onPointerMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); setHover(Math.max(0, Math.min(a.length - 1, Math.round(((e.clientX - r.left) / r.width) * (a.length - 1))))) }}
        onPointerLeave={() => setHover(null)} role="img" aria-label={`${a[a.length - 1]} vídeos de ${b[b.length - 1]} da meta`}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
          <defs><linearGradient id={`${uid}-f`} x1="0" x2="0" y1="0" y2="1"><stop offset="0" style={{ stopColor: ACC, stopOpacity: 0.28 }} /><stop offset="1" style={{ stopColor: ACC, stopOpacity: 0 }} /></linearGradient></defs>
          {[0.25, 0.5, 0.75].map((f) => <line key={f} x1={0} x2={W} y1={H * f} y2={H * f} vectorEffect="non-scaling-stroke" strokeDasharray="1 5" style={{ stroke: 'var(--color-border)' }} />)}
          <path d={`${smooth(pa)} L ${W} ${H} L 0 ${H} Z`} fill={`url(#${uid}-f)`} style={{ opacity: mounted ? 1 : 0, transition: 'opacity 900ms ease 400ms' }} />
          <path d={smooth(pb)} fill="none" strokeWidth={1.5} strokeDasharray="4 5" vectorEffect="non-scaling-stroke" style={{ stroke: 'var(--color-muted-foreground)' }} />
          <path key={j} d={smooth(pa)} fill="none" strokeWidth={2.5} strokeLinecap="round" vectorEffect="non-scaling-stroke" pathLength={1}
            style={{ stroke: ACC, strokeDasharray: 1, strokeDashoffset: mounted || reduced ? 0 : 1, transition: reduced ? 'none' : `stroke-dashoffset 1300ms ${EASE}` }} />
        </svg>
        <span aria-hidden className="pointer-events-none absolute inset-y-0 w-px -translate-x-1/2 bg-border" style={{ left, opacity: hover !== null ? 1 : 0 }} />
        <span aria-hidden className="pointer-events-none absolute size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-card" style={{ left, top: `${(pa[idx][1] / H) * 100}%`, background: ACC }} />
      </div>
      <div className="mt-3 flex justify-between font-mono text-[11px] text-muted-foreground" aria-hidden>
        <span>{new Date(days[0] + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</span>
        <span>{hover !== null ? new Date(days[hover] + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : ''}</span>
        <span>Hoje</span>
      </div>
    </Tile>
  )
}

/* ---------- Trabalho por time ---------- */
function TimesTile({ tasks }: { tasks: Task[] }) {
  const mounted = useMounted()
  const teams = useHQ((s) => s.teams)
  const rows = teams.map((t) => ({ id: t.id, nome: t.nome, cor: t.cor, v: tasks.filter((x) => x.team_id === t.id).length })).filter((r) => r.v).sort((a, b) => b.v - a.v)
  const total = rows.reduce((s, r) => s + r.v, 0) || 1
  const [hover, setHover] = React.useState<number | null>(null)
  return (
    <Tile title="Tarefas por time" className="lg:col-start-3 lg:row-start-2">
      <p className="font-mono text-[22px] font-semibold tabular-nums">{fmtN(total)} <span className="text-[13px] font-normal text-muted-foreground">tarefas</span></p>
      <div className="mt-4 flex h-9 gap-1" onPointerLeave={() => setHover(null)}>
        {rows.map((r, i) => (
          <span key={r.id} onPointerEnter={() => setHover(i)} className="rounded-[8px]" aria-hidden
            style={{ flexBasis: mounted ? `${(r.v / total) * 100}%` : `${100 / rows.length}%`, background: r.cor, opacity: hover === null || hover === i ? 1 : 0.3,
              transition: `flex-basis 1000ms ${EASE} ${200 + i * 60}ms, opacity 200ms ease` }} />
        ))}
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2">
        {rows.slice(0, 8).map((r, i) => (
          <li key={r.id} className="flex items-center justify-between gap-2 text-[12px]" onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}>
            <span className="flex min-w-0 items-center gap-2"><span className="size-2 shrink-0 rounded-full" style={{ background: r.cor }} /><span className="truncate">{r.nome}</span></span>
            <span className="font-mono tabular-nums text-muted-foreground">{r.v}</span>
          </li>
        ))}
      </ul>
    </Tile>
  )
}

/* ---------- Aprovações (cartão de destaque) ---------- */
function AprovacoesTile({ tasks }: { tasks: Task[] }) {
  const { approvals, schedule } = useHQ()
  const ok = approvals.filter((a) => a.decision === 'approved').length
  const dev = approvals.filter((a) => a.decision === 'changes').length
  const taxa = ok + dev ? (ok / (ok + dev)) * 100 : 0
  const esperando = tasks.filter((t) => t.status === 'waiting').length
  const ink = 'oklch(0.24 0.05 70)'
  // próximo post de hoje
  const agora = nowBR(), hoje = dayKey(new Date()), min = agora.getHours() * 60 + agora.getMinutes()
  const prox = schedule.filter((s) => s.data === hoje && toMin(s.horario) > min).sort((a, b) => toMin(a.horario) - toMin(b.horario))[0]
  const falta = prox ? toMin(prox.horario) - min : 0
  const [seg, setSeg] = React.useState(0)
  React.useEffect(() => { const id = window.setInterval(() => setSeg((s) => (s + 1) % 60), 1000); return () => window.clearInterval(id) }, [])
  const dias = lastDays(10).map((d) => approvals.filter((a) => a.decision === 'approved' && dayKey(new Date(a.ts)) === d).length)
  const mx = Math.max(1, ...dias)
  const postados = schedule.filter((s) => s.status === 'postado').length
  return (
    <section className="relative flex min-w-0 flex-col overflow-hidden rounded-[26px] p-5 lg:col-start-4 lg:row-span-2 lg:row-start-2" style={{ background: ACC, color: ink }}>
      <header className="flex items-center justify-between">
        <h3 className="text-[13px] font-semibold opacity-75">Aprovações</h3>
        <span className="flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[11px] font-semibold" style={{ background: 'oklch(0.24 0.05 70 / 0.12)' }}>
          <span className="size-1.5 rounded-full" style={{ background: ink }} />{esperando} esperando você
        </span>
      </header>
      <p className="mt-5 font-mono text-[52px] font-semibold leading-none tracking-[-0.05em] tabular-nums">{fmtN(taxa)}<span className="text-[22px]">%</span></p>
      <p className="mt-1 text-[12px] font-medium opacity-70">aprovados de primeira por você</p>
      <div className="mt-5 rounded-2xl p-3" style={{ background: 'oklch(0.24 0.05 70 / 0.1)' }}>
        <div className="flex items-baseline justify-between text-[12px] font-semibold">
          <span className="opacity-70">Próximo post</span>
          <span className="font-mono tabular-nums">{prox ? `${prox.horario} · em ${Math.floor(falta / 60)}h ${String(falta % 60).padStart(2, '0')}m` : 'amanhã'}</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full" style={{ background: 'oklch(0.24 0.05 70 / 0.14)' }}>
          <div className="h-full rounded-full" style={{ width: `${prox ? Math.max(4, 100 - (falta / 180) * 100) : 0}%`, background: ink, transition: 'width 1s linear' }} data-s={seg} />
        </div>
      </div>
      <dl className="mt-3 space-y-1.5 text-[12px]">
        {[['Aprovados', ok], ['Devolvidos com ajuste', dev], ['Posts publicados', postados]].map(([k, v]) => (
          <div key={k as string} className="flex justify-between"><dt className="opacity-70">{k}</dt><dd className="font-mono font-semibold tabular-nums">{v}</dd></div>
        ))}
      </dl>
      <div className="mt-auto pt-6">
        <div className="mt-5 flex h-12 items-end gap-1" aria-hidden>
          {dias.map((v, i) => <span key={i} className="flex-1 rounded-[4px]" style={{ height: `${8 + (v / mx) * 92}%`, background: ink, opacity: 0.15 + (i / dias.length) * 0.5 }} />)}
        </div>
        <p className="mt-1.5 font-mono text-[10px] opacity-60">Aprovações nos últimos 10 dias</p>
        <button type="button" onClick={() => useHQ.getState().set({ view: 'tasks' })}
          className="mt-4 w-full rounded-2xl py-3 text-sm font-semibold transition-transform active:scale-[0.98]" style={{ background: ink, color: ACC }}>
          {esperando ? `Revisar ${esperando} pendente${esperando > 1 ? 's' : ''}` : 'Nada esperando você'}
        </button>
      </div>
    </section>
  )
}

/* ---------- Expediente: faixa do dia com posts e agora ---------- */
function ExpedienteTile() {
  const schedule = useHQ((s) => s.schedule)
  const [, tick] = React.useState(0)
  React.useEffect(() => { const id = window.setInterval(() => tick((x) => x + 1), 30000); return () => window.clearInterval(id) }, [])
  const a = nowBR(), min = a.getHours() * 60 + a.getMinutes(), hoje = dayKey(new Date())
  const ini = toMin(EXP.silencio.fim), fim = toMin(EXP.silencio.inicio)
  const pos = (m: number) => ((m - 4 * 60) / (20 * 60)) * 100
  const silencio = min >= fim || min < ini
  const posts = schedule.filter((s) => s.data === hoje)
  return (
    <Tile title="Expediente de hoje" className="lg:col-start-3 lg:row-start-3"
      action={<span className="rounded-full px-2 py-0.5 font-mono text-[11px] font-semibold" style={{ background: `color-mix(in oklch, ${silencio ? ACC2 : ACC} 18%, transparent)`, color: silencio ? ACC2 : ACC }}>{silencio ? 'Silêncio' : 'Trabalhando'}</span>}>
      <p className="font-mono text-[22px] font-semibold tabular-nums">{a.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
      <p className="font-mono text-[11px] text-muted-foreground">{posts.length} posts hoje · {posts.filter((p) => p.status === 'postado').length} publicados</p>
      <div className="relative mt-6 h-10" role="img" aria-label="Faixa do expediente">
        <div className="absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 rounded-full bg-muted" />
        <div className="absolute top-1/2 h-10 -translate-y-1/2 rounded-[10px]"
          style={{ left: `${pos(ini)}%`, width: `${pos(fim) - pos(ini)}%`, background: `repeating-linear-gradient(135deg, color-mix(in oklch, ${ACC} 26%, transparent) 0 6px, color-mix(in oklch, ${ACC} 12%, transparent) 6px 12px)`,
            boxShadow: `inset 0 0 0 1px color-mix(in oklch, ${ACC} 55%, transparent)` }} />
        {posts.map((p) => (
          <span key={p.id} title={`${p.horario} · ${p.status}`} className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card"
            style={{ left: `${pos(toMin(p.horario))}%`, background: p.status === 'postado' ? ACC : p.status === 'atrasado' ? ACC2 : 'var(--color-foreground)' }} />
        ))}
        <div className="absolute top-1/2 h-14 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground" style={{ left: `${Math.max(1, Math.min(99, pos(min)))}%`, transition: `left 900ms ${EASE}` }} />
      </div>
      <div className="mt-2 flex justify-between font-mono text-[11px] tabular-nums text-muted-foreground"><span>04:00</span><span>14:00</span><span>24:00</span></div>
    </Tile>
  )
}

/* ---------- Movimento: eventos por hora ---------- */
function MovimentoTile({ events }: { events: HQEvent[] }) {
  const reduced = useReducedMotion()
  const horas = Array.from({ length: 24 }, (_, i) => {
    const a = Date.now() - (23 - i) * 3600000
    return events.filter((e) => { const t = new Date(e.ts).getTime(); return t > a - 3600000 && t <= a }).length
  })
  const mx = Math.max(1, ...horas)
  const ult = events[0]
  const conta = (t: HQEvent['type']) => events.filter((e) => e.type === t).length
  return (
    <Tile title="Movimento do escritório" className="sm:col-span-2 lg:col-span-2 lg:col-start-1 lg:row-start-4"
      action={<span className="font-mono text-[11px] text-muted-foreground">{ult ? `último há ${ago(ult.ts)}` : 'sem eventos'}</span>}>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[22px] font-semibold tabular-nums">{fmtN(horas.reduce((s, v) => s + v, 0))} <span className="text-[13px] font-normal text-muted-foreground">eventos em 24h</span></p>
          <p className="font-mono text-[11px] tabular-nums text-muted-foreground">pico de {mx} na mesma hora</p>
        </div>
        <p className="font-mono text-[11px] text-muted-foreground">por hora</p>
      </div>
      <div className="mt-4 flex flex-1 items-end gap-[3px]" style={{ minHeight: 64 }} aria-hidden>
        {horas.map((v, i) => {
          const last = i === horas.length - 1
          return <span key={i} className="flex-1 rounded-[3px]" style={{ height: `${6 + (v / mx) * 94}%`, background: last ? ACC : 'var(--color-muted-foreground)',
            opacity: last ? 1 : 0.15 + (i / horas.length) * 0.45, animation: last && !reduced ? 'orbit-pop 500ms cubic-bezier(.3,1.5,.6,1)' : undefined, transformOrigin: 'bottom' }} />
        })}
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-3">
        {[['Passagens de bastão', conta('handoff')], ['Leituras do cérebro', conta('brain_read')], ['Escritas no cérebro', conta('brain_write')]].map(([k, v]) => (
          <div key={k as string} className="min-w-0"><dt className="truncate text-[11px] text-muted-foreground">{k}</dt><dd className="mt-0.5 font-mono text-[13px] font-semibold tabular-nums">{fmtN(v as number)}</dd></div>
        ))}
      </dl>
    </Tile>
  )
}

/* ---------- Atividade recente ---------- */
const ICONE = { handoff: ArrowRightLeft, brain_read: Brain, brain_write: Brain, tool_run: Wrench, toast: Film }
function AtividadeTile({ tasks, events }: { tasks: Task[]; events: HQEvent[] }) {
  const mounted = useMounted()
  const teams = useHQ((s) => s.teams)
  const nome = (id: string | null) => teams.find((t) => t.id === id)?.nome ?? 'Escritório'
  const { approvals } = useHQ()
  const itens = [
    ...tasks.slice(0, 12).map((t) => ({ id: 't' + t.id, ts: t.updated_at, titulo: t.titulo, detalhe: nome(t.team_id),
      st: t.status === 'done' ? 'feito' : t.status === 'error' ? 'erro' : t.status === 'waiting' ? 'esperando você' : 'rodando',
      Icon: t.status === 'done' ? CheckCircle2 : t.status === 'error' ? CircleAlert : t.status === 'waiting' ? Clock3 : Loader2 })),
    ...approvals.slice(-8).map((a, k) => ({ id: 'a' + k + a.ts, ts: a.ts, titulo: a.decision === 'approved' ? 'Você aprovou' : 'Você pediu ajuste', detalhe: a.task_id,
      st: a.decision === 'approved' ? 'aprovado' : 'devolvido', Icon: a.decision === 'approved' ? ThumbsUp : ThumbsDown })),
    ...events.slice(0, 8).map((e) => ({ id: 'e' + e.id, ts: e.ts, titulo: String(e.payload.text ?? e.payload.note ?? e.type), detalhe: nome(e.team_id), st: 'evento', Icon: ICONE[e.type] ?? Film })),
  ].sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, 5)
  const cor = (st: string) => (st === 'erro' || st === 'devolvido' ? ACC2 : st === 'rodando' || st === 'esperando você' ? ACC : 'var(--color-muted-foreground)')
  return (
    <Tile title="Atividade recente" className="sm:col-span-2 lg:col-span-2 lg:col-start-3 lg:row-start-4">
      <ul className="-mx-2 -my-1">
        {itens.length === 0 && <li className="px-2 py-6 text-center text-[13px] text-muted-foreground">Nada ainda. Assim que um turno rodar, aparece aqui.</li>}
        {itens.map((a, i) => (
          <li key={a.id} className="flex items-center gap-3 rounded-2xl px-2 py-2 transition-colors hover:bg-muted/50"
            style={{ opacity: mounted ? 1 : 0, transform: mounted ? 'none' : 'translateY(6px)', transition: `opacity 500ms ease ${300 + i * 70}ms, transform 500ms ${EASE} ${300 + i * 70}ms` }}>
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-muted text-foreground"><a.Icon size={16} className={cx(a.st === 'rodando' && 'animate-spin motion-reduce:animate-none')} /></span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium">{a.titulo}</p>
              <p className="truncate text-[11px] text-muted-foreground">{a.detalhe} · {ago(a.ts)}</p>
            </div>
            <p className="font-mono text-[10px] font-semibold" style={{ color: cor(a.st) }}>{a.st}</p>
          </li>
        ))}
      </ul>
    </Tile>
  )
}

export function DashboardView() {
  const { tasks, events, live } = useHQ()
  return (
    <div className="absolute inset-0 z-10 overflow-y-auto bg-background px-4 pb-10 pt-20 text-foreground sm:px-8">
      <style>{'@keyframes orbit-pop { 0% { transform: scaleY(0) } 100% { transform: scaleY(1) } }'}</style>
      <div className="mx-auto w-full max-w-[1120px]">
        <nav className="mb-3 flex flex-wrap items-center justify-between gap-3 px-1" aria-label="Painel">
          <h2 className="text-[13px] font-medium text-muted-foreground">Painel · tudo que os agentes fizeram</h2>
          <div className="flex items-center gap-2">
            <UploadReferencia />
            <span className="flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-[12px] font-medium">
              <span className="size-2 rounded-full" style={{ background: live === 'supabase' ? ACC : ACC2 }} />{live === 'supabase' ? 'Ao vivo' : 'Demonstração'}
            </span>
            <span className="rounded-full bg-foreground px-3 py-1.5 font-mono text-[12px] font-semibold text-background">Lucas HQ</span>
          </div>
        </nav>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <HeroTile tasks={tasks} />
          <OperacoesTile tasks={tasks} events={events} />
          <QualidadeTile tasks={tasks} />
          <ProducaoTile tasks={tasks} />
          <TimesTile tasks={tasks} />
          <AprovacoesTile tasks={tasks} />
          <ExpedienteTile />
          <MovimentoTile events={events} />
          <AtividadeTile tasks={tasks} events={events} />
        </div>
      </div>
    </div>
  )
}
