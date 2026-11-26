import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Award, CalendarClock, Check, FileText, Mail, MessageCircle, Plus, Store, Trash2, Trophy } from 'lucide-react'
import { Botao } from '../../components/ui'
import { Janela } from '../../components/Janela'
import { Selecao } from '../../components/Selecao'
import { comemorar } from '../../lib/comemorar'
import { useSessao } from '../../lib/sessao'
import {
  abrirArquivo, aprovarCotacao, carregarNegocios, corCategoria, dataBr, diasAte, excluir, excluirCotacao, lerValor, reais, salvar, salvarCotacao, salvarOrcamento,
  type Cotacao, type DadosNegocios, type Fornecedor, type Orcamento,
} from '../../lib/negocios'
import { CampoArquivo, CampoValor, Estrelas, SeletorFornecedor, opcoesCategoriaGasto } from './comum'
import './negocios.css'

type Aba = 'orcamentos' | 'fornecedores'

/** Comercial do marketing: orçamentos com cotações de vários fornecedores, e a lista de fornecedores. */
export function Comercial() {
  const { cliente } = useSessao()
  const [dados, setDados] = useState<DadosNegocios | null>(null)
  const [aba, setAba] = useState<Aba>('orcamentos')
  const [abrir, setAbrir] = useState<string | 'novo' | null>(null)
  const [fornecedor, setFornecedor] = useState<Fornecedor | 'novo' | null>(null)
  const [verAprovados, setVerAprovados] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [agora] = useState(() => Date.now())

  const carregar = useCallback(async () => {
    if (!cliente) return
    try { setDados(await carregarNegocios(cliente.id)) } catch (e) { setErro((e as Error).message) }
  }, [cliente])
  useEffect(() => { void Promise.resolve().then(carregar) }, [carregar])

  const cotando = (dados?.orcamentos ?? []).filter((o) => o.situacao === 'cotando').sort((a, b) => (a.prazo ?? '9').localeCompare(b.prazo ?? '9'))
  const fechados = (dados?.orcamentos ?? []).filter((o) => o.situacao !== 'cotando')
  const gastoPorFornecedor = useMemo(() => {
    const m = new Map<string, number>()
    const ano = new Date(agora).getFullYear()
    ;(dados?.lancamentos ?? []).filter((l) => l.fornecedor_id && l.situacao === 'pago' && l.data.startsWith(String(ano))).forEach((l) => m.set(l.fornecedor_id!, (m.get(l.fornecedor_id!) ?? 0) + l.valor))
    return m
  }, [dados, agora])
  const nomeFornecedor = (q: Cotacao) => dados?.fornecedores.find((f) => f.id === q.fornecedor_id)?.nome ?? q.fornecedor_nome ?? 'Fornecedor'
  const orcamentoAberto = abrir && abrir !== 'novo' ? dados?.orcamentos.find((o) => o.id === abrir) ?? null : null

  if (!cliente) return <div className="corpo"><h2>Comercial</h2><p className="texto-2">Crie um cliente primeiro.</p></div>

  const cartaoOrcamento = (o: Orcamento) => {
    const menor = o.cotacoes.length ? Math.min(...o.cotacoes.map((q) => q.valor)) : null
    const escolhida = o.cotacoes.find((q) => q.id === o.cotacao_escolhida)
    const falta = o.prazo ? diasAte(o.prazo, agora) : null
    return (
      <li key={o.id} className={`orcamento orcamento--${o.situacao}`}>
        <button type="button" className="orcamento__abrir" onClick={() => setAbrir(o.id)} aria-label={`Abrir ${o.titulo}`} />
        <div className="orcamento__topo">
          {o.categoria && <span className="pequeno"><span className="bolinha-cor" style={{ background: corCategoria(o.categoria) }} />{o.categoria}</span>}
          {o.situacao === 'cotando' && falta != null && <span className={`orcamento__prazo${falta <= 3 ? ' urgente' : ''}`}><CalendarClock size={12} /> {falta < 0 ? `passou ${-falta}d` : falta === 0 ? 'decidir hoje' : `decidir em ${falta}d`}</span>}
          {o.situacao === 'aprovado' && <span className="orcamento__aprovado"><Check size={12} /> Aprovado</span>}
          {o.situacao === 'cancelado' && <span className="pequeno">Cancelado</span>}
        </div>
        <strong className="orcamento__titulo">{o.titulo}</strong>
        {o.situacao === 'aprovado' && escolhida ? (
          <span className="orcamento__resumo"><Trophy size={14} /> {nomeFornecedor(escolhida)} · <strong>{reais(escolhida.valor)}</strong></span>
        ) : (
          <span className="orcamento__resumo">{o.cotacoes.length ? <>{o.cotacoes.length} {o.cotacoes.length === 1 ? 'cotação' : 'cotações'} · menor <strong>{reais(menor!)}</strong></> : 'Nenhuma cotação ainda'}</span>
        )}
        {o.situacao === 'cotando' && o.cotacoes.length > 1 && (
          <ul className="orcamento__mini">{[...o.cotacoes].sort((a, b) => a.valor - b.valor).slice(0, 3).map((q) => (
            <li key={q.id} className={q.valor === menor ? 'menor' : ''}>
              <span className="orcamento__mini-nome">{nomeFornecedor(q)}</span>
              <span className="orcamento__mini-barra"><span style={{ width: `${(q.valor / Math.max(...o.cotacoes.map((x) => x.valor))) * 100}%` }} /></span>
              <strong>{reais(q.valor)}</strong>
            </li>
          ))}</ul>
        )}
      </li>
    )
  }

  return (
    <div className="corpo">
      <div className="linha" style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div><h2>Comercial</h2><p className="pequeno">Orçamentos com fornecedores: junte as cotações, compare e escolha. O escolhido já entra no Financeiro como previsto.</p></div>
        <div className="linha" style={{ gap: 10 }}>
          <div className="segmentos" role="radiogroup" aria-label="Ver">
            <button type="button" role="radio" aria-checked={aba === 'orcamentos'} className={aba === 'orcamentos' ? 'marcado' : ''} onClick={() => setAba('orcamentos')}>Orçamentos <span>{cotando.length}</span></button>
            <button type="button" role="radio" aria-checked={aba === 'fornecedores'} className={aba === 'fornecedores' ? 'marcado' : ''} onClick={() => setAba('fornecedores')}>Fornecedores <span>{dados?.fornecedores.length ?? 0}</span></button>
          </div>
          {aba === 'orcamentos' ? <Botao icone={<Plus size={16} />} onClick={() => setAbrir('novo')}>Pedir orçamento</Botao>
            : <Botao icone={<Plus size={16} />} onClick={() => setFornecedor('novo')}>Novo fornecedor</Botao>}
        </div>
      </div>
      {erro && <p className="importar__erro">{erro}</p>}

      {dados === null ? <p className="pequeno">Carregando…</p> : aba === 'orcamentos' ? (
        <>
          {cotando.length === 0 ? (
            <div className="vazio-grande"><Award size={34} /><h3>Nenhum orçamento em aberto</h3><p className="texto-2">Precisa de banner, brinde ou vídeo? Peça o orçamento aqui e vá adicionando as cotações que chegarem.</p></div>
          ) : <ul className="orcamentos">{cotando.map(cartaoOrcamento)}</ul>}
          {fechados.length > 0 && (
            <section>
              <button type="button" className="contas-redes__info" onClick={() => setVerAprovados(!verAprovados)}>{verAprovados ? 'Esconder' : 'Ver'} orçamentos fechados ({fechados.length})</button>
              {verAprovados && <ul className="orcamentos" style={{ marginTop: 10 }}>{fechados.map(cartaoOrcamento)}</ul>}
            </section>
          )}
        </>
      ) : dados.fornecedores.length === 0 ? (
        <div className="vazio-grande"><Store size={34} /><h3>Nenhum fornecedor cadastrado</h3><p className="texto-2">Cadastre gráficas, lojas de brindes, fotógrafos e ferramentas para pedir orçamentos e ligar aos contratos.</p></div>
      ) : (
        <ul className="fornecedores">
          {dados.fornecedores.map((f) => {
            const contratos = dados.contratos.filter((c) => c.fornecedor_id === f.id && c.situacao !== 'encerrado').length
            const zap = f.telefone?.replace(/\D/g, '')
            return (
              <li key={f.id} className={`fornecedor${f.ativo ? '' : ' fornecedor--inativo'}`}>
                <button type="button" className="orcamento__abrir" onClick={() => setFornecedor(f)} aria-label={`Abrir ${f.nome}`} />
                <div className="fornecedor__topo">
                  <span className="fornecedor__inicial" style={{ background: corCategoria(f.categoria) }}>{f.nome.slice(0, 1).toUpperCase()}</span>
                  <span className="fornecedor__nome"><strong>{f.nome}</strong><small>{f.categoria ?? 'Sem categoria'}{f.contato ? ` · ${f.contato}` : ''}</small></span>
                </div>
                {f.nota && <Estrelas nota={f.nota} tamanho={14} />}
                <span className="pequeno">{gastoPorFornecedor.get(f.id) ? `${reais(gastoPorFornecedor.get(f.id)!)} pagos este ano` : 'Nada pago este ano'}{contratos ? ` · ${contratos} contrato${contratos > 1 ? 's' : ''}` : ''}</span>
                <div className="fornecedor__acoes">
                  {zap && <a className="botao botao--fantasma botao--mini" href={`https://wa.me/55${zap}`} target="_blank" rel="noreferrer"><MessageCircle size={14} /> WhatsApp</a>}
                  {f.email && <a className="botao botao--fantasma botao--mini" href={`mailto:${f.email}`}><Mail size={14} /> E-mail</a>}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {abrir === 'novo' && (
        <NovoOrcamento onFechar={() => setAbrir(null)} onCriar={async (o) => { const id = await salvarOrcamento(cliente.id, null, o); await carregar(); setAbrir(id) }} />
      )}
      {orcamentoAberto && dados && (
        <FichaOrcamento clienteId={cliente.id} orcamento={orcamentoAberto} dados={dados} nomeFornecedor={nomeFornecedor} onFechar={() => setAbrir(null)} recarregar={carregar}
          onAprovar={async (q) => { await aprovarCotacao(cliente.id, orcamentoAberto, q, nomeFornecedor(q)); comemorar(); await carregar() }}
          onExcluir={async () => { await excluir('orcamentos', orcamentoAberto.id); setAbrir(null); await carregar() }} />
      )}
      {fornecedor && (
        <FornecedorModal fornecedor={fornecedor === 'novo' ? null : fornecedor} onFechar={() => setFornecedor(null)}
          onSalvar={async (f) => { await salvar('fornecedores', cliente.id, fornecedor === 'novo' ? null : fornecedor.id, f); setFornecedor(null); await carregar() }}
          onExcluir={fornecedor !== 'novo' ? async () => { await excluir('fornecedores', fornecedor.id); setFornecedor(null); await carregar() } : undefined} />
      )}
    </div>
  )
}

function NovoOrcamento({ onFechar, onCriar }: { onFechar: () => void; onCriar: (o: Partial<Orcamento>) => Promise<void> }) {
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [categoria, setCategoria] = useState('')
  const [prazo, setPrazo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  return (
    <Janela titulo="Pedir orçamento" onFechar={onFechar}>
      <form className="janela__corpo" onSubmit={(e) => {
        e.preventDefault(); if (!titulo.trim()) { setErro('Diga o que precisa.'); return }
        void onCriar({ titulo: titulo.trim(), descricao: descricao.trim() || null, categoria: categoria || null, prazo: prazo || null }).catch((x) => setErro((x as Error).message))
      }}>
        <div className="campo"><label htmlFor="o-titulo">O que precisa</label><input id="o-titulo" className="entrada" autoFocus value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: 500 folders A5 do Dezembro Vermelho" /></div>
        <div className="campo"><label htmlFor="o-desc">Detalhes (opcional)</label><textarea id="o-desc" className="entrada" rows={2} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Tamanho, material, quantidade, prazo de entrega…" /></div>
        <div className="grade-2">
          <div className="campo"><label htmlFor="o-cat">Categoria</label><Selecao id="o-cat" valor={categoria} onMudar={setCategoria} opcoes={opcoesCategoriaGasto} /></div>
          <div className="campo"><label htmlFor="o-prazo">Decidir até (opcional)</label><input id="o-prazo" type="date" className="entrada" value={prazo} onChange={(e) => setPrazo(e.target.value)} /></div>
        </div>
        {erro && <p className="importar__erro">{erro}</p>}
        <div className="linha" style={{ justifyContent: 'flex-end' }}><Botao type="button" variante="fantasma" onClick={onFechar}>Cancelar</Botao><Botao type="submit">Criar e adicionar cotações</Botao></div>
      </form>
    </Janela>
  )
}

function FichaOrcamento({ clienteId, orcamento: o, dados, nomeFornecedor, onFechar, recarregar, onAprovar, onExcluir }: {
  clienteId: string; orcamento: Orcamento; dados: DadosNegocios; nomeFornecedor: (q: Cotacao) => string
  onFechar: () => void; recarregar: () => Promise<void>; onAprovar: (q: Cotacao) => Promise<void>; onExcluir: () => Promise<void>
}) {
  const [nova, setNova] = useState(o.cotacoes.length === 0)
  const [fornecedorId, setFornecedorId] = useState('')
  const [outroNome, setOutroNome] = useState('')
  const [valor, setValor] = useState('')
  const [prazoEntrega, setPrazoEntrega] = useState('')
  const [observacao, setObservacao] = useState('')
  const [arquivo, setArquivo] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [confirmar, setConfirmar] = useState(false)
  const [aprovando, setAprovando] = useState<string | null>(null)
  const ordenadas = [...o.cotacoes].sort((a, b) => a.valor - b.valor)
  const menor = ordenadas[0]?.valor
  const aberto = o.situacao === 'cotando'

  async function adicionar() {
    const n = lerValor(valor)
    if (!fornecedorId && !outroNome.trim()) { setErro('Escolha o fornecedor ou escreva o nome.'); return }
    if (n == null) { setErro('Informe o valor.'); return }
    setErro(null)
    await salvarCotacao(o.id, null, { fornecedor_id: fornecedorId || null, fornecedor_nome: fornecedorId ? null : outroNome.trim(), valor: n, prazo_entrega: prazoEntrega.trim() || null, observacao: observacao.trim() || null, arquivo_path: arquivo })
    setFornecedorId(''); setOutroNome(''); setValor(''); setPrazoEntrega(''); setObservacao(''); setArquivo(null); setNova(false)
    await recarregar()
  }

  return (
    <Janela titulo="Orçamento" onFechar={onFechar} largura={720}>
      <div className="janela__corpo">
        <div>
          <h3 style={{ margin: 0 }}>{o.titulo}</h3>
          <span className="pequeno">{[o.categoria, o.prazo && `decidir até ${dataBr(o.prazo)}`, o.situacao === 'aprovado' ? 'Aprovado' : o.situacao === 'cancelado' ? 'Cancelado' : null].filter(Boolean).join(' · ')}</span>
          {o.descricao && <p className="texto-2" style={{ margin: '6px 0 0' }}>{o.descricao}</p>}
        </div>

        {ordenadas.length > 0 && (
          <ul className="cotacoes">
            {ordenadas.map((q) => {
              const escolhida = o.cotacao_escolhida === q.id
              return (
                <li key={q.id} className={`cotacao${q.valor === menor && aberto ? ' cotacao--menor' : ''}${escolhida ? ' cotacao--escolhida' : ''}`}>
                  <div className="cotacao__texto">
                    <strong>{nomeFornecedor(q)}{!q.fornecedor_id && <small> · não cadastrado</small>}</strong>
                    <small>{[q.prazo_entrega && `Entrega: ${q.prazo_entrega}`, q.observacao].filter(Boolean).join(' · ') || ' '}</small>
                  </div>
                  {q.valor === menor && aberto && ordenadas.length > 1 && <span className="cotacao__selo">Menor preço</span>}
                  {escolhida && <span className="cotacao__selo cotacao__selo--ok"><Trophy size={12} /> Escolhida</span>}
                  <span className="cotacao__valor">{reais(q.valor)}{q.valor !== menor && menor ? <small>+{reais(q.valor - menor)}</small> : null}</span>
                  {q.arquivo_path && <button type="button" className="icone-botao" style={{ width: 30, height: 30 }} aria-label="Ver proposta" title="Ver proposta" onClick={() => void abrirArquivo(q.arquivo_path!)}><FileText size={14} /></button>}
                  {aberto && <>
                    <button type="button" className="botao botao--secundario botao--mini" disabled={aprovando !== null} onClick={() => { setAprovando(q.id); void onAprovar(q).finally(() => setAprovando(null)) }}>{aprovando === q.id ? 'Aprovando…' : 'Escolher'}</button>
                    <button type="button" className="icone-botao" style={{ width: 30, height: 30, border: 0 }} aria-label="Tirar cotação" onClick={() => void excluirCotacao(o.id, q.id).then(recarregar)}><Trash2 size={13} /></button>
                  </>}
                </li>
              )
            })}
          </ul>
        )}
        {o.situacao === 'aprovado' && <p className="faixa-dica"><Check size={15} /><span>O valor escolhido foi lançado no <Link to="/financeiro">Financeiro</Link> como previsto. Marque como pago quando pagar.</span></p>}

        {aberto && (nova ? (
          <section className="nova-cotacao">
            <strong>Nova cotação</strong>
            <div className="grade-2">
              <div className="campo"><label htmlFor="q-forn">Fornecedor</label><SeletorFornecedor id="q-forn" valor={fornecedorId} onMudar={setFornecedorId} fornecedores={dados.fornecedores} vazio="Outro (escrever o nome)" /></div>
              {!fornecedorId
                ? <div className="campo"><label htmlFor="q-nome">Nome do fornecedor</label><input id="q-nome" className="entrada" value={outroNome} onChange={(e) => setOutroNome(e.target.value)} placeholder="Ex.: Gráfica do Bairro" /></div>
                : <div />}
              <div className="campo"><label htmlFor="q-valor">Valor</label><CampoValor id="q-valor" valor={valor} onMudar={setValor} /></div>
              <div className="campo"><label htmlFor="q-prazo">Prazo de entrega (opcional)</label><input id="q-prazo" className="entrada" value={prazoEntrega} onChange={(e) => setPrazoEntrega(e.target.value)} placeholder="Ex.: 5 dias úteis" /></div>
            </div>
            <div className="campo"><label htmlFor="q-obs">Observação (opcional)</label><input id="q-obs" className="entrada" value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Frete, forma de pagamento…" /></div>
            <CampoArquivo clienteId={clienteId} pasta="cotacoes" caminho={arquivo} onMudar={setArquivo} rotulo="Anexar proposta (PDF ou print)" />
            {erro && <p className="importar__erro">{erro}</p>}
            <div className="linha" style={{ justifyContent: 'flex-end' }}>
              {o.cotacoes.length > 0 && <Botao type="button" variante="fantasma" onClick={() => setNova(false)}>Cancelar</Botao>}
              <Botao type="button" onClick={() => void adicionar().catch((x) => setErro((x as Error).message))}>Adicionar cotação</Botao>
            </div>
          </section>
        ) : <Botao variante="secundario" icone={<Plus size={15} />} onClick={() => setNova(true)}>Adicionar cotação</Botao>)}

        <div className="linha" style={{ justifyContent: 'space-between' }}>
          <div className="linha" style={{ gap: 4 }}>
            {aberto && <Botao type="button" variante="fantasma" onClick={() => void salvarOrcamento(clienteId, o.id, { situacao: 'cancelado' }).then(recarregar)}>Cancelar orçamento</Botao>}
            {o.situacao === 'cancelado' && <Botao type="button" variante="fantasma" onClick={() => void salvarOrcamento(clienteId, o.id, { situacao: 'cotando' }).then(recarregar)}>Reabrir</Botao>}
            {confirmar ? <Botao type="button" variante="fantasma" className="texto-perigo" onClick={() => void onExcluir()}>Confirmar exclusão</Botao>
              : <Botao type="button" variante="fantasma" icone={<Trash2 size={15} />} onClick={() => setConfirmar(true)}>Excluir</Botao>}
          </div>
          <Botao type="button" onClick={onFechar}>Fechar</Botao>
        </div>
      </div>
    </Janela>
  )
}

function FornecedorModal({ fornecedor, onFechar, onSalvar, onExcluir }: { fornecedor: Fornecedor | null; onFechar: () => void; onSalvar: (f: Partial<Fornecedor>) => Promise<void>; onExcluir?: () => Promise<void> }) {
  const [nome, setNome] = useState(fornecedor?.nome ?? '')
  const [categoria, setCategoria] = useState(fornecedor?.categoria ?? '')
  const [contato, setContato] = useState(fornecedor?.contato ?? '')
  const [telefone, setTelefone] = useState(fornecedor?.telefone ?? '')
  const [email, setEmail] = useState(fornecedor?.email ?? '')
  const [observacoes, setObservacoes] = useState(fornecedor?.observacoes ?? '')
  const [nota, setNota] = useState<number | null>(fornecedor?.nota ?? null)
  const [ativo, setAtivo] = useState(fornecedor?.ativo ?? true)
  const [erro, setErro] = useState<string | null>(null)
  const [confirmar, setConfirmar] = useState(false)
  return (
    <Janela titulo={fornecedor ? 'Fornecedor' : 'Novo fornecedor'} onFechar={onFechar} largura={560}>
      <form className="janela__corpo" onSubmit={(e) => {
        e.preventDefault(); if (!nome.trim()) { setErro('Informe o nome.'); return }
        void onSalvar({ nome: nome.trim(), categoria: categoria || null, contato: contato.trim() || null, telefone: telefone.trim() || null, email: email.trim() || null, observacoes: observacoes.trim() || null, nota, ativo })
          .catch((x) => setErro((x as Error).message))
      }}>
        <div className="grade-2">
          <div className="campo"><label htmlFor="f-nome">Nome</label><input id="f-nome" className="entrada" autoFocus={!fornecedor} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Gráfica Central" /></div>
          <div className="campo"><label htmlFor="f-cat">Categoria</label><Selecao id="f-cat" valor={categoria} onMudar={setCategoria} opcoes={opcoesCategoriaGasto} /></div>
          <div className="campo"><label htmlFor="f-contato">Com quem falar</label><input id="f-contato" className="entrada" value={contato} onChange={(e) => setContato(e.target.value)} /></div>
          <div className="campo"><label htmlFor="f-tel">Telefone / WhatsApp</label><input id="f-tel" className="entrada" inputMode="tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(61) 99999-0000" /></div>
        </div>
        <div className="campo"><label htmlFor="f-email">E-mail</label><input id="f-email" type="email" className="entrada" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="campo"><span className="rotulo-campo">Avaliação</span><Estrelas nota={nota} onMudar={setNota} tamanho={20} /></div>
        <div className="campo"><label htmlFor="f-obs">Observações</label><textarea id="f-obs" className="entrada" rows={2} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Prazo, pedido mínimo, forma de pagamento…" /></div>
        {fornecedor && <label className="pauta-repetir-opcao"><input type="checkbox" checked={!ativo} onChange={(e) => setAtivo(!e.target.checked)} /><span><strong>Não trabalhamos mais com ele</strong><small>Some das listas de escolha, mas o histórico continua.</small></span></label>}
        {erro && <p className="importar__erro">{erro}</p>}
        <div className="linha" style={{ justifyContent: 'space-between' }}>
          <div>{onExcluir && (confirmar
            ? <Botao type="button" variante="fantasma" className="texto-perigo" onClick={() => void onExcluir()}>Confirmar exclusão</Botao>
            : <Botao type="button" variante="fantasma" icone={<Trash2 size={15} />} onClick={() => setConfirmar(true)}>Excluir</Botao>)}</div>
          <div className="linha" style={{ gap: 8 }}><Botao type="button" variante="fantasma" onClick={onFechar}>Cancelar</Botao><Botao type="submit">Salvar</Botao></div>
        </div>
      </form>
    </Janela>
  )
}
