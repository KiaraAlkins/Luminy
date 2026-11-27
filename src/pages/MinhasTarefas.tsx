import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarClock, Check, ChevronDown, ClipboardList, Columns3, Repeat, Flag, Inbox, Play, Plus, Presentation, Sparkles, Trash2, User, X } from 'lucide-react'
import { Selecao } from '../components/Selecao'
import { OPCOES_PRIORIDADE } from '../components/opcoes'
import { comemorar } from '../lib/comemorar'
import { grupoDe, lerData, rotuloPrazo, type Grupo } from '../lib/datas'
import { useFoco } from '../lib/foco'
import { useSessao } from '../lib/sessao'
import { NavMeuEspaco } from '../components/NavMeuEspaco'
import { criarTarefa, excluirTarefa, meusItens, salvarTarefa, semRotinaFora, type MeuItem } from '../lib/tarefas'
import { salvarDemanda } from '../lib/demandas'
import { salvarOS } from '../lib/os'
import { marcarEncaminhamento } from '../lib/reunioes'
import { desmarcar, marcarFeito, type Ocorrencia } from '../lib/rotinas'
import { ConcluirRotina } from '../components/ConcluirRotina'
import { supabase } from '../lib/supabase'
import type { Prioridade } from '../lib/kanban'
import './tarefas.css'

const GRUPOS: { id: Grupo; nome: string }[] = [
  { id: 'atrasadas', nome: 'Atrasadas' }, { id: 'hoje', nome: 'Hoje' }, { id: 'amanha', nome: 'Amanhã' },
  { id: 'semana', nome: 'Esta semana' }, { id: 'depois', nome: 'Mais para frente' }, { id: 'sem_prazo', nome: 'Sem prazo' },
]
type Filtro = '' | MeuItem['origem']
const ORIGEM: Record<MeuItem['origem'], { nome: string; icone: React.ElementType }> = {
  tarefa: { nome: 'Pessoal', icone: User }, demanda: { nome: 'Demanda', icone: Inbox }, card: { nome: 'Kanban', icone: Columns3 }, os: { nome: 'OS', icone: ClipboardList }, rotina: { nome: 'Rotina', icone: Repeat }, reuniao: { nome: 'Reunião', icone: Presentation },
}
const paraInput = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '')

/**
 * Minhas tarefas: tudo o que é meu para fazer, de todos os clientes, num lugar só.
 * Tarefas pessoais são privadas (nem o dono da agência vê).
 */
