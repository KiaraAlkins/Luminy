import { useMemo, useState } from 'react'
import { CheckCircle2, ChevronLeft, ChevronRight, Plus, X } from 'lucide-react'
import { COR_TIPO, iconeTipo } from '../../components/opcoes'
import { CardVoando } from '../../components/Arrastar'
import { useArrastar, type Vaga } from '../../lib/arrastar'
import type { Card, Coluna, Pessoa } from '../../lib/kanban'
import { Responsaveis } from './Pessoas'

const DIAS = ['dom.', 'seg.', 'ter.', 'qua.', 'qui.', 'sex.', 'sáb.']
const chave = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const diaDoCard = (c: Card) => (c.postagem_em ? chave(new Date(c.postagem_em)) : null)
const SEM_DATA = 'sem-data'

/** Etiqueta + título + responsáveis: o "cartãozinho" do calendário. */
function Item({ card, coluna, pessoas }: { card: Card; coluna?: Coluna; pessoas: Pessoa[] }) {
  const pronto = !!coluna && /postado|feito/i.test(coluna.nome)
  return (
    <>
      <span className="cal-item__topo">
        {card.tipo_conteudo && <span className="etiqueta" style={{ '--cor': COR_TIPO[card.tipo_conteudo] ?? '#667085' } as React.CSSProperties}>{iconeTipo(card.tipo_conteudo, 11)} {card.tipo_conteudo}</span>}
        {card.prioridade === 'alta' && <span className="etiqueta" style={{ '--cor': 'var(--perigo)' } as React.CSSProperties}>Alta</span>}
      </span>
      <span className="cal-item__linha">
        <span className="cal-item__titulo">{pronto && <CheckCircle2 size={13} className="cal-item__pronto" aria-label="Pronto" />}{card.titulo}</span>
        <Responsaveis ids={card.responsaveis} pessoas={pessoas} max={2} tamanho={22} />
      </span>
    </>
  )
}

/**
 * Kanban por data (como o calendário do Trello): cada post aparece no dia em que vai sair.
 * Arrastar muda a data de postagem; "Adicionar" cria um post já com a data.
 */
