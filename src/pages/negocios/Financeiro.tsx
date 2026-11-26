import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, ChevronLeft, ChevronRight, FileSignature, Paperclip, Pencil, Plus, Receipt, Trash2, Wallet } from 'lucide-react'
import { Botao } from '../../components/ui'
import { Janela } from '../../components/Janela'
import { Selecao } from '../../components/Selecao'
import { BotaoPlanilha } from '../../components/Planilha'
import { useSessao } from '../../lib/sessao'
import {
  carregarNegocios, corCategoria, custoMensal, dataBr, definirVerba, excluir, hojeIso, lerValor, mesIso, reais, salvar, situacaoContrato,
  type Contrato, type DadosNegocios, type Lancamento,
} from '../../lib/negocios'
import { CampoArquivo, CampoValor, SeletorFornecedor, opcoesCategoriaGasto, valorParaCampo } from './comum'
import './negocios.css'

const nomeMes = (d: Date) => { const t = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }); return t.charAt(0).toUpperCase() + t.slice(1) }

/** Financeiro do marketing: verba do mês, gastos pagos e previstos, por categoria, e mensalidades dos contratos. */
export function Financeiro() {
  const { cliente } = useSessao()
  const [dados, setDados] = useState<DadosNegocios | null>(null)
  const [mes, setMes] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const [editar, setEditar] = useState<Lancamento | Partial<Lancamento> | null>(null)
  const [editarVerba, setEditarVerba] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [agora] = useState(() => Date.now())

  const carregar = useCallback(async () => {
    if (!cliente) return
    try { setDados(await carregarNegocios(cliente.id)) } catch (e) { setErro((e as Error).message) }
  }, [cliente])
  useEffect(() => { void Promise.resolve().then(carregar) }, [carregar])

  const chave = mesIso(mes)
  const doMes = useMemo(() => (dados?.lancamentos ?? []).filter((l) => l.data.slice(0, 7) === chave.slice(0, 7)).sort((a, b) => b.data.localeCompare(a.data)), [dados, chave])
  const verba = dados?.verbas.find((v) => v.mes === chave)?.valor ?? null
  const pago = doMes.filter((l) => l.situacao === 'pago').reduce((s, l) => s + l.valor, 0)
  const previsto = doMes.filter((l) => l.situacao === 'previsto').reduce((s, l) => s + l.valor, 0)
  const saldo = verba != null ? verba - pago - previsto : null
  const porCategoria = useMemo(() => {
    const m = new Map<string, number>()
    doMes.forEach((l) => m.set(l.categoria ?? 'Outros', (m.get(l.categoria ?? 'Outros') ?? 0) + l.valor))
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [doMes])
  const maiorCategoria = porCategoria[0]?.[1] ?? 0
  // Contratos mensais ativos que ainda não têm a mensalidade lançada neste mês
  const mensalidades = (dados?.contratos ?? []).filter((c) => c.periodicidade === 'mensal' && ['ativo', 'renovar'].includes(situacaoContrato(c, agora))
    && c.inicio.slice(0, 7) <= chave.slice(0, 7) && (!c.fim || c.fim.slice(0, 7) >= chave.slice(0, 7)))
  const faltaLancar = mensalidades.filter((c) => !doMes.some((l) => l.contrato_id === c.id))
  const comprometido = (dados?.contratos ?? []).filter((c) => ['ativo', 'renovar'].includes(situacaoContrato(c, agora))).reduce((s, c) => s + custoMensal(c), 0)
  const fornecedor = (id: string | null) => dados?.fornecedores.find((f) => f.id === id)?.nome ?? null

  if (!cliente) return <div className="corpo"><h2>Financeiro</h2><p className="texto-2">Crie um cliente primeiro.</p></div>

  async function lancarMensalidade(c: Contrato) {
    if (!cliente) return
    const dia = Math.min(Number(c.inicio.slice(8, 10)), new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate())
    await salvar('lancamentos', cliente.id, null, { data: `${chave.slice(0, 8)}${String(dia).padStart(2, '0')}`, descricao: `Mensalidade: ${c.titulo}`, categoria: c.categoria, valor: c.valor, situacao: 'previsto', fornecedor_id: c.fornecedor_id, contrato_id: c.id })
    await carregar()
  }
  async function alternarPago(l: Lancamento) {
    if (!cliente) return
    setDados((d) => d && { ...d, lancamentos: d.lancamentos.map((x) => (x.id === l.id ? { ...x, situacao: l.situacao === 'pago' ? 'previsto' : 'pago' } : x)) })
    try { await salvar('lancamentos', cliente.id, l.id, { situacao: l.situacao === 'pago' ? 'previsto' : 'pago' }) } catch (e) { setErro((e as Error).message); void carregar() }
  }
  const usoPago = verba ? Math.min(100, (pago / verba) * 100) : 0
  const usoPrevisto = verba ? Math.min(100 - usoPago, (previsto / verba) * 100) : 0

  return (
    <div className="corpo">
      <div className="linha" style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div><h2>Financeiro</h2><p className="pequeno">Verba e gastos do marketing. Só administradores veem esta página.</p></div>
        <div className="linha" style={{ gap: 8 }}>
          <BotaoPlanilha nome={`gastos-marketing-${chave.slice(0, 7)}`} exportar={() => ({
            colunas: ['Data', 'Descrição', 'Categoria', 'Fornecedor', 'Valor', 'Situação'],
            linhas: doMes.map((l) => [new Date(`${l.data}T12:00:00`), l.descricao, l.categoria, fornecedor(l.fornecedor_id), l.valor, l.situacao === 'pago' ? 'Pago' : 'Previsto']),
          })} />
          <Botao icone={<Plus size={16} />} onClick={() => setEditar({ data: chave.slice(0, 7) === hojeIso().slice(0, 7) ? hojeIso() : chave, situacao: 'pago' })}>Novo gasto</Botao>
        </div>
      </div>

      <div className="mes-nav">
        <button type="button" className="icone-botao" aria-label="Mês anterior" onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() - 1, 1))}><ChevronLeft size={18} /></button>
        <strong>{nomeMes(mes)}</strong>
        <button type="button" className="icone-botao" aria-label="Próximo mês" onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() + 1, 1))}><ChevronRight size={18} /></button>
      </div>
      {erro && <p className="importar__erro">{erro}</p>}

      <section className="verba">
        <div className="verba__topo">
          <div>
            <span className="rotulo">Verba do mês</span>
            {verba != null
              ? <button type="button" className="verba__valor" onClick={() => setEditarVerba(true)} title="Alterar verba">{reais(verba)} <Pencil size={14} /></button>
              : <button type="button" className="botao botao--secundario botao--mini" style={{ marginTop: 6 }} onClick={() => setEditarVerba(true)}><Wallet size={14} /> Definir a verba do mês</button>}
          </div>
          <div className="verba__numeros">
            <span><small>Pago</small><strong>{reais(pago)}</strong></span>
            <span><small>Previsto</small><strong>{reais(previsto)}</strong></span>
            {saldo != null && <span className={saldo < 0 ? 'negativo' : ''}><small>{saldo < 0 ? 'Acima da verba' : 'Sobra'}</small><strong>{reais(Math.abs(saldo))}</strong></span>}
          </div>
        </div>
        {verba != null && (
          <>
            <div className="verba__barra" role="img" aria-label={`Pago ${Math.round(usoPago)}% e previsto ${Math.round(usoPrevisto)}% da verba`}>
              <span className="verba__pago" style={{ width: `${usoPago}%` }} title={`Pago: ${reais(pago)}`} />
              <span className="verba__previsto" style={{ width: `${usoPrevisto}%` }} title={`Previsto: ${reais(previsto)}`} />
            </div>
            <div className="verba__legenda"><span><i className="verba__pago" /> Pago</span><span><i className="verba__previsto" /> Previsto</span><span>{verba ? Math.round(((pago + previsto) / verba) * 100) : 0}% da verba usada</span></div>
          </>
        )}
      </section>

      <div className="financeiro-grade">
        <section className="cartao-negocio">
          <h3>Gastos por categoria</h3>
          {porCategoria.length ? (
            <ul className="barras-categoria">
              {porCategoria.map(([cat, v]) => (
                <li key={cat} title={`${cat}: ${reais(v)}`}>
                  <span className="barras-categoria__nome"><span className="bolinha-cor" style={{ background: corCategoria(cat) }} />{cat}</span>
                  <span className="barras-categoria__trilho"><span style={{ width: `${(v / maiorCategoria) * 100}%` }} /></span>
                  <strong>{reais(v)}</strong>
                </li>
              ))}
            </ul>
          ) : <p className="pequeno">Nenhum gasto neste mês.</p>}
        </section>
        <section className="cartao-negocio">
          <h3>Contratos</h3>
          <p className="financeiro-comprometido"><strong>{reais(comprometido)}</strong><span>por mês comprometidos com contratos</span></p>
          {faltaLancar.length > 0 && (
            <ul className="mensalidades">
              {faltaLancar.map((c) => (
                <li key={c.id}>
                  <span><strong>{c.titulo}</strong><small>{fornecedor(c.fornecedor_id) ?? 'Contrato'} · {reais(c.valor)}</small></span>
                  <button type="button" className="botao botao--secundario botao--mini" onClick={() => void lancarMensalidade(c)}><Plus size={13} /> Lançar mensalidade</button>
                </li>
              ))}
            </ul>
          )}
          <Link className="botao botao--fantasma botao--mini" to="/contratos"><FileSignature size={14} /> Ver contratos</Link>
        </section>
      </div>

      <section className="cartao-negocio">
        <h3>Gastos de {mes.toLocaleDateString('pt-BR', { month: 'long' })} <span className="pequeno">{doMes.length}</span></h3>
        {dados === null ? <p className="pequeno">Carregando…</p> : doMes.length === 0 ? (
          <div className="vazio-grande" style={{ padding: 24 }}><Receipt size={30} /><p className="texto-2">Nenhum gasto lançado em {nomeMes(mes)}.</p></div>
        ) : (
          <ul className="lancamentos">
            {doMes.map((l) => (
              <li key={l.id} className={`lancamento lancamento--${l.situacao}`}>
                <button type="button" className={`lancamento__pago${l.situacao === 'pago' ? ' marcado' : ''}`} aria-pressed={l.situacao === 'pago'}
                  title={l.situacao === 'pago' ? 'Pago (clique para voltar a previsto)' : 'Previsto (clique quando pagar)'} onClick={() => void alternarPago(l)}><Check size={14} /></button>
                <button type="button" className="lancamento__abrir" onClick={() => setEditar(l)}>
                  <span className="lancamento__data">{dataBr(l.data).slice(0, 5)}</span>
                  <span className="lancamento__texto"><strong>{l.descricao}</strong>
                    <small><span className="bolinha-cor" style={{ background: corCategoria(l.categoria) }} />{l.categoria ?? 'Sem categoria'}{fornecedor(l.fornecedor_id) ? ` · ${fornecedor(l.fornecedor_id)}` : ''}{l.comprovante_path ? <> · <Paperclip size={11} /> comprovante</> : ''}</small></span>
                  <span className="lancamento__valor">{reais(l.valor)}<small>{l.situacao === 'pago' ? 'Pago' : 'Previsto'}</small></span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {editarVerba && <VerbaModal mes={mes} atual={verba} onFechar={() => setEditarVerba(false)} onSalvar={async (v) => { await definirVerba(cliente.id, chave, v); setEditarVerba(false); await carregar() }} />}
      {editar && dados && <LancamentoModal clienteId={cliente.id} lancamento={editar} dados={dados} onFechar={() => setEditar(null)}
        onSalvar={async (l) => { await salvar('lancamentos', cliente.id, 'id' in editar && editar.id ? editar.id : null, l); setEditar(null); await carregar() }}
        onExcluir={'id' in editar && editar.id ? async () => { await excluir('lancamentos', editar.id!); setEditar(null); await carregar() } : undefined} />}
    </div>
  )
}

function VerbaModal({ mes, atual, onFechar, onSalvar }: { mes: Date; atual: number | null; onFechar: () => void; onSalvar: (v: number) => Promise<void> }) {
  const [v, setV] = useState(valorParaCampo(atual))
  const [erro, setErro] = useState<string | null>(null)
  return (
    <Janela titulo={`Verba de ${nomeMes(mes)}`} onFechar={onFechar} largura={420}>
      <form className="janela__corpo" onSubmit={(e) => { e.preventDefault(); const n = lerValor(v); if (n == null) { setErro('Informe um valor.'); return } void onSalvar(n) }}>
        <div className="campo"><label htmlFor="verba-v">Quanto o marketing tem para gastar no mês</label><CampoValor id="verba-v" valor={v} onMudar={setV} autoFocus /></div>
        {erro && <p className="importar__erro">{erro}</p>}
        <div className="linha" style={{ justifyContent: 'flex-end' }}><Botao type="button" variante="fantasma" onClick={onFechar}>Cancelar</Botao><Botao type="submit">Salvar</Botao></div>
      </form>
    </Janela>
  )
}

function LancamentoModal({ clienteId, lancamento, dados, onFechar, onSalvar, onExcluir }: {
  clienteId: string; lancamento: Partial<Lancamento>; dados: DadosNegocios; onFechar: () => void; onSalvar: (l: Partial<Lancamento>) => Promise<void>; onExcluir?: () => Promise<void>
}) {
  const [descricao, setDescricao] = useState(lancamento.descricao ?? '')
  const [valor, setValor] = useState(valorParaCampo(lancamento.valor))
  const [data, setData] = useState(lancamento.data ?? hojeIso())
  const [categoria, setCategoria] = useState(lancamento.categoria ?? '')
  const [fornecedorId, setFornecedorId] = useState(lancamento.fornecedor_id ?? '')
  const [situacao, setSituacao] = useState<Lancamento['situacao']>(lancamento.situacao ?? 'pago')
  const [comprovante, setComprovante] = useState<string | null>(lancamento.comprovante_path ?? null)
  const [observacao, setObservacao] = useState(lancamento.observacao ?? '')
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [confirmar, setConfirmar] = useState(false)
  const origem = lancamento.orcamento_id ? 'Veio de um orçamento aprovado no Comercial.' : lancamento.contrato_id ? 'Mensalidade de um contrato.' : null

  async function salvarTudo() {
    const n = lerValor(valor)
    if (!descricao.trim()) { setErro('Descreva o gasto.'); return }
    if (!n || n <= 0) { setErro('Informe o valor.'); return }
    setSalvando(true); setErro(null)
    try {
      await onSalvar({ descricao: descricao.trim(), valor: n, data, categoria: categoria || null, fornecedor_id: fornecedorId || null, situacao, comprovante_path: comprovante, observacao: observacao.trim() || null })
    } catch (e) { setErro((e as Error).message); setSalvando(false) }
  }
  return (
    <Janela titulo={lancamento.id ? 'Gasto' : 'Novo gasto'} onFechar={onFechar} largura={560}>
      <form className="janela__corpo" onSubmit={(e) => { e.preventDefault(); void salvarTudo() }}>
        {origem && <p className="faixa-dica">{origem}</p>}
        <div className="campo"><label htmlFor="l-desc">O que foi</label><input id="l-desc" className="entrada" autoFocus={!lancamento.id} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: Banners do Outubro Rosa" /></div>
        <div className="grade-2">
          <div className="campo"><label htmlFor="l-valor">Valor</label><CampoValor id="l-valor" valor={valor} onMudar={setValor} /></div>
          <div className="campo"><label htmlFor="l-data">Data</label><input id="l-data" type="date" className="entrada" value={data} onChange={(e) => setData(e.target.value)} /></div>
          <div className="campo"><label htmlFor="l-cat">Categoria</label><Selecao id="l-cat" valor={categoria} onMudar={setCategoria} opcoes={opcoesCategoriaGasto} /></div>
          <div className="campo"><label htmlFor="l-forn">Fornecedor</label><SeletorFornecedor id="l-forn" valor={fornecedorId} onMudar={setFornecedorId} fornecedores={dados.fornecedores} /></div>
        </div>
        <div className="campo"><span className="rotulo-campo">Situação</span>
          <div className="segmentos" role="radiogroup" aria-label="Situação">
            <button type="button" role="radio" aria-checked={situacao === 'pago'} className={situacao === 'pago' ? 'marcado' : ''} onClick={() => setSituacao('pago')}>Pago</button>
            <button type="button" role="radio" aria-checked={situacao === 'previsto'} className={situacao === 'previsto' ? 'marcado' : ''} onClick={() => setSituacao('previsto')}>Previsto</button>
          </div>
        </div>
        <div className="campo"><span className="rotulo-campo">Nota fiscal ou comprovante</span><CampoArquivo clienteId={clienteId} pasta="comprovantes" caminho={comprovante} onMudar={setComprovante} rotulo="Anexar comprovante" /></div>
        <div className="campo"><label htmlFor="l-obs">Observação (opcional)</label><input id="l-obs" className="entrada" value={observacao} onChange={(e) => setObservacao(e.target.value)} /></div>
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
