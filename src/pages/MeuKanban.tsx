import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlignLeft, CalendarClock, ChevronsLeft, Plus, Repeat, Trash2 } from 'lucide-react'
import { Botao } from '../components/ui'
import { Janela } from '../components/Janela'
import { Selecao } from '../components/Selecao'
import { OPCOES_PRIORIDADE } from '../components/opcoes'
import { NavMeuEspaco } from '../components/NavMeuEspaco'
import { CardVoando, FaixaColuna, VagaCard } from '../components/Arrastar'
import { useArrastar, useColunasMinimizadas, type Vaga } from '../lib/arrastar'
import { lerData, rotuloPrazo } from '../lib/datas'
import { dataIso } from '../lib/rotinas'
import { criarTarefa, excluirTarefa, listarTarefasPessoais, salvarTarefa, type StatusTarefa, type Tarefa } from '../lib/tarefas'
import type { Prioridade } from '../lib/kanban'
import './kanban.css'
import './meu-kanban.css'

const COLUNAS: { id: StatusTarefa; nome: string; cor: string; vazio: string }[] = [
  { id: 'a_fazer', nome: 'A fazer', cor: '#98A2B3', vazio: 'Nada para fazer. Escreva abaixo para criar.' },
  { id: 'em_andamento', nome: 'Fazendo', cor: '#3D2EF9', vazio: 'Arraste para cá o que está fazendo agora' },
  { id: 'impedida', nome: 'Travada', cor: '#E5484D', vazio: 'Esperando alguém ou alguma coisa' },
  { id: 'concluida', nome: 'Feito', cor: '#12A15F', vazio: 'O que você concluir aparece aqui' },
]
const paraInput = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '')

