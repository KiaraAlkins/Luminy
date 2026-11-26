import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import QRCode from 'qrcode'
import {
  ArrowDown, ArrowLeft, ArrowUp, Copy, Download, ExternalLink, EyeOff, Lock, Plus, QrCode, Sparkles, Tag, Trash2, X,
} from 'lucide-react'
import { Botao, Chip } from '../../components/ui'
import { useSessao } from '../../lib/sessao'
import { dataBr, listarEmpresas, type Empresa } from '../../lib/parcerias'
import {
  CAMPOS_PRONTOS, SEM_PLANO, TIPOS_CAMPO, chaveDe, comPlanos, criarPeca, excluirCampanha, excluirPeca, linkPeca, obterCampanha, salvarCampanha,
  type Campanha, type Campo, type ModoCampo, type Peca, type SituacaoCampanha, type TipoCampo,
} from '../../lib/campanhas'
import { LogoConvenio } from '../../components/Convenio'
import { useConvenios } from '../../lib/convenios'
import '../formulario.css'
import { Selecao } from '../../components/Selecao'
import { opcoesTipoCampo } from '../../components/opcoes'
import './campanhas.css'

const MODOS: { id: ModoCampo; nome: string; dica: string }[] = [
  { id: 'obrigatorio', nome: 'Obrigatório', dica: 'A pessoa precisa responder' },
  { id: 'exibir', nome: 'Opcional', dica: 'Aparece, mas pode ficar em branco' },
  { id: 'oculto', nome: 'Oculto', dica: 'Não aparece: vai preenchido com um valor fixo' },
]
const TRAVADOS = ['nome', 'whatsapp']

type Edicao = Pick<Campanha, 'nome' | 'inicio' | 'fim' | 'formulario' | 'titulo_publico' | 'texto_publico' | 'mensagem_obrigado'>
const edicaoDe = (c: Campanha): Edicao => ({ nome: c.nome, inicio: c.inicio, fim: c.fim, formulario: c.formulario, titulo_publico: c.titulo_publico, texto_publico: c.texto_publico, mensagem_obrigado: c.mensagem_obrigado })

