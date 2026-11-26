import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AlertTriangle, AlignLeft, CalendarDays, CheckSquare, ChevronsLeft, Columns3, Clock, MessageSquare, Paperclip, Plus, Send, X } from 'lucide-react'
import { Botao } from '../components/ui'
import { Janela } from '../components/Janela'
import { COR_TIPO, iconeTipo } from '../components/opcoes'
import { useFoco } from '../lib/foco'
import { useSessao } from '../lib/sessao'
import {
  carregarQuadro, criarCard, dataCurta, excluirCard, linksArquivos, listarPessoas, moverCard, salvarCard, situacaoPrazo,
  type Card, type Coluna, type EdicaoCard, type Pessoa, type Quadro,
} from '../lib/kanban'
import { FichaCard } from './kanban/FichaCard'
import { Responsaveis } from './kanban/Pessoas'
import { CalendarioKanban } from './kanban/CalendarioKanban'
import { posicaoEntre, useArrastar, useColunasMinimizadas, type Vaga } from '../lib/arrastar'
import { CardVoando, FaixaColuna, VagaCard } from '../components/Arrastar'
import './kanban.css'

const COR_COLUNA: Record<string, string> = {
  'Backlog (ideias)': 'var(--texto-3)', 'Briefing aprovado': 'var(--info)', Fazendo: 'var(--alerta)',
  'Feito e aprovado': 'var(--sucesso)', 'Postado e feito': 'var(--marca)', Impedimento: 'var(--perigo)',
}

type Pendente = { card: Card; coluna: Coluna; posicao: number }
/** Card no jeito do Trello: capa, etiquetas coloridas, título e selos (prazo, briefing, checklist, anexos, comentários). */
function CardConteudo({ card, ultima, pessoas = [] }: { card: Card; ultima?: boolean; pessoas?: Pessoa[] }) {
  const { foco } = useFoco()
  const feitos = card.checklist.filter((i) => i.feito).length
  const prazo = situacaoPrazo(card.entrega_em, ultima)
  return (
    <>
      {card.capa_url ? <img className="card__capa" src={card.capa_url} alt="" draggable={false} />
        : card.capa_cor ? <div className="card__capa card__capa--cor" style={{ background: card.capa_cor }} /> : null}
      <div className="card__corpo">
        {(card.tipo_conteudo || card.prioridade === 'alta') && (
          <div className="card__etiquetas">
            {card.tipo_conteudo && <span className="etiqueta" style={{ '--cor': COR_TIPO[card.tipo_conteudo] ?? '#667085' } as React.CSSProperties}>{iconeTipo(card.tipo_conteudo, 12)} {card.tipo_conteudo}</span>}
            {card.prioridade === 'alta' && <span className="etiqueta" style={{ '--cor': 'var(--perigo)' } as React.CSSProperties}>Alta</span>}
          </div>
        )}
        <strong className="card__titulo">{card.titulo}</strong>
        {card.motivo_impedimento && <p className="card__impedimento"><AlertTriangle size={14} aria-hidden /> {card.motivo_impedimento}</p>}
        <div className="card__rodape-card">
        <div className="card__selos">
          {card.entrega_em && <span className={`selo selo--${prazo}`} title="Entrega"><Clock size={13} /> {dataCurta(card.entrega_em)}</span>}
          {card.postagem_em && <span className="selo" title="Postagem"><Send size={12} /> {dataCurta(card.postagem_em)}</span>}
          {card.briefing && <span className="selo" title="Tem briefing"><AlignLeft size={13} /></span>}
          {card.checklist.length > 0 && <span className={`selo${feitos === card.checklist.length ? ' selo--feito' : ''}`} title="Checklist"><CheckSquare size={13} /> {feitos}/{card.checklist.length}</span>}
          {card.anexos.length > 0 && <span className="selo" title="Anexos"><Paperclip size={13} /> {card.anexos.length}</span>}
          {(card.comentarios ?? 0) > 0 && <span className="selo" title="Comentários"><MessageSquare size={13} /> {card.comentarios}</span>}
          {foco?.card_id === card.id && <span className="selo selo--agora" title="Você está fazendo agora">● agora</span>}
        </div>
        <Responsaveis ids={card.responsaveis} pessoas={pessoas} />
        </div>
      </div>
    </>
  )
}

