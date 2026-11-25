import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CalendarDays, Camera, Gift, Handshake, Mail, MessageSquare, Phone, QrCode, Snowflake, Sparkles, Star, Trash2, Undo2, Users, X } from 'lucide-react'
import { Botao, Cartao, Chip } from '../../components/ui'
import { useSessao } from '../../lib/sessao'
import {
  adicionarContato, enviarFotoEmpresa, removerFotoEmpresa, dataBr, esfriando, etapaSugerida, excluirEmpresa, excluirInteracao, haQuanto,
  nomeEtapa, nomeTipo, obterEmpresa, prazo, removerContato, salvarEmpresa, somarDias,
  type Contato, type Empresa, type Etapa, type Evento, type Interacao, type TipoInteracao,
} from '../../lib/parcerias'
import { FotoEmpresa } from '../../components/Empresa'
import { ChipConvenio, SeletorConvenios } from '../../components/Convenio'
import { RegistroRapido } from './RegistroRapido'
import { TrilhaEtapa } from './TrilhaEtapa'

const ICONE: Record<TipoInteracao, React.ElementType> = {
  contato: Phone, reuniao: Users, brinde: Gift, evento: CalendarDays, coleta_leads: QrCode, campanha: Star, proposta: Handshake, outro: MessageSquare,
}

