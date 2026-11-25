import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine, ClipboardCheck, History, Plus, Search, Trash2 } from 'lucide-react'
import { Botao, Chip } from '../components/ui'
import { Janela } from '../components/Janela'
import { useSessao } from '../lib/sessao'
import { listarEventos, hojeIso, type Evento } from '../lib/parcerias'
import {
  CATEGORIAS, UNIDADES, criarItem, editarItem, excluirItem, fmt, historicoItem, listarItens, movimentar, situacao, venceEmDias,
  type Item, type Movimento, type TipoMovimento,
} from '../lib/estoque'
import './estoque.css'

/** Estoque de materiais: brindes, papel, pilhas, fitas de glicemia, luvas… com entradas, saídas e avisos. */
export function Estoque() {
  const { cliente, ehAdminCliente } = useSessao()
  const [itens, setItens] = useState<Item[] | null>(null)
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
    setItens(i); setEventos(e.filter((x) => x.data >= hojeIso()))
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
        <select className="entrada" style={{ width: 'auto', background: 'var(--superficie)' }} aria-label="Categoria" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
          <option value="">Todas as categorias</option>{CATEGORIAS.map((c) => <option key={c}>{c}</option>)}
        </select>
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
                <strong className={`saldo saldo--${s}`}>{fmt(i.quantidade)} {i.unidade}</strong>
                <span className="pequeno" style={{ display: 'block' }}>mínimo {fmt(i.minimo)}</span>
              </span>
              <span className="texto-2">{i.local ?? '—'}</span>
              <span>{i.validade ? <Chip tom={d !== null && d < 0 ? 'perigo' : d !== null && d <= 30 ? 'alerta' : 'neutro'}>{d !== null && d < 0 ? 'Vencido' : new Date(`${i.validade}T12:00:00`).toLocaleDateString('pt-BR')}</Chip> : <span className="pequeno">—</span>}</span>
              <span className="estoque-acoes">
                <button type="button" className="botao botao--secundario" onClick={() => setMov({ item: i, tipo: 'entrada' })} title="Registrar entrada"><ArrowDownToLine size={15} /> Entrada</button>
                <button type="button" className="botao botao--secundario" onClick={() => setMov({ item: i, tipo: 'saida' })} title="Registrar saída"><ArrowUpFromLine size={15} /> Saída</button>
                <button type="button" className="icone-botao" aria-label={`Contagem de ${i.nome}`} title="Ajustar pela contagem" onClick={() => setMov({ item: i, tipo: 'ajuste' })}><ClipboardCheck size={16} /></button>
                <button type="button" className="icone-botao" aria-label={`Histórico de ${i.nome}`} title="Histórico" onClick={() => setHist(i)}><History size={16} /></button>
              </span>
            </div>
          )
        })}
      </div>

      {novo && <NovoItem onFechar={() => setNovo(false)} onCriar={async (d, ini) => { await criarItem(cliente.id, d, ini); setNovo(false); await carregar() }} />}
      {mov && <Movimentar item={mov.item} tipo={mov.tipo} eventos={eventos} onFechar={() => setMov(null)} onFeito={async () => { setMov(null); await carregar() }} />}
      {hist && <Historico item={hist} podeExcluir={ehAdminCliente} onFechar={() => setHist(null)}
        onSalvar={async (d) => { await editarItem(hist.id, d); setHist(null); await carregar() }}
        onExcluir={async () => { await excluirItem(hist.id); setHist(null); await carregar() }} />}
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
    } catch (err) { setErro(/duplicate|unique/i.test(String((err as Error).message)) ? 'Já existe um item com este nome.' : 'Não foi possível cadastrar.') }
  }
  return (
    <Janela titulo="Novo item no estoque" onFechar={onFechar} largura={560}>
      <form className="janela__corpo" onSubmit={enviar}>
        <div className="campo"><label htmlFor="it-nome">Nome do item</label><input id="it-nome" className="entrada" autoFocus required value={d.nome} onChange={(e) => setD({ ...d, nome: e.target.value })} placeholder="Ex.: Fitas de glicemia" /></div>
        <div className="grade-2">
          <div className="campo"><label htmlFor="it-cat">Categoria</label><select id="it-cat" className="entrada" value={d.categoria} onChange={(e) => setD({ ...d, categoria: e.target.value })}>{CATEGORIAS.map((c) => <option key={c}>{c}</option>)}</select></div>
          <div className="campo"><label htmlFor="it-un">Unidade</label><select id="it-un" className="entrada" value={d.unidade} onChange={(e) => setD({ ...d, unidade: e.target.value })}>{UNIDADES.map((u) => <option key={u}>{u}</option>)}</select></div>
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
            <select id="mv-ev" className="entrada" value={evento} onChange={(e) => setEvento(e.target.value)}>
              <option value="">Nenhum</option>{eventos.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
            </select></div>
        )}
        <div className="campo"><label htmlFor="mv-mot">Motivo (opcional)</label><input id="mv-mot" className="entrada" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder={tipo === 'entrada' ? 'Ex.: compra, doação do fornecedor' : tipo === 'saida' ? 'Ex.: ação na recepção' : 'Ex.: inventário mensal'} /></div>
        {erro && <p className="pequeno" style={{ color: 'var(--perigo)' }}>{erro}</p>}
        <div className="linha" style={{ justifyContent: 'flex-end' }}><Botao type="button" variante="fantasma" onClick={onFechar}>Cancelar</Botao><Botao type="submit">Registrar</Botao></div>
      </form>
    </Janela>
  )
}

function Historico({ item, podeExcluir, onFechar, onSalvar, onExcluir }: {
  item: Item; podeExcluir: boolean; onFechar: () => void; onSalvar: (d: Partial<Item>) => Promise<void>; onExcluir: () => Promise<void>
}) {
  const [movs, setMovs] = useState<Movimento[] | null>(null)
  const [d, setD] = useState({ minimo: String(item.minimo), local: item.local ?? '', validade: item.validade ?? '' })
  useEffect(() => { void historicoItem(item.id).then(setMovs) }, [item.id])
  return (
    <Janela titulo={item.nome} onFechar={onFechar} largura={600}>
      <div className="janela__corpo">
        <form className="grade-2" onSubmit={(e) => { e.preventDefault(); void onSalvar({ minimo: Number(d.minimo) || 0, local: d.local.trim() || null, validade: d.validade || null }) }}>
          <div className="campo"><label htmlFor="h-min">Avisar abaixo de</label><input id="h-min" className="entrada" type="number" min={0} step="any" value={d.minimo} onChange={(e) => setD({ ...d, minimo: e.target.value })} /></div>
          <div className="campo"><label htmlFor="h-loc">Onde fica</label><input id="h-loc" className="entrada" value={d.local} onChange={(e) => setD({ ...d, local: e.target.value })} /></div>
          <div className="campo"><label htmlFor="h-val">Validade</label><input id="h-val" className="entrada" type="date" value={d.validade} onChange={(e) => setD({ ...d, validade: e.target.value })} /></div>
          <div style={{ alignSelf: 'end' }}><Botao type="submit" variante="secundario">Salvar dados</Botao></div>
        </form>
        <h4 style={{ margin: 0 }}>Movimentações</h4>
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
        {podeExcluir && <Botao variante="fantasma" style={{ color: 'var(--perigo)', alignSelf: 'flex-start' }} onClick={() => { if (confirm(`Excluir ${item.nome} e o histórico?`)) void onExcluir() }}><Trash2 size={16} /> Excluir item</Botao>}
      </div>
    </Janela>
  )
}