export function Kanban() {
  const { cliente } = useSessao()
  const clienteId = cliente?.id
  const [quadro, setQuadro] = useState<Quadro | null | undefined>(undefined)
  const [erro, setErro] = useState<string | null>(null)
  const [motivoPara, setMotivoPara] = useState<Pendente | null>(null)
  const [params] = useSearchParams()
  // ?card=… abre o card direto (vindo de Minhas tarefas ou de uma demanda)
  const [abertoId, setAbertoId] = useState<string | null>(() => params.get('card'))
  const [pessoas, setPessoas] = useState<Pessoa[]>([])
  const [visao, setVisao] = useState<'quadro' | 'calendario'>(() => { try { return localStorage.getItem('luminy.kanban.visao') === 'calendario' ? 'calendario' : 'quadro' } catch { return 'quadro' } })
  const trocarVisao = (v: 'quadro' | 'calendario') => { setVisao(v); try { localStorage.setItem('luminy.kanban.visao', v) } catch { /* sem armazenamento */ } }
  const [novoEm, setNovoEm] = useState<string | null>(null)

  const recarregar = useCallback(async () => {
    if (!clienteId) { setQuadro(null); return }
    try { setQuadro(await carregarQuadro(clienteId)) } catch { setErro('Não foi possível carregar o quadro.') }
  }, [clienteId])

  useEffect(() => { void Promise.resolve().then(recarregar) }, [recarregar])
  useEffect(() => { if (clienteId) void listarPessoas(clienteId).then(setPessoas) }, [clienteId])

  const porColuna = useMemo(() => {
    const m = new Map<string, Card[]>()
    quadro?.colunas.forEach((c) => m.set(c.id, []))
    quadro?.cards.forEach((c) => m.get(c.coluna_id)?.push(c))
    m.forEach((lista) => lista.sort((a, b) => a.posicao - b.posicao))
    return m
  }, [quadro])

  async function executarMovimento({ card, coluna, posicao }: Pendente, motivo?: string) {
    if (!quadro) return
    // Atualiza a tela na hora e confirma no banco em seguida.
    setQuadro({ ...quadro, cards: quadro.cards.map((c) => c.id === card.id
      ? { ...c, coluna_id: coluna.id, posicao, motivo_impedimento: motivo ?? null } : c) })
    quicar(card.id)
    try { await moverCard(card, coluna.id, posicao, motivo) } catch { setErro('Não foi possível mover o card.') }
    await recarregar()
  }

  /** Solta o card na vaga escolhida: calcula a posição entre os vizinhos. */
  function soltarEm(card: Card, { coluna: colunaId, indice }: Vaga) {
    const coluna = quadro?.colunas.find((c) => c.id === colunaId)
    if (!coluna) return
    const todos = porColuna.get(coluna.id) ?? []
    if (card.coluna_id === coluna.id && todos.findIndex((c) => c.id === card.id) === indice) return
    const posicao = posicaoEntre(todos.filter((c) => c.id !== card.id), indice)
    const pendente = { card, coluna, posicao }
    // Mover para Impedimento exige motivo (documento, seção 4.3)
    if (coluna.exige_motivo && card.coluna_id !== coluna.id) setMotivoPara(pendente)
    else void executarMovimento(pendente)
  }

  const { arraste, vaga, chegou, quadroRef, voandoRef, iniciar, acabouDeSoltar, quicar } = useArrastar<Card>({ idDe: (c) => c.id, aoSoltar: soltarEm })
  const colunas = useColunasMinimizadas(quadro ? `luminy.kanban.colunas.${quadro.id}` : null, vaga)

  async function adicionar(coluna: Coluna, titulo: string) {
    if (!quadro || !titulo.trim()) return
    const ultimo = porColuna.get(coluna.id)?.at(-1)?.posicao ?? 0
    try { await criarCard(quadro.id, coluna.id, titulo.trim(), ultimo + 1) } catch { setErro('Não foi possível criar o card.') }
    // Como no Trello: o campo continua aberto para criar o próximo card
    await recarregar()
  }

  /** Atualiza na tela na hora e salva no banco (a ficha do card salva sozinha). */
  async function atualizarCard(id: string, parcial: EdicaoCard) {
    let capa_url: string | null | undefined
    if (parcial.capa_path) capa_url = (await linksArquivos([parcial.capa_path])).get(parcial.capa_path) ?? null
    else if (parcial.capa_path === null) capa_url = null
    setQuadro((q) => q && { ...q, cards: q.cards.map((c) => (c.id === id ? { ...c, ...parcial, ...(capa_url !== undefined ? { capa_url } : {}) } : c)) })
    await salvarCard(id, parcial)
  }
  const aberto = quadro?.cards.find((c) => c.id === abertoId) ?? null

  if (quadro === undefined) return <div className="corpo"><p className="pequeno">Carregando quadro…</p></div>
  if (quadro === null) return <div className="corpo"><h2>Kanban · Redes sociais</h2><p className="texto-2">Este cliente ainda não tem um quadro oficial.</p></div>

  return (
    <div className="corpo kanban-pagina">
      <div className="kanban-topo">
        <div>
          <h2>Kanban · Redes sociais</h2>
          <p className="pequeno">Quadro oficial do {cliente?.nome} · {quadro.cards.length} cards</p>
        </div>
        <div className="linha" style={{ gap: 10 }}>
          <div className="segmentos" role="radiogroup" aria-label="Visualização">
            <button type="button" role="radio" aria-checked={visao === 'quadro'} className={visao === 'quadro' ? 'marcado' : ''} onClick={() => trocarVisao('quadro')}><Columns3 size={15} /> Quadro</button>
            <button type="button" role="radio" aria-checked={visao === 'calendario'} className={visao === 'calendario' ? 'marcado' : ''} onClick={() => trocarVisao('calendario')}><CalendarDays size={15} /> Calendário</button>
          </div>
          {visao === 'quadro' && <Botao icone={<Plus size={16} aria-hidden />} onClick={() => setNovoEm(quadro.colunas[0]?.id ?? null)}>Novo card</Botao>}
        </div>
      </div>
      {erro && <p className="aviso" role="alert" style={{ background: 'rgb(229 72 77 / .1)', color: 'var(--perigo)' }}>{erro}</p>}

      {visao === 'calendario' ? (
        <CalendarioKanban cards={quadro.cards} colunas={quadro.colunas} pessoas={pessoas} onAbrir={setAbertoId}
          onMudarData={(c, postagem_em) => void atualizarCard(c.id, { postagem_em })}
          onCriar={async (dia, titulo) => {
            const col = quadro.colunas[0]; const ultimo = porColuna.get(col.id)?.at(-1)?.posicao ?? 0
            const [a, m, d] = dia.split('-').map(Number)
            try { await criarCard(quadro.id, col.id, titulo, ultimo + 1, new Date(a, m - 1, d, 12, 0).toISOString()) } catch { setErro('Não foi possível criar o card.') }
            await recarregar()
          }} />
      ) : (
      <div className="quadro" aria-label="Quadro de redes sociais" ref={quadroRef}>
        {quadro.colunas.map((col) => {
          const cards = porColuna.get(col.id) ?? []
          const visiveis = cards.filter((c) => c.id !== arraste?.id)
          const recolhida = colunas.recolhida(col.id, cards.length)
          const cor = COR_COLUNA[col.nome] ?? 'var(--marca-clara)'
          const vagaAqui = arraste && vaga?.coluna === col.id ? vaga.indice : -1
          const slot = <VagaCard key="vaga" altura={arraste?.altura} />

          if (recolhida) return <FaixaColuna key={col.id} id={col.id} nome={col.nome} cor={cor} total={cards.length} arrastando={!!arraste} onAbrir={() => colunas.alternar(col.id, cards.length)} />

          return (
            <section key={col.id} data-coluna={col.id} className={`coluna${vagaAqui >= 0 ? ' coluna--alvo' : ''}`}>
              <header className="coluna__topo">
                <span className="coluna__ponto" style={{ background: cor }} />
                <strong>{col.nome}</strong>
                <span className="pequeno">{cards.length}</span>
                <button className="coluna__mais" type="button" aria-label={`Novo card em ${col.nome}`} title="Novo card" onClick={() => setNovoEm(col.id)}><Plus size={16} /></button>
                <button className="coluna__mais" type="button" aria-label={`Minimizar coluna ${col.nome}`} title="Minimizar coluna" onClick={() => colunas.alternar(col.id, cards.length)}><ChevronsLeft size={16} /></button>
              </header>

              {visiveis.map((card, i) => [
                i === vagaAqui && slot,
                <article key={card.id} data-card={card.id} className={`card card--trello${chegou === card.id ? ' card--chegou' : ''}`}
                  onPointerDown={(e) => iniciar(e, card)}
                  onClick={() => { if (!acabouDeSoltar()) setAbertoId(card.id) }} tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter') setAbertoId(card.id) }}>
                  <CardConteudo card={card} ultima={col.posicao >= 4 && !col.exige_motivo} pessoas={pessoas} />
                </article>,
              ])}
              {vagaAqui >= visiveis.length && slot}

              {novoEm === col.id ? (
                <NovoCard onSalvar={(t) => void adicionar(col, t)} onCancelar={() => setNovoEm(null)} />
              ) : (
                <button className="coluna__adicionar" type="button" onClick={() => setNovoEm(col.id)}><Plus size={14} /> Adicionar card</button>
              )}
            </section>
          )
        })}
      </div>
      )}

      {arraste && (
        <CardVoando arraste={arraste} voandoRef={voandoRef} classe="card--trello"><CardConteudo card={arraste.item} pessoas={pessoas} /></CardVoando>
      )}

      {motivoPara && (
        <Motivo card={motivoPara.card} onCancelar={() => setMotivoPara(null)}
          onConfirmar={(m) => { void executarMovimento(motivoPara, m); setMotivoPara(null) }} />
      )}
      {aberto && (
        <FichaCard card={aberto} quadroId={quadro.id} colunas={quadro.colunas} pessoas={pessoas} onFechar={() => { setAbertoId(null); void recarregar() }}
          onAtualizar={(p) => atualizarCard(aberto.id, p)}
          onMover={(colunaId) => soltarEm(aberto, { coluna: colunaId, indice: (porColuna.get(colunaId) ?? []).filter((c) => c.id !== aberto.id).length })}
          onExcluir={async () => { await excluirCard(aberto.id); setAbertoId(null); await recarregar() }} />
      )}
    </div>
  )
}

