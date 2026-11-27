import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowLeft, Camera, ChevronLeft, ChevronRight, Clock, Image as ImageIcon, Plus, Settings2, Trash2, Users } from 'lucide-react'
import { Botao } from '../components/ui'
import { Janela } from '../components/Janela'
import { BotaoPlanilha, ImportarPlanilha, type Conversao } from '../components/Planilha'
import { SeletorHora } from '../components/Ponto'
import { useSessao } from '../lib/sessao'
import { supabase } from '../lib/supabase'
import { listarPessoas, type Pessoa } from '../lib/kanban'
import { dataIso as lerDataPlanilha, textoDe, type Tabela, type Valor } from '../lib/planilhas'
import {
  MARCAS, carregarConfig, cicloDe, definirLembretes, diaIso, enviarFotoPonto, excluirPonto, importarPontos, jornadaDoDia, lembretesLigados, linkFotoPonto,
  listarPontos, resumoDia, saldoPeriodo, saldoTexto, salvarConfig, salvarPonto,
  type ConfigPonto, type EdicaoPonto, type Marca, type Ponto,
} from '../lib/ponto'
import './ponto.css'

const nomeMes = (d: Date) => { const t = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }); return t.charAt(0).toUpperCase() + t.slice(1) }
const diaSemana = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')
const dataCurta = (iso: string) => iso.split('-').reverse().slice(0, 2).join('/')
const horaAgora = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` }
const MODELO_PONTO: Tabela = { colunas: ['Data', 'Entrada', 'Saída almoço', 'Volta almoço', 'Saída', 'Justificativa'], linhas: [['24/11/2026', '08:02', '12:00', '13:00', '18:05', ''], ['25/11/2026', '08:20', '12:10', '13:05', '18:30', 'Trânsito na BR']] }

/** Ponto (Organização): opcional. Cada um vê o seu; administradores veem a equipe. */
export function PaginaPonto() {
  const { cliente, usuario, ehAdminCliente } = useSessao()
  const eu = supabase ? usuario.id : 'p1'
  const [config, setConfig] = useState<ConfigPonto | null>(null)
  const [pontos, setPontos] = useState<Ponto[] | null>(null)
  const [pessoas, setPessoas] = useState<Pessoa[]>([])
  const [aba, setAba] = useState<'meu' | 'equipe'>('meu')
  const [vendo, setVendo] = useState<string | null>(null)
  const [mes, setMes] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const [editar, setEditar] = useState<{ dia: string; ponto: Ponto | null } | null>(null)
  const [importar, setImportar] = useState(false)
  const [configurar, setConfigurar] = useState(false)
  const [lembretes, setLembretes] = useState(() => (cliente ? lembretesLigados(cliente.id) : true))
  const [erro, setErro] = useState<string | null>(null)
  const [agora] = useState(() => new Date())
  const hoje = diaIso(agora)

  const ciclo = useMemo(() => (config ? cicloDe(config, agora) : null), [config, agora])
  const carregar = useCallback(async () => {
    if (!cliente) return
    try {
      const c = await carregarConfig(cliente.id)
      const ci = cicloDe(c, new Date())
      const inicioMes = diaIso(mes); const fimMes = diaIso(new Date(mes.getFullYear(), mes.getMonth() + 1, 0))
      const de = inicioMes < ci.inicio ? inicioMes : ci.inicio
      const ate = fimMes > ci.fim ? fimMes : ci.fim
      const [p, g] = await Promise.all([listarPontos(cliente.id, de, ate, ehAdminCliente ? undefined : eu), listarPessoas(cliente.id).catch(() => [])])
      setConfig(c); setPontos(p); setPessoas(g)
    } catch (e) { setErro((e as Error).message) }
  }, [cliente, mes, ehAdminCliente, eu])
  useEffect(() => { void Promise.resolve().then(carregar) }, [carregar])
  useEffect(() => { const f = () => void carregar(); window.addEventListener('luminy:ponto', f); return () => window.removeEventListener('luminy:ponto', f) }, [carregar])

  if (!cliente) return <div className="corpo"><h2>Ponto</h2><p className="texto-2">Crie um cliente primeiro.</p></div>
  if (!config || !pontos || !ciclo) return <div className="corpo"><h2>Ponto</h2><p className="pequeno">Carregando…</p></div>

  const pessoa = vendo ?? eu
  const meus = pontos.filter((p) => p.usuario_id === pessoa)
  const inicioMes = diaIso(mes); const fimMes = diaIso(new Date(mes.getFullYear(), mes.getMonth() + 1, 0))
  const doCiclo = saldoPeriodo(meus, config, ciclo.inicio, ciclo.fim)
  const doMes = saldoPeriodo(meus, config, inicioMes, fimMes)
  const pontoHoje = meus.find((p) => p.dia === hoje) ?? null
  const nome = (id: string) => pessoas.find((p) => p.usuario_id === id)?.nome ?? (id === eu ? usuario.nome : 'Pessoa')
  const proprio = pessoa === eu

  // Dias do mês: dias úteis até hoje e qualquer dia com registro
  const dias: string[] = []
  for (let d = new Date(mes); d.getMonth() === mes.getMonth(); d.setDate(d.getDate() + 1)) {
    const iso = diaIso(d)
    if (iso > hoje && !meus.some((p) => p.dia === iso)) continue
    if (jornadaDoDia(config, iso) || meus.some((p) => p.dia === iso)) dias.push(iso)
  }
  dias.reverse()

  async function registrarAgora(m: Marca) {
    if (!cliente) return
    await salvarPonto(cliente.id, eu, hoje, { [m]: horaAgora() })
    await carregar()
  }
  const linhasExport = (lista: Ponto[]) => lista.filter((p) => p.dia >= inicioMes && p.dia <= fimMes).sort((a, b) => a.dia.localeCompare(b.dia) || nome(a.usuario_id).localeCompare(nome(b.usuario_id))).map((p) => {
    const r = resumoDia(p, config)
    return [nome(p.usuario_id), new Date(`${p.dia}T12:00:00`), p.entrada, p.almoco_saida, p.almoco_volta, p.saida, r.trabalhado == null ? '' : saldoTexto(r.trabalhado, false), r.saldo == null ? '' : saldoTexto(r.saldo), r.atraso > 0 ? 'Sim' : '', r.avisos.join(' · '), p.foto_path ? 'Sim' : ''] as Valor[]
  })

  return (
    <div className="corpo ponto">
      <div className="linha" style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div><h2>Ponto</h2><p className="pequeno">Entrada, almoço e saída. Usar é opcional. Você vê o seu{ehAdminCliente ? '; como administrador, vê o da equipe também' : ''}.</p></div>
        <div className="linha" style={{ gap: 8 }}>
          {ehAdminCliente && (
            <div className="segmentos" role="radiogroup" aria-label="Ver">
              <button type="button" role="radio" aria-checked={aba === 'meu'} className={aba === 'meu' ? 'marcado' : ''} onClick={() => { setAba('meu'); setVendo(null) }}>Meu ponto</button>
              <button type="button" role="radio" aria-checked={aba === 'equipe'} className={aba === 'equipe' ? 'marcado' : ''} onClick={() => setAba('equipe')}><Users size={14} /> Equipe</button>
            </div>
          )}
          <BotaoPlanilha nome={`ponto-${aba === 'equipe' && !vendo ? 'equipe' : nome(pessoa).split(' ')[0].toLowerCase()}-${inicioMes.slice(0, 7)}`} modelo={MODELO_PONTO}
            onImportar={aba === 'meu' ? () => setImportar(true) : undefined}
            exportar={() => ({ colunas: ['Pessoa', 'Data', 'Entrada', 'Saída almoço', 'Volta almoço', 'Saída', 'Trabalhado', 'Saldo do dia', 'Atrasado', 'Avisos', 'Foto'], linhas: linhasExport(aba === 'equipe' && !vendo ? pontos : meus) })} />
          {ehAdminCliente && <Botao variante="secundario" icone={<Settings2 size={15} />} onClick={() => setConfigurar(true)}>Jornada</Botao>}
          {proprio && aba === 'meu' && <Botao icone={<Plus size={16} />} onClick={() => setEditar({ dia: hoje, ponto: pontoHoje })}>Registrar dia</Botao>}
        </div>
      </div>
      {erro && <p className="importar__erro">{erro}</p>}

      {aba === 'equipe' && !vendo ? (
        <EquipePonto pontos={pontos} pessoas={pessoas} config={config} ciclo={ciclo} inicioMes={inicioMes} fimMes={fimMes} mes={mes} setMes={setMes} onVer={setVendo} />
      ) : (
        <>
          {vendo && <button type="button" className="contas-redes__info" style={{ alignSelf: 'flex-start' }} onClick={() => setVendo(null)}><ArrowLeft size={15} /> Voltar para a equipe · vendo o ponto de <b>{nome(vendo)}</b></button>}
          <div className="ponto-resumo">
            <section className={`ponto-banco${doCiclo.saldo >= 0 ? ' positivo' : ' negativo'}`}>
              <span className="rotulo">Banco de horas · {ciclo.nome}</span>
              <strong>{saldoTexto(doCiclo.saldo)}</strong>
              <span>{doCiclo.saldo > 0 ? 'de horas extras' : doCiclo.saldo < 0 ? 'devendo' : 'tudo certo'} · zera em {ciclo.zeraEm}</span>
            </section>
            <section className="ponto-numeros">
              <div><small>Trabalhadas em {mes.toLocaleDateString('pt-BR', { month: 'long' })}</small><strong>{saldoTexto(doMes.trabalhado, false)}</strong></div>
              <div><small>Saldo do mês</small><strong className={doMes.saldo < 0 ? 'neg' : 'pos'}>{saldoTexto(doMes.saldo)}</strong></div>
              <div><small>Atrasos</small><strong className={doMes.atrasos ? 'neg' : ''}>{doMes.atrasos}</strong></div>
              <div><small>Esquecidos</small><strong>{doMes.esquecidos}</strong></div>
            </section>
          </div>

          {proprio && jornadaDoDia(config, hoje) && (
            <section className="ponto-hoje">
              <span className="rotulo">Hoje</span>
              <div className="ponto-hoje__marcas">
                {MARCAS.map((m) => {
                  const v = pontoHoje?.[m.id]
                  return (
                    <button key={m.id} type="button" className={`ponto-marca${v ? ' feita' : ''}`} onClick={() => (v ? setEditar({ dia: hoje, ponto: pontoHoje }) : void registrarAgora(m.id))}>
                      <small>{m.curto}</small>
                      <strong>{v ?? '--:--'}</strong>
                      <span>{v ? 'editar' : 'registrar agora'}</span>
                    </button>
                  )
                })}
              </div>
            </section>
          )}

          <div className="linha" style={{ justifyContent: 'space-between' }}>
            <div className="mes-nav">
              <button type="button" className="icone-botao" aria-label="Mês anterior" onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() - 1, 1))}><ChevronLeft size={18} /></button>
              <strong>{nomeMes(mes)}</strong>
              <button type="button" className="icone-botao" aria-label="Próximo mês" onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() + 1, 1))}><ChevronRight size={18} /></button>
            </div>
            {proprio && (
              <label className="ponto-lembretes">
                <input type="checkbox" checked={lembretes} onChange={(e) => { setLembretes(e.target.checked); definirLembretes(cliente.id, e.target.checked) }} />
                Me perguntar o horário (chegada, almoço e saída)
              </label>
            )}
          </div>

          <div className="ponto-tabela-caixa">
            <table className="ponto-tabela">
              <thead><tr><th>Dia</th><th>Entrada</th><th>Almoço</th><th>Saída</th><th>Trabalhado</th><th>Saldo</th><th>Avisos</th></tr></thead>
              <tbody>
                {dias.map((d) => {
                  const p = meus.find((x) => x.dia === d)
                  const r = p ? resumoDia(p, config) : null
                  const cel = (m: Marca) => p?.[m] ? p[m] : p?.esquecidos.includes(m) ? <span className="ponto-esquecido">esquecido</span> : <span className="ponto-vazio">--:--</span>
                  return (
                    <tr key={d} className={`${p ? '' : 'sem-registro'}${d === hoje ? ' hoje' : ''}`} onClick={() => proprio && setEditar({ dia: d, ponto: p ?? null })} style={{ cursor: proprio ? 'pointer' : 'default' }}>
                      <td><b>{dataCurta(d)}</b> <span className="pequeno">{diaSemana(d)}</span></td>
                      <td>{p ? <>{cel('entrada')}{r && r.atraso > 0 && <AlertTriangle size={13} className="ponto-atraso" aria-label="Atrasado" />}</> : null}</td>
                      <td>{p ? <>{cel('almoco_saida')} – {cel('almoco_volta')}</> : null}</td>
                      <td>{p ? cel('saida') : null}</td>
                      <td>{r?.trabalhado != null ? saldoTexto(r.trabalhado, false) : p ? <span className="ponto-vazio">—</span> : null}</td>
                      <td>{r?.saldo != null ? <b className={r.saldo < 0 ? 'neg' : r.saldo > 0 ? 'pos' : ''}>{saldoTexto(r.saldo)}</b> : null}</td>
                      <td><div className="ponto-avisos">
                        {!p ? (proprio ? <span className="pequeno">Sem registro · <u>registrar</u></span> : <span className="pequeno">Sem registro</span>) : (
                          <>{r!.avisos.map((a) => <span key={a} className={`chip ${a.startsWith('Atrasado') ? 'chip--perigo' : a.startsWith('Justificado') ? 'chip--neutro' : 'chip--alerta'}`}>{a}</span>)}
                            {p.foto_path && <span className="chip chip--neutro"><Camera size={11} /> foto</span>}</>
                        )}
                      </div></td>
                    </tr>
                  )
                })}
                {dias.length === 0 && <tr><td colSpan={7} className="pequeno" style={{ textAlign: 'center', padding: 24 }}>Nada neste mês.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {editar && <EditarDia clienteId={cliente.id} eu={eu} dia={editar.dia} ponto={editar.ponto} config={config} onFechar={() => setEditar(null)} onMudou={async () => { setEditar(null); await carregar() }} />}
      {importar && <ImportarPonto onFechar={() => setImportar(false)} enviar={async (itens) => { const n = await importarPontos(cliente.id, eu, itens); await carregar(); return `${n} ${n === 1 ? 'dia importado' : 'dias importados'}.` }} />}
      {configurar && <ConfigJornada config={config} onFechar={() => setConfigurar(false)} onSalvar={async (c) => { await salvarConfig(c); setConfigurar(false); await carregar() }} />}
    </div>
  )
}

function EquipePonto({ pontos, pessoas, config, ciclo, inicioMes, fimMes, mes, setMes, onVer }: {
  pontos: Ponto[]; pessoas: Pessoa[]; config: ConfigPonto; ciclo: { inicio: string; fim: string; nome: string }; inicioMes: string; fimMes: string; mes: Date; setMes: (d: Date) => void; onVer: (id: string) => void
}) {
  const ids = [...new Set([...pessoas.map((p) => p.usuario_id), ...pontos.map((p) => p.usuario_id)])]
  const linhas = ids.map((id) => {
    const dele = pontos.filter((p) => p.usuario_id === id)
    return { id, nome: pessoas.find((p) => p.usuario_id === id)?.nome ?? 'Pessoa', foto: pessoas.find((p) => p.usuario_id === id)?.foto_url, ciclo: saldoPeriodo(dele, config, ciclo.inicio, ciclo.fim), mes: saldoPeriodo(dele, config, inicioMes, fimMes), usa: dele.length > 0 }
  }).sort((a, b) => Number(b.usa) - Number(a.usa) || a.nome.localeCompare(b.nome))
  return (
    <>
      <div className="mes-nav" style={{ alignSelf: 'flex-start' }}>
        <button type="button" className="icone-botao" aria-label="Mês anterior" onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() - 1, 1))}><ChevronLeft size={18} /></button>
        <strong>{nomeMes(mes)}</strong>
        <button type="button" className="icone-botao" aria-label="Próximo mês" onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() + 1, 1))}><ChevronRight size={18} /></button>
      </div>
      <div className="ponto-tabela-caixa">
        <table className="ponto-tabela ponto-tabela--equipe">
          <thead><tr><th>Pessoa</th><th>Banco ({ciclo.nome})</th><th>Dias no mês</th><th>Atrasos</th><th>Esquecidos</th><th>Incompletos</th><th /></tr></thead>
          <tbody>{linhas.map((l) => (
            <tr key={l.id} onClick={() => l.usa && onVer(l.id)} style={{ cursor: l.usa ? 'pointer' : 'default' }} className={l.usa ? '' : 'sem-registro'}>
              <td><span className="ponto-pessoa">{l.foto ? <img src={l.foto} alt="" /> : <span>{l.nome.slice(0, 1)}</span>}<b>{l.nome}</b></span></td>
              <td>{l.usa ? <b className={l.ciclo.saldo < 0 ? 'neg' : 'pos'}>{saldoTexto(l.ciclo.saldo)}</b> : <span className="pequeno">Não usa o ponto</span>}</td>
              <td>{l.usa ? l.mes.dias : ''}</td>
              <td>{l.mes.atrasos ? <span className="chip chip--perigo">{l.mes.atrasos}</span> : l.usa ? 0 : ''}</td>
              <td>{l.mes.esquecidos ? <span className="chip chip--alerta">{l.mes.esquecidos}</span> : l.usa ? 0 : ''}</td>
              <td>{l.mes.incompletos ? <span className="chip chip--alerta">{l.mes.incompletos}</span> : l.usa ? 0 : ''}</td>
              <td>{l.usa && <span className="contas-redes__info">Ver dias</span>}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <p className="pequeno">Atrasado = chegou depois de {config.entrada} + {config.tolerancia_min} min de tolerância. Administradores só veem; cada pessoa edita o próprio ponto.</p>
    </>
  )
}

function EditarDia({ clienteId, eu, dia: diaInicial, ponto, config, onFechar, onMudou }: {
  clienteId: string; eu: string; dia: string; ponto: Ponto | null; config: ConfigPonto; onFechar: () => void; onMudou: () => Promise<void>
}) {
  const j = jornadaDoDia(config, diaInicial)
  const padrao: Record<Marca, string> = { entrada: j?.entrada ?? config.entrada, almoco_saida: '12:00', almoco_volta: '13:00', saida: j?.saida ?? config.saida }
  const [dia, setDia] = useState(diaInicial)
  const [hojeMax] = useState(() => diaIso(new Date()))
  const [horas, setHoras] = useState<Record<Marca, string>>(() => ({ entrada: ponto?.entrada ?? '', almoco_saida: ponto?.almoco_saida ?? '', almoco_volta: ponto?.almoco_volta ?? '', saida: ponto?.saida ?? '' }))
  const [esquecidos, setEsquecidos] = useState<Marca[]>(ponto?.esquecidos ?? [])
  const [justificativa, setJustificativa] = useState(ponto?.justificativa ?? '')
  const [foto, setFoto] = useState<string | null>(ponto?.foto_path ?? null)
  const [fotoUrl, setFotoUrl] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [confirmar, setConfirmar] = useState(false)
  useEffect(() => { if (foto) void linkFotoPonto(foto).then(setFotoUrl) }, [foto])
  const alternarEsquecido = (m: Marca) => setEsquecidos(esquecidos.includes(m) ? esquecidos.filter((x) => x !== m) : [...esquecidos, m])

  async function salvar() {
    setEnviando(true); setErro(null)
    try {
      const dados: EdicaoPonto = { esquecidos, justificativa: justificativa.trim() || null, foto_path: foto, origem: ponto?.origem === 'app' && dia === diaInicial ? 'app' : 'manual' }
      MARCAS.forEach((m) => { dados[m.id] = esquecidos.includes(m.id) ? null : horas[m.id] || null })
      if (ponto && dia !== diaInicial) await excluirPonto(ponto.id)
      await salvarPonto(clienteId, eu, dia, dados)
      await onMudou()
    } catch (e) { setErro((e as Error).message); setEnviando(false) }
  }
  return (
    <Janela titulo={ponto ? 'Editar ponto' : 'Registrar ponto'} onFechar={onFechar} largura={560}>
      <form className="janela__corpo" onSubmit={(e) => { e.preventDefault(); void salvar() }}>
        <div className="campo"><label htmlFor="pt-dia">Dia</label><input id="pt-dia" type="date" className="entrada" style={{ maxWidth: 220 }} value={dia} max={hojeMax} onChange={(e) => e.target.value && setDia(e.target.value)} /></div>
        <div className="ponto-editar">
          {MARCAS.map((m) => {
            const esq = esquecidos.includes(m.id)
            return (
              <div key={m.id} className={`ponto-editar__marca${esq ? ' esquecida' : ''}`}>
                <span className="rotulo-campo">{m.nome}</span>
                {esq ? <span className="ponto-esquecido">Esquecido</span> : horas[m.id]
                  ? <SeletorHora rotulo={m.nome} valor={horas[m.id]} onMudar={(v) => setHoras((h) => ({ ...h, [m.id]: v }))} />
                  : <button type="button" className="ponto-editar__vazio" onClick={() => setHoras((h) => ({ ...h, [m.id]: padrao[m.id] }))}><Clock size={15} /> Colocar horário</button>}
                <div className="ponto-editar__opcoes">
                  {horas[m.id] && !esq && <button type="button" onClick={() => setHoras((h) => ({ ...h, [m.id]: '' }))}>Limpar</button>}
                  <button type="button" className={esq ? 'ativo' : ''} onClick={() => alternarEsquecido(m.id)}>{esq ? 'Lembrei o horário' : 'Esqueci de bater'}</button>
                </div>
              </div>
            )
          })}
        </div>
        <div className="campo"><label htmlFor="pt-just">Justificativa (opcional)</label>
          <input id="pt-just" className="entrada" value={justificativa} onChange={(e) => setJustificativa(e.target.value)} placeholder="Ex.: relógio de ponto sem papel, máquina com defeito, consulta médica…" /></div>
        <div className="campo"><span className="rotulo-campo">Foto (opcional)</span>
          <div className="linha" style={{ gap: 10 }}>
            {foto && fotoUrl && <a href={fotoUrl} target="_blank" rel="noreferrer"><img src={fotoUrl} alt="Foto anexada" className="ponto-foto" /></a>}
            <label className="botao botao--secundario botao--mini" style={{ cursor: 'pointer' }}>
              <ImageIcon size={14} /> {foto ? 'Trocar foto' : 'Anexar foto'}
              <input type="file" hidden accept="image/*" capture="environment" onChange={async (e) => {
                const f = e.target.files?.[0]; e.target.value = ''
                if (!f) return
                try { setFoto(await enviarFotoPonto(clienteId, eu, f)) } catch (x) { setErro((x as Error).message) }
              }} />
            </label>
            {foto && <button type="button" className="botao botao--fantasma botao--mini" onClick={() => { setFoto(null); setFotoUrl(null) }}>Tirar</button>}
          </div>
        </div>
        {erro && <p className="importar__erro">{erro}</p>}
        <div className="linha" style={{ justifyContent: 'space-between' }}>
          <div>{ponto && (confirmar
            ? <Botao type="button" variante="fantasma" className="texto-perigo" onClick={() => void excluirPonto(ponto.id).then(onMudou)}>Confirmar exclusão</Botao>
            : <Botao type="button" variante="fantasma" icone={<Trash2 size={15} />} onClick={() => setConfirmar(true)}>Excluir dia</Botao>)}</div>
          <div className="linha" style={{ gap: 8 }}><Botao type="button" variante="fantasma" onClick={onFechar}>Cancelar</Botao><Botao type="submit" disabled={enviando}>{enviando ? 'Salvando…' : 'Salvar'}</Botao></div>
        </div>
      </form>
    </Janela>
  )
}

type DiaImportado = { dia: string } & EdicaoPonto
const SINONIMOS: Record<string, string[]> = {
  data: ['data', 'dia'], entrada: ['entrada', 'chegada', 'inicio', 'entrada 1'], almoco_saida: ['saida almoco', 'saida para almoco', 'almoco', 'inicio almoco', 'saida 1', 'intervalo'],
  almoco_volta: ['volta almoco', 'retorno almoco', 'retorno', 'fim almoco', 'entrada 2', 'volta'], saida: ['saida', 'saida final', 'saida 2', 'fim'], justificativa: ['justificativa', 'observacao', 'obs', 'motivo'],
}
function horaDe(v: Valor): string | null {
  if (v == null || v === '') return null
  if (v instanceof Date) return `${String(v.getUTCHours()).padStart(2, '0')}:${String(v.getUTCMinutes()).padStart(2, '0')}`
  if (typeof v === 'number' && v < 1) { const t = Math.round(v * 1440); return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}` }
  const m = textoDe(v).trim().match(/^(\d{1,2})\s*[:h.]\s*(\d{2})?/i)
  if (!m || +m[1] > 23) return null
  return `${m[1].padStart(2, '0')}:${m[2] ?? '00'}`
}
function converter(l: Valor[], m: Record<string, number>): Conversao<DiaImportado> {
  const bruto = (c: string) => (m[c] === undefined ? null : l[m[c]])
  const dia = lerDataPlanilha(bruto('data') ?? null)
  if (!dia) return { ok: false, erro: `data "${textoDe(bruto('data'))}" (use dd/mm/aaaa)` }
  const item: DiaImportado = { dia }
  for (const c of ['entrada', 'almoco_saida', 'almoco_volta', 'saida'] as Marca[]) {
    const t = textoDe(bruto(c)).trim()
    if (/esquec/i.test(t)) { item.esquecidos = [...(item.esquecidos ?? []), c]; continue }
    const h = horaDe(bruto(c)); if (t && !h) return { ok: false, erro: `${dia}: horário "${t}" não entendido` }
    item[c] = h
  }
  const j = textoDe(bruto('justificativa')).trim(); if (j) item.justificativa = j
  if (!item.entrada && !item.saida && !item.esquecidos?.length) return { ok: false, erro: `${dia}: sem entrada nem saída` }
  return { ok: true, item }
}
function ImportarPonto({ onFechar, enviar }: { onFechar: () => void; enviar: (itens: DiaImportado[]) => Promise<string> }) {
  return (
    <ImportarPlanilha<DiaImportado> titulo="Importar ponto de planilha" nome="ponto" modelo={MODELO_PONTO} sinonimos={SINONIMOS} obrigatorias={['data']} converter={converter}
      previa={[
        { rotulo: 'Dia', valor: (d) => dataCurta(d.dia) }, { rotulo: 'Entrada', valor: (d) => d.entrada ?? (d.esquecidos?.includes('entrada') ? 'esquecido' : '—') },
        { rotulo: 'Almoço', valor: (d) => `${d.almoco_saida ?? '—'} – ${d.almoco_volta ?? '—'}` }, { rotulo: 'Saída', valor: (d) => d.saida ?? (d.esquecidos?.includes('saida') ? 'esquecido' : '—') },
        { rotulo: 'Justificativa', valor: (d) => d.justificativa ?? '' },
      ]}
      aviso={<p className="faixa-dica">Colunas: Data, Entrada, Saída almoço, Volta almoço, Saída e Justificativa. Dias que já existem são atualizados. Escreva "esquecido" num horário para marcar como esquecido.</p>}
      enviar={(itens) => enviar(itens)} onFechar={onFechar} />
  )
}

