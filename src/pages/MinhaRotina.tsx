import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Clock, Pause, Pencil, Play, Plus, Repeat, Trash2 } from 'lucide-react'
import { Botao } from '../components/ui'
import { Janela } from '../components/Janela'
import { Selecao } from '../components/Selecao'
import { OPCOES_PRIORIDADE } from '../components/opcoes'
import { NavMeuEspaco } from '../components/NavMeuEspaco'
import { comemorar } from '../lib/comemorar'
import { DIAS_CURTOS, dataIso, descreverRepeticao } from '../lib/rotinas'
import {
  DIAS_GERADOS, diasDaRotina, excluirRotinaPessoal, historicoRotinas, listarRotinasPessoais, listarTarefasPessoais, salvarRotinaPessoal, salvarTarefa,
  type EdicaoRotinaPessoal, type RotinaPessoal, type Tarefa,
} from '../lib/tarefas'
import type { Prioridade } from '../lib/kanban'
import './minha-rotina.css'

const repeticaoDe = (r: RotinaPessoal) => descreverRepeticao({ repeticao: r.repeticao, dias_semana: r.dias_semana, dia_mes: r.dia_mes, horarios: r.horario ? [r.horario] : [] })

/** Minha rotina: hábitos que se repetem e viram tarefas no dia certo (em Minhas tarefas, no Meu Kanban e no Calendário). */
export function MinhaRotina() {
  const [rotinas, setRotinas] = useState<RotinaPessoal[] | null>(null)
  const [deHoje, setDeHoje] = useState<Tarefa[]>([])
  const [historico, setHistorico] = useState<Tarefa[]>([])
  const [editar, setEditar] = useState<RotinaPessoal | 'nova' | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [agora] = useState(() => new Date())
  const hoje = dataIso(agora)

  const carregar = useCallback(async () => {
    try {
      const [r, t, h] = await Promise.all([listarRotinasPessoais(), listarTarefasPessoais(), historicoRotinas(14)])
      setRotinas(r); setDeHoje(t.filter((x) => x.rotina_pessoal_id && x.rotina_data === hoje)); setHistorico(h)
    } catch (e) { setErro((e as Error).message) }
  }, [hoje])
  useEffect(() => { void Promise.resolve().then(carregar) }, [carregar])

  const feitasHoje = deHoje.filter((t) => t.status === 'concluida').length
  async function marcar(t: Tarefa) {
    const feita = t.status !== 'concluida'
    setDeHoje((l) => l.map((x) => (x.id === t.id ? { ...x, status: feita ? 'concluida' : 'a_fazer' } : x)))
    if (feita && feitasHoje + 1 === deHoje.length) comemorar()
    await salvarTarefa(t.id, { status: feita ? 'concluida' : 'a_fazer' }).catch((e) => setErro((e as Error).message))
    void carregar()
  }

  // Constância: nos últimos 14 dias (até ontem), em quantos dias a rotina aconteceu e foi feita
  const constancia = useMemo(() => {
    const m = new Map<string, { dias: { dia: string; feita: boolean }[]; feitas: number }>()
    const de = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - 14)
    const ontem = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - 1)
    ;(rotinas ?? []).forEach((r) => {
      const dias = diasDaRotina({ ...r, ativa: true }, de, ontem).map((d) => {
        const dia = dataIso(d)
        return { dia, feita: historico.some((t) => t.rotina_pessoal_id === r.id && t.rotina_data === dia && t.status === 'concluida') }
      })
      m.set(r.id, { dias, feitas: dias.filter((d) => d.feita).length })
    })
    return m
  }, [rotinas, historico, agora])

  return (
    <div className="corpo">
      <NavMeuEspaco />
      <div className="linha" style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div><h2>Minha rotina</h2><p className="pequeno">O que você faz sempre. Cada rotina vira uma tarefa no dia certo, em Minhas tarefas, no Meu Kanban e no Calendário. Só você vê.</p></div>
        <Botao icone={<Plus size={16} />} onClick={() => setEditar('nova')}>Nova rotina</Botao>
      </div>
      {erro && <p className="importar__erro">{erro}</p>}

      <section className="mr-hoje">
        <div className="mr-hoje__topo">
          <div><span className="rotulo">Hoje</span><strong>{(() => { const t = agora.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }); return t.charAt(0).toUpperCase() + t.slice(1) })()}</strong></div>
          {deHoje.length > 0 && <span className="mr-hoje__conta"><b>{feitasHoje}</b> de {deHoje.length} {deHoje.length === 1 ? 'feita' : 'feitas'}</span>}
        </div>
        {deHoje.length > 0 && <div className="mr-progresso" aria-hidden><span style={{ width: `${(feitasHoje / deHoje.length) * 100}%` }} /></div>}
        {rotinas === null ? <p className="pequeno">Carregando…</p> : deHoje.length === 0 ? (
          <p className="pequeno" style={{ color: 'rgb(255 255 255 / .8)' }}>Nenhuma rotina para hoje.</p>
        ) : (
          <ul className="mr-hoje__lista">
            {[...deHoje].sort((a, b) => (a.prazo ?? '').localeCompare(b.prazo ?? '')).map((t) => {
              const feita = t.status === 'concluida'
              const d = t.prazo ? new Date(t.prazo) : null
              return (
                <li key={t.id}>
                  <button type="button" className={`mr-check${feita ? ' feita' : ''}`} aria-pressed={feita} onClick={() => void marcar(t)}>
                    <span className="mr-check__caixa">{feita && <Check size={16} />}</span>
                    <span className="mr-check__texto">{t.titulo}</span>
                    {d && d.getMinutes() !== 59 && <span className="mr-check__hora"><Clock size={12} /> {d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>}
                    {t.status === 'em_andamento' && <span className="mr-check__hora">Fazendo</span>}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {rotinas && rotinas.length === 0 ? (
        <div className="vazio-grande"><Repeat size={34} /><h3>Nenhuma rotina ainda</h3><p className="texto-2">Ex.: responder e-mails todo dia às 8h30, planejar a semana toda segunda, relatório todo dia 1º.</p></div>
      ) : (
        <ul className="mr-rotinas">
          {(rotinas ?? []).map((r) => {
            const c = constancia.get(r.id)
            return (
              <li key={r.id} className={`mr-rotina${r.ativa ? '' : ' pausada'}`}>
                <div className="mr-rotina__topo">
                  <span className="mr-rotina__icone"><Repeat size={18} /></span>
                  <div className="mr-rotina__texto">
                    <strong>{r.titulo}</strong>
                    <small>{r.ativa ? repeticaoDe(r) : 'Pausada'}{r.prioridade === 'alta' ? ' · prioridade alta' : ''}</small>
                  </div>
                  <button type="button" className="icone-botao" style={{ width: 32, height: 32, border: 0 }} title={r.ativa ? 'Pausar' : 'Retomar'} aria-label={r.ativa ? `Pausar ${r.titulo}` : `Retomar ${r.titulo}`}
                    onClick={() => void salvarRotinaPessoal(r.id, { ativa: !r.ativa }).then(carregar)}>{r.ativa ? <Pause size={15} /> : <Play size={15} />}</button>
                  <button type="button" className="icone-botao" style={{ width: 32, height: 32, border: 0 }} aria-label={`Editar ${r.titulo}`} onClick={() => setEditar(r)}><Pencil size={15} /></button>
                </div>
                {r.descricao && <p className="mr-rotina__desc">{r.descricao}</p>}
                {c && c.dias.length > 0 && (
                  <div className="mr-constancia" title="Últimos 14 dias">
                    <span className="pequeno">Últimos 14 dias</span>
                    <span className="mr-constancia__dias">{c.dias.map((d) => <i key={d.dia} className={d.feita ? 'feita' : ''} title={`${d.dia.split('-').reverse().slice(0, 2).join('/')}: ${d.feita ? 'feita' : 'não feita'}`} />)}</span>
                    <span className="pequeno"><b>{c.feitas}</b> de {c.dias.length}</span>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
      <p className="pequeno">As tarefas das rotinas são criadas para os próximos {DIAS_GERADOS} dias. Veja todas no <Link to="/calendario">Calendário</Link>; no Meu Kanban e em Minhas tarefas aparecem as de hoje e amanhã.</p>

      {editar && <RotinaJanela rotina={editar === 'nova' ? null : editar} onFechar={() => setEditar(null)}
        onSalvar={async (d) => { await salvarRotinaPessoal(editar === 'nova' ? null : editar.id, d); setEditar(null); await carregar() }}
        onExcluir={editar !== 'nova' ? async () => { await excluirRotinaPessoal(editar.id); setEditar(null); await carregar() } : undefined} />}
    </div>
  )
}

function RotinaJanela({ rotina, onFechar, onSalvar, onExcluir }: { rotina: RotinaPessoal | null; onFechar: () => void; onSalvar: (d: EdicaoRotinaPessoal) => Promise<void>; onExcluir?: () => Promise<void> }) {
  const [titulo, setTitulo] = useState(rotina?.titulo ?? '')
  const [descricao, setDescricao] = useState(rotina?.descricao ?? '')
  const [repeticao, setRepeticao] = useState<'semana' | 'mes'>(rotina?.repeticao ?? 'semana')
  const [dias, setDias] = useState<number[]>(rotina?.dias_semana?.length ? rotina.dias_semana : [1, 2, 3, 4, 5])
  const [diaMes, setDiaMes] = useState(String(rotina?.dia_mes ?? 1))
  const [horario, setHorario] = useState(rotina?.horario ?? '')
  const [prioridade, setPrioridade] = useState<Prioridade>(rotina?.prioridade ?? 'comum')
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [confirmar, setConfirmar] = useState(false)
  const alternar = (d: number) => setDias(dias.includes(d) ? dias.filter((x) => x !== d) : [...dias, d].sort())

  async function salvar() {
    if (!titulo.trim()) { setErro('Dê um nome para a rotina.'); return }
    if (repeticao === 'semana' && !dias.length) { setErro('Escolha pelo menos um dia da semana.'); return }
    const dm = Math.max(1, Math.min(31, Number(diaMes) || 1))
    setSalvando(true); setErro(null)
    try { await onSalvar({ titulo: titulo.trim(), descricao: descricao.trim() || null, repeticao, dias_semana: repeticao === 'semana' ? dias : [], dia_mes: repeticao === 'mes' ? dm : null, horario: horario || null, prioridade }) }
    catch (e) { setErro((e as Error).message); setSalvando(false) }
  }
  return (
    <Janela titulo={rotina ? 'Rotina' : 'Nova rotina'} onFechar={onFechar} largura={540}>
      <form className="janela__corpo" onSubmit={(e) => { e.preventDefault(); void salvar() }}>
        <div className="campo"><label htmlFor="mr-titulo">O que fazer</label><input id="mr-titulo" className="entrada" autoFocus={!rotina} value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Responder comentários do Instagram" /></div>
        <div className="campo"><label htmlFor="mr-desc">Detalhes (opcional)</label><input id="mr-desc" className="entrada" value={descricao} onChange={(e) => setDescricao(e.target.value)} /></div>
        <div className="campo"><span className="rotulo-campo">Repete</span>
          <div className="segmentos" role="radiogroup" aria-label="Repete">
            <button type="button" role="radio" aria-checked={repeticao === 'semana'} className={repeticao === 'semana' ? 'marcado' : ''} onClick={() => setRepeticao('semana')}>Na semana</button>
            <button type="button" role="radio" aria-checked={repeticao === 'mes'} className={repeticao === 'mes' ? 'marcado' : ''} onClick={() => setRepeticao('mes')}>Todo mês</button>
          </div>
        </div>
        {repeticao === 'semana' ? (
          <div className="campo"><span className="rotulo-campo">Dias</span>
            <div className="mr-dias">
              {DIAS_CURTOS.map((d, i) => <button key={d} type="button" aria-pressed={dias.includes(i)} className={dias.includes(i) ? 'marcado' : ''} onClick={() => alternar(i)}>{d}</button>)}
              <button type="button" className="mr-dias__atalho" onClick={() => setDias([1, 2, 3, 4, 5])}>Dias úteis</button>
              <button type="button" className="mr-dias__atalho" onClick={() => setDias([0, 1, 2, 3, 4, 5, 6])}>Todo dia</button>
            </div>
          </div>
        ) : (
          <div className="campo"><label htmlFor="mr-diames">Dia do mês</label><input id="mr-diames" className="entrada" inputMode="numeric" style={{ width: 120 }} value={diaMes} onChange={(e) => setDiaMes(e.target.value.replace(/\D/g, '').slice(0, 2))} /><span className="pequeno">Em meses mais curtos, cai no último dia.</span></div>
        )}
        <div className="grade-2">
          <div className="campo"><label htmlFor="mr-hora">Horário (opcional)</label><input id="mr-hora" type="time" className="entrada" value={horario} onChange={(e) => setHorario(e.target.value)} /></div>
          <div className="campo"><label htmlFor="mr-prio">Prioridade</label><Selecao id="mr-prio" valor={prioridade} onMudar={(v) => setPrioridade(v as Prioridade)} opcoes={OPCOES_PRIORIDADE} /></div>
        </div>
        {rotina && <p className="pequeno">Ao salvar, as próximas tarefas desta rotina que ainda não foram começadas são refeitas com os dias e horário novos.</p>}
        {erro && <p className="importar__erro">{erro}</p>}
        <div className="linha" style={{ justifyContent: 'space-between' }}>
          <div>{onExcluir && (confirmar
            ? <Botao type="button" variante="fantasma" className="texto-perigo" onClick={() => void onExcluir()}>Confirmar exclusão</Botao>
            : <Botao type="button" variante="fantasma" icone={<Trash2 size={15} />} onClick={() => setConfirmar(true)}>Excluir</Botao>)}</div>
          <div className="linha" style={{ gap: 8 }}><Botao type="button" variante="fantasma" onClick={onFechar}>Cancelar</Botao><Botao type="submit" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</Botao></div>
        </div>
      </form>
    </Janela>
  )
}
