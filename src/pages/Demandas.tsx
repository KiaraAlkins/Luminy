import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CalendarClock, Check, ChevronsLeft, Columns3, Hand, MessageSquare, Plus, Search, Send, Trash2 } from 'lucide-react'
import { Botao } from '../components/ui'
import { Janela } from '../components/Janela'
import { Selecao, type Opcao } from '../components/Selecao'
import { CardVoando, FaixaColuna, VagaCard } from '../components/Arrastar'
import { OPCOES_PRIORIDADE } from '../components/opcoes'
import { posicaoEntre, useArrastar, useColunasMinimizadas, type Vaga } from '../lib/arrastar'
import { grupoDe, rotuloPrazo } from '../lib/datas'
import { useFoco } from '../lib/foco'
import { useSessao } from '../lib/sessao'
import { supabase } from '../lib/supabase'
import { carregarQuadro, listarPessoas, type Pessoa, type Prioridade } from '../lib/kanban'
import {
  CATEGORIAS_DEMANDA, SETORES, SITUACOES, aceitarDemanda, comentarDemanda, criarDemanda, eventosDemanda, excluirDemanda,
  listarDemandas, nomeSituacao, salvarDemanda, virarCard, type Demanda, type EventoDemanda, type NovaDemanda, type StatusDemanda,
} from '../lib/demandas'
import { EscolherResponsaveis, FotoPessoa, Responsaveis } from './kanban/Pessoas'
import './kanban.css'
import './demandas.css'

const COR_CATEGORIA: Record<string, string> = { Arte: '#7A5AF8', Post: '#3D2EF9', Vídeo: '#E8890C', Fotografia: '#2E90FA', Evento: '#12A15F', Impresso: '#D6297A', Texto: '#0E9384', Outro: '#667085' }
const paraInput = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '')
const quando = (iso: string) => {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 60) return `há ${Math.max(1, min)} min`; const h = Math.round(min / 60); if (h < 24) return `há ${h} h`
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}
const opcoesPessoas = (pessoas: Pessoa[], vazio: string): Opcao[] => [{ valor: '', rotulo: vazio }, ...pessoas.map((p) => ({ valor: p.usuario_id, rotulo: p.nome, icone: <FotoPessoa pessoa={p} tamanho={26} /> }))]

function ConteudoDemanda({ d, pessoas, souEu, onAceitar }: { d: Demanda; pessoas: Pessoa[]; souEu?: boolean; onAceitar?: () => void }) {
  const g = d.status === 'concluida' ? null : grupoDe(d.prazo)
  return (
    <div className="card__corpo">
      <div className="card__etiquetas">
        {d.categoria && <span className="etiqueta" style={{ '--cor': COR_CATEGORIA[d.categoria] ?? '#667085' } as React.CSSProperties}>{d.categoria}</span>}
        {d.prioridade === 'alta' && <span className="etiqueta" style={{ '--cor': 'var(--perigo)' } as React.CSSProperties}>Alta</span>}
      </div>
      <strong className="card__titulo">{d.titulo}</strong>
      {d.setor_solicitante && <span className="pequeno">Pedido por <strong>{d.setor_solicitante}</strong></span>}
      <div className="card__rodape-card">
        <div className="card__selos">
          {d.prazo && <span className={`selo${g === 'atrasadas' ? ' selo--atrasado' : g === 'hoje' ? ' selo--hoje' : g === 'amanha' ? ' selo--breve' : ''}`}><CalendarClock size={13} /> {rotuloPrazo(d.prazo)}</span>}
          {d.card_id && <span className="selo" title="Virou card no Kanban"><Columns3 size={13} /></span>}
        </div>
        <Responsaveis ids={[d.responsavel_id, ...d.colaboradores].filter(Boolean) as string[]} pessoas={pessoas} />
      </div>
      {d.status === 'aguardando_aceite' && onAceitar && (!d.responsavel_id || souEu) && (
        <button type="button" className="aceitar" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onAceitar() }}><Hand size={14} /> Aceitar</button>
      )}
    </div>
  )
}