function ConfigJornada({ config, onFechar, onSalvar }: { config: ConfigPonto; onFechar: () => void; onSalvar: (c: ConfigPonto) => Promise<void> }) {
  const [c, setC] = useState(config)
  const mudar = (k: keyof ConfigPonto, v: string | number) => setC({ ...c, [k]: v })
  const horas = (c2: ConfigPonto, sexta: boolean) => saldoTexto((Number((sexta ? c2.saida_sexta : c2.saida).slice(0, 2)) * 60 + Number((sexta ? c2.saida_sexta : c2.saida).slice(3, 5))) - (Number(c2.entrada.slice(0, 2)) * 60 + Number(c2.entrada.slice(3, 5))) - c2.almoco_min, false)
  const ciclo = cicloDe(c)
  return (
    <Janela titulo="Jornada da equipe" onFechar={onFechar} largura={520}>
      <form className="janela__corpo" onSubmit={(e) => { e.preventDefault(); void onSalvar(c) }}>
        <div className="grade-3">
          <div className="campo"><label htmlFor="jc-ent">Entrada</label><input id="jc-ent" type="time" className="entrada" value={c.entrada} onChange={(e) => mudar('entrada', e.target.value)} /></div>
          <div className="campo"><label htmlFor="jc-sai">Saída (seg a qui)</label><input id="jc-sai" type="time" className="entrada" value={c.saida} onChange={(e) => mudar('saida', e.target.value)} /></div>
          <div className="campo"><label htmlFor="jc-sex">Saída (sexta)</label><input id="jc-sex" type="time" className="entrada" value={c.saida_sexta} onChange={(e) => mudar('saida_sexta', e.target.value)} /></div>
          <div className="campo"><label htmlFor="jc-alm">Almoço (min)</label><input id="jc-alm" className="entrada" inputMode="numeric" value={c.almoco_min} onChange={(e) => mudar('almoco_min', Number(e.target.value.replace(/\D/g, '')) || 0)} /></div>
          <div className="campo"><label htmlFor="jc-tol">Tolerância (min)</label><input id="jc-tol" className="entrada" inputMode="numeric" value={c.tolerancia_min} onChange={(e) => mudar('tolerancia_min', Number(e.target.value.replace(/\D/g, '')) || 0)} /></div>
          <div className="campo"><label htmlFor="jc-cic">Zera a cada (meses)</label><input id="jc-cic" className="entrada" inputMode="numeric" value={c.ciclo_meses} onChange={(e) => mudar('ciclo_meses', Math.max(1, Math.min(12, Number(e.target.value.replace(/\D/g, '')) || 1)))} /></div>
        </div>
        <div className="campo"><label htmlFor="jc-ini">Contando a partir de</label><input id="jc-ini" type="month" className="entrada" style={{ maxWidth: 220 }} value={c.ciclo_inicio.slice(0, 7)} onChange={(e) => e.target.value && mudar('ciclo_inicio', `${e.target.value}-01`)} /></div>
        <p className="faixa-dica">Segunda a quinta: {horas(c, false)} por dia. Sexta: {horas(c, true)}. Ciclo atual do banco de horas: {ciclo.nome}, zera em {ciclo.zeraEm}.</p>
        <div className="linha" style={{ justifyContent: 'flex-end' }}><Botao type="button" variante="fantasma" onClick={onFechar}>Cancelar</Botao><Botao type="submit">Salvar</Botao></div>
      </form>
    </Janela>
  )
}
