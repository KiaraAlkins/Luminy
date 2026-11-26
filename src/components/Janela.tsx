import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'

/** Janela sobreposta (modal). Fecha com Esc ou clicando fora. */
export function Janela({ titulo, onFechar, children, largura = 520, classe = '' }: { titulo: string; onFechar: () => void; children: ReactNode; largura?: number; classe?: string }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape' && !e.defaultPrevented) onFechar() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onFechar])
  return (
    <div className="janela-fundo" onMouseDown={(e) => { if (e.target === e.currentTarget) onFechar() }}>
      <div className={`janela ${classe}`} role="dialog" aria-modal="true" aria-label={titulo} style={{ maxWidth: largura }}>
        <header className="janela__topo"><h3>{titulo}</h3><button type="button" className="icone-botao" style={{ border: 0 }} aria-label="Fechar" onClick={onFechar}><X size={18} /></button></header>
        {children}
      </div>
    </div>
  )
}