/** Demandas: pedidos dos setores do cliente, do "aguardando aceite" até "concluída". */
export function Demandas() {
  const { cliente, usuario, ehAdminCliente } = useSessao()
  const navegar = useNavigate()
  const [params, setParams] = useSearchParams()
  const [demandas, setDemandas] = useState<Demanda[] | null>(null)
  const [pessoas, setPessoas] = useState<Pessoa[]>([])
  const [filtro, setFiltro] = useState<'todas' | 'minhas'>('todas')
  const [busca, setBusca] = useState('')
  const [nova, setNova] = useState(false)
  const [justificar, setJustificar] = useState<{ d: Demanda; status: StatusDemanda; posicao?: number } | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const abertaId = params.get('d')
  const eu = supabase ? usuario.id : 'p1'   // no modo demonstração, "eu" é a pessoa dos dados de exemplo

  const carregar = useCallback(async () => { if (cliente) setDemandas(await listarDemandas(cliente.id)) }, [cliente])
  useEffect(() => { void Promise.resolve().then(carregar) }, [carregar])
  useEffect(() => { if (cliente) void listarPessoas(cliente.id).then(setPessoas) }, [cliente])

  const visiveis = useMemo(() => (demandas ?? []).filter((d) =>
    (filtro === 'todas' || d.responsavel_id === eu || d.colaboradores.includes(eu) || (d.status === 'aguardando_aceite' && !d.responsavel_id)) &&
    (!busca || `${d.titulo} ${d.setor_solicitante ?? ''} ${d.categoria ?? ''}`.toLowerCase().includes(busca.toLowerCase()))), [demandas, filtro, busca, eu])
  const porSituacao = (s: StatusDemanda) => visiveis.filter((d) => d.status === s).sort((a, b) => a.posicao - b.posicao)
  const mudarParam = (v: string | null) => { const p = new URLSearchParams(params); if (v) p.set('d', v); else p.delete('d'); setParams(p, { replace: true }) }

  async function mudar(d: Demanda, dados: Partial<Demanda>) {
    setErro(null)
    setDemandas((l) => l && l.map((x) => (x.id === d.id ? { ...x, ...dados } : x)))
    try { await salvarDemanda(d.id, dados) } catch (e) { setErro((e as Error).message); await carregar() }
  }
  async function aceitar(d: Demanda) {
    setErro(null)
    try { await aceitarDemanda(d.id, eu); quicar(d.id); await carregar() } catch (e) { setErro((e as Error).message) }
  }

  function soltar(d: Demanda, { coluna, indice }: Vaga) {
    const status = coluna as StatusDemanda
    const lista = porSituacao(status).filter((x) => x.id !== d.id)
    if (d.status === status && porSituacao(status).findIndex((x) => x.id === d.id) === indice) return
    const posicao = posicaoEntre(lista, indice)
    if (status === d.status) { void mudar(d, { posicao }); quicar(d.id); return }
    if (d.status === 'aguardando_aceite' && status !== 'cancelada') { void aceitar(d).then(() => { if (status !== 'a_fazer') void mudar({ ...d, status: 'a_fazer' }, { status, posicao }) }); return }
    if (SITUACOES.find((s) => s.id === status)?.justificativa) { setJustificar({ d, status, posicao }); return }
    void mudar(d, { status, posicao, justificativa: null }); quicar(d.id)
  }
  const { arraste, vaga, chegou, quadroRef, voandoRef, iniciar, acabouDeSoltar, quicar } = useArrastar<Demanda>({ idDe: (d) => d.id, aoSoltar: soltar })
  const colunas = useColunasMinimizadas(cliente ? `luminy.demandas.colunas.${cliente.id}` : null, vaga)

  if (!cliente) return <div className="corpo"><h2>Demandas</h2><p className="texto-2">Crie um cliente primeiro.</p></div>
  const aberta = demandas?.find((d) => d.id === abertaId) ?? null
  const aguardando = (demandas ?? []).filter((d) => d.status === 'aguardando_aceite').length

  return (
    <div className="corpo kanban-pagina">
      <div className="kanban-topo">
        <div>
          <h2>Demandas</h2>
          <p className="pequeno">Pedidos dos setores do {cliente.nome}{aguardando ? ` · ${aguardando} aguardando aceite` : ''}</p>
        </div>
        <div className="linha" style={{ gap: 10 }}>
          <label className="busca" style={{ width: 220 }}><Search size={16} aria-hidden />
            <input aria-label="Buscar demanda" placeholder="Buscar" value={busca} onChange={(e) => setBusca(e.target.value)} style={{ border: 0, outline: 0, background: 'none', flex: 1 }} /></label>
          <div className="segmentos" role="radiogroup" aria-label="Mostrar">
            <button type="button" role="radio" aria-checked={filtro === 'todas'} className={filtro === 'todas' ? 'marcado' : ''} onClick={() => setFiltro('todas')}>Todas</button>
            <button type="button" role="radio" aria-checked={filtro === 'minhas'} className={filtro === 'minhas' ? 'marcado' : ''} onClick={() => setFiltro('minhas')}>Minhas</button>
          </div>
          <Botao icone={<Plus size={16} />} onClick={() => setNova(true)}>Nova demanda</Botao>
        </div>
      </div>
      {erro && <p className="importar__erro" role="alert">{erro}</p>}

      <div className="quadro" ref={quadroRef} aria-label="Demandas por situação">
        {SITUACOES.map((s) => {
          const lista = porSituacao(s.id)
          const visiveisCol = lista.filter((d) => d.id !== arraste?.id)
          const vagaAqui = arraste && vaga?.coluna === s.id ? vaga.indice : -1
          const slot = <VagaCard key="vaga" altura={arraste?.altura} />
          const fechada = (s.id === 'cancelada' || s.id === 'impedida') && lista.length === 0
          if (colunas.recolhida(s.id, lista.length) || fechada && vaga?.coluna !== s.id) {
            return <FaixaColuna key={s.id} id={s.id} nome={s.nome} cor={s.cor} total={lista.length} arrastando={!!arraste} onAbrir={() => colunas.alternar(s.id, lista.length)} />
          }
          return (
            <section key={s.id} data-coluna={s.id} className={`coluna${vagaAqui >= 0 ? ' coluna--alvo' : ''}`}>
              <header className="coluna__topo">
                <span className="coluna__ponto" style={{ background: s.cor }} />
                <strong>{s.nome}</strong><span className="pequeno">{lista.length}</span>
                <button className="coluna__mais" type="button" aria-label={`Minimizar ${s.nome}`} title="Minimizar coluna" onClick={() => colunas.alternar(s.id, lista.length)}><ChevronsLeft size={16} /></button>
              </header>
              {visiveisCol.map((d, i) => [
                i === vagaAqui && slot,
                <article key={d.id} data-card={d.id} className={`card card--trello${chegou === d.id ? ' card--chegou' : ''}${d.status === 'aguardando_aceite' ? ' card--aguardando' : ''}`} tabIndex={0}
                  onPointerDown={(e) => iniciar(e, d)} onClick={() => { if (!acabouDeSoltar()) mudarParam(d.id) }}
                  onKeyDown={(e) => { if (e.key === 'Enter') mudarParam(d.id) }}>
                  <ConteudoDemanda d={d} pessoas={pessoas} souEu={d.responsavel_id === eu} onAceitar={() => void aceitar(d)} />
                </article>,
              ])}
              {vagaAqui >= visiveisCol.length && slot}
              {s.id === 'aguardando_aceite' && <button className="coluna__adicionar" type="button" onClick={() => setNova(true)}><Plus size={14} /> Nova demanda</button>}
            </section>
          )
        })}
      </div>
      {arraste && <CardVoando arraste={arraste} voandoRef={voandoRef} classe="card--trello"><ConteudoDemanda d={arraste.item} pessoas={pessoas} /></CardVoando>}

      {nova && <NovaDemandaJanela pessoas={pessoas} onFechar={() => setNova(false)} onCriar={async (d) => { await criarDemanda(cliente.id, d); setNova(false); await carregar() }} />}
      {justificar && (
        <Justificar titulo={`${justificar.status === 'cancelada' ? 'Cancelar' : 'Marcar como impedida'}: ${justificar.d.titulo}`}
          onCancelar={() => setJustificar(null)}
          onConfirmar={(j) => { void mudar(justificar.d, { status: justificar.status, justificativa: j, ...(justificar.posicao !== undefined ? { posicao: justificar.posicao } : {}) }); quicar(justificar.d.id); setJustificar(null) }} />
      )}
      {aberta && (
        <FichaDemanda d={aberta} pessoas={pessoas} eu={eu} podeExcluir={ehAdminCliente} clienteId={cliente.id}
          onFechar={() => mudarParam(null)} onMudar={(dados) => mudar(aberta, dados)} onAceitar={() => aceitar(aberta)}
          onSituacao={(status) => (SITUACOES.find((s) => s.id === status)?.justificativa ? setJustificar({ d: aberta, status }) : void mudar(aberta, { status, justificativa: null }))}
          onExcluir={async () => { await excluirDemanda(aberta.id); mudarParam(null); await carregar() }}
          onAbrirCard={(id) => navegar(`/kanban?card=${id}`)} onRecarregar={carregar} />
      )}
    </div>
  )
}