/** Ficha da empresa: dados, planos de saúde, contatos, próximo passo e histórico de tudo que já foi feito. */
export function EmpresaDetalhe() {
  const { id = '' } = useParams()
  const navegar = useNavigate()
  const { ehAdminCliente } = useSessao()
  const [dados, setDados] = useState<{ empresa: Empresa | null; contatos: Contato[]; interacoes: Interacao[]; eventos: Evento[] } | null>(null)
  const [editando, setEditando] = useState(false)
  const [aviso, setAviso] = useState<{ texto: string; desfazer?: () => void } | null>(null)
  const [sugestao, setSugestao] = useState<Etapa | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const carregar = useCallback(async () => setDados(await obterEmpresa(id)), [id])
  useEffect(() => { void Promise.resolve().then(carregar) }, [carregar])

  if (!dados) return <p className="pequeno">Carregando…</p>
  const { empresa, contatos, interacoes, eventos } = dados
  if (!empresa) return <p className="texto-2">Empresa não encontrada. <Link to="/eventos">Voltar para empresas</Link></p>

  async function mudar(campos: Partial<Empresa>) { await salvarEmpresa(empresa!.id, campos); await carregar() }
  function avisar(texto: string, desfazer?: () => void) {
    setAviso({ texto, desfazer }); clearTimeout(timer.current)
    timer.current = setTimeout(() => setAviso(null), 7000)
  }
  async function mudarEtapa(nova: Etapa) {
    const antes = empresa!.etapa
    setSugestao(null)
    await mudar({ etapa: nova })
    avisar(`Etapa alterada para ${nomeEtapa(nova)}`, () => { void mudar({ etapa: antes }); setAviso(null) })
  }
  const ultima = interacoes[0]?.data ?? null
  const frio = esfriando(empresa, ultima)

  return (
    <>
      <Link to="/eventos" className="linha pequeno" style={{ color: 'var(--texto-2)' }}><ArrowLeft size={14} /> Empresas</Link>
      <div className="ficha-topo">
        <div className="ficha-topo__titulo">
          <div className="linha" style={{ gap: 16, flexWrap: 'nowrap' }}>
            <FotoDaEmpresa empresa={empresa} onMudou={carregar} />
            <div>
            <h2>{empresa.nome}</h2>
            <p className="pequeno">{[empresa.segmento, empresa.funcionarios ? `${empresa.funcionarios} funcionários` : null].filter(Boolean).join(' · ')}</p>
            </div>
          </div>
          <div className="ficha-topo__sinais">
            {ultima ? <span className="sinal">Último registro <strong>{haQuanto(ultima)}</strong></span> : <span className="sinal">Nenhum registro ainda</span>}
            {frio && <span className="sinal sinal--frio"><Snowflake size={14} /> Esfriando: faz tempo que ninguém fala com eles</span>}
            {empresa.proximo_passo_em && <span className={`sinal sinal--${prazo(empresa.proximo_passo_em).tom}`}>Próximo passo <strong>{prazo(empresa.proximo_passo_em).texto}</strong></span>}
          </div>
        </div>
        <TrilhaEtapa etapa={empresa.etapa} onMudar={(e) => void mudarEtapa(e)} />
      </div>

      <div className="detalhe">
        <div className="detalhe__lado">
          <Cartao titulo="Dados da empresa" acao={<button type="button" className="pequeno" style={{ background: 'none', border: 0, color: 'var(--marca)', cursor: 'pointer' }} onClick={() => setEditando(!editando)}>{editando ? 'Fechar' : 'Editar'}</button>}>
            {editando ? <EditarDados empresa={empresa} onSalvar={async (c) => { await mudar(c); setEditando(false) }} /> : (
              <>
                <div className="dado"><span>Planos de saúde dos funcionários</span>
                  <span className="linha">{empresa.convenios.length ? empresa.convenios.map((c) => <ChipConvenio key={c} nome={c} />) : 'Não informado'}</span></div>
                {empresa.cnpj && <div className="dado"><span>CNPJ</span><span>{empresa.cnpj}</span></div>}
                {empresa.endereco && <div className="dado"><span>Endereço</span><span>{empresa.endereco}</span></div>}
                {empresa.site && <div className="dado"><span>Site</span><a href={empresa.site.startsWith('http') ? empresa.site : `https://${empresa.site}`} target="_blank" rel="noreferrer">{empresa.site}</a></div>}
                {empresa.observacoes && <div className="dado"><span>Observações</span><span style={{ whiteSpace: 'pre-wrap' }}>{empresa.observacoes}</span></div>}
              </>
            )}
          </Cartao>

          <ProximoPasso empresa={empresa} onSalvar={mudar} />
          <Contatos empresaId={empresa.id} contatos={contatos} onMudar={carregar} />

          {eventos.length > 0 && (
            <Cartao titulo="Eventos com esta empresa">
              {eventos.map((v) => <div key={v.id}><strong>{v.nome}</strong><div className="pequeno">{dataBr(v.data)}{v.local ? ` · ${v.local}` : ''} · {v.situacao}</div></div>)}
            </Cartao>
          )}

          {ehAdminCliente && (
            <Botao variante="fantasma" style={{ color: 'var(--perigo)', alignSelf: 'flex-start' }}
              onClick={() => { if (confirm(`Excluir ${empresa.nome} e todo o histórico? Esta ação não pode ser desfeita.`)) void excluirEmpresa(empresa.id).then(() => navegar('/eventos')) }}>
              <Trash2 size={16} /> Excluir empresa
            </Botao>
          )}
        </div>

        <Cartao titulo={`Histórico · ${interacoes.length} registros`}>
          <RegistroRapido empresaId={empresa.id} onRegistrado={async (tipo) => {
            await carregar(); avisar('Registrado no histórico')
            setSugestao(etapaSugerida(empresa.etapa, tipo))
          }} />
          {sugestao && (
            <div className="sugestao" role="status">
              <Sparkles size={16} aria-hidden />
              <span>Isso parece <strong>{nomeEtapa(sugestao)}</strong>. Mover a etapa?</span>
              <button type="button" className="botao botao--primario" onClick={() => void mudarEtapa(sugestao)}>Mover</button>
              <button type="button" className="botao botao--fantasma" onClick={() => setSugestao(null)}>Agora não</button>
            </div>
          )}
          <ol className="linha-tempo">
            {interacoes.map((i) => {
              const Icone = ICONE[i.tipo]
              return (
                <li key={i.id}>
                  <span className={`marcador marcador--${i.tipo}`}><Icone size={16} /></span>
                  <div>
                    <strong>{i.titulo}</strong>
                    {i.descricao && <p className="texto-2" style={{ whiteSpace: 'pre-wrap' }}>{i.descricao}</p>}
                    <span className="pequeno">{nomeTipo(i.tipo)} · {haQuanto(i.data)} ({dataBr(i.data)}){i.autor ? ` · ${i.autor}` : ''}</span>
                  </div>
                  <button type="button" aria-label="Excluir registro" className="icone-botao" style={{ border: 0, width: 32, height: 32 }}
                    onClick={() => { if (confirm('Excluir este registro do histórico?')) void excluirInteracao(i.id).then(carregar) }}><Trash2 size={14} /></button>
                </li>
              )
            })}
            {interacoes.length === 0 && <li style={{ display: 'block' }} className="texto-2">Nada registrado ainda. Toque em um dos botões acima para registrar o primeiro contato.</li>}
          </ol>
        </Cartao>
      </div>

      {aviso && (
        <div className="aviso-flutuante" role="status">
          <span>{aviso.texto}</span>
          {aviso.desfazer && <button type="button" onClick={aviso.desfazer}><Undo2 size={14} /> Desfazer</button>}
          <button type="button" aria-label="Fechar aviso" onClick={() => setAviso(null)}><X size={14} /></button>
        </div>
      )}
    </>
  )
}