export function MinhasTarefas() {
  const { usuario, clientes, trocarCliente } = useSessao()
  const navegar = useNavigate()
  const { foco, definir } = useFoco()
  const [itens, setItens] = useState<MeuItem[] | null>(null)
  const [filtro, setFiltro] = useState<Filtro>('')
  const [texto, setTexto] = useState('')
  const [prioridade, setPrioridade] = useState<Prioridade>('comum')
  const [aberta, setAberta] = useState<string | null>(null)
  const [saindo, setSaindo] = useState<Set<string>>(new Set())
  const [verFeitas, setVerFeitas] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [rotinaAberta, setRotinaAberta] = useState<Ocorrencia | null>(null)
  const eu = supabase ? usuario.id : 'p1'
  const campo = useRef<HTMLInputElement>(null)

  const carregar = useCallback(async () => { if (usuario.id) setItens(semRotinaFora(await meusItens(eu))) }, [usuario.id, eu])
  useEffect(() => { void Promise.resolve().then(carregar) }, [carregar])

  const lida = useMemo(() => lerData(texto), [texto])
  const visiveis = (itens ?? []).filter((i) => !filtro || i.origem === filtro)
  const abertas = visiveis.filter((i) => !i.concluida || saindo.has(i.id))
  const feitas = visiveis.filter((i) => i.concluida && !saindo.has(i.id)).sort((a, b) => (b.concluida_em ?? '').localeCompare(a.concluida_em ?? ''))
  const porGrupo = (g: Grupo) => abertas.filter((i) => grupoDe(i.prazo) === g).sort((a, b) => (a.prazo ?? '').localeCompare(b.prazo ?? '') || (a.prioridade === 'alta' ? -1 : 1))
  const conta = (g: Grupo) => (itens ?? []).filter((i) => !i.concluida && grupoDe(i.prazo) === g).length

  async function adicionar() {
    const titulo = lida.titulo.trim(); if (!titulo) return
    setErro(null)
    try { await criarTarefa(titulo, lida.prazo?.toISOString() ?? null, prioridade); setTexto(''); setPrioridade('comum'); await carregar() }
    catch (e) { setErro((e as Error).message) }
  }

  async function concluir(i: MeuItem) {
    if (i.origem === 'card') { abrir(i); return }
    const feito = !i.concluida
    if (i.origem === 'rotina' && i.ocorrencia) {
      // Rotina com checklist ou foto abre a janela de concluir; as simples marcam direto
      if (feito && (i.ocorrencia.rotina.checklist.length || i.ocorrencia.rotina.exige_foto)) { setRotinaAberta(i.ocorrencia); return }
      try {
        if (feito) { setSaindo((s) => new Set(s).add(i.id)); comemorar(); await marcarFeito(i.ocorrencia, {}, eu) }
        else if (i.registroId) await desmarcar(i.registroId)
      } catch (e) { setErro((e as Error).message) }
      setTimeout(() => setSaindo((s) => { const n = new Set(s); n.delete(i.id); return n }), 900)
      await carregar(); return
    }
    if (feito) { setSaindo((s) => new Set(s).add(i.id)); comemorar() }
    setItens((l) => l && l.map((x) => (x.id === i.id ? { ...x, concluida: feito, concluida_em: feito ? new Date().toISOString() : null } : x)))
    try {
      if (i.origem === 'tarefa') await salvarTarefa(i.id, { status: feito ? 'concluida' : 'a_fazer' })
      else if (i.origem === 'os') await salvarOS(i.id, { situacao: feito ? 'concluida' : 'em_andamento' })
      else if (i.origem === 'reuniao') await marcarEncaminhamento(i.reuniaoId!, i.id.split(':')[1], feito)
      else await salvarDemanda(i.id, { status: feito ? 'concluida' : 'em_andamento' })
    } catch (e) { setErro((e as Error).message); await carregar() }
    // Deixa a pessoa ver o risco e a animação antes de sair da lista
    setTimeout(() => setSaindo((s) => { const n = new Set(s); n.delete(i.id); return n }), 900)
  }

  function abrir(i: MeuItem) {
    if (i.origem === 'tarefa') { setAberta(aberta === i.id ? null : i.id); return }
    if (i.origem === 'rotina') { if (i.cliente_id && clientes.some((c) => c.id === i.cliente_id)) trocarCliente(i.cliente_id); navegar('/rotinas'); return }
    if (i.cliente_id && clientes.some((c) => c.id === i.cliente_id)) trocarCliente(i.cliente_id)
    navegar(i.origem === 'card' ? `/kanban?card=${i.id}` : i.origem === 'os' ? `/ordens?os=${i.id}` : i.origem === 'reuniao' ? `/reunioes?r=${i.reuniaoId}` : `/demandas?d=${i.id}`)
  }

  const linha = (i: MeuItem) => {
    const cli = clientes.find((c) => c.id === i.cliente_id)
    const g = grupoDe(i.prazo)
    const O = ORIGEM[i.origem].icone
    return (
      <li key={i.id} className={`tarefa${i.concluida ? ' tarefa--feita' : ''}${saindo.has(i.id) ? ' tarefa--saindo' : ''}${aberta === i.id ? ' tarefa--aberta' : ''}`}>
        <div className="tarefa__linha">
          <button type="button" className={`tarefa__check${i.origem === 'card' ? ' tarefa__check--card' : ''}`} aria-label={i.origem === 'card' ? `Abrir ${i.titulo} no Kanban` : i.concluida ? `Desmarcar ${i.titulo}` : `Concluir ${i.titulo}`}
            title={i.origem === 'card' ? 'Card do Kanban: conclua movendo para "Feito e aprovado"' : undefined} onClick={() => void concluir(i)}>
            {i.concluida && <Check size={14} strokeWidth={3} />}
          </button>
          <button type="button" className="tarefa__corpo" onClick={() => abrir(i)}>
            <span className="tarefa__titulo">{i.prioridade === 'alta' && <Flag size={13} className="tarefa__bandeira" aria-label="Prioridade alta" />}{i.titulo}</span>
            <span className="tarefa__meta">
              <span className={`tarefa__origem tarefa__origem--${i.origem}`}><O size={12} /> {i.detalhe ?? ORIGEM[i.origem].nome}</span>
              {cli && clientes.length > 1 && <span className="tarefa__cliente"><i style={{ background: cli.cor }} />{cli.nome}</span>}
              {i.prazo && <span className={`tarefa__prazo tarefa__prazo--${i.concluida ? 'ok' : g}`}><CalendarClock size={12} /> {rotuloPrazo(i.prazo)}</span>}
            </span>
          </button>
          {!i.concluida && (
            <button type="button" className={`tarefa__agora${foco?.titulo === i.titulo ? ' ativo' : ''}`} title="Fazer agora (aparece na TV da equipe)" aria-label={`Fazer agora: ${i.titulo}`}
              onClick={() => void definir(i.titulo, i.origem === 'card' ? i.id : null)}><Play size={14} /></button>
          )}
        </div>
        {aberta === i.id && i.origem === 'tarefa' && <EditarTarefa item={i} onMudou={carregar} onFechar={() => setAberta(null)} />}
      </li>
    )
  }

  const total = (itens ?? []).filter((i) => !i.concluida).length
  return (
    <div className="corpo minhas-tarefas">
      <NavMeuEspaco />
      <div className="linha" style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div><h2>Minhas tarefas</h2><p className="pequeno">Suas tarefas pessoais, rotinas, demandas, OS e cards do Kanban de todos os clientes · as pessoais só você vê</p></div>
        <div className="resumo-tarefas">
          {conta('atrasadas') > 0 && <span className="resumo-tarefas__item resumo-tarefas__item--perigo"><strong>{conta('atrasadas')}</strong> atrasadas</span>}
          <span className="resumo-tarefas__item"><strong>{conta('hoje')}</strong> para hoje</span>
          <span className="resumo-tarefas__item"><strong>{total}</strong> no total</span>
        </div>
      </div>

      <form className="nova-tarefa" onSubmit={(e) => { e.preventDefault(); void adicionar() }}>
        <Plus size={20} className="nova-tarefa__mais" />
        <input ref={campo} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder='O que você precisa fazer? Ex.: "Ligar para o RH amanhã 14h"' aria-label="Nova tarefa" />
        {lida.rotulo && <span className="nova-tarefa__data" title="Data entendida do texto"><Sparkles size={13} /> {lida.rotulo}</span>}
        {texto && <Selecao mini rotulo="Prioridade" valor={prioridade} onMudar={(v) => setPrioridade(v as Prioridade)} opcoes={OPCOES_PRIORIDADE} largura={120} />}
        {texto && <button type="submit" className="botao botao--primario botao--mini">Adicionar</button>}
      </form>
      {erro && <p className="pequeno" style={{ color: 'var(--perigo)' }}>{erro}</p>}

      <div className="segmentos" role="radiogroup" aria-label="Mostrar">
        {(['', 'tarefa', 'rotina', 'demanda', 'card', 'os', 'reuniao'] as const).filter((f) => f !== 'reuniao' || (itens ?? []).some((i) => i.origem === 'reuniao')).map((f) => (
          <button key={f} type="button" role="radio" aria-checked={filtro === f} className={filtro === f ? 'marcado' : ''} onClick={() => setFiltro(f)}>
            {f ? { tarefa: 'Pessoais', rotina: 'Rotinas', demanda: 'Demandas', card: 'Kanban', os: 'OS', reuniao: 'Reuniões' }[f] : 'Tudo'}
            <span>{(itens ?? []).filter((i) => !i.concluida && (!f || i.origem === f)).length}</span>
          </button>
        ))}
      </div>

      {itens === null && <p className="pequeno">Carregando…</p>}
      {itens !== null && abertas.length === 0 && (
        <div className="vazio-grande"><Check size={36} /><h3>Tudo em dia!</h3><p className="texto-2">Nada pendente por aqui. Escreva acima para criar uma tarefa.</p></div>
      )}

      {GRUPOS.map((g) => {
        const lista = porGrupo(g.id)
        if (!lista.length) return null
        return (
          <section key={g.id} className={`grupo-tarefas grupo-tarefas--${g.id}`}>
            <h3>{g.nome} <span>{lista.length}</span></h3>
            <ul>{lista.map(linha)}</ul>
          </section>
        )
      })}

      {feitas.length > 0 && (
        <section className="grupo-tarefas grupo-tarefas--feitas">
          <button type="button" className="excluidos__abrir" aria-expanded={verFeitas} onClick={() => setVerFeitas(!verFeitas)}>
            <ChevronDown size={16} style={{ transform: verFeitas ? 'rotate(180deg)' : undefined, transition: 'transform .2s' }} /> Concluídas nos últimos 7 dias ({feitas.length})
          </button>
          {verFeitas && <ul>{feitas.map(linha)}</ul>}
        </section>
      )}
      {rotinaAberta && <ConcluirRotina ocorrencia={rotinaAberta} usuarioId={eu} onFechar={() => setRotinaAberta(null)} onFeito={carregar} />}
    </div>
  )
}

