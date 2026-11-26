import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Camera, Check, Clock, Pause, Pencil, Play, Plus, Repeat, Trash2, Undo2, Users, X } from 'lucide-react'
import { Botao } from '../components/ui'
import { Janela } from '../components/Janela'
import { ConcluirRotina } from '../components/ConcluirRotina'
import { comemorar } from '../lib/comemorar'
import { useSessao } from '../lib/sessao'
import { supabase } from '../lib/supabase'
import { listarPessoas, type Pessoa } from '../lib/kanban'
import {
  DIAS_CURTOS, dataIso, descreverRepeticao, desmarcar, excluirRotina, feitoPor, linkFotoRotina, listarRegistros, listarRotinas, marcarFeito,
  minha, ocorrenciasNoDia, prazoDe, salvarRotina, type DadosRotina, type Ocorrencia, type Registro, type Rotina,
} from '../lib/rotinas'
import { EscolherResponsaveis, Responsaveis } from './kanban/Pessoas'
import './kanban.css'
import './rotinas.css'

/** Rotinas: tarefas que se repetem (ronda, responder comentários, stories…), passadas para pessoas da equipe. */
export function Rotinas() {
  const { cliente, usuario, ehAdminCliente } = useSessao()
  const [aba, setAba] = useState<'hoje' | 'rotinas'>('hoje')
  const [rotinas, setRotinas] = useState<Rotina[] | null>(null)
  const [registros, setRegistros] = useState<Registro[]>([])
  const [pessoas, setPessoas] = useState<Pessoa[]>([])
  const [editar, setEditar] = useState<Rotina | 'nova' | null>(null)
  const [concluir, setConcluir] = useState<Ocorrencia | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [agora] = useState(() => new Date())
  const eu = supabase ? usuario.id : 'p1'

  const carregar = useCallback(async () => {
    if (!cliente) return
    const rs = await listarRotinas(cliente.id)
    const desde = dataIso(new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - 7))
    setRotinas(rs); setRegistros(await listarRegistros(rs.map((r) => r.id), desde))
  }, [cliente, agora])
  useEffect(() => { void Promise.resolve().then(carregar) }, [carregar])
  useEffect(() => { if (cliente) void listarPessoas(cliente.id).then(setPessoas) }, [cliente])

  const hoje = useMemo(() => (rotinas ?? []).flatMap((r) => ocorrenciasNoDia(r, agora)).sort((a, b) => prazoDe(a).localeCompare(prazoDe(b))), [rotinas, agora])
  const pessoa = (id: string) => pessoas.find((p) => p.usuario_id === id)
  const podeMarcar = (r: Rotina) => minha(r, eu) || ehAdminCliente

  async function marcar(o: Ocorrencia) {
    setErro(null)
    if (o.rotina.checklist.length || o.rotina.exige_foto) { setConcluir(o); return }
    try { await marcarFeito(o, {}, eu); comemorar(); await carregar() } catch (e) { setErro((e as Error).message) }
  }

  // Cumprimento dos últimos 7 dias (sem contar hoje)
  function ultimosDias(r: Rotina) {
    return Array.from({ length: 7 }, (_, i) => {
      const dia = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - 7 + i)
      const ocs = ocorrenciasNoDia(r, dia)
      const feitas = ocs.filter((o) => feitoPor(o, registros)).length
      return { dia, total: ocs.length, feitas }
    })
  }

  if (!cliente) return <div className="corpo"><h2>Rotinas</h2><p className="texto-2">Crie um cliente primeiro.</p></div>
  const atrasadas = hoje.filter((o) => !feitoPor(o, registros, eu) && o.horario && new Date(prazoDe(o)) < agora)
  const feitas = hoje.filter((o) => feitoPor(o, registros, o.rotina.cada_um ? eu : undefined))

  return (
    <div className="corpo">
      <div className="linha" style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div><h2>Rotinas</h2><p className="pequeno">Tarefas que se repetem, como ronda, comentários e stories. Aparecem sozinhas em Minhas tarefas de quem é responsável.</p></div>
        <div className="linha" style={{ gap: 10 }}>
          <div className="segmentos" role="radiogroup" aria-label="Ver">
            <button type="button" role="radio" aria-checked={aba === 'hoje'} className={aba === 'hoje' ? 'marcado' : ''} onClick={() => setAba('hoje')}>Hoje <span>{feitas.length}/{hoje.length}</span></button>
            <button type="button" role="radio" aria-checked={aba === 'rotinas'} className={aba === 'rotinas' ? 'marcado' : ''} onClick={() => setAba('rotinas')}>Todas as rotinas <span>{rotinas?.length ?? 0}</span></button>
          </div>
          {ehAdminCliente && <Botao icone={<Plus size={16} />} onClick={() => setEditar('nova')}>Nova rotina</Botao>}
        </div>
      </div>
      {erro && <p className="importar__erro">{erro}</p>}

      {aba === 'hoje' && (
        <>
          <div className="progresso-dia">
            <div className="progresso-dia__barra"><span style={{ width: `${hoje.length ? (feitas.length / hoje.length) * 100 : 0}%` }} /></div>
            <span><strong>{feitas.length}</strong> de {hoje.length} feitas hoje{atrasadas.length ? <> · <em>{atrasadas.length} {atrasadas.length === 1 ? 'atrasada' : 'atrasadas'}</em></> : ''}</span>
          </div>
          {rotinas !== null && hoje.length === 0 && <div className="vazio-grande"><Repeat size={34} /><h3>Nenhuma rotina para hoje</h3><p className="texto-2">{ehAdminCliente ? 'Crie rotinas para a equipe em "Nova rotina".' : 'Quando um administrador criar rotinas para você, elas aparecem aqui.'}</p></div>}
          <ul className="lista-rotinas-hoje">
            {hoje.map((o) => {
              const g = feitoPor(o, registros, o.rotina.cada_um ? eu : undefined)
              const atrasada = !g && o.horario && new Date(prazoDe(o)) < agora
              const quem = g ? pessoa(g.usuario_id) : null
              return (
                <li key={o.chave} className={`rotina-hoje${g ? ' feita' : ''}${atrasada ? ' atrasada' : ''}`}>
                  <button type="button" className="tarefa__check" disabled={!g && !podeMarcar(o.rotina)} aria-label={g ? `Feita: ${o.rotina.titulo}` : `Marcar ${o.rotina.titulo} como feita`}
                    title={!g && !podeMarcar(o.rotina) ? 'Esta rotina é de outra pessoa' : undefined}
                    onClick={() => { if (!g) void marcar(o) }}>{g && <Check size={14} strokeWidth={3} />}</button>
                  <span className="rotina-hoje__hora">{o.horario ?? 'Dia todo'}</span>
                  <div className="rotina-hoje__texto">
                    <strong>{o.rotina.titulo}</strong>
                    <span className="pequeno">
                      {g ? <>Feita por <strong>{quem?.nome.split(' ')[0] ?? 'alguém'}</strong> às {new Date(g.feito_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}{g.observacao ? ` · "${g.observacao}"` : ''}</>
                        : atrasada ? 'Atrasada' : o.rotina.responsaveis.length ? `Para ${o.rotina.responsaveis.map((id) => pessoa(id)?.nome.split(' ')[0]).filter(Boolean).join(', ')}` : 'Qualquer pessoa da equipe'}
                      {!g && o.rotina.checklist.length > 0 && ` · ${o.rotina.checklist.length} itens`}{!g && o.rotina.exige_foto && ' · pede foto'}
                    </span>
                  </div>
                  {g?.foto_path && <FotoRegistro caminho={g.foto_path} />}
                  {g ? (quem?.usuario_id === eu || g.usuario_id === eu) && <button type="button" className="botao botao--fantasma botao--mini" onClick={() => void desmarcar(g.id).then(carregar)}><Undo2 size={13} /> Desfazer</button>
                    : o.rotina.responsaveis.length > 0 && <Responsaveis ids={o.rotina.responsaveis} pessoas={pessoas} />}
                </li>
              )
            })}
          </ul>
        </>
      )}

      {aba === 'rotinas' && (
        <div className="grade-rotinas">
          {(rotinas ?? []).map((r) => {
            const dias = ultimosDias(r)
            const total = dias.reduce((s, d) => s + d.total, 0); const ok = dias.reduce((s, d) => s + d.feitas, 0)
            return (
              <article key={r.id} className={`rotina-cartao${r.ativa ? '' : ' pausada'}`}>
                <header>
                  <span className="rotina-cartao__icone"><Repeat size={16} /></span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <strong>{r.titulo}</strong>
                    <span className="pequeno" style={{ display: 'block' }}><Clock size={12} style={{ verticalAlign: -1 }} /> {descreverRepeticao(r)}{!r.ativa && ' · pausada'}</span>
                  </div>
                  {ehAdminCliente && (
                    <span className="rotina-cartao__acoes">
                      <button type="button" className="icone-botao" title={r.ativa ? 'Pausar' : 'Reativar'} aria-label={r.ativa ? 'Pausar rotina' : 'Reativar rotina'} onClick={() => void salvarRotina(cliente.id, { ...semIds(r), ativa: !r.ativa }, r.id).then(carregar)}>{r.ativa ? <Pause size={14} /> : <Play size={14} />}</button>
                      <button type="button" className="icone-botao" title="Editar" aria-label="Editar rotina" onClick={() => setEditar(r)}><Pencil size={14} /></button>
                    </span>
                  )}
                </header>
                {r.descricao && <p className="texto-2 rotina-cartao__desc">{r.descricao}</p>}
                <div className="rotina-cartao__para">
                  {r.responsaveis.length ? <><Responsaveis ids={r.responsaveis} pessoas={pessoas} max={4} /> <span className="pequeno">{r.responsaveis.length > 1 ? (r.cada_um ? 'cada um faz a sua' : 'basta um fazer') : pessoa(r.responsaveis[0])?.nome}</span></>
                    : <span className="pequeno"><Users size={13} style={{ verticalAlign: -2 }} /> Qualquer pessoa da equipe</span>}
                  {r.checklist.length > 0 && <span className="pequeno">· {r.checklist.length} itens</span>}
                  {r.exige_foto && <span className="pequeno"><Camera size={12} style={{ verticalAlign: -1 }} /> foto</span>}
                </div>
                <div className="rotina-cartao__semana" aria-label="Últimos 7 dias">
                  {dias.map((d, i) => (
                    <span key={i} className={`dia-rotina${d.total === 0 ? ' sem' : d.feitas === d.total ? ' ok' : d.feitas > 0 ? ' parcial' : ' falhou'}`} title={`${d.dia.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' })}: ${d.total ? `${d.feitas} de ${d.total}` : 'não tinha'}`}>
                      <small>{DIAS_CURTOS[d.dia.getDay()].slice(0, 1)}</small>
                    </span>
                  ))}
                  <span className="pequeno" style={{ marginLeft: 'auto' }}>{total ? `${Math.round((ok / total) * 100)}% em dia` : '—'}</span>
                </div>
              </article>
            )
          })}
          {rotinas?.length === 0 && <div className="vazio-grande"><Repeat size={34} /><h3>Nenhuma rotina ainda</h3>{ehAdminCliente && <Botao icone={<Plus size={16} />} onClick={() => setEditar('nova')}>Criar a primeira rotina</Botao>}</div>}
        </div>
      )}

      {concluir && <ConcluirRotina ocorrencia={concluir} usuarioId={eu} onFechar={() => setConcluir(null)} onFeito={carregar} />}
      {editar && <EditarRotina rotina={editar === 'nova' ? null : editar} pessoas={pessoas} onFechar={() => setEditar(null)}
        onSalvar={async (d) => { await salvarRotina(cliente.id, d, editar === 'nova' ? undefined : editar.id); setEditar(null); await carregar() }}
        onExcluir={editar !== 'nova' ? async () => { await excluirRotina(editar.id); setEditar(null); await carregar() } : undefined} />}
    </div>
  )
}

