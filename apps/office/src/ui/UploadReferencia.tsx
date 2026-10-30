import * as React from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, CircleAlert, Film, Loader2, UploadCloud, X } from 'lucide-react'
import { supabase } from '../lib/supabase'

/* Botão "Enviar referência": o Lucas arrasta vídeos virais; eles vão para o bucket "acervo" (referencias/)
   e o Chromebook baixa com `tools/acervo.py baixar` antes do curador fichar (domingo ou /alimentar-acervo). */

const MAX = 50 * 1024 * 1024
const TIPOS = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v']
type Item = { nome: string; tam: number; st: 'enviando' | 'ok' | 'erro'; msg?: string }
type Remoto = { name: string; created_at?: string; metadata?: { size?: number } }

const mb = (b: number) => `${(b / 1048576).toFixed(1)} MB`
const nomeSeguro = (f: File) => {
  const d = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
  const base = f.name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9.]+/g, '-').replace(/^-+|-+$/g, '')
  return `${d}_${Date.now().toString(36)}_${base || 'video.mp4'}`
}

export function UploadReferencia({ className = '' }: { className?: string }) {
  const [aberto, setAberto] = React.useState(false)
  return (
    <>
      <button type="button" onClick={() => setAberto(true)}
        className={`flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-[12px] font-medium transition-colors hover:bg-muted ${className}`}>
        <UploadCloud size={14} /> Enviar referência
      </button>
      <AnimatePresence>{aberto && <Modal onClose={() => setAberto(false)} />}</AnimatePresence>
    </>
  )
}

function Modal({ onClose }: { onClose: () => void }) {
  const [itens, setItens] = React.useState<Item[]>([])
  const [remotos, setRemotos] = React.useState<Remoto[]>([])
  const [arrastando, setArrastando] = React.useState(false)
  const input = React.useRef<HTMLInputElement>(null)

  const listar = React.useCallback(async () => {
    if (!supabase) return
    const { data } = await supabase.storage.from('acervo').list('referencias', { limit: 100, sortBy: { column: 'created_at', order: 'desc' } })
    setRemotos((data ?? []).filter((x) => x.name && !x.name.startsWith('.')) as Remoto[])
  }, [])
  React.useEffect(() => { listar() }, [listar])
  React.useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k)
  }, [onClose])

  async function enviar(files: FileList | File[]) {
    for (const f of Array.from(files)) {
      const nome = f.name
      const erro = !TIPOS.includes(f.type) ? 'só vídeo (.mp4, .mov, .webm)' : f.size > MAX ? 'maior que 50 MB' : !supabase ? 'sem conexão com o Supabase' : ''
      if (erro) { setItens((x) => [{ nome, tam: f.size, st: 'erro', msg: erro }, ...x]); continue }
      setItens((x) => [{ nome, tam: f.size, st: 'enviando' }, ...x])
      const { error } = await supabase!.storage.from('acervo').upload(`referencias/${nomeSeguro(f)}`, f, { contentType: f.type, upsert: false })
      setItens((x) => x.map((i) => (i.nome === nome && i.st === 'enviando' ? { ...i, st: error ? 'erro' : 'ok', msg: error?.message } : i)))
    }
    listar()
  }

  return (
    <motion.div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.section role="dialog" aria-label="Enviar referência" onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[520px] rounded-[26px] border border-border bg-card p-5 text-card-foreground shadow-2xl"
        initial={{ y: 24, scale: 0.97 }} animate={{ y: 0, scale: 1 }} exit={{ y: 24, scale: 0.97 }}>
        <header className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-[17px] font-semibold tracking-tight">Enviar referência para o Acervo</h3>
            <p className="mt-1 text-[12px] text-muted-foreground">Vídeos virais do nicho. O curador tira os prints, lê a copy e ficha tema, gancho e animações.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"><X size={16} /></button>
        </header>

        <button type="button" onClick={() => input.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setArrastando(true) }} onDragLeave={() => setArrastando(false)}
          onDrop={(e) => { e.preventDefault(); setArrastando(false); enviar(e.dataTransfer.files) }}
          className={`flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-10 text-center transition-colors ${arrastando ? 'border-foreground bg-muted' : 'border-border hover:bg-muted/50'}`}>
          <UploadCloud size={28} className="text-muted-foreground" />
          <span className="text-[14px] font-medium">Arraste os vídeos aqui ou toque para escolher</span>
          <span className="font-mono text-[11px] text-muted-foreground">.mp4 · .mov · .webm · até 50 MB cada</span>
        </button>
        <input ref={input} type="file" accept="video/*" multiple hidden onChange={(e) => e.target.files && enviar(e.target.files)} />

        {itens.length > 0 && (
          <ul className="mt-4 space-y-1">
            {itens.map((i, k) => (
              <li key={k} className="flex items-center gap-3 rounded-xl px-2 py-1.5 text-[13px]">
                {i.st === 'enviando' ? <Loader2 size={16} className="animate-spin" /> : i.st === 'ok' ? <CheckCircle2 size={16} className="text-emerald-400" /> : <CircleAlert size={16} className="text-rose-400" />}
                <span className="min-w-0 flex-1 truncate">{i.nome}</span>
                <span className="font-mono text-[11px] text-muted-foreground">{i.st === 'erro' ? i.msg : i.st === 'ok' ? 'enviado' : mb(i.tam)}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-5 border-t border-border pt-4">
          <p className="mb-2 flex items-center justify-between text-[12px] text-muted-foreground">
            <span>No acervo, esperando o curador</span><span className="font-mono">{remotos.length}</span>
          </p>
          <ul className="max-h-40 space-y-1 overflow-y-auto">
            {remotos.length === 0 && <li className="text-[12px] text-muted-foreground">Nenhum vídeo enviado ainda.</li>}
            {remotos.map((r) => (
              <li key={r.name} className="flex items-center gap-2 text-[12px]">
                <Film size={13} className="shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{r.name.replace(/^\d{4}-\d{2}-\d{2}_[a-z0-9]+_/, '')}</span>
                <span className="font-mono text-[11px] text-muted-foreground">{r.metadata?.size ? mb(r.metadata.size) : ''}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] text-muted-foreground">O Chromebook baixa e ficha no domingo às 10:00, ou na hora com <span className="font-mono">/alimentar-acervo</span>.</p>
        </div>
      </motion.section>
    </motion.div>
  )
}