function EditarDados({ empresa, onSalvar }: { empresa: Empresa; onSalvar: (c: Partial<Empresa>) => Promise<void> }) {
  const [d, setD] = useState({ nome: empresa.nome, cnpj: empresa.cnpj ?? '', segmento: empresa.segmento ?? '', funcionarios: empresa.funcionarios?.toString() ?? '',
    endereco: empresa.endereco ?? '', site: empresa.site ?? '', observacoes: empresa.observacoes ?? '', convenios: empresa.convenios })
  const txt = (k: keyof typeof d) => ({ value: d[k] as string, onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setD({ ...d, [k]: e.target.value }) })
  async function enviar(e: FormEvent) {
    e.preventDefault()
    const vazio = (v: string) => v.trim() || null
    await onSalvar({ nome: d.nome.trim(), cnpj: vazio(d.cnpj), segmento: vazio(d.segmento), funcionarios: d.funcionarios ? Number(d.funcionarios) : null,
      endereco: vazio(d.endereco), site: vazio(d.site), observacoes: vazio(d.observacoes), convenios: d.convenios })
  }
  return (
    <form onSubmit={enviar} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="campo"><label htmlFor="d-nome">Nome</label><input id="d-nome" className="entrada" required {...txt('nome')} /></div>
      <div className="grade-2">
        <div className="campo"><label htmlFor="d-seg">Segmento</label><input id="d-seg" className="entrada" {...txt('segmento')} /></div>
        <div className="campo"><label htmlFor="d-func">Funcionários</label><input id="d-func" className="entrada" type="number" min={0} {...txt('funcionarios')} /></div>
      </div>
      <SeletorConvenios valor={d.convenios} onMudar={(convenios) => setD({ ...d, convenios })} />
      <div className="campo"><label htmlFor="d-cnpj">CNPJ</label><input id="d-cnpj" className="entrada" {...txt('cnpj')} /></div>
      <div className="campo"><label htmlFor="d-end">Endereço</label><input id="d-end" className="entrada" {...txt('endereco')} /></div>
      <div className="campo"><label htmlFor="d-site">Site</label><input id="d-site" className="entrada" {...txt('site')} /></div>
      <div className="campo"><label htmlFor="d-obs">Observações</label><textarea id="d-obs" className="entrada" rows={3} {...txt('observacoes')} /></div>
      <Botao type="submit">Salvar</Botao>
    </form>
  )
}

function ProximoPasso({ empresa, onSalvar }: { empresa: Empresa; onSalvar: (c: Partial<Empresa>) => Promise<void> }) {
  const [texto, setTexto] = useState(empresa.proximo_passo ?? '')
  const [data, setData] = useState(empresa.proximo_passo_em ?? '')
  const mudou = texto !== (empresa.proximo_passo ?? '') || data !== (empresa.proximo_passo_em ?? '')
  return (
    <div className="proximo-passo">
      <span className="rotulo" style={{ color: 'var(--marca)' }}>Próximo passo</span>
      <input className="entrada" style={{ background: 'var(--superficie)' }} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Ex.: levar o mutirão de glicemia" aria-label="Próximo passo" />
      <div className="linha" style={{ gap: 6 }}>
        {[['Amanhã', 1], ['1 semana', 7], ['15 dias', 15], ['1 mês', 30]].map(([r, n]) => (
          <button key={r} type="button" className={`opcao opcao--mini${data === somarDias(n as number) ? ' marcada' : ''}`} onClick={() => setData(somarDias(n as number))}>{r}</button>
        ))}
      </div>
      <div className="linha">
        <input className="entrada" style={{ flex: 1, background: 'var(--superficie)' }} type="date" value={data} onChange={(e) => setData(e.target.value)} aria-label="Data do próximo passo" />
        {mudou && <Botao onClick={() => void onSalvar({ proximo_passo: texto.trim() || null, proximo_passo_em: data || null })}>Salvar</Botao>}
      </div>
      {empresa.proximo_passo && !mudou && (
        <button type="button" className="botao botao--secundario" onClick={() => { setTexto(''); setData(''); void onSalvar({ proximo_passo: null, proximo_passo_em: null }) }}>✓ Feito, limpar</button>
      )}
    </div>
  )
}

