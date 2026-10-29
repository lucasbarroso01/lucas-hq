import { useHQ } from '../store'
import { nowBR } from '../lib/expediente'
import { driveSearch } from './TaskDetail'

/** Abre o Drive numa aba nova: a pasta de hoje se já tem vídeo, senão a Central de Conteúdo. */
export function driveHref(drive: { raiz?: string; dia?: string; data?: string }) {
  const env = import.meta.env.VITE_DRIVE_URL as string | undefined
  if (drive.dia && drive.data === nowBR().date) return { href: drive.dia, label: 'pasta de hoje' }
  if (drive.raiz) return { href: drive.raiz, label: 'Central de Conteúdo' }
  if (env) return { href: env, label: 'Central de Conteúdo' }
  return { href: driveSearch('Central de Conteúdo — Lucas'), label: 'busca no Drive' }
}

export function DriveButton() {
  const drive = useHQ((s) => s.drive)
  const { href, label } = driveHref(drive)
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" title={`Abrir o Drive (${label}) numa aba nova`}
      className="flex items-center gap-1.5 whitespace-nowrap rounded-full bg-emerald-400/15 px-3 py-1 text-[12px] font-bold text-emerald-200 ring-1 ring-emerald-400/30 hover:bg-emerald-400/25">
      📁 Drive ↗
    </a>
  )
}
