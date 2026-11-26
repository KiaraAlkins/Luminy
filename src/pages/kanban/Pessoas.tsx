import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Plus, Search } from 'lucide-react'
import type { Pessoa } from '../../lib/kanban'

const CORES = ['#3D2EF9', '#12A15F', '#E8890C', '#D6297A', '#2E90FA', '#7A5AF8', '#0E9384', '#E5484D']
const corDe = (id: string) => CORES[[...id].reduce((s, c) => s + c.charCodeAt(0), 0) % CORES.length]
const iniciais = (nome: string) => nome.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('') || '?'

export function FotoPessoa({ pessoa, tamanho = 26 }: { pessoa: Pessoa; tamanho?: number }) {
  const estilo = { width: tamanho, height: tamanho, fontSize: Math.max(9, tamanho * 0.38) }
  return pessoa.foto_url
    ? <img className="foto-pessoa" src={pessoa.foto_url} alt="" title={pessoa.nome} style={estilo} />
    : <span className="foto-pessoa" title={pessoa.nome} style={{ ...estilo, background: corDe(pessoa.usuario_id) }}>{iniciais(pessoa.nome)}</span>
}

/** Fotinhas sobrepostas dos responsáveis (como no Trello). */
export function Responsaveis({ ids, pessoas, max = 3, tamanho = 24 }: { ids: string[]; pessoas: Pessoa[]; max?: number; tamanho?: number }) {
  const lista = ids.map((id) => pessoas.find((p) => p.usuario_id === id)).filter(Boolean) as Pessoa[]
  if (!lista.length) return null
  return (
    <span className="responsaveis" aria-label={`Responsáveis: ${lista.map((p) => p.nome).join(', ')}`}>
      {lista.slice(0, max).map((p) => <FotoPessoa key={p.usuario_id} pessoa={p} tamanho={tamanho} />)}
      {lista.length > max && <span className="foto-pessoa foto-pessoa--mais" style={{ width: tamanho, height: tamanho }}>+{lista.length - max}</span>}
    </span>
  )
}

/** Escolher os responsáveis do card: toca na pessoa para marcar ou desmarcar. */
export function EscolherResponsaveis({ ids, pessoas, onMudar }: { ids: string[]; pessoas: Pessoa[]; onMudar: (ids: string[]) => void }) {
  const [aberto, setAberto] = useState(false)
  const [busca, setBusca] = useState('')
  const [pos, setPos] = useState({ top: 0, left: 0, width: 260 })
  const botao = useRef<HTMLButtonElement>(null)
  const painel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!aberto) return
    const r = botao.current!.getBoundingClientRect()
    const acima = window.innerHeight - r.bottom < 300
    setPos({ top: acima ? Math.max(8, r.top - 300) : r.bottom + 6, left: Math.min(r.left, window.innerWidth - 276), width: 260 })
    const fora = (e: MouseEvent) => { if (!painel.current?.contains(e.target as Node) && !botao.current?.contains(e.target as Node)) setAberto(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); setAberto(false) } }
    document.addEventListener('mousedown', fora); document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', fora); document.removeEventListener('keydown', esc) }
  }, [aberto])

  const alternar = (id: string) => onMudar(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id])
  const visiveis = pessoas.filter((p) => !busca || p.nome.toLowerCase().includes(busca.toLowerCase()))

  return (
    <>
      <div className="escolher-responsaveis">
        <Responsaveis ids={ids} pessoas={pessoas} max={6} tamanho={30} />
        <button ref={botao} type="button" className="escolher-responsaveis__mais" aria-label="Escolher responsáveis" aria-expanded={aberto} onClick={() => { setBusca(''); setAberto(!aberto) }}>
          <Plus size={16} />
        </button>
      </div>
      {aberto && createPortal(
        <div ref={painel} className="selecao__painel" style={{ top: pos.top, left: pos.left, width: pos.width }}>
          {pessoas.length > 6 && (
            <label className="selecao__busca"><Search size={15} aria-hidden /><input autoFocus value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar pessoa" aria-label="Buscar pessoa" /></label>
          )}
          <span className="rotulo" style={{ padding: '6px 10px 4px', display: 'block' }}>Responsáveis</span>
          <ul role="listbox" aria-multiselectable="true" aria-label="Responsáveis">
            {visiveis.map((p) => (
              <li key={p.usuario_id} role="option" aria-selected={ids.includes(p.usuario_id)} className={`selecao__opcao${ids.includes(p.usuario_id) ? ' marcada' : ''}`}
                onMouseDown={(e) => e.preventDefault()} onClick={() => alternar(p.usuario_id)}>
                <FotoPessoa pessoa={p} tamanho={28} />
                <span className="selecao__texto"><span className="selecao__rotulo">{p.nome}</span></span>
                {ids.includes(p.usuario_id) && <Check size={16} className="selecao__ok" />}
              </li>
            ))}
            {pessoas.length === 0 && <li className="selecao__nada">Convide a equipe em Configurações para escolher responsáveis.</li>}
          </ul>
        </div>, document.body)}
    </>
  )
}