function NovoCard({ onSalvar, onCancelar }: { onSalvar: (t: string) => void; onCancelar: () => void }) {
  const [titulo, setTitulo] = useState('')
  return (
    <form className="novo-card" onSubmit={(e) => { e.preventDefault(); if (titulo.trim()) { onSalvar(titulo); setTitulo('') } }}>
      <textarea className="entrada novo-card__texto" autoFocus rows={2} placeholder="Título do card (Enter adiciona)" value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (titulo.trim()) { onSalvar(titulo); setTitulo('') } }
          if (e.key === 'Escape') { e.preventDefault(); onCancelar() }
        }} />
      <div className="linha" style={{ gap: 6 }}>
        <Botao type="submit" disabled={!titulo.trim()}>Adicionar card</Botao>
        <button type="button" className="icone-botao" style={{ width: 36, height: 36, border: 0 }} aria-label="Cancelar" onClick={onCancelar}><X size={18} /></button>
      </div>
    </form>
  )
}

function Motivo({ card, onConfirmar, onCancelar }: { card: Card; onConfirmar: (m: string) => void; onCancelar: () => void }) {
  const [motivo, setMotivo] = useState('')
  return (
    <Janela titulo="Mover para Impedimento" onFechar={onCancelar}>
      <form className="janela__corpo" onSubmit={(e) => { e.preventDefault(); if (motivo.trim()) onConfirmar(motivo.trim()) }}>
        <p className="texto-2">O que está impedindo <strong>{card.titulo}</strong>? O card volta para a coluna de origem quando for liberado.</p>
        <textarea className="entrada" rows={3} autoFocus required value={motivo} onChange={(e) => setMotivo(e.target.value)}
          placeholder="Ex.: aguardando autorização de imagem" />
        <div className="linha" style={{ justifyContent: 'flex-end' }}>
          <Botao type="button" variante="fantasma" onClick={onCancelar}>Cancelar</Botao>
          <Botao type="submit" disabled={!motivo.trim()}>Mover</Botao>
        </div>
      </form>
    </Janela>
  )
}