function Contatos({ empresaId, contatos, onMudar }: { empresaId: string; contatos: Contato[]; onMudar: () => Promise<void> }) {
  const [abrir, setAbrir] = useState(false)
  const [c, setC] = useState({ nome: '', cargo: '', email: '', telefone: '' })
  async function enviar(e: FormEvent) {
    e.preventDefault()
    await adicionarContato({ empresa_id: empresaId, nome: c.nome.trim(), cargo: c.cargo.trim() || null, email: c.email.trim() || null, telefone: c.telefone.trim() || null, principal: contatos.length === 0 })
    setC({ nome: '', cargo: '', email: '', telefone: '' }); setAbrir(false); await onMudar()
  }
  return (
    <Cartao titulo="Contatos na empresa" acao={<button type="button" className="pequeno" style={{ background: 'none', border: 0, color: 'var(--marca)', cursor: 'pointer' }} onClick={() => setAbrir(!abrir)}>{abrir ? 'Fechar' : 'Adicionar'}</button>}>
      {contatos.map((x) => (
        <div key={x.id} className="linha" style={{ alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <strong>{x.nome}</strong>{x.principal && <> <Chip>Principal</Chip></>}
            {x.cargo && <div className="pequeno">{x.cargo}</div>}
            <div className="linha" style={{ marginTop: 4 }}>
              {x.telefone && <a className="pequeno linha" href={`tel:${x.telefone}`}><Phone size={12} /> {x.telefone}</a>}
              {x.email && <a className="pequeno linha" href={`mailto:${x.email}`}><Mail size={12} /> {x.email}</a>}
            </div>
          </div>
          <button type="button" aria-label={`Remover ${x.nome}`} className="icone-botao" style={{ border: 0, width: 28, height: 28 }} onClick={() => void removerContato(x.id).then(onMudar)}><Trash2 size={14} /></button>
        </div>
      ))}
      {contatos.length === 0 && !abrir && <p className="texto-2">Nenhum contato cadastrado.</p>}
      {abrir && (
        <form onSubmit={enviar} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input className="entrada" required placeholder="Nome" aria-label="Nome do contato" value={c.nome} onChange={(e) => setC({ ...c, nome: e.target.value })} />
          <input className="entrada" placeholder="Cargo (ex.: Gerente de RH)" aria-label="Cargo" value={c.cargo} onChange={(e) => setC({ ...c, cargo: e.target.value })} />
          <input className="entrada" placeholder="Telefone" aria-label="Telefone" value={c.telefone} onChange={(e) => setC({ ...c, telefone: e.target.value })} />
          <input className="entrada" type="email" placeholder="E-mail" aria-label="E-mail" value={c.email} onChange={(e) => setC({ ...c, email: e.target.value })} />
          <Botao type="submit">Salvar contato</Botao>
        </form>
      )}
    </Cartao>
  )
}

/** Logo ou foto da fachada: clicar troca; aparece na lista, no quadro e ao escolher a empresa nas campanhas. */
function FotoDaEmpresa({ empresa, onMudou }: { empresa: Empresa; onMudou: () => Promise<void> }) {
  const entrada = useRef<HTMLInputElement>(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  async function trocar(f: File | undefined) {
    if (!f) return
    setEnviando(true); setErro(null)
    try { await enviarFotoEmpresa(empresa, f); await onMudou() } catch (e) { setErro((e as Error).message) }
    setEnviando(false)
  }
  return (
    <div className="foto-da-empresa">
      <button type="button" className={`foto-da-empresa__botao${enviando ? ' enviando' : ''}`} onClick={() => entrada.current?.click()}
        title={empresa.foto_url ? 'Trocar logo ou foto da fachada' : 'Pôr logo ou foto da fachada'} aria-label="Trocar foto da empresa">
        <FotoEmpresa empresa={empresa} tamanho={76} />
        <span className="foto-da-empresa__camera"><Camera size={16} /></span>
      </button>
      <input ref={entrada} type="file" accept="image/*" hidden onChange={(e) => void trocar(e.target.files?.[0])} />
      {empresa.foto_url && <button type="button" className="foto-da-empresa__tirar" onClick={() => void removerFotoEmpresa(empresa).then(onMudou)}>tirar foto</button>}
      {erro && <span className="pequeno" style={{ color: 'var(--perigo)' }}>{erro}</span>}
    </div>
  )
}