/** Meu Kanban: as tarefas pessoais (as mesmas de Minhas tarefas, do Calendário e da Minha rotina) em colunas. */
export function MeuKanban() {
  const [tarefas, setTarefas] = useState<Tarefa[] | null>(null)
  const [texto, setTexto] = useState('')
  const [abrir, setAbrir] = useState<Tarefa | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [agora] = useState(() => new Date())

  const carregar = useCallback(async () => {
    try { setTarefas(await listarTarefasPessoais()) } catch (e) { setErro((e as Error).message) }
  }, [])
  useEffect(() => { void Promise.resolve().then(carregar) }, [carregar])

  // Tarefas da rotina: só as de hoje e amanhã (as próximas ficam no Calendário), a não ser que já tenham saído do "A fazer"
  const hoje = dataIso(agora)
  const amanha = dataIso(new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + 1))
  const semana = new Date(agora.getTime() - 7 * 86_400_000).toISOString()
  const visiveis = useMemo(() => (tarefas ?? []).filter((t) => {
    if (t.status === 'concluida') return t.rotina_pessoal_id ? t.rotina_data === hoje : (t.concluida_em ?? '') >= semana
    return !t.rotina_pessoal_id || t.status !== 'a_fazer' || t.rotina_data === hoje || t.rotina_data === amanha
  }), [tarefas, hoje, amanha, semana])
  const daColuna = (c: StatusTarefa) => visiveis.filter((t) => t.status === c)
    .sort((a, b) => c === 'concluida' ? (b.concluida_em ?? '').localeCompare(a.concluida_em ?? '') : (a.prazo ?? '9').localeCompare(b.prazo ?? '9'))

  function soltarEm(t: Tarefa, vaga: Vaga) {
    const status = vaga.coluna as StatusTarefa
    if (status === t.status) return
    setTarefas((l) => l?.map((x) => (x.id === t.id ? { ...x, status, concluida_em: status === 'concluida' ? new Date().toISOString() : null } : x)) ?? null)
    quicar(t.id)
    void salvarTarefa(t.id, { status }).catch((e) => { setErro((e as Error).message); void carregar() })
  }
  const { arraste, vaga, chegou, quadroRef, voandoRef, iniciar, acabouDeSoltar, quicar } = useArrastar<Tarefa>({ idDe: (t) => t.id, aoSoltar: soltarEm })
  const colunas = useColunasMinimizadas('luminy.meu-kanban.colunas', vaga)

  const lida = useMemo(() => lerData(texto), [texto])
  async function adicionar() {
    const titulo = lida.titulo.trim(); if (!titulo) return
    setTexto('')
    await criarTarefa(titulo, lida.prazo?.toISOString() ?? null)
    await carregar()
  }

  const conteudo = (t: Tarefa) => {
    const atrasada = t.prazo && t.status !== 'concluida' && new Date(t.prazo) < agora
    return (
      <>
        <div className="mk-card__topo">
          {t.prioridade === 'alta' && <span className="mk-prioridade" title="Prioridade alta" />}
          <strong className="mk-card__titulo">{t.titulo}</strong>
        </div>
        {t.descricao && <p className="mk-card__desc"><AlignLeft size={12} /> {t.descricao}</p>}
        {(t.prazo || t.rotina_pessoal_id) && (
          <div className="mk-card__meta">
            {t.prazo && <span className={`mk-prazo${atrasada ? ' atrasada' : ''}`}><CalendarClock size={12} /> {rotuloPrazo(t.prazo, agora, new Date(t.prazo).getMinutes() !== 59)}</span>}
            {t.rotina_pessoal_id && <span className="mk-rotina"><Repeat size={12} /> Rotina</span>}
          </div>
        )}
      </>
    )
  }

  return (
    <div className="corpo">
      <NavMeuEspaco />
      <div><h2>Meu Kanban</h2><p className="pequeno">Suas tarefas pessoais em colunas. São as mesmas de Minhas tarefas, do Calendário e da Minha rotina: mudou aqui, muda lá. Só você vê.</p></div>
      {erro && <p className="importar__erro">{erro}</p>}

      {tarefas === null ? <p className="pequeno">Carregando…</p> : (
        <div className="quadro meu-kanban" ref={quadroRef}>
          {COLUNAS.map((col) => {
            const lista = daColuna(col.id)
            const semArraste = lista.filter((x) => x.id !== arraste?.id)
            const vagaAqui = arraste && vaga?.coluna === col.id ? vaga.indice : -1
            const slot = <VagaCard key="vaga" altura={arraste?.altura} />
            if (colunas.recolhida(col.id, lista.length) && col.id !== 'a_fazer') {
              return <FaixaColuna key={col.id} id={col.id} nome={col.nome} cor={col.cor} total={lista.length} arrastando={!!arraste} onAbrir={() => colunas.alternar(col.id, lista.length)} />
            }
            return (
              <section key={col.id} data-coluna={col.id} className={`coluna${vagaAqui >= 0 ? ' coluna--alvo' : ''}`} aria-label={col.nome}>
                <header className="coluna__topo">
                  <span className="coluna__ponto" style={{ background: col.cor }} />
                  <strong>{col.nome}</strong><span className="pequeno">{lista.length}</span>
                  {col.id !== 'a_fazer' && <button className="coluna__mais" type="button" aria-label={`Minimizar coluna ${col.nome}`} title="Minimizar coluna" onClick={() => colunas.alternar(col.id, lista.length)}><ChevronsLeft size={16} /></button>}
                </header>
                {semArraste.map((t, i) => [
                  i === vagaAqui && slot,
                  <article key={t.id} data-card={t.id} className={`card mk-card mk-card--${col.id}${chegou === t.id ? ' card--chegou' : ''}`} tabIndex={0} role="button" aria-label={`Abrir ${t.titulo}`}
                    onPointerDown={(e) => iniciar(e, t)} onClick={() => { if (!acabouDeSoltar()) setAbrir(t) }} onKeyDown={(e) => { if (e.key === 'Enter') setAbrir(t) }}>
                    {conteudo(t)}
                  </article>,
                ])}
                {vagaAqui >= semArraste.length && slot}
                {lista.length === 0 && vagaAqui < 0 && <p className="pequeno" style={{ padding: '4px 8px' }}>{col.vazio}</p>}
                {col.id === 'a_fazer' && (
                  <form className="mk-nova" onSubmit={(e) => { e.preventDefault(); void adicionar() }}>
                    <Plus size={15} aria-hidden />
                    <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Nova tarefa… (ex.: ligar pro fornecedor amanhã 15h)" aria-label="Nova tarefa" />
                    {lida.rotulo && <span className="mk-nova__data">{lida.rotulo}</span>}
                  </form>
                )}
              </section>
            )
          })}
        </div>
      )}
      {arraste && <CardVoando arraste={arraste} voandoRef={voandoRef} classe="mk-card">{conteudo(arraste.item)}</CardVoando>}
      {abrir && <TarefaJanela tarefa={abrir} onFechar={() => setAbrir(null)} onMudou={async () => { setAbrir(null); await carregar() }} />}
    </div>
  )
}