function EditarTarefa({ item, onMudou, onFechar }: { item: MeuItem; onMudou: () => Promise<void>; onFechar: () => void }) {
  const [titulo, setTitulo] = useState(item.titulo)
  const [descricao, setDescricao] = useState(item.descricao ?? '')
  const salvar = async (d: Parameters<typeof salvarTarefa>[1]) => { await salvarTarefa(item.id, d); await onMudou() }
  return (
    <div className="tarefa__edicao">
      <input className="entrada" value={titulo} onChange={(e) => setTitulo(e.target.value)} onBlur={() => titulo.trim() && titulo !== item.titulo && void salvar({ titulo: titulo.trim() })} aria-label="Título" />
      <textarea className="entrada" rows={2} value={descricao} placeholder="Detalhes (opcional)" onChange={(e) => setDescricao(e.target.value)}
        onBlur={() => descricao !== (item.descricao ?? '') && void salvar({ descricao: descricao.trim() || null })} aria-label="Detalhes" />
      <div className="linha" style={{ gap: 8 }}>
        <input type="datetime-local" className="entrada entrada--mini" style={{ width: 210 }} value={paraInput(item.prazo)} onChange={(e) => void salvar({ prazo: e.target.value ? new Date(e.target.value).toISOString() : null })} aria-label="Prazo" />
        {item.prazo && <button type="button" className="botao botao--fantasma botao--mini" onClick={() => void salvar({ prazo: null })}><X size={13} /> Sem prazo</button>}
        <Selecao mini rotulo="Prioridade" valor={item.prioridade} onMudar={(v) => void salvar({ prioridade: v as Prioridade })} opcoes={OPCOES_PRIORIDADE} largura={130} />
        <span style={{ flex: 1 }} />
        <button type="button" className="botao botao--fantasma botao--mini" style={{ color: 'var(--perigo)' }} onClick={() => { if (confirm('Excluir esta tarefa?')) void excluirTarefa(item.id).then(onMudou).then(onFechar) }}><Trash2 size={14} /> Excluir</button>
      </div>
    </div>
  )
}
