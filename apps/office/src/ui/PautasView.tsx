import * as React from 'react'
import { ArrowDown, ArrowUp, Check, Loader2, Plus, RotateCcw, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { UploadReferencia } from './UploadReferencia'

/* Aba "Pautas": o Lucas digita os temas que quer; o Radar pega daqui primeiro (tools/pautas.py) e só pesquisa os fatos. */

type Status = 'fila' | 'em_uso' | 'feito' | 'descartado'
interface Pauta { id: string; criado_em: string; tema: string; gancho: string; categoria: string; ordem: number; status: Status; usado_em: string | null; video_slug: string | null; nota: string }

const CATS = [['geopolitica', 'Geopolítica'], ['guerras', 'Guerras'], ['economia', 'Economia'], ['politica', 'Política'], ['curiosidades', 'Curiosidades']] as const
const ST: Record<Status, [string, string]> = {
  fila: ['Na fila', 'oklch(0.86 0.16 85)'], em_uso: ['Em produção', 'oklch(0.75 0.13 250)'],
  feito: ['Virou vídeo', 'oklch(0.75 0.15 150)'], descartado: ['Descartada', 'oklch(0.7 0.17 25)'],
}

export function PautasView() {
  const [pautas, setPautas] = React.useState<Pauta[]>([])
  const [erro, setErro] = React.useState('')
  const [tema, setTema] = React.useState('')
  const [gancho, setGancho] = React.useState('')
  const [cat, setCat] = React.useState('geopolitica')
  const [salvando, setSalvando] = React.useState(false)
  const [filtro, setFiltro] = React.useState<Status | 'todas'>('fila')

  const carregar = React.useCallback(async () => {
    if (!supabase) { setErro('Sem conexão com o Supabase.'); return }
    const { data, error } = await supabase.from('pautas').select('*').order('ordem').order('criado_em')
    if (error) setErro(error.message.includes('pautas') ? 'Falta criar a tabela: rode supabase/migrations/0008_pautas.sql no SQL Editor.' : error.message)
    else { setErro(''); setPautas((data ?? []) as Pauta[]) }
  }, [])
  React.useEffect(() => {
    carregar()
    if (!supabase) return
    const ch = supabase.channel('pautas').on('postgres_changes', { event: '*', schema: 'public', table: 'pautas' }, carregar).subscribe()
    return () => { supabase?.removeChannel(ch) }
  }, [carregar])

  async function adicionar(e: React.FormEvent) {
    e.preventDefault()
    if (!supabase || !tema.trim()) return
    setSalvando(true)
    const fim = Math.max(0, ...pautas.map((p) => p.ordem)) + 1
    const { error } = await supabase.from('pautas').insert({ tema: tema.trim(), gancho: gancho.trim(), categoria: cat, ordem: fim })
    setSalvando(false)
    if (error) setErro(error.message)
    else { setTema(''); setGancho(''); carregar() }
  }
  async function mudar(p: Pauta, campos: Partial<Pauta>) {
    if (!supabase) return
    await supabase.from('pautas').update(campos).eq('id', p.id)
    carregar()
  }
  async function mover(p: Pauta, dir: -1 | 1) {
    const fila = pautas.filter((x) => x.status === 'fila')
    const i = fila.findIndex((x) => x.id === p.id), j = i + dir
    if (j < 0 || j >= fila.length) return
    await Promise.all([mudar(fila[i], { ordem: fila[j].ordem }), mudar(fila[j], { ordem: fila[i].ordem })])
  }

  const conta = (s: Status) => pautas.filter((p) => p.status === s).length
  const lista = pautas.filter((p) => filtro === 'todas' || p.status === filtro)
  const posFila = new Map(pautas.filter((p) => p.status === 'fila').map((p, i) => [p.id, i]))

  return (
    <div className="absolute inset-0 z-10 overflow-y-auto bg-background px-4 pb-10 pt-20 text-foreground sm:px-8">
      <div className="mx-auto w-full max-w-[880px]">
        <header className="mb-4 px-1">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-[26px] font-semibold tracking-[-0.03em]">Pautas</h2>
            <UploadReferencia />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Escreva os temas que você quer em vídeo. O Radar pega os 5 primeiros da fila todo dia e só pesquisa os fatos e as fontes.</p>
        </header>

        <form onSubmit={adicionar} className="rounded-[26px] border border-border bg-card p-5">
          <label className="text-[12px] font-medium text-muted-foreground" htmlFor="tema">Tema</label>
          <textarea id="tema" value={tema} onChange={(e) => setTema(e.target.value)} rows={2} placeholder="Ex.: Operation Neptune Spear: os 38 minutos que mataram Bin Laden"
            className="mt-1 w-full resize-y rounded-xl border border-border bg-background px-3 py-2 text-[14px] outline-none focus:border-foreground/40" />
          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_180px]">
            <div>
              <label className="text-[12px] font-medium text-muted-foreground" htmlFor="gancho">Gancho sugerido (opcional, em inglês)</label>
              <input id="gancho" value={gancho} onChange={(e) => setGancho(e.target.value)} placeholder="Ex.: Two helicopters. 23 SEALs. 38 minutes."
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-[14px] outline-none focus:border-foreground/40" />
            </div>
            <div>
              <label className="text-[12px] font-medium text-muted-foreground" htmlFor="cat">Editoria</label>
              <select id="cat" value={cat} onChange={(e) => setCat(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-[14px] outline-none">
                {CATS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-[12px] text-muted-foreground">Tema que repete um vídeo dos últimos 45 dias sai da fila sozinho.</p>
            <button type="submit" disabled={!tema.trim() || salvando}
              className="flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-[13px] font-semibold text-background disabled:opacity-40">
              {salvando ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Adicionar à fila
            </button>
          </div>
        </form>

        {erro && <p className="mt-3 rounded-xl border border-border bg-card px-4 py-3 text-[13px]" style={{ color: ST.descartado[1] }}>{erro}</p>}

        <nav className="mt-5 flex flex-wrap gap-2" aria-label="Filtro">
          {(['fila', 'em_uso', 'feito', 'descartado', 'todas'] as const).map((s) => (
            <button key={s} type="button" onClick={() => setFiltro(s)}
              className={`rounded-full border border-border px-3 py-1.5 text-[12px] font-medium ${filtro === s ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'}`}>
              {s === 'todas' ? `Todas · ${pautas.length}` : `${ST[s][0]} · ${conta(s)}`}
            </button>
          ))}
        </nav>

        <ul className="mt-3 space-y-2">
          {lista.length === 0 && !erro && <li className="rounded-2xl border border-border bg-card px-4 py-6 text-center text-[13px] text-muted-foreground">Nada aqui.</li>}
          {lista.map((p) => (
            <li key={p.id} className="flex items-start gap-3 rounded-2xl border border-border bg-card px-4 py-3">
              <span className="mt-0.5 w-7 shrink-0 font-mono text-[12px] text-muted-foreground">{p.status === 'fila' ? `#${(posFila.get(p.id) ?? 0) + 1}` : ''}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-medium leading-snug">{p.tema}</p>
                {p.gancho && <p className="mt-0.5 text-[12px] italic text-muted-foreground">“{p.gancho}”</p>}
                <p className="mt-1 flex flex-wrap items-center gap-2 font-mono text-[10px] text-muted-foreground">
                  <span className="rounded-full px-2 py-0.5 font-semibold" style={{ color: ST[p.status][1], background: `color-mix(in oklch, ${ST[p.status][1]} 16%, transparent)` }}>{ST[p.status][0]}</span>
                  <span>{CATS.find(([v]) => v === p.categoria)?.[1] ?? p.categoria}</span>
                  {p.video_slug && <span>· {p.video_slug}</span>}
                  {p.nota && <span>· {p.nota}</span>}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {p.status === 'fila' && <>
                  <button type="button" title="Subir" onClick={() => mover(p, -1)} className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"><ArrowUp size={14} /></button>
                  <button type="button" title="Descer" onClick={() => mover(p, 1)} className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"><ArrowDown size={14} /></button>
                  <button type="button" title="Descartar" onClick={() => mudar(p, { status: 'descartado', nota: 'descartada pelo Lucas' })} className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"><X size={14} /></button>
                </>}
                {p.status === 'descartado' && <button type="button" title="Voltar para a fila" onClick={() => mudar(p, { status: 'fila', nota: '' })} className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"><RotateCcw size={14} /></button>}
                {p.status === 'feito' && <Check size={14} style={{ color: ST.feito[1] }} />}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