/** Editor da campanha: formulário (com campos ocultos e segmentos), textos, peças com QR e prévia no celular. */
export function CampanhaEditor() {
  const { id = '' } = useParams()
  const navegar = useNavigate()
  const { cliente, ehAdminCliente } = useSessao()
  const { convenios } = useConvenios()
  const [campanha, setCampanha] = useState<Campanha | null | undefined>(undefined)
  const [pecas, setPecas] = useState<Peca[]>([])
  const [empresa, setEmpresa] = useState<Empresa | null>(null)
  const [ed, setEd] = useState<Edicao | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)

  // Recarregar não apaga o que está sendo editado (só ao salvar ou na primeira carga)
  const carregar = useCallback(async (resetar = false) => {
    const r = await obterCampanha(id)
    setCampanha(r.campanha); setPecas(r.pecas)
    if (r.campanha) { const c = r.campanha; setEd((prev) => (!prev || resetar ? edicaoDe(c) : prev)) }
    if (r.campanha?.empresa_id && cliente) {
      const e = await listarEmpresas(cliente.id)
      setEmpresa(e.empresas.find((x) => x.id === r.campanha!.empresa_id) ?? null)
    }
  }, [id, cliente])
  useEffect(() => { void Promise.resolve().then(() => carregar()) }, [carregar])

  if (campanha === undefined || (campanha && !ed)) return <p className="pequeno">Carregando…</p>
  if (!campanha || !ed) return <p className="texto-2">Campanha não encontrada. <Link to="/eventos/campanhas">Voltar</Link></p>

  const mudou = JSON.stringify(ed) !== JSON.stringify(edicaoDe(campanha))
  const mudar = (d: Partial<Edicao>) => setEd({ ...ed, ...d })
  const mudarCampo = (i: number, d: Partial<Campo>) => mudar({ formulario: ed.formulario.map((c, j) => (j === i ? { ...c, ...d } : c)) })
  const mover = (i: number, para: number) => { const f = [...ed.formulario]; const [c] = f.splice(i, 1); f.splice(para, 0, c); mudar({ formulario: f }) }
  const avisar = (t: string) => { setAviso(t); setTimeout(() => setAviso(null), 3000) }

  function adicionar(c: Campo) {
    let chave = c.chave
    while (ed!.formulario.some((f) => f.chave === chave)) chave = `${c.chave}_${Math.random().toString(36).slice(2, 5)}`
    mudar({ formulario: [...ed!.formulario, { ...c, chave }] })
  }

  async function salvar() {
    const problema = ed!.formulario.find((c) => c.modo === 'oculto' && !c.valor_fixo?.trim())
    if (problema) { avisar(`"${problema.rotulo}" está oculto: preencha o valor fixo.`); return }
    setSalvando(true)
    // Pergunta de plano de saúde leva junto a lista e os logos dos planos cadastrados
    await salvarCampanha(campanha!.id, { ...ed!, formulario: comPlanos(ed!.formulario, convenios), nome: ed!.nome.trim() || campanha!.nome })
    setSalvando(false); avisar('Campanha salva'); await carregar(true)
  }

  async function mudarSituacao(s: SituacaoCampanha) {
    if (s === 'ativa' && pecas.length === 0) await criarPeca(campanha!, 'QR principal')
    await salvarCampanha(campanha!.id, { situacao: s })
    avisar(s === 'ativa' ? 'Campanha ativa: os QR já recebem leads' : s === 'encerrada' ? 'Campanha encerrada: o formulário mostra aviso de encerrada' : 'Voltou para rascunho')
    await carregar()
  }

  return (
    <>
      <Link to="/eventos/campanhas" className="linha pequeno" style={{ color: 'var(--texto-2)' }}><ArrowLeft size={14} /> Campanhas</Link>

      <div className="editor-topo">
        <input className="editor-topo__nome" value={ed.nome} onChange={(e) => mudar({ nome: e.target.value })} aria-label="Nome da campanha" />
        <div className="situacao" role="radiogroup" aria-label="Situação da campanha">
          {(['rascunho', 'ativa', 'encerrada'] as const).map((s) => (
            <button key={s} type="button" role="radio" aria-checked={campanha.situacao === s} className={`situacao__item situacao__item--${s}${campanha.situacao === s ? ' marcado' : ''}`}
              onClick={() => campanha.situacao !== s && void mudarSituacao(s)}>
              {s === 'ativa' && <span className="pulso" aria-hidden />}{s === 'rascunho' ? 'Rascunho' : s === 'ativa' ? 'Ativa' : 'Encerrada'}
            </button>
          ))}
        </div>
      </div>
      {campanha.situacao === 'rascunho' && <p className="faixa-dica"><Sparkles size={15} /> Monte o formulário, confira a prévia e clique em <strong>Ativa</strong> para o QR começar a receber leads.</p>}

      <div className="editor">
        <div className="editor__principal">
          <section className="cartao">
            <div className="cartao__topo"><h3>Formulário</h3><span className="pequeno">{ed.formulario.filter((c) => c.modo !== 'oculto').length} perguntas · {ed.formulario.filter((c) => c.modo === 'oculto').length} ocultos</span></div>
            <ol className="campos">
              {ed.formulario.map((c, i) => (
                <LinhaCampo key={c.chave} campo={c} travado={TRAVADOS.includes(c.chave)} primeiro={i === 0} ultimo={i === ed.formulario.length - 1}
                  empresa={empresa}
                  onMudar={(d) => mudarCampo(i, d)} onRemover={() => mudar({ formulario: ed.formulario.filter((_, j) => j !== i) })}
                  onSubir={() => mover(i, i - 1)} onDescer={() => mover(i, i + 1)} />
              ))}
            </ol>
            <div className="adicionar-campo">
              <span className="rotulo">Adicionar pergunta</span>
              <div className="linha" style={{ gap: 6 }}>
                {CAMPOS_PRONTOS.filter((p) => !ed.formulario.some((f) => f.chave === p.chave)).map(({ dica, ...p }) => (
                  <button key={p.chave} type="button" className="opcao opcao--mini" onClick={() => adicionar(p)}>
                    {p.segmento ? <Tag size={12} /> : <Plus size={12} />} {dica}
                  </button>
                ))}
                <button type="button" className="opcao opcao--mini opcao--marca" onClick={() => adicionar({ chave: chaveDe(`pergunta ${ed.formulario.length}`), rotulo: 'Nova pergunta', tipo: 'texto', modo: 'exibir' })}>
                  <Plus size={12} /> Pergunta personalizada
                </button>
              </div>
            </div>
          </section>

          <section className="cartao">
            <div className="cartao__topo"><h3>Textos que o público vê</h3></div>
            <div className="campo"><label htmlFor="tp-titulo">Título</label>
              <input id="tp-titulo" className="entrada" value={ed.titulo_publico ?? ''} placeholder={ed.nome} onChange={(e) => mudar({ titulo_publico: e.target.value || null })} /></div>
            <div className="campo"><label htmlFor="tp-texto">Chamada</label>
              <textarea id="tp-texto" className="entrada" rows={2} value={ed.texto_publico ?? ''} placeholder="Ex.: Garanta seu check-up com condições especiais." onChange={(e) => mudar({ texto_publico: e.target.value || null })} /></div>
            <div className="campo"><label htmlFor="tp-obg">Mensagem depois de enviar</label>
              <input id="tp-obg" className="entrada" value={ed.mensagem_obrigado} onChange={(e) => mudar({ mensagem_obrigado: e.target.value })} /></div>
            <div className="grade-2">
              <div className="campo"><label htmlFor="tp-ini">Começa em</label><input id="tp-ini" type="date" className="entrada" value={ed.inicio ?? ''} onChange={(e) => mudar({ inicio: e.target.value || null })} /></div>
              <div className="campo"><label htmlFor="tp-fim">Termina em (encerra sozinha)</label><input id="tp-fim" type="date" className="entrada" value={ed.fim ?? ''} onChange={(e) => mudar({ fim: e.target.value || null })} /></div>
            </div>
          </section>

          <Pecas campanha={campanha} pecas={pecas} onMudar={() => carregar()} avisar={avisar} />

          {ehAdminCliente && (
            <Botao variante="fantasma" style={{ color: 'var(--perigo)', alignSelf: 'flex-start' }} icone={<Trash2 size={16} />}
              onClick={() => { if (confirm(`Excluir a campanha ${campanha.nome}? Os QR param de funcionar. Os leads já recebidos continuam guardados.`)) void excluirCampanha(campanha.id).then(() => navegar('/eventos/campanhas')) }}>
              Excluir campanha
            </Botao>
          )}
        </div>

        <aside className="editor__previa" aria-label="Prévia no celular">
          <span className="rotulo">Prévia no celular</span>
          <div className="celular">
            <div className="celular__tela">
              <div className="publico__cartao" style={{ border: 0, borderRadius: 0 }}>
                <header className="publico__capa" style={{ background: cliente?.cor ?? 'var(--marca)' }}>
                  <span className="rotulo" style={{ color: '#fff' }}>{cliente?.nome}</span>
                  <h2>{ed.titulo_publico || ed.nome}</h2>
                  {ed.texto_publico && <p>{ed.texto_publico}</p>}
                </header>
                <div className="publico__corpo">
                  {ed.formulario.filter((c) => c.modo !== 'oculto').map((c) => (
                    <div className="campo" key={c.chave}>
                      <label>{c.rotulo}{c.modo === 'obrigatorio' ? ' *' : ''}</label>
                      {c.tipo === 'convenio'
                        ? <div className="planos-publico">{[...convenios.map((p) => p.nome), SEM_PLANO].map((o) => <span key={o} className="plano-publico">{o !== SEM_PLANO && <LogoConvenio nome={o} tamanho={28} />}<span>{o}</span></span>)}</div>
                        : c.tipo === 'escolha' || c.tipo === 'sim_nao'
                        ? <div className="opcoes">{(c.tipo === 'sim_nao' ? ['Sim', 'Não'] : c.opcoes ?? []).map((o) => <span key={o} className="opcao">{o}</span>)}</div>
                        : <div className="entrada" style={{ height: 40 }} />}
                    </div>
                  ))}
                  <label className="aceite"><input type="checkbox" readOnly /> <span>Autorizo o {cliente?.nome} a usar meus dados para entrar em contato…</span></label>
                  <span className="botao botao--primario" style={{ background: cliente?.cor }}>Enviar</span>
                </div>
              </div>
            </div>
          </div>
          {ed.formulario.some((c) => c.modo === 'oculto') && (
            <p className="pequeno linha" style={{ alignItems: 'flex-start' }}><EyeOff size={14} style={{ flex: 'none', marginTop: 2 }} />
              <span>Também vai junto, sem aparecer: {ed.formulario.filter((c) => c.modo === 'oculto').map((c) => `${c.rotulo} = ${c.valor_fixo || '?'}`).join(' · ')}</span></p>
          )}
        </aside>
      </div>

      {mudou && (
        <div className="barra-salvar" role="status">
          <span>Alterações não salvas</span>
          <button type="button" className="botao botao--fantasma" style={{ color: '#fff' }} onClick={() => setEd(edicaoDe(campanha))}>Descartar</button>
          <button type="button" className="botao botao--primario" disabled={salvando} onClick={() => void salvar()}>{salvando ? 'Salvando…' : 'Salvar'}</button>
        </div>
      )}
      {aviso && !mudou && <div className="aviso-flutuante" role="status"><span>{aviso}</span></div>}
    </>
  )
}