function Justificar({ titulo, onConfirmar, onCancelar }: { titulo: string; onConfirmar: (j: string) => void; onCancelar: () => void }) {
  const [texto, setTexto] = useState('')
  return (
    <Janela titulo={titulo} onFechar={onCancelar}>
      <form className="janela__corpo" onSubmit={(e) => { e.preventDefault(); if (texto.trim()) onConfirmar(texto.trim()) }}>
        <p className="texto-2">Escreva o motivo. Ele fica no histórico e quem pediu consegue ver.</p>
        <textarea className="entrada" rows={3} autoFocus value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Ex.: aguardando as fotos da diretoria" />
        <div className="linha" style={{ justifyContent: 'flex-end' }}><Botao type="button" variante="fantasma" onClick={onCancelar}>Voltar</Botao><Botao type="submit" disabled={!texto.trim()}>Confirmar</Botao></div>
      </form>
    </Janela>
  )
}

function NovaDemandaJanela({ pessoas, onFechar, onCriar }: { pessoas: Pessoa[]; onFechar: () => void; onCriar: (d: NovaDemanda) => Promise<void> }) {
  const [d, setD] = useState<NovaDemanda>({ titulo: '', descricao: null, categoria: 'Arte', setor_solicitante: null, prioridade: 'comum', prazo: null, responsavel_id: null, colaboradores: [] })
  const [erro, setErro] = useState<string | null>(null)
  async function enviar(e: FormEvent) {
    e.preventDefault()
    try { await onCriar({ ...d, titulo: d.titulo.trim() }) } catch (err) { setErro((err as Error).message) }
  }
  return (
    <Janela titulo="Nova demanda" onFechar={onFechar} largura={620}>
      <form className="janela__corpo" onSubmit={enviar}>
        <input className="editar-card__titulo" style={{ fontSize: 24 }} autoFocus required placeholder="O que precisa ser feito?" value={d.titulo} onChange={(e) => setD({ ...d, titulo: e.target.value })} aria-label="Título da demanda" />
        <textarea className="entrada" rows={3} placeholder="Detalhes: tamanho, onde vai ser usado, textos, referências…" value={d.descricao ?? ''} onChange={(e) => setD({ ...d, descricao: e.target.value || null })} aria-label="Detalhes" />
        <div className="campo"><span className="rotulo-campo">Quem está pedindo?</span>
          <div className="linha" style={{ gap: 6 }}>{SETORES.map((s) => (
            <button key={s} type="button" className={`opcao opcao--mini${d.setor_solicitante === s ? ' marcada' : ''}`} onClick={() => setD({ ...d, setor_solicitante: d.setor_solicitante === s ? null : s })}>{s}</button>
          ))}</div></div>
        <div className="grade-2">
          <div className="campo"><label htmlFor="dm-cat">Tipo</label>
            <Selecao id="dm-cat" valor={d.categoria ?? ''} onMudar={(v) => setD({ ...d, categoria: v || null })} opcoes={CATEGORIAS_DEMANDA.map((c) => ({ valor: c, rotulo: c, cor: COR_CATEGORIA[c] }))} /></div>
          <div className="campo"><label htmlFor="dm-pri">Prioridade</label>
            <Selecao id="dm-pri" valor={d.prioridade} onMudar={(v) => setD({ ...d, prioridade: v as Prioridade })} opcoes={OPCOES_PRIORIDADE} /></div>
          <div className="campo"><label htmlFor="dm-prazo">Prazo</label>
            <input id="dm-prazo" type="datetime-local" className="entrada" value={paraInput(d.prazo)} onChange={(e) => setD({ ...d, prazo: e.target.value ? new Date(e.target.value).toISOString() : null })} /></div>
          <div className="campo"><label htmlFor="dm-resp">Direcionar para</label>
            <Selecao id="dm-resp" valor={d.responsavel_id ?? ''} onMudar={(v) => setD({ ...d, responsavel_id: v || null })} opcoes={opcoesPessoas(pessoas, 'Qualquer pessoa da equipe')} /></div>
        </div>
        {erro && <p className="pequeno" style={{ color: 'var(--perigo)' }}>{erro}</p>}
        <div className="linha" style={{ justifyContent: 'flex-end' }}><Botao type="button" variante="fantasma" onClick={onFechar}>Cancelar</Botao><Botao type="submit" disabled={!d.titulo.trim()}>Criar demanda</Botao></div>
      </form>
    </Janela>
  )
}