function TarefaJanela({ tarefa, onFechar, onMudou }: { tarefa: Tarefa; onFechar: () => void; onMudou: () => Promise<void> }) {
  const [titulo, setTitulo] = useState(tarefa.titulo)
  const [descricao, setDescricao] = useState(tarefa.descricao ?? '')
  const [prazo, setPrazo] = useState(paraInput(tarefa.prazo))
  const [prioridade, setPrioridade] = useState<Prioridade>(tarefa.prioridade)
  const [status, setStatus] = useState<StatusTarefa>(tarefa.status)
  const [salvando, setSalvando] = useState(false)
  async function salvar() {
    setSalvando(true)
    await salvarTarefa(tarefa.id, { titulo: titulo.trim() || tarefa.titulo, descricao: descricao.trim() || null, prazo: prazo ? new Date(prazo).toISOString() : null, prioridade, status })
    await onMudou()
  }
  return (
    <Janela titulo="Tarefa" onFechar={onFechar} largura={520}>
      <form className="janela__corpo" onSubmit={(e) => { e.preventDefault(); void salvar() }}>
        {tarefa.rotina_pessoal_id && <p className="faixa-dica"><Repeat size={15} /> Esta tarefa vem da Minha rotina.</p>}
        <div className="campo"><label htmlFor="mk-titulo">Tarefa</label><input id="mk-titulo" className="entrada" value={titulo} onChange={(e) => setTitulo(e.target.value)} /></div>
        <div className="campo"><label htmlFor="mk-desc">Detalhes</label><textarea id="mk-desc" className="entrada" rows={3} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Anotações, links, o que precisa…" /></div>
        <div className="grade-2">
          <div className="campo"><label htmlFor="mk-prazo">Prazo</label><input id="mk-prazo" type="datetime-local" className="entrada" value={prazo} onChange={(e) => setPrazo(e.target.value)} /></div>
          <div className="campo"><label htmlFor="mk-prio">Prioridade</label><Selecao id="mk-prio" valor={prioridade} onMudar={(v) => setPrioridade(v as Prioridade)} opcoes={OPCOES_PRIORIDADE} /></div>
        </div>
        <div className="campo"><span className="rotulo-campo">Coluna</span>
          <div className="segmentos" role="radiogroup" aria-label="Coluna">
            {COLUNAS.map((c) => <button key={c.id} type="button" role="radio" aria-checked={status === c.id} className={status === c.id ? 'marcado' : ''} onClick={() => setStatus(c.id)}>{c.nome}</button>)}
          </div>
        </div>
        <div className="linha" style={{ justifyContent: 'space-between' }}>
          <Botao type="button" variante="fantasma" icone={<Trash2 size={15} />} onClick={() => { if (confirm('Excluir esta tarefa?')) void excluirTarefa(tarefa.id).then(onMudou) }}>Excluir</Botao>
          <div className="linha" style={{ gap: 8 }}><Botao type="button" variante="fantasma" onClick={onFechar}>Cancelar</Botao><Botao type="submit" disabled={salvando}>Salvar</Botao></div>
        </div>
      </form>
    </Janela>
  )
}