function LinhaCampo({ campo: c, travado, primeiro, ultimo, empresa, onMudar, onRemover, onSubir, onDescer }: {
  campo: Campo; travado: boolean; primeiro: boolean; ultimo: boolean; empresa: Empresa | null
  onMudar: (d: Partial<Campo>) => void; onRemover: () => void; onSubir: () => void; onDescer: () => void
}) {
  const [opcoesTexto, setOpcoesTexto] = useState((c.opcoes ?? []).join(', '))
  const { convenios } = useConvenios()
  const ehPlano = c.tipo === 'convenio' || /convenio|plano/.test(c.chave)
  const sugestoes = c.modo === 'oculto'
    ? [...(empresa && !ehPlano ? [empresa.nome] : []), ...(empresa?.convenios.length ? [empresa.convenios.join(' / '), ...empresa.convenios] : []), ...(ehPlano ? convenios.map((p) => p.nome) : [])]
        .filter((v, i, a) => a.indexOf(v) === i && v !== c.valor_fixo)
    : []
  return (
    <li className={`campo-linha campo-linha--${c.modo}`}>
      <div className="campo-linha__topo">
        <div className="campo-linha__ordem">
          <button type="button" aria-label="Subir" disabled={primeiro} onClick={onSubir}><ArrowUp size={14} /></button>
          <button type="button" aria-label="Descer" disabled={ultimo} onClick={onDescer}><ArrowDown size={14} /></button>
        </div>
        <input className="campo-linha__rotulo" value={c.rotulo} onChange={(e) => onMudar({ rotulo: e.target.value })} aria-label="Pergunta" />
        {travado ? <span className="pequeno linha" title="Necessário para falar com o lead"><Lock size={13} /> sempre obrigatório</span> : (
          <>
            <div className="modo" role="radiogroup" aria-label={`Como mostrar "${c.rotulo}"`}>
              {MODOS.map((m) => (
                <button key={m.id} type="button" role="radio" aria-checked={c.modo === m.id} title={m.dica}
                  className={`modo__item${c.modo === m.id ? ' marcado' : ''}`} onClick={() => onMudar({ modo: m.id })}>
                  {m.id === 'oculto' && <EyeOff size={13} />}{m.nome}
                </button>
              ))}
            </div>
            <button type="button" className="icone-botao" style={{ width: 32, height: 32, border: 0 }} aria-label={`Remover ${c.rotulo}`} onClick={onRemover}><X size={15} /></button>
          </>
        )}
      </div>

      {!travado && (
        <div className="campo-linha__detalhes">
          {c.modo === 'oculto' ? (
            <div className="valor-fixo">
              <label className="pequeno" htmlFor={`fixo-${c.chave}`}>Todo mundo que ler este QR vai com</label>
              <input id={`fixo-${c.chave}`} className="entrada" value={c.valor_fixo ?? ''} placeholder="Ex.: Empresa X" onChange={(e) => onMudar({ valor_fixo: e.target.value })} />
              {sugestoes.length > 0 && <div className="linha" style={{ gap: 6 }}>{sugestoes.map((s) => <button key={s} type="button" className="opcao opcao--mini opcao--com-logo" onClick={() => onMudar({ valor_fixo: s })}>{ehPlano && <LogoConvenio nome={s} tamanho={16} />}{s}</button>)}</div>}
            </div>
          ) : (
            <>
              <Selecao mini rotulo="Tipo de resposta" valor={c.tipo} onMudar={(t) => onMudar({ tipo: t as TipoCampo })} opcoes={opcoesTipoCampo(TIPOS_CAMPO)} largura={210} />
              {c.tipo === 'convenio' && <PlanosDoCampo />}
              {c.tipo === 'escolha' && (
                <input className="entrada entrada--mini" style={{ flex: 1 }} value={opcoesTexto} placeholder="Opções separadas por vírgula"
                  aria-label="Opções" onChange={(e) => { setOpcoesTexto(e.target.value); onMudar({ opcoes: e.target.value.split(',').map((o) => o.trim()).filter(Boolean) }) }} />
              )}
              {c.tipo === 'sim_nao' && (
                <label className="segmento-campo">
                  <Tag size={13} /> <span>Quem responder <strong>Sim</strong> entra no segmento</span>
                  <input className="entrada entrada--mini" value={c.segmento ?? ''} placeholder="Ex.: Risco de diabetes" onChange={(e) => onMudar({ segmento: e.target.value || undefined })} />
                </label>
              )}
            </>
          )}
        </div>
      )}
    </li>
  )
}

