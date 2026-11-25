import { useEffect, useState, type FormEvent } from 'react'
import { Check, ChevronDown, ChevronUp, PartyPopper, Pencil, Play, X } from 'lucide-react'
import { useFoco, tempoDesde } from '../lib/foco'
import { useSessao } from '../lib/sessao'
import { comemorar } from '../lib/comemorar'
import './foco.css'

const CHAVE_MIN = 'luminy.foco.minimizado'
const lerMin = () => { try { return localStorage.getItem(CHAVE_MIN) === '1' } catch { return false } }

/**
 * Pílula flutuante no canto da tela, em todas as abas: mostra o "Fazendo agora",
 * o tempo correndo e o botão de concluir (com festa). Minimiza para não atrapalhar.
 */
export function FocoFlutuante() {
  const { cliente, usuario } = useSessao()
  const { foco, definir, concluir, limpar } = useFoco()
  const [minimizado, setMinimizado] = useState(lerMin)
  const [editando, setEditando] = useState(false)
  const [texto, setTexto] = useState('')
  const [agora, setAgora] = useState(() => Date.now())
  const [parabens, setParabens] = useState<string | null>(null)

  useEffect(() => { const t = setInterval(() => setAgora(Date.now()), 30_000); return () => clearInterval(t) }, [])
  useEffect(() => { try { localStorage.setItem(CHAVE_MIN, minimizado ? '1' : '0') } catch { /* sem armazenamento */ } }, [minimizado])

  if (!cliente) return null

  async function salvar(e: FormEvent) {
    e.preventDefault()
    if (!texto.trim()) return
    await definir(texto.trim()); setTexto(''); setEditando(false); setMinimizado(false)
  }

  async function finalizar() {
    const titulo = foco?.titulo
    if (await concluir()) {
      comemorar('normal')
      setParabens(`Mandou bem, ${usuario.nome.split(' ')[0]}! "${titulo}" concluída.`)
      setTimeout(() => setParabens(null), 5000)
    }
  }

  if (minimizado) {
    return (
      <button type="button" className="foco foco--mini" onClick={() => setMinimizado(false)} aria-label="Mostrar o que estou fazendo agora">
        <span className={`foco__ponto${foco ? ' ativo' : ''}`} />
        {foco ? <span className="foco__mini-texto">{foco.titulo}</span> : <span>Fazendo agora</span>}
        <ChevronUp size={16} aria-hidden />
      </button>
    )
  }

  return (
    <aside className="foco" aria-label="Fazendo agora">
      {parabens && <p className="foco__parabens" role="status"><PartyPopper size={16} aria-hidden /> {parabens}</p>}
      <header className="foco__topo">
        <span className="rotulo" style={{ color: 'var(--marca-clara)' }}>Fazendo agora</span>
        <button type="button" className="foco__icone" aria-label="Minimizar" onClick={() => setMinimizado(true)}><ChevronDown size={16} /></button>
      </header>

      {foco && !editando ? (
        <>
          <p className="foco__titulo">{foco.titulo}</p>
          <p className="foco__tempo">há {tempoDesde(foco.iniciado_em, agora)} · aparece na TV da equipe</p>
          <div className="foco__acoes">
            <button type="button" className="foco__concluir" onClick={() => void finalizar()}><Check size={16} /> Concluir</button>
            <button type="button" className="foco__icone" aria-label="Trocar tarefa" title="Trocar tarefa" onClick={() => { setTexto(''); setEditando(true) }}><Pencil size={15} /></button>
            <button type="button" className="foco__icone" aria-label="Parar sem concluir" title="Parar sem concluir" onClick={() => void limpar()}><X size={16} /></button>
          </div>
        </>
      ) : (
        <form onSubmit={salvar} className="foco__form">
          <input className="foco__entrada" autoFocus={editando} value={texto} onChange={(e) => setTexto(e.target.value)}
            placeholder="O que você está fazendo agora?" aria-label="O que você está fazendo agora?" />
          <button type="submit" className="foco__concluir" disabled={!texto.trim()} aria-label="Começar"><Play size={14} /></button>
          {editando && <button type="button" className="foco__icone" aria-label="Cancelar" onClick={() => setEditando(false)}><X size={16} /></button>}
        </form>
      )}
      {!foco && !editando && <p className="foco__tempo">Dica: no Kanban, abra um card e clique em "Fazer agora".</p>}
    </aside>
  )
}
