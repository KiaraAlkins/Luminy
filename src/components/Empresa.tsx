import { useEffect, useRef, useState } from 'react'
import { Building2, Check, ChevronDown, Search } from 'lucide-react'
import type { Empresa } from '../lib/parcerias'

const CORES = ['#3D2EF9', '#2E90FA', '#12A15F', '#E8890C', '#D6297A', '#7A5AF8', '#0E9384']

/** Foto da empresa (logo ou fachada); sem foto, mostra as iniciais. */
export function FotoEmpresa({ empresa, tamanho = 36 }: { empresa: Pick<Empresa, 'nome' | 'foto_url'>; tamanho?: number }) {
  const [falhou, setFalhou] = useState(false)
  const iniciais = empresa.nome.split(/\s+/).filter((p) => p.length > 2 || /^[A-Z]/.test(p)).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('') || empresa.nome[0]?.toUpperCase()
  const cor = CORES[[...empresa.nome].reduce((s, c) => s + c.charCodeAt(0), 0) % CORES.length]
  const estilo = { width: tamanho, height: tamanho, borderRadius: Math.round(tamanho * 0.28) }
  if (empresa.foto_url && !falhou) {
    return <img className="foto-empresa" src={empresa.foto_url} alt="" style={estilo} loading="lazy" onError={() => setFalhou(true)} />
  }
  return <span className="foto-empresa foto-empresa--iniciais" aria-hidden style={{ ...estilo, background: cor, fontSize: Math.max(10, tamanho * 0.36) }}>{iniciais}</span>
}

/**
 * Escolher empresa vendo a foto e o nome (em vez de uma lista só de texto).
 * Tem busca; a primeira opção é "nenhuma" (texto configurável).
 */
export function SeletorEmpresa({ empresas, valor, onMudar, semEmpresa = 'Nenhuma empresa', id }: {
  empresas: Empresa[]; valor: string; onMudar: (id: string) => void; semEmpresa?: string; id?: string
}) {
  const [aberto, setAberto] = useState(false)
  const [busca, setBusca] = useState('')
  const [foco, setFoco] = useState(0)
  const caixa = useRef<HTMLDivElement>(null)
  const atual = empresas.find((e) => e.id === valor)
  const lista = empresas.filter((e) => !busca || `${e.nome} ${e.segmento ?? ''} ${e.convenios.join(' ')}`.toLowerCase().includes(busca.toLowerCase()))
  const opcoes: (Empresa | null)[] = busca ? lista : [null, ...lista]

  useEffect(() => {
    if (!aberto) return
    const fora = (e: MouseEvent) => { if (!caixa.current?.contains(e.target as Node)) setAberto(false) }
    document.addEventListener('mousedown', fora)
    return () => document.removeEventListener('mousedown', fora)
  }, [aberto])

  function escolher(e: Empresa | null) { onMudar(e?.id ?? ''); setAberto(false); setBusca('') }
  function tecla(ev: React.KeyboardEvent) {
    if (ev.key === 'Escape') { setAberto(false); return }
    if (ev.key === 'ArrowDown') { ev.preventDefault(); setFoco((f) => Math.min(opcoes.length - 1, f + 1)) }
    if (ev.key === 'ArrowUp') { ev.preventDefault(); setFoco((f) => Math.max(0, f - 1)) }
    if (ev.key === 'Enter' && aberto) { ev.preventDefault(); if (opcoes[foco] !== undefined) escolher(opcoes[foco]) }
  }

  return (
    <div className="seletor-empresa" ref={caixa} onKeyDown={tecla}>
      <button id={id} type="button" className={`entrada seletor-empresa__botao${aberto ? ' aberto' : ''}`} aria-haspopup="listbox" aria-expanded={aberto}
        onClick={() => { setAberto(!aberto); setFoco(0) }}>
        {atual ? <FotoEmpresa empresa={atual} tamanho={28} /> : <span className="seletor-empresa__vazio"><Building2 size={15} /></span>}
        <span className="seletor-empresa__texto">
          <strong>{atual?.nome ?? semEmpresa}</strong>
          {atual && (atual.segmento || atual.convenios.length > 0) && <span className="pequeno">{[atual.segmento, atual.convenios.join(' / ')].filter(Boolean).join(' · ')}</span>}
        </span>
        <ChevronDown size={16} className="seletor-empresa__seta" aria-hidden />
      </button>
      {aberto && (
        <div className="seletor-empresa__painel">
          {empresas.length > 5 && (
            <label className="seletor-empresa__busca">
              <Search size={15} aria-hidden />
              <input autoFocus value={busca} onChange={(e) => { setBusca(e.target.value); setFoco(0) }} placeholder="Buscar empresa" aria-label="Buscar empresa" />
            </label>
          )}
          <ul role="listbox" aria-label="Empresas">
            {opcoes.map((e, i) => (
              <li key={e?.id ?? 'nenhuma'}>
                <button type="button" role="option" aria-selected={(e?.id ?? '') === valor} className={i === foco ? 'focada' : ''}
                  onMouseEnter={() => setFoco(i)} onClick={() => escolher(e)}>
                  {e ? <FotoEmpresa empresa={e} tamanho={34} /> : <span className="seletor-empresa__vazio seletor-empresa__vazio--grande"><Building2 size={16} /></span>}
                  <span className="seletor-empresa__texto">
                    <strong>{e?.nome ?? semEmpresa}</strong>
                    {e && <span className="pequeno">{[e.segmento, e.convenios.join(' / ')].filter(Boolean).join(' · ') || 'Sem dados'}</span>}
                  </span>
                  {(e?.id ?? '') === valor && <Check size={16} className="seletor-empresa__ok" />}
                </button>
              </li>
            ))}
            {busca && lista.length === 0 && <li className="pequeno" style={{ padding: 12 }}>Nenhuma empresa encontrada.</li>}
          </ul>
        </div>
      )}
    </div>
  )
}