function Pecas({ campanha, pecas, onMudar, avisar }: { campanha: Campanha; pecas: Peca[]; onMudar: () => Promise<void>; avisar: (t: string) => void }) {
  const [nome, setNome] = useState('')
  return (
    <section className="cartao">
      <div className="cartao__topo"><h3>Peças com QR</h3><span className="pequeno">um QR para cada lugar, para saber qual funciona melhor</span></div>
      {campanha.situacao !== 'ativa' && pecas.length > 0 && <p className="pequeno" style={{ color: '#8a5000' }}>A campanha está {campanha.situacao === 'rascunho' ? 'em rascunho' : 'encerrada'}: quem ler o QR ainda não consegue enviar.</p>}
      <div className="pecas">
        {pecas.map((p) => <CartaoPeca key={p.id} peca={p} campanha={campanha} onExcluir={async () => { await excluirPeca(p.id); await onMudar() }} avisar={avisar} />)}
      </div>
      <form className="linha" onSubmit={(e) => { e.preventDefault(); if (nome.trim()) void criarPeca(campanha, nome.trim()).then(() => { setNome(''); return onMudar() }) }}>
        <input className="entrada" style={{ flex: 1 }} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nova peça: cartaz do refeitório, folder, banner, adesivo de mesa…" aria-label="Nome da nova peça" />
        <Botao type="submit" variante="secundario" icone={<QrCode size={16} />} disabled={!nome.trim()}>Gerar QR</Botao>
      </form>
    </section>
  )
}

