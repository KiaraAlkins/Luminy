import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { AlertTriangle, ArchiveRestore, ArrowDownToLine, ArrowUpFromLine, ChevronDown, ClipboardCheck, History, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { Botao, Chip } from '../components/ui'
import { Janela } from '../components/Janela'
import { useSessao } from '../lib/sessao'
import { listarEventos, hojeIso, type Evento } from '../lib/parcerias'
import {
  CATEGORIAS, MOTIVOS_EXCLUSAO, UNIDADES, criarItem, editarItem, excluirItem, fmt, historicoItem, listarItens, movimentar, restaurarItem, situacao, venceEmDias,
  type DadosItem, type Item, type Movimento, type TipoMovimento,
} from '../lib/estoque'
import { Selecao } from '../components/Selecao'
import { opcaoEvento, opcoesCategoria, opcoesUnidade } from '../components/opcoes'
import './estoque.css'

/** Estoque de materiais: brindes, papel, pilhas, fitas de glicemia, luvas… com entradas, saídas e avisos. */
export function Estoque() {
  const { cliente } = useSessao()
  const [itens, setItens] = useState<Item[] | null>(null)
  const [excluidos, setExcluidos] = useState<Item[]>([])
  const [verExcluidos, setVerExcluidos] = useState(false)
  const [editar, setEditar] = useState<Item | null>(null)
  const [eventos, setEventos] = useState<Evento[]>([])
  const [busca, setBusca] = useState('')
  const [categoria, setCategoria] = useState('')
  const [soBaixo, setSoBaixo] = useState(false)
  const [novo, setNovo] = useState(false)
  const [mov, setMov] = useState<{ item: Item; tipo: TipoMovimento } | null>(null)
  const [hist, setHist] = useState<Item | null>(null)

  const carregar = useCallback(async () => {
    if (!cliente) return
    const [i, e] = await Promise.all([listarItens(cliente.id), listarEventos(cliente.id)])
    setItens(i.ativos); setExcluidos(i.excluidos); setEventos(e.filter((x) => x.data >= hojeIso()))
  }, [cliente])
  useEffect(() => { void Promise.resolve().then(carregar) }, [carregar])

  const alertas = useMemo(() => (itens ?? []).filter((i) => situacao(i) !== 'ok' || (venceEmDias(i) ?? 999) <= 30), [itens])
  const filtrados = useMemo(() => (itens ?? []).filter((i) =>
    (!busca || i.nome.toLowerCase().includes(busca.toLowerCase())) && (!categoria || i.categoria === categoria) &&
    (!soBaixo || situacao(i) !== 'ok')), [itens, busca, categoria, soBaixo])

  if (!cliente) return <div className="corpo"><h2>Estoque</h2><p className="texto-2">Crie um cliente primeiro.</p></div>

  return (
    <div className="corpo">
      <div className="linha" style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div><h2>Estoque</h2><p className="pequeno">Materiais do {cliente.nome} para eventos e para o dia a dia</p></div>
        <Botao icone={<Plus size={16} />} onClick={() => setNovo(true)}>Novo item</Botao>
      </div>

      {alertas.length > 0 && (
        <div className="estoque-alertas" role="status">
          <AlertTriangle size={18} aria-hidden />
          <div>
            <strong>{alertas.length} {alertas.length === 1 ? 'item precisa' : 'itens precisam'} de atenção</strong>
            <p className="pequeno" style={{ color: 'inherit' }}>{alertas.map((i) => {
              const d = venceEmDias(i)
              return `${i.nome} (${situacao(i) === 'zerado' ? 'zerado' : situacao(i) === 'baixo' ? `${fmt(i.quantidade)} ${i.unidade}, mínimo ${fmt(i.minimo)}` : `vence em ${d} dias`})`
            }).join(' · ')}</p>
          </div>
        </div>
      )}

      <div className="filtros" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <label className="busca" style={{ flex: 1, minWidth: 240, width: 'auto' }}>
          <Search size={16} aria-hidden />
          <input aria-label="Buscar item" placeholder="Buscar item" value={busca} onChange={(e) => setBusca(e.target.value)} style={{ border: 0, outline: 0, background: 'none', flex: 1 }} />
        </label>
        <Selecao rotulo="Categoria" valor={categoria} onMudar={setCategoria} largura={220} opcoes={opcoesCategoria(CATEGORIAS, 'Todas as categorias')} />
        <button type="button" className={`opcao${soBaixo ? ' marcada' : ''}`} aria-pressed={soBaixo} onClick={() => setSoBaixo(!soBaixo)}>Só o que precisa repor</button>
      </div>

      <div className="estoque-tabela">
        <div className="estoque-linha cabecalho rotulo"><span>Item</span><span>Saldo</span><span>Local</span><span>Validade</span><span aria-hidden="true" /></div>
        {itens === null && <div className="vazio">Carregando…</div>}
        {itens?.length === 0 && <div className="vazio">Nenhum item cadastrado. Cadastre brindes, fitas de glicemia, luvas, pilhas…</div>}
        {filtrados.map((i) => {
          const s = situacao(i); const d = venceEmDias(i)
          return (
            <div key={i.id} className="estoque-linha">
              <span><strong>{i.nome}</strong><span className="pequeno" style={{ display: 'block' }}>{i.categoria ?? 'Sem categoria'}</span></span>
              <span>
                <span className={`saldo saldo--${s}`}>
                  <span className="saldo__unidade">{i.unidade}</span>
                  <strong className="saldo__numero">{fmt(i.quantidade)}</strong>
                  <span className="saldo__minimo">mín. {fmt(i.minimo)}</span>
                </span>
              </span>
              <span className="texto-2">{i.local ?? '—'}</span>
              <span>{i.validade ? <Chip tom={d !== null && d < 0 ? 'perigo' : d !== null && d <= 30 ? 'alerta' : 'neutro'}>{d !== null && d < 0 ? 'Vencido' : new Date(`${i.validade}T12:00:00`).toLocaleDateString('pt-BR')}</Chip> : <span className="pequeno">—</span>}</span>
              <span className="estoque-acoes">
                <button type="button" className="botao botao--secundario" onClick={() => setMov({ item: i, tipo: 'entrada' })} title="Registrar entrada"><ArrowDownToLine size={15} /> Entrada</button>
                <button type="button" className="botao botao--secundario" onClick={() => setMov({ item: i, tipo: 'saida' })} title="Registrar saída"><ArrowUpFromLine size={15} /> Saída</button>
                <button type="button" className="icone-botao" aria-label={`Contagem de ${i.nome}`} title="Ajustar pela contagem" onClick={() => setMov({ item: i, tipo: 'ajuste' })}><ClipboardCheck size={16} /></button>
                <button type="button" className="icone-botao" aria-label={`Histórico de ${i.nome}`} title="Histórico" onClick={() => setHist(i)}><History size={16} /></button>
                <button type="button" className="icone-botao" aria-label={`Editar ${i.nome}`} title="Editar ou excluir" onClick={() => setEditar(i)}><Pencil size={15} /></button>
              </span>
            </div>
          )
        })}
      </div>

      {novo && <NovoItem onFechar={() => setNovo(false)} onCriar={async (d, ini) => { await criarItem(cliente.id, d, ini); setNovo(false); await carregar() }} />}
      {mov && <Movimentar item={mov.item} tipo={mov.tipo} eventos={eventos} onFechar={() => setMov(null)} onFeito={async () => { setMov(null); await carregar() }} />}
      {hist && <Historico item={hist} onFechar={() => setHist(null)} onEditar={() => { setEditar(hist); setHist(null) }} />}
      {editar && <EditarItem item={editar} onFechar={() => setEditar(null)}
        onSalvar={async (d) => { await editarItem(editar.id, d); setEditar(null); await carregar() }}
        onExcluir={async (motivo) => { await excluirItem(editar.id, motivo); setEditar(null); await carregar() }} />}

      {excluidos.length > 0 && (
        <section className="excluidos">
          <button type="button" className="excluidos__abrir" aria-expanded={verExcluidos} onClick={() => setVerExcluidos(!verExcluidos)}>
            <ChevronDown size={16} style={{ transform: verExcluidos ? 'rotate(180deg)' : undefined, transition: 'transform .2s' }} aria-hidden />
            Itens excluídos ({excluidos.length})
          </button>
          {verExcluidos && (
            <ul className="excluidos__lista">
              {excluidos.map((i) => (
                <li key={i.id}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <strong>{i.nome}</strong>
                    <p className="texto-2">Motivo: {i.motivo_arquivamento}</p>
                    <span className="pequeno">Excluído em {new Date(i.arquivado_em!).toLocaleDateString('pt-BR')}{i.arquivado_por_nome ? ` por ${i.arquivado_por_nome}` : ''}{i.quantidade > 0 ? ` · ficaram ${fmt(i.quantidade)} ${i.unidade}` : ''}</span>
                  </div>
                  <button type="button" className="botao botao--secundario" onClick={() => void restaurarItem(i.id).then(carregar).catch((e: Error) => alert(e.message))}><ArchiveRestore size={15} /> Restaurar</button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}

function NovoItem({ onFechar, onCriar }: { onFechar: () => void; onCriar: (d: Omit<Item, 'id' | 'cliente_id' | 'quantidade' | 'atualizado_em'>, inicial: number) => Promise<void> }) {
  const [d, setD] = useState({ nome: '', categoria: 'Brindes', unidade: 'un', minimo: '0', local: '', validade: '', inicial: '0' })
  const [erro, setErro] = useState<string | null>(null)
  async function enviar(e: FormEvent) {
    e.preventDefault()
    try {
      await onCriar({ nome: d.nome.trim(), categoria: d.categoria || null, unidade: d.unidade, minimo: Number(d.minimo) || 0, local: d.local.trim() || null, validade: d.validade || null, observacoes: null }, Number(d.inicial) || 0)
    } catch (err) { setErro((err as Error).message) }
  }
  return (
    <Janela titulo="Novo item no estoque" onFechar={onFechar} largura={560}>
      <form className="janela__corpo" onSubmit={enviar}>
        <div className="campo"><label htmlFor="it-nome">Nome do item</label><input id="it-nome" className="entrada" autoFocus required value={d.nome} onChange={(e) => setD({ ...d, nome: e.target.value })} placeholder="Ex.: Fitas de glicemia" /></div>
        <div className="grade-2">
          <div className="campo"><label htmlFor="it-cat">Categoria</label><Selecao id="it-cat" valor={d.categoria} onMudar={(v) => setD({ ...d, categoria: v })} opcoes={opcoesCategoria(CATEGORIAS)} /></div>
          <div className="campo"><label htmlFor="it-un">Unidade</label><Selecao id="it-un" valor={d.unidade} onMudar={(v) => setD({ ...d, unidade: v })} opcoes={opcoesUnidade(UNIDADES)} /></div>
          <div className="campo"><label htmlFor="it-ini">Quantidade que tem hoje</label><input id="it-ini" className="entrada" type="number" min={0} step="any" value={d.inicial} onChange={(e) => setD({ ...d, inicial: e.target.value })} /></div>
          <div className="campo"><label htmlFor="it-min">Avisar quando ficar abaixo de</label><input id="it-min" className="entrada" type="number" min={0} step="any" value={d.minimo} onChange={(e) => setD({ ...d, minimo: e.target.value })} /></div>
          <div className="campo"><label htmlFor="it-local">Onde fica</label><input id="it-local" className="entrada" value={d.local} onChange={(e) => setD({ ...d, local: e.target.value })} placeholder="Ex.: Armário 2" /></div>
          <div className="campo"><label htmlFor="it-val">Validade (se tiver)</label><input id="it-val" className="entrada" type="date" value={d.validade} onChange={(e) => setD({ ...d, validade: e.target.value })} /></div>
        </div>
        {erro && <p className="pequeno" style={{ color: 'var(--perigo)' }}>{erro}</p>}
        <div className="linha" style={{ justifyContent: 'flex-end' }}><Botao type="button" variante="fantasma" onClick={onFechar}>Cancelar</Botao><Botao type="submit">Cadastrar</Botao></div>
      </form>
    </Janela>
  )
}

const TITULO: Record<TipoMovimento, string> = { entrada: 'Registrar entrada', saida: 'Registrar saída', ajuste: 'Ajustar pela contagem' }

function Movimentar({ item, tipo, eventos, onFechar, onFeito }: { item: Item; tipo: TipoMovimento; eventos: Evento[]; onFechar: () => void; onFeito: () => Promise<void> }) {
  const [qtd, setQtd] = useState(tipo === 'ajuste' ? String(item.quantidade) : '')
  const [motivo, setMotivo] = useState('')
  const [evento, setEvento] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  async function enviar(e: FormEvent) {
    e.preventDefault()
    const n = Number(qtd)
    const ev = eventos.find((x) => x.id === evento)
    try { await movimentar(item.id, tipo, n, motivo.trim() || (ev ? ev.nome : null) || (tipo === 'ajuste' ? 'Contagem' : null), evento || null); await onFeito() }
    catch (err) { setErro((err as Error).message) }
  }
  return (
    <Janela titulo={`${TITULO[tipo]} · ${item.nome}`} onFechar={onFechar} largura={480}>
      <form className="janela__corpo" onSubmit={enviar}>
        <p className="texto-2">Saldo atual: <strong>{fmt(item.quantidade)} {item.unidade}</strong></p>
        <div className="campo"><label htmlFor="mv-qtd">{tipo === 'ajuste' ? 'Quantidade contada' : 'Quantidade'} ({item.unidade})</label>
          <input id="mv-qtd" className="entrada" type="number" min={tipo === 'ajuste' ? 0 : 0.01} step="any" required autoFocus value={qtd} onChange={(e) => setQtd(e.target.value)} /></div>
        {tipo === 'saida' && eventos.length > 0 && (
          <div className="campo"><label htmlFor="mv-ev">Para qual evento? (opcional)</label>
            <Selecao id="mv-ev" valor={evento} onMudar={setEvento} opcoes={[{ valor: '', rotulo: 'Nenhum' }, ...eventos.map((x) => opcaoEvento(x, (d) => new Date(`${d}T12:00:00`).toLocaleDateString('pt-BR')))]} /></div>
        )}
        <div className="campo"><label htmlFor="mv-mot">Motivo (opcional)</label><input id="mv-mot" className="entrada" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder={tipo === 'entrada' ? 'Ex.: compra, doação do fornecedor' : tipo === 'saida' ? 'Ex.: ação na recepção' : 'Ex.: inventário mensal'} /></div>
        {erro && <p className="pequeno" style={{ color: 'var(--perigo)' }}>{erro}</p>}
        <div className="linha" style={{ justifyContent: 'flex-end' }}><Botao type="button" variante="fantasma" onClick={onFechar}>Cancelar</Botao><Botao type="submit">Registrar</Botao></div>
      </form>
    </Janela>
  )
}

function Historico({ item, onFechar, onEditar }: { item: Item; onFechar: () => void; onEditar: () => void }) {
  const [movs, setMovs] = useState<Movimento[] | null>(null)
  useEffect(() => { void historicoItem(item.id).then(setMovs) }, [item.id])
  return (
    <Janela titulo={`Histórico · ${item.nome}`} onFechar={onFechar} largura={600}>
      <div className="janela__corpo">
        {movs === null ? <p className="pequeno">Carregando…</p> : movs.length === 0 ? <p className="texto-2">Nenhuma movimentação ainda.</p> : (
          <ul className="movimentos">
            {movs.map((m) => (
              <li key={m.id}>
                <Chip tom={m.tipo === 'entrada' ? 'sucesso' : m.tipo === 'saida' ? 'alerta' : 'neutro'}>{m.tipo === 'entrada' ? `+${fmt(m.quantidade)}` : m.tipo === 'saida' ? `−${fmt(m.quantidade)}` : `= ${fmt(m.quantidade)}`}</Chip>
                <span style={{ flex: 1 }}>{m.motivo ?? (m.tipo === 'ajuste' ? 'Contagem' : '—')}</span>
                <span className="pequeno">{new Date(m.criado_em).toLocaleDateString('pt-BR')}{m.autor ? ` · ${m.autor}` : ''}</span>
              </li>
            ))}
          </ul>
        )}
        <Botao variante="secundario" icone={<Pencil size={15} />} style={{ alignSelf: 'flex-start' }} onClick={onEditar}>Editar item</Botao>
      </div>
    </Janela>
  )
}

/** Editar todos os dados do item; excluir pede o motivo (o item vai para "Itens excluídos" e pode voltar). */
function EditarItem({ item, onFechar, onSalvar, onExcluir }: {
  item: Item; onFechar: () => void; onSalvar: (d: Partial<DadosItem>) => Promise<void>; onExcluir: (motivo: string) => Promise<void>
}) {
  const [d, setD] = useState({ nome: item.nome, categoria: item.categoria ?? '', unidade: item.unidade, minimo: String(item.minimo),
    local: item.local ?? '', validade: item.validade ?? '', observacoes: item.observacoes ?? '' })
  const [excluindo, setExcluindo] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [outro, setOutro] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const campo = (k: keyof typeof d) => ({ value: d[k], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setD({ ...d, [k]: e.target.value }) })
  const unidades = UNIDADES.includes(d.unidade) ? UNIDADES : [d.unidade, ...UNIDADES]
  const motivoFinal = motivo === 'outro' ? outro.trim() : motivo

  async function salvar(e: FormEvent) {
    e.preventDefault(); setErro(null)
    try {
      await onSalvar({ nome: d.nome.trim(), categoria: d.categoria || null, unidade: d.unidade, minimo: Number(d.minimo) || 0,
        local: d.local.trim() || null, validade: d.validade || null, observacoes: d.observacoes.trim() || null })
    } catch (err) { setErro((err as Error).message) }
  }
  async function excluir() {
    if (motivoFinal.length < 3) return
    try { await onExcluir(motivoFinal) } catch { setErro('Não foi possível excluir.') }
  }

  return (
    <Janela titulo={`Editar ${item.nome}`} onFechar={onFechar} largura={580}>
      <div className="janela__corpo">
        {!excluindo ? (
          <form onSubmit={salvar} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="campo"><label htmlFor="ed-nome">Nome do item</label><input id="ed-nome" className="entrada" required {...campo('nome')} /></div>
            <div className="grade-2">
              <div className="campo"><label htmlFor="ed-cat">Categoria</label><Selecao id="ed-cat" valor={d.categoria} onMudar={(v) => setD({ ...d, categoria: v })} opcoes={opcoesCategoria(CATEGORIAS, 'Sem categoria')} /></div>
              <div className="campo"><label htmlFor="ed-un">Unidade</label><Selecao id="ed-un" valor={d.unidade} onMudar={(v) => setD({ ...d, unidade: v })} opcoes={opcoesUnidade(unidades)} /></div>
              <div className="campo"><label htmlFor="ed-min">Avisar quando ficar abaixo de</label><input id="ed-min" className="entrada" type="number" min={0} step="any" {...campo('minimo')} /></div>
              <div className="campo"><label htmlFor="ed-local">Onde fica</label><input id="ed-local" className="entrada" {...campo('local')} /></div>
              <div className="campo"><label htmlFor="ed-val">Validade</label><input id="ed-val" className="entrada" type="date" {...campo('validade')} /></div>
              <div className="campo"><label>Quantidade</label><p className="texto-2" style={{ margin: '10px 0 0' }}>{fmt(item.quantidade)} {item.unidade} · muda por entrada, saída ou contagem</p></div>
            </div>
            <div className="campo"><label htmlFor="ed-obs">Observações</label><textarea id="ed-obs" className="entrada" rows={2} {...campo('observacoes')} /></div>
            {erro && <p className="pequeno" style={{ color: 'var(--perigo)' }}>{erro}</p>}
            <div className="linha" style={{ justifyContent: 'space-between' }}>
              <Botao type="button" variante="fantasma" style={{ color: 'var(--perigo)' }} icone={<Trash2 size={16} />} onClick={() => setExcluindo(true)}>Excluir item</Botao>
              <div className="linha"><Botao type="button" variante="fantasma" onClick={onFechar}>Cancelar</Botao><Botao type="submit">Salvar</Botao></div>
            </div>
          </form>
        ) : (
          <div className="excluir-item">
            <strong>Por que está excluindo {item.nome}?</strong>
            <div className="excluir-item__motivos" role="radiogroup" aria-label="Motivo da exclusão">
              {[...MOTIVOS_EXCLUSAO, 'outro'].map((m) => (
                <button key={m} type="button" role="radio" aria-checked={motivo === m} className={`opcao${motivo === m ? ' marcada' : ''}`} onClick={() => setMotivo(m)}>
                  {m === 'outro' ? 'Outro motivo…' : m}
                </button>
              ))}
            </div>
            {motivo === 'outro' && <input className="entrada" autoFocus value={outro} onChange={(e) => setOutro(e.target.value)} placeholder="Escreva o motivo" aria-label="Outro motivo" />}
            {item.quantidade > 0 && <p className="pequeno" style={{ color: '#8a5000' }}>Ainda há {fmt(item.quantidade)} {item.unidade} registrados. Se for doar ou descartar, registre uma saída antes.</p>}
            <p className="pequeno">O item sai da lista, mas o histórico fica guardado em "Itens excluídos", com o motivo, quem excluiu e quando. Dá para restaurar depois.</p>
            {erro && <p className="pequeno" style={{ color: 'var(--perigo)' }}>{erro}</p>}
            <div className="linha" style={{ justifyContent: 'flex-end' }}>
              <Botao type="button" variante="fantasma" onClick={() => setExcluindo(false)}>Voltar</Botao>
              <button type="button" className="botao botao--perigo" disabled={motivoFinal.length < 3} onClick={() => void excluir()}><Trash2 size={16} /> Excluir item</button>
            </div>
          </div>
        )}
      </div>
    </Janela>
  )
}