export function CalendarioKanban({ cards, colunas, pessoas, onAbrir, onMudarData, onCriar }: {
  cards: Card[]; colunas: Coluna[]; pessoas: Pessoa[]
  onAbrir: (id: string) => void
  onMudarData: (card: Card, postagemEm: string | null) => void
  onCriar: (dia: string, titulo: string) => Promise<void>
}) {
  const [mes, setMes] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const [criandoEm, setCriandoEm] = useState<string | null>(null)
  const [titulo, setTitulo] = useState('')
  const [hoje] = useState(() => chave(new Date()))

  const semanas = useMemo(() => {
    const inicio = new Date(mes); inicio.setDate(1 - inicio.getDay())
    const fim = new Date(mes.getFullYear(), mes.getMonth() + 1, 0); fim.setDate(fim.getDate() + (6 - fim.getDay()))
    const dias: Date[] = []
    for (const d = new Date(inicio); d <= fim; d.setDate(d.getDate() + 1)) dias.push(new Date(d))
    return Array.from({ length: dias.length / 7 }, (_, i) => dias.slice(i * 7, i * 7 + 7))
  }, [mes])

  const porDia = useMemo(() => {
    const m = new Map<string, Card[]>()
    cards.forEach((c) => { const k = diaDoCard(c) ?? SEM_DATA; m.set(k, [...(m.get(k) ?? []), c]) })
    m.forEach((l) => l.sort((a, b) => (a.postagem_em ?? '').localeCompare(b.postagem_em ?? '')))
    return m
  }, [cards])

  function soltar(card: Card, { coluna }: Vaga) {
    if (coluna === (diaDoCard(card) ?? SEM_DATA)) return
    if (coluna === SEM_DATA) { onMudarData(card, null); quicar(card.id); return }
    // Mantém o horário que já estava (ou meio-dia)
    const antes = card.postagem_em ? new Date(card.postagem_em) : null
    const [a, m, d] = coluna.split('-').map(Number)
    const nova = new Date(a, m - 1, d, antes?.getHours() ?? 12, antes?.getMinutes() ?? 0)
    onMudarData(card, nova.toISOString()); quicar(card.id)
  }
  const { arraste, vaga, chegou, quadroRef, voandoRef, iniciar, acabouDeSoltar, quicar } = useArrastar<Card>({ idDe: (c) => c.id, aoSoltar: soltar })

  const nomeMes = mes.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  const colunaDe = (c: Card) => colunas.find((x) => x.id === c.coluna_id)
  const semData = porDia.get(SEM_DATA) ?? []

  async function criar(dia: string) {
    const t = titulo.trim(); if (!t) return
    await onCriar(dia, t); setTitulo('')
  }

  const item = (c: Card) => c.id === arraste?.id ? null : (
    <button key={c.id} type="button" data-card={c.id} className={`cal-item${chegou === c.id ? ' card--chegou' : ''}`}
      onPointerDown={(e) => iniciar(e, c)} onClick={() => { if (!acabouDeSoltar()) onAbrir(c.id) }}>
      {c.capa_url && <img className="cal-item__capa" src={c.capa_url} alt="" draggable={false} />}
      <Item card={c} coluna={colunaDe(c)} pessoas={pessoas} />
    </button>
  )

  return (
    <div className="calendario-kanban" ref={quadroRef}>
      <div className="cal-topo">
        <strong className="cal-topo__mes">{nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1)}</strong>
        <button type="button" className="icone-botao" aria-label="Mês anterior" onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() - 1, 1))}><ChevronLeft size={18} /></button>
        <button type="button" className="botao botao--secundario botao--mini" onClick={() => { const d = new Date(); setMes(new Date(d.getFullYear(), d.getMonth(), 1)) }}>Hoje</button>
        <button type="button" className="icone-botao" aria-label="Próximo mês" onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() + 1, 1))}><ChevronRight size={18} /></button>
        <span className="pequeno" style={{ marginLeft: 'auto' }}>Arraste um post para mudar o dia da postagem</span>
      </div>

      <div className="cal-corpo">
        <div className="cal-grade">
          {DIAS.map((d) => <div key={d} className="cal-semana-dia">{d}</div>)}
          {semanas.flat().map((d) => {
            const k = chave(d)
            const lista = porDia.get(k) ?? []
            const foraDoMes = d.getMonth() !== mes.getMonth()
            const alvo = arraste && vaga?.coluna === k
            return (
              <div key={k} data-coluna={k} className={`cal-dia${foraDoMes ? ' cal-dia--fora' : ''}${k === hoje ? ' cal-dia--hoje' : ''}${alvo ? ' cal-dia--alvo' : ''}`}>
                <span className="cal-dia__numero">{d.getDate() === 1 ? d.toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' }).replace(' de', '') : d.getDate()}</span>
                <div className="cal-dia__itens">{lista.map(item)}</div>
                {criandoEm === k ? (
                  <form className="cal-novo" onSubmit={(e) => { e.preventDefault(); void criar(k) }}>
                    <input className="entrada entrada--mini" autoFocus value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título do post"
                      onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); setCriandoEm(null) } }} onBlur={() => { if (!titulo.trim()) setCriandoEm(null) }} aria-label="Título do novo post" />
                    <button type="button" aria-label="Cancelar" onMouseDown={(e) => e.preventDefault()} onClick={() => setCriandoEm(null)}><X size={14} /></button>
                  </form>
                ) : (
                  <button type="button" className="cal-dia__adicionar" onClick={() => { setTitulo(''); setCriandoEm(k) }}><Plus size={14} /> Adicionar</button>
                )}
              </div>
            )
          })}
        </div>

        <aside data-coluna={SEM_DATA} className={`cal-sem-data${arraste && vaga?.coluna === SEM_DATA ? ' cal-dia--alvo' : ''}`}>
          <span className="rotulo">Sem data de postagem · {semData.length}</span>
          <div className="cal-dia__itens">{semData.map(item)}</div>
          {semData.length === 0 && <p className="pequeno">Tudo com data. Arraste um post para cá para tirar a data.</p>}
        </aside>
      </div>

      {arraste && (
        <CardVoando arraste={arraste} voandoRef={voandoRef} classe="cal-item cal-item--voando"><Item card={arraste.item} coluna={colunaDe(arraste.item)} pessoas={pessoas} /></CardVoando>
      )}
    </div>
  )
}