const semIds = (r: Rotina): DadosRotina => ({ titulo: r.titulo, descricao: r.descricao, repeticao: r.repeticao, dias_semana: r.dias_semana, dia_mes: r.dia_mes, horarios: r.horarios, responsaveis: r.responsaveis, cada_um: r.cada_um, checklist: r.checklist, exige_foto: r.exige_foto, inicio: r.inicio, ativa: r.ativa })

function FotoRegistro({ caminho }: { caminho: string }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => { void linkFotoRotina(caminho).then(setUrl) }, [caminho])
  return url ? <a href={url} target="_blank" rel="noreferrer" className="rotina-hoje__foto"><img src={url} alt="Foto de comprovação" /></a> : null
}

function EditarRotina({ rotina, pessoas, onFechar, onSalvar, onExcluir }: {
  rotina: Rotina | null; pessoas: Pessoa[]; onFechar: () => void; onSalvar: (d: DadosRotina) => Promise<void>; onExcluir?: () => Promise<void>
}) {
  const [d, setD] = useState<DadosRotina>(() => rotina ? semIds(rotina) : {
    titulo: '', descricao: null, repeticao: 'semana', dias_semana: [1, 2, 3, 4, 5], dia_mes: 1, horarios: [], responsaveis: [], cada_um: false,
    checklist: [], exige_foto: false, inicio: dataIso(new Date()), ativa: true,
  })
  const [hora, setHora] = useState('09:00')
  const [item, setItem] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const mudar = (p: Partial<DadosRotina>) => setD({ ...d, ...p })
  const alternarDia = (n: number) => mudar({ dias_semana: d.dias_semana.includes(n) ? d.dias_semana.filter((x) => x !== n) : [...d.dias_semana, n].sort() })

  async function enviar(e: FormEvent) {
    e.preventDefault(); setErro(null)
    if (d.repeticao === 'semana' && d.dias_semana.length === 0) { setErro('Escolha pelo menos um dia da semana.'); return }
    try { await onSalvar({ ...d, titulo: d.titulo.trim(), dia_mes: d.repeticao === 'mes' ? d.dia_mes ?? 1 : null }) } catch (err) { setErro((err as Error).message) }
  }

  return (
    <Janela titulo={rotina ? 'Editar rotina' : 'Nova rotina'} onFechar={onFechar} largura={640}>
      <form className="janela__corpo editar-rotina" onSubmit={enviar}>
        <input className="editar-card__titulo" style={{ fontSize: 24 }} autoFocus required placeholder="Ex.: Responder comentários do Instagram" value={d.titulo} onChange={(e) => mudar({ titulo: e.target.value })} aria-label="Nome da rotina" />
        <textarea className="entrada" rows={2} placeholder="Como fazer (opcional)" value={d.descricao ?? ''} onChange={(e) => mudar({ descricao: e.target.value || null })} aria-label="Como fazer" />

        <div className="campo"><span className="rotulo-campo">Quando se repete</span>
          <div className="segmentos" style={{ alignSelf: 'flex-start' }}>
            <button type="button" className={d.repeticao === 'semana' ? 'marcado' : ''} onClick={() => mudar({ repeticao: 'semana' })}>Dias da semana</button>
            <button type="button" className={d.repeticao === 'mes' ? 'marcado' : ''} onClick={() => mudar({ repeticao: 'mes' })}>Uma vez por mês</button>
          </div>
          {d.repeticao === 'semana' ? (
            <div className="dias-semana">
              {DIAS_CURTOS.map((nome, n) => <button key={n} type="button" className={`dia-chip${d.dias_semana.includes(n) ? ' marcado' : ''}`} aria-pressed={d.dias_semana.includes(n)} onClick={() => alternarDia(n)}>{nome}</button>)}
              <span className="dias-semana__atalhos">
                <button type="button" className="anexo__acao" onClick={() => mudar({ dias_semana: [0, 1, 2, 3, 4, 5, 6] })}>Todo dia</button>
                <button type="button" className="anexo__acao" onClick={() => mudar({ dias_semana: [1, 2, 3, 4, 5] })}>Dias úteis</button>
              </span>
            </div>
          ) : (
            <label className="linha" style={{ gap: 8 }}>Todo dia <input className="entrada entrada--mini" style={{ width: 70 }} type="number" min={1} max={31} value={d.dia_mes ?? 1} onChange={(e) => mudar({ dia_mes: Math.min(31, Math.max(1, Number(e.target.value) || 1)) })} /> do mês</label>
          )}
        </div>

        <div className="campo"><span className="rotulo-campo">Horários</span>
          <div className="linha" style={{ gap: 6 }}>
            {d.horarios.map((h) => <span key={h} className="hora-chip">{h}<button type="button" aria-label={`Tirar ${h}`} onClick={() => mudar({ horarios: d.horarios.filter((x) => x !== h) })}><X size={12} /></button></span>)}
            <input type="time" className="entrada entrada--mini" style={{ width: 110 }} value={hora} onChange={(e) => setHora(e.target.value)} aria-label="Horário" />
            <button type="button" className="botao botao--secundario botao--mini" onClick={() => hora && !d.horarios.includes(hora) && mudar({ horarios: [...d.horarios, hora].sort() })}><Plus size={13} /> Adicionar horário</button>
          </div>
          <span className="pequeno">{d.horarios.length ? `Vira ${d.horarios.length} ${d.horarios.length === 1 ? 'tarefa' : 'tarefas'} no dia, uma por horário.` : 'Sem horário: uma vez no dia, até o fim do dia.'}</span>
        </div>

        <div className="campo"><span className="rotulo-campo">Para quem</span>
          <div className="claro"><EscolherResponsaveis ids={d.responsaveis} pessoas={pessoas} onMudar={(ids) => mudar({ responsaveis: ids })} /></div>
          <span className="pequeno">{d.responsaveis.length === 0 ? 'Ninguém escolhido: qualquer pessoa da equipe pode fazer.' : ''}</span>
          {d.responsaveis.length > 1 && (
            <div className="segmentos" style={{ alignSelf: 'flex-start' }}>
              <button type="button" className={!d.cada_um ? 'marcado' : ''} onClick={() => mudar({ cada_um: false })}>Basta uma pessoa fazer</button>
              <button type="button" className={d.cada_um ? 'marcado' : ''} onClick={() => mudar({ cada_um: true })}>Cada pessoa faz a sua</button>
            </div>
          )}
        </div>

        <div className="campo"><span className="rotulo-campo">Checklist (opcional)</span>
          <ul className="checklist">{d.checklist.map((c) => (
            <li key={c.id}><span style={{ flex: 1 }}>• {c.texto}</span><button type="button" aria-label={`Tirar ${c.texto}`} style={{ opacity: 1 }} onClick={() => mudar({ checklist: d.checklist.filter((x) => x.id !== c.id) })}><X size={13} /></button></li>
          ))}</ul>
          <div className="linha" style={{ gap: 6, flexWrap: 'nowrap' }}>
            <input className="entrada entrada--mini" style={{ flex: 1 }} value={item} onChange={(e) => setItem(e.target.value)} placeholder="Ex.: Passar na UTI"
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (item.trim()) { mudar({ checklist: [...d.checklist, { id: crypto.randomUUID(), texto: item.trim() }] }); setItem('') } } }} aria-label="Item da checklist" />
            <button type="button" className="botao botao--secundario botao--mini" onClick={() => { if (item.trim()) { mudar({ checklist: [...d.checklist, { id: crypto.randomUUID(), texto: item.trim() }] }); setItem('') } }}><Plus size={13} /> Item</button>
          </div>
        </div>

        <label className="aceite" style={{ fontSize: 14 }}><input type="checkbox" checked={d.exige_foto} onChange={(e) => mudar({ exige_foto: e.target.checked })} />
          <span><strong>Pedir foto de comprovação</strong> ao concluir (ex.: ronda, vitrine, mural)</span></label>
        <div className="campo" style={{ maxWidth: 220 }}><label htmlFor="rt-ini">Começa em</label><input id="rt-ini" type="date" className="entrada" value={d.inicio} onChange={(e) => mudar({ inicio: e.target.value || dataIso(new Date()) })} /></div>

        <p className="faixa-dica"><Repeat size={15} /> {descreverRepeticao({ ...d, dia_mes: d.dia_mes })}</p>
        {erro && <p className="importar__erro">{erro}</p>}
        <div className="linha" style={{ justifyContent: 'space-between' }}>
          {onExcluir ? <Botao type="button" variante="fantasma" style={{ color: 'var(--perigo)' }} icone={<Trash2 size={15} />} onClick={() => { if (confirm('Excluir esta rotina e o histórico dela?')) void onExcluir() }}>Excluir</Botao> : <span />}
          <div className="linha"><Botao type="button" variante="fantasma" onClick={onFechar}>Cancelar</Botao><Botao type="submit" disabled={!d.titulo.trim()}>{rotina ? 'Salvar' : 'Criar rotina'}</Botao></div>
        </div>
      </form>
    </Janela>
  )
}