function CartaoPeca({ peca, campanha, onExcluir, avisar }: { peca: Peca; campanha: Campanha; onExcluir: () => Promise<void>; avisar: (t: string) => void }) {
  const [img, setImg] = useState<string | null>(null)
  const link = linkPeca(peca.slug)
  useEffect(() => { void QRCode.toDataURL(link, { width: 320, margin: 1, color: { dark: '#17142E' } }).then(setImg) }, [link])

  async function baixar() {
    const url = await QRCode.toDataURL(link, { width: 2048, margin: 2, errorCorrectionLevel: 'H', color: { dark: '#000000' } })
    const a = document.createElement('a'); a.href = url; a.download = `QR - ${campanha.nome} - ${peca.nome}.png`; a.click()
  }
  const taxa = peca.leituras > 0 ? Math.round(((peca.total_leads ?? 0) / peca.leituras) * 100) : null
  return (
    <div className="peca">
      {img ? <img src={img} alt={`QR da peça ${peca.nome}`} className="peca__qr" /> : <div className="peca__qr" />}
      <div className="peca__info">
        <strong>{peca.nome}</strong>
        <span className="pequeno">{peca.leituras} leituras · {peca.total_leads ?? 0} leads{taxa !== null ? ` · ${taxa}%` : ''}</span>
        <span className="pequeno">desde {dataBr(peca.criado_em)}</span>
        <div className="linha" style={{ gap: 6, marginTop: 'auto' }}>
          <button type="button" className="botao botao--primario botao--mini" onClick={() => void baixar()}><Download size={14} /> Baixar PNG</button>
          <button type="button" className="icone-botao" style={{ width: 34, height: 34 }} title="Copiar link" aria-label="Copiar link" onClick={() => { void navigator.clipboard.writeText(link); avisar('Link copiado') }}><Copy size={14} /></button>
          <a className="icone-botao" style={{ width: 34, height: 34 }} href={link} target="_blank" rel="noreferrer" title="Abrir formulário" aria-label="Abrir formulário"><ExternalLink size={14} /></a>
          <button type="button" className="icone-botao" style={{ width: 34, height: 34 }} title="Excluir peça" aria-label={`Excluir peça ${peca.nome}`}
            onClick={() => { if (confirm(`Excluir a peça "${peca.nome}"? O QR impresso dela para de funcionar.`)) void onExcluir() }}><Trash2 size={14} /></button>
        </div>
      </div>
      {(peca.total_leads ?? 0) > 0 && <Chip tom="sucesso">{peca.total_leads}</Chip>}
    </div>
  )
}

/** Mostra quais planos (com logo) o público vai poder tocar. */
function PlanosDoCampo() {
  const { convenios } = useConvenios()
  return (
    <span className="planos-do-campo">
      {convenios.length
        ? <>{convenios.slice(0, 8).map((p) => <LogoConvenio key={p.id} nome={p.nome} tamanho={22} />)}<span className="pequeno">{convenios.length} planos com logo + "{SEM_PLANO}" · <Link to="/eventos/planos">editar planos</Link></span></>
        : <span className="pequeno">Cadastre os planos em <Link to="/eventos/planos">Planos de saúde</Link> para aparecerem aqui.</span>}
    </span>
  )
}