function FichaDemanda({ d, pessoas, eu, podeExcluir, clienteId, onFechar, onMudar, onAceitar, onSituacao, onExcluir, onAbrirCard, onRecarregar }: {
  d: Demanda; pessoas: Pessoa[]; eu: string; podeExcluir: boolean; clienteId: string
  onFechar: () => void; onMudar: (dados: Partial<Demanda>) => Promise<void>; onAceitar: () => Promise<void>
  onSituacao: (s: StatusDemanda) => void; onExcluir: () => Promise<void>; onAbrirCard: (id: string) => void; onRecarregar: () => Promise<void>
}) {
  const { definir } = useFoco()
  const [eventos, setEventos] = useState<EventoDemanda[]>([])
  const [comentario, setComentario] = useState('')
  const [titulo, setTitulo] = useState(d.titulo)
  const [descricao, setDescricao] = useState(d.descricao ?? '')
  const [criandoCard, setCriandoCard] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const carregarEventos = useCallback(async () => setEventos(await eventosDemanda(d.id)), [d.id])
  useEffect(() => { void Promise.resolve().then(carregarEventos) }, [carregarEventos, d.status])
  const nome = (id: string | null) => pessoas.find((p) => p.usuario_id === id)?.nome

  async function paraKanban() {
    setCriandoCard(true); setErro(null)
    try {
      const q = await carregarQuadro(clienteId)
      if (!q || !q.colunas.length) throw new Error('Este cliente ainda não tem Kanban.')
      const id = await virarCard(d, q.id, q.colunas[0].id)
      await onRecarregar(); onAbrirCard(id)
    } catch (e) { setErro((e as Error).message) }
    setCriandoCard(false)
  }

  return (
    <Janela titulo="Demanda" onFechar={onFechar} largura={940} classe="ficha-card">
      <div className="ficha-card__corpo">
        <div className="ficha-card__principal">
          <input className="editar-card__titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} aria-label="Título"
            onBlur={() => { if (titulo.trim() && titulo !== d.titulo) void onMudar({ titulo: titulo.trim() }); else setTitulo(d.titulo) }} />
          <p className="pequeno" style={{ marginTop: -10 }}>Pedida {quando(d.criado_em)}{d.setor_solicitante ? ` por ${d.setor_solicitante}` : ''}{nome(d.criado_por) ? ` · aberta por ${nome(d.criado_por)}` : ''}</p>

          <div className="trilha-demanda" role="radiogroup" aria-label="Situação">
            {SITUACOES.filter((s) => s.id !== 'aguardando_aceite' || d.status === 'aguardando_aceite').map((s) => (
              <button key={s.id} type="button" role="radio" aria-checked={d.status === s.id} style={{ '--cor': s.cor } as React.CSSProperties}
                className={`etapas-lead__item${d.status === s.id ? ' marcado' : ''}`}
                onClick={() => { if (s.id === d.status) return; if (d.status === 'aguardando_aceite') void onAceitar().then(() => { if (s.id !== 'a_fazer') onSituacao(s.id) }); else onSituacao(s.id) }}>
                {s.nome}
              </button>
            ))}
          </div>
          {d.justificativa && (d.status === 'impedida' || d.status === 'cancelada') && <p className="card__impedimento">{d.justificativa}</p>}

          <section className="ficha-secao">
            <h4>Detalhes do pedido</h4>
            <textarea className="entrada ficha-texto" rows={4} value={descricao} placeholder="O que precisa, onde vai ser usado, referências…"
              onChange={(e) => setDescricao(e.target.value)} onBlur={() => descricao !== (d.descricao ?? '') && void onMudar({ descricao: descricao.trim() || null })} />
          </section>

          <section className="ficha-secao">
            <h4><MessageSquare size={16} /> Conversa e histórico</h4>
            <form className="comentar" onSubmit={(e) => { e.preventDefault(); const t = comentario.trim(); if (t) void comentarDemanda(d.id, t).then(() => { setComentario(''); return carregarEventos() }) }}>
              <input className="entrada" value={comentario} onChange={(e) => setComentario(e.target.value)} placeholder="Escreva para a equipe… (Enter envia)" aria-label="Comentário" />
              {comentario && <button type="submit" className="icone-botao" aria-label="Enviar"><Send size={15} /></button>}
            </form>
            <ul className="comentarios">
              {eventos.map((e) => (
                <li key={e.id} className={e.tipo !== 'comentario' ? 'comentarios__sistema' : ''}>
                  <span className="comentarios__avatar">{(e.autor ?? '•').slice(0, 1).toUpperCase()}</span>
                  <div>
                    <span className="linha" style={{ gap: 8 }}><strong>{e.autor ?? 'Luminy'}</strong><span className="pequeno">{quando(e.criado_em)}</span></span>
                    {e.tipo === 'comentario' ? <p>{e.texto}</p> : (
                      <span className="pequeno">{e.tipo === 'criada' ? 'abriu a demanda' : e.tipo === 'card' ? 'levou a demanda para o Kanban'
                        : `mudou de ${nomeSituacao(e.detalhe.de as StatusDemanda)} para ${nomeSituacao(e.detalhe.para as StatusDemanda)}${e.detalhe.justificativa ? `: "${e.detalhe.justificativa}"` : ''}`}</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
          {erro && <p className="importar__erro">{erro}</p>}
        </div>

        <aside className="painel-propriedades">
          <span className="rotulo">Propriedades</span>
          <div className="propriedade"><span>Responsável</span>
            <Selecao mini valor={d.responsavel_id ?? ''} onMudar={(v) => void onMudar({ responsavel_id: v || null })} opcoes={opcoesPessoas(pessoas, 'Ninguém ainda')} /></div>
          <div className="propriedade"><span>Quem ajuda</span>
            <EscolherResponsaveis ids={d.colaboradores} pessoas={pessoas.filter((p) => p.usuario_id !== d.responsavel_id)} onMudar={(ids) => void onMudar({ colaboradores: ids })} /></div>
          <div className="propriedade"><span>Prazo</span>
            <input type="datetime-local" className="entrada entrada--mini" value={paraInput(d.prazo)} onChange={(e) => void onMudar({ prazo: e.target.value ? new Date(e.target.value).toISOString() : null })} aria-label="Prazo" /></div>
          <div className="propriedade"><span>Prioridade</span><Selecao mini valor={d.prioridade} onMudar={(v) => void onMudar({ prioridade: v as Prioridade })} opcoes={OPCOES_PRIORIDADE} /></div>
          <div className="propriedade"><span>Tipo</span><Selecao mini valor={d.categoria ?? ''} onMudar={(v) => void onMudar({ categoria: v || null })} opcoes={CATEGORIAS_DEMANDA.map((c) => ({ valor: c, rotulo: c, cor: COR_CATEGORIA[c] }))} /></div>
          <div className="propriedade"><span>Quem pediu</span><Selecao mini valor={d.setor_solicitante ?? ''} onMudar={(v) => void onMudar({ setor_solicitante: v || null })} opcoes={[{ valor: '', rotulo: 'Não informado' }, ...SETORES.map((s) => ({ valor: s, rotulo: s }))]} /></div>

          <span className="rotulo" style={{ marginTop: 8 }}>Ações</span>
          {d.status === 'aguardando_aceite' && (!d.responsavel_id || d.responsavel_id === eu || podeExcluir) && (
            <button type="button" className="painel-propriedades__acao painel-propriedades__acao--destaque" onClick={() => void onAceitar()}><Hand size={15} /> Aceitar demanda</button>
          )}
          {d.status !== 'aguardando_aceite' && d.status !== 'concluida' && (
            <button type="button" className="painel-propriedades__acao painel-propriedades__acao--destaque" onClick={() => void onMudar({ status: 'concluida', justificativa: null })}><Check size={15} /> Concluir</button>
          )}
          <button type="button" className="painel-propriedades__acao" onClick={() => { void definir(d.titulo); onFechar() }}>▶ Fazer agora</button>
          {d.card_id
            ? <button type="button" className="painel-propriedades__acao" onClick={() => onAbrirCard(d.card_id!)}><Columns3 size={15} /> Abrir card no Kanban</button>
            : <button type="button" className="painel-propriedades__acao" disabled={criandoCard} onClick={() => void paraKanban()}><Columns3 size={15} /> {criandoCard ? 'Criando…' : 'Levar para o Kanban'}</button>}
          {podeExcluir && <button type="button" className="painel-propriedades__acao painel-propriedades__acao--perigo" onClick={() => { if (confirm('Excluir esta demanda e o histórico?')) void onExcluir() }}><Trash2 size={15} /> Excluir</button>}
        </aside>
      </div>
    </Janela>
  )
}
