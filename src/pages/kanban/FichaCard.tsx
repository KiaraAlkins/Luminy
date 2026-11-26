import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertTriangle, AlignLeft, BadgeCheck, CalendarClock, Check, CheckSquare, Copy, ExternalLink, FileText, ImagePlus, Link2, MessageSquare,
  Paperclip, Play, Plus, Send, Trash2, X,
} from 'lucide-react'
import { Janela } from '../../components/Janela'
import { Selecao } from '../../components/Selecao'
import { COR_TIPO, OPCOES_PRIORIDADE, iconeTipo, opcoesTipoConteudo } from '../../components/opcoes'
import { useFoco } from '../../lib/foco'
import { EscolherResponsaveis } from './Pessoas'
import { EnviarAprovacao } from './EnviarAprovacao'
import { aprovacaoDoCard, type Aprovacao } from '../../lib/aprovacoes'
import {
  REDES, TIPOS, apagarArquivoCard, apagarComentario, comentar, enviarArquivoCard, linksArquivos, listarComentarios,
  type Anexo, type Card, type Coluna, type Comentario, type EdicaoCard, type ItemChecklist, type Pessoa,
} from '../../lib/kanban'

const CORES_CAPA = ['#3D2EF9', '#1F6FEB', '#12A15F', '#E8890C', '#E5484D', '#D6297A', '#7A5AF8', '#17142E']
const paraInput = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '')
const deInput = (v: string) => (v ? new Date(v).toISOString() : null)
const ehImagem = (a: Anexo) => a.tipo === 'arquivo' && /^image\//.test(a.mime ?? '')
const quando = (iso: string) => {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 1) return 'agora'; if (min < 60) return `há ${min} min`
  const h = Math.round(min / 60); if (h < 24) return `há ${h} h`
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

/** Campo de texto que salva sozinho quando a pessoa para de digitar ou sai do campo. */
function TextoQueSalva({ valor, onSalvar, ...props }: { valor: string; onSalvar: (v: string) => void } & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange' | 'value'>) {
  const [v, setV] = useState(valor)
  const t = useRef<ReturnType<typeof setTimeout>>(undefined)
  const salvar = (x: string) => { clearTimeout(t.current); if (x !== valor) onSalvar(x) }
  return (
    <textarea {...props} value={v}
      onChange={(e) => { setV(e.target.value); clearTimeout(t.current); const x = e.target.value; t.current = setTimeout(() => salvar(x), 900) }}
      onBlur={() => salvar(v)} />
  )
}

/**
 * Ficha do card (no jeito da Orkestrya + Trello): capa, título grande, briefing, legenda, checklist,
 * anexos e comentários; à direita, o painel escuro de propriedades. Tudo salva sozinho.
 */
export function FichaCard({ card, quadroId, colunas, pessoas, onAtualizar, onMover, onExcluir, onFechar }: {
  card: Card; quadroId: string; colunas: Coluna[]; pessoas: Pessoa[]
  onAtualizar: (parcial: EdicaoCard) => Promise<void>
  onMover: (colunaId: string) => void
  onExcluir: () => Promise<void>
  onFechar: () => void
}) {
  const { foco, definir } = useFoco()
  const [titulo, setTitulo] = useState(card.titulo)
  const [agoraFicha] = useState(() => Date.now())
  const [links, setLinks] = useState<Map<string, string>>(new Map())
  const [comentarios, setComentarios] = useState<Comentario[]>([])
  const [novoItem, setNovoItem] = useState('')
  const [novoComentario, setNovoComentario] = useState('')
  const [link, setLink] = useState<{ url: string; nome: string } | null>(null)
  const [escolherCapa, setEscolherCapa] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [salvo, setSalvo] = useState(false)
  const [aprovacao, setAprovacao] = useState<Aprovacao | null>(null)
  const [enviarAprovacao, setEnviarAprovacao] = useState(false)
  const arquivo = useRef<HTMLInputElement>(null)
  const capaArquivo = useRef<HTMLInputElement>(null)
  const coluna = colunas.find((c) => c.id === card.coluna_id)

  const caminhos = [card.capa_path, ...card.anexos.map((a) => a.caminho)].filter(Boolean).join('|')
  useEffect(() => { void linksArquivos(caminhos ? caminhos.split('|') : []).then(setLinks) }, [caminhos])
  const carregarComentarios = useCallback(async () => setComentarios(await listarComentarios(card.id)), [card.id])
  useEffect(() => { void Promise.resolve().then(carregarComentarios) }, [carregarComentarios])
  useEffect(() => { void aprovacaoDoCard(card.id).then(setAprovacao) }, [card.id])

  async function salvar(p: EdicaoCard) {
    setErro(null)
    try { await onAtualizar(p); setSalvo(true); setTimeout(() => setSalvo(false), 1500) } catch { setErro('Não foi possível salvar.') }
  }

  // ---------- checklist
  const feitos = card.checklist.filter((i) => i.feito).length
  const mudarChecklist = (lista: ItemChecklist[]) => void salvar({ checklist: lista })
  function adicionarItem() {
    const t = novoItem.trim(); if (!t) return
    mudarChecklist([...card.checklist, { id: crypto.randomUUID(), texto: t, feito: false }]); setNovoItem('')
  }

  // ---------- anexos e capa
  async function anexar(arquivos: FileList | null, comoCapa = false) {
    if (!arquivos?.length) return
    setEnviando(true); setErro(null)
    try {
      const novos: Anexo[] = []
      for (const f of Array.from(arquivos)) novos.push(await enviarArquivoCard(quadroId, card.id, f))
      const primeiraImagem = novos.find(ehImagem)
      await salvar({
        anexos: [...card.anexos, ...novos],
        ...((comoCapa || !card.capa_path) && primeiraImagem ? { capa_path: primeiraImagem.caminho!, capa_cor: null } : {}),
      })
    } catch (e) { setErro((e as Error).message) }
    setEnviando(false); setEscolherCapa(false)
  }
  async function removerAnexo(a: Anexo) {
    if (!confirm(`Remover "${a.nome}" do card?`)) return
    await salvar({ anexos: card.anexos.filter((x) => x.id !== a.id), ...(card.capa_path === a.caminho ? { capa_path: null } : {}) })
    if (a.caminho) await apagarArquivoCard(a.caminho)
  }
  function adicionarLink() {
    if (!link?.url.trim()) return
    const url = /^https?:\/\//.test(link.url) ? link.url.trim() : `https://${link.url.trim()}`
    const nome = link.nome.trim() || (url.includes('drive.google') || url.includes('docs.google') ? 'Arquivo no Google Drive' : url.replace(/^https?:\/\//, '').slice(0, 50))
    void salvar({ anexos: [...card.anexos, { id: crypto.randomUUID(), tipo: 'link', nome, url, criado_em: new Date().toISOString() }] })
    setLink(null)
  }

  const capa = card.capa_path ? links.get(card.capa_path) ?? card.capa_url : null
  const opcoesColuna = colunas.map((c) => ({ valor: c.id, rotulo: c.nome, cor: c.exige_motivo ? 'var(--perigo)' : undefined }))

  return (
    <Janela titulo={coluna?.nome ?? 'Card'} onFechar={onFechar} largura={1000} classe="ficha-card">
      {(capa || card.capa_cor) && (
        <div className="ficha-card__capa" style={{ background: card.capa_cor ?? 'var(--painel)' }}>
          {capa && <img src={capa} alt="" />}
        </div>
      )}
      <div className="ficha-card__corpo">
        <div className="ficha-card__principal">
          <input className="editar-card__titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)}
            onBlur={() => { const t = titulo.trim(); if (t && t !== card.titulo) void salvar({ titulo: t }); else setTitulo(card.titulo) }}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} aria-label="Título do card" />

          <div className="ficha-card__chips">
            {card.tipo_conteudo && <span className="etiqueta" style={{ '--cor': COR_TIPO[card.tipo_conteudo] } as React.CSSProperties}>{iconeTipo(card.tipo_conteudo)} {card.tipo_conteudo}</span>}
            {card.prioridade === 'alta' && <span className="etiqueta" style={{ '--cor': 'var(--perigo)' } as React.CSSProperties}>Prioridade alta</span>}
            {card.redes.map((r) => <span key={r} className="etiqueta etiqueta--leve">{r}</span>)}
          </div>
          {card.motivo_impedimento && <p className="card__impedimento"><AlertTriangle size={14} aria-hidden /> {card.motivo_impedimento}</p>}
          {aprovacao && (
            <div className={`situacao-aprovacao situacao-aprovacao--${aprovacao.situacao}`}>
              <BadgeCheck size={18} />
              <div>
                <strong>{aprovacao.situacao === 'pendente' ? `Aguardando aprovação${aprovacao.aprovador ? ` de ${aprovacao.aprovador}` : ''}` : aprovacao.situacao === 'aprovado' ? `Aprovado por ${aprovacao.respondido_por_nome}` : `Ajuste pedido por ${aprovacao.respondido_por_nome}`}</strong>
                {aprovacao.resposta && <p>"{aprovacao.resposta}"</p>}
                <span className="pequeno">{aprovacao.situacao === 'pendente' ? `enviado ${quando(aprovacao.enviado_em)}` : aprovacao.respondido_em ? quando(aprovacao.respondido_em) : ''}</span>
                {card.postagem_em && !card.postado_em && (
                  <span className="situacao-aprovacao__programa">
                    {aprovacao.situacao === 'aprovado' ? 'Liberado para ir ao ar em ' : 'Programado para '}
                    {new Date(card.postagem_em).toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    {aprovacao.situacao !== 'aprovado' && (new Date(card.postagem_em).getTime() < agoraFicha ? ' · não foi aprovado a tempo, postar manualmente' : ' · só vai ao ar se for aprovado')}
                  </span>
                )}
              </div>
              {aprovacao.situacao === 'ajuste' && <button type="button" className="botao botao--primario botao--mini" onClick={() => setEnviarAprovacao(true)}>Corrigido, reenviar</button>}
            </div>
          )}

          <section className="ficha-secao">
            <h4><AlignLeft size={16} /> Briefing</h4>
            <TextoQueSalva className="entrada ficha-texto" rows={4} placeholder="O que precisa ser feito, referências, tom de voz…" valor={card.briefing ?? ''} onSalvar={(v) => void salvar({ briefing: v || null })} />
          </section>

          {card.tipo_conteudo === 'Story' && (
            <section className="ficha-secao">
              <h4><Link2 size={16} /> Link no story <span className="ficha-secao__conta">sticker do Instagram</span></h4>
              <div className="story-link">
                <div className="story-link__campos">
                  <input className="entrada" type="url" placeholder="https://… (para onde o link leva)" defaultValue={card.story_link ?? ''} aria-label="Link do story"
                    onBlur={(e) => { const v = e.target.value.trim() || null; if (v !== (card.story_link ?? null)) void salvar({ story_link: v }) }} />
                  <input className="entrada" maxLength={40} placeholder="Texto do sticker, ex.: AGENDE SUA CONSULTA" defaultValue={card.story_link_texto ?? ''} aria-label="Texto do sticker"
                    onBlur={(e) => { const v = e.target.value.trim() || null; if (v !== (card.story_link_texto ?? null)) void salvar({ story_link_texto: v }) }} />
                </div>
                <span className="story-link__fundo" aria-hidden><span className="story-link__previa"><Link2 size={13} /> {(card.story_link_texto || card.story_link?.replace(/^https?:\/\/(www\.)?/, '').split('/')[0] || 'texto do link').toUpperCase()}</span></span>
              </div>
            </section>
          )}

          <section className="ficha-secao">
            <h4><FileText size={16} /> {card.tipo_conteudo === 'Story' ? 'Texto do story (opcional)' : 'Legenda do post'}
              {card.legenda && <button type="button" className="ficha-secao__acao" onClick={() => void navigator.clipboard.writeText(card.legenda ?? '')}><Copy size={13} /> Copiar</button>}
              <span className="ficha-secao__conta">{(card.legenda ?? '').length}/2200</span></h4>
            <TextoQueSalva className="entrada ficha-texto" rows={3} maxLength={2200} placeholder="Texto que vai junto da publicação" valor={card.legenda ?? ''} onSalvar={(v) => void salvar({ legenda: v || null })} />
          </section>

          <section className="ficha-secao">
            <h4><CheckSquare size={16} /> Checklist {card.checklist.length > 0 && <span className="ficha-secao__conta">{feitos}/{card.checklist.length}</span>}</h4>
            {card.checklist.length > 0 && (
              <div className="progresso"><span style={{ width: `${(feitos / card.checklist.length) * 100}%` }} className={feitos === card.checklist.length ? 'completo' : ''} /></div>
            )}
            <ul className="checklist">
              {card.checklist.map((i) => (
                <li key={i.id} className={i.feito ? 'feito' : ''}>
                  <label><input type="checkbox" checked={i.feito} onChange={() => mudarChecklist(card.checklist.map((x) => (x.id === i.id ? { ...x, feito: !x.feito } : x)))} /><span>{i.texto}</span></label>
                  <button type="button" aria-label={`Remover ${i.texto}`} onClick={() => mudarChecklist(card.checklist.filter((x) => x.id !== i.id))}><X size={14} /></button>
                </li>
              ))}
            </ul>
            <form className="linha" onSubmit={(e) => { e.preventDefault(); adicionarItem() }}>
              <input className="entrada entrada--mini" style={{ flex: 1 }} value={novoItem} onChange={(e) => setNovoItem(e.target.value)} placeholder="Adicionar item (Enter)" aria-label="Novo item da checklist" />
              {novoItem && <button type="submit" className="botao botao--primario botao--mini">Adicionar</button>}
            </form>
          </section>

          <section className="ficha-secao">
            <h4><Paperclip size={16} /> Anexos {card.anexos.length > 0 && <span className="ficha-secao__conta">{card.anexos.length}</span>}</h4>
            {card.anexos.length > 0 && (
              <ul className="anexos">
                {card.anexos.map((a) => {
                  const url = a.tipo === 'link' ? a.url : a.caminho ? links.get(a.caminho) : undefined
                  return (
                    <li key={a.id} className="anexo">
                      <a className="anexo__previa" href={url} target="_blank" rel="noreferrer">
                        {ehImagem(a) && url ? <img src={url} alt="" /> : a.tipo === 'link' ? <Link2 size={20} /> : <FileText size={20} />}
                      </a>
                      <div className="anexo__info">
                        <a href={url} target="_blank" rel="noreferrer" className="anexo__nome">{a.nome} {a.tipo === 'link' && <ExternalLink size={12} />}</a>
                        <span className="pequeno">{quando(a.criado_em)}{card.capa_path === a.caminho && ' · capa'}</span>
                        <span className="linha" style={{ gap: 10 }}>
                          {ehImagem(a) && card.capa_path !== a.caminho && <button type="button" className="anexo__acao" onClick={() => void salvar({ capa_path: a.caminho!, capa_cor: null })}>Usar como capa</button>}
                          <button type="button" className="anexo__acao anexo__acao--perigo" onClick={() => void removerAnexo(a)}>Remover</button>
                        </span>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
            <div className="linha" style={{ gap: 8 }}>
              <button type="button" className="botao botao--secundario botao--mini" disabled={enviando} onClick={() => arquivo.current?.click()}><Paperclip size={14} /> {enviando ? 'Enviando…' : 'Arquivo do computador'}</button>
              <button type="button" className="botao botao--secundario botao--mini" onClick={() => setLink({ url: '', nome: '' })}><Link2 size={14} /> Link ou Google Drive</button>
            </div>
            <input ref={arquivo} type="file" multiple hidden onChange={(e) => { void anexar(e.target.files); e.target.value = '' }} />
            {link && (
              <form className="anexo-link" onSubmit={(e) => { e.preventDefault(); adicionarLink() }}>
                <input className="entrada entrada--mini" autoFocus placeholder="Cole o link (Drive, Canva, Figma…)" value={link.url} onChange={(e) => setLink({ ...link, url: e.target.value })} aria-label="Link" />
                <input className="entrada entrada--mini" placeholder="Nome (opcional)" value={link.nome} onChange={(e) => setLink({ ...link, nome: e.target.value })} aria-label="Nome do link" />
                <button type="submit" className="botao botao--primario botao--mini">Anexar</button>
                <button type="button" className="botao botao--fantasma botao--mini" onClick={() => setLink(null)}>Cancelar</button>
              </form>
            )}
          </section>

          <section className="ficha-secao">
            <h4><MessageSquare size={16} /> Comentários</h4>
            <form className="comentar" onSubmit={(e) => { e.preventDefault(); const t = novoComentario.trim(); if (t) void comentar(card.id, t).then(() => { setNovoComentario(''); return carregarComentarios() }) }}>
              <input className="entrada" value={novoComentario} onChange={(e) => setNovoComentario(e.target.value)} placeholder="Escreva um comentário… (Enter envia)" aria-label="Novo comentário" />
              {novoComentario && <button type="submit" className="icone-botao" aria-label="Enviar comentário"><Send size={15} /></button>}
            </form>
            <ul className="comentarios">
              {comentarios.map((c) => (
                <li key={c.id}>
                  <span className="comentarios__avatar">{(c.autor ?? '?').slice(0, 1).toUpperCase()}</span>
                  <div><span className="linha" style={{ gap: 8 }}><strong>{c.autor ?? 'Alguém'}</strong><span className="pequeno">{quando(c.criado_em)}</span></span>
                    <p>{c.texto}</p>
                    {(c.autor_id === 'demo' || c.autor === 'Você') && <button type="button" className="anexo__acao anexo__acao--perigo" onClick={() => void apagarComentario(c.id).then(carregarComentarios)}>Apagar</button>}
                  </div>
                </li>
              ))}
            </ul>
          </section>
          {erro && <p className="pequeno" style={{ color: 'var(--perigo)' }}>{erro}</p>}
        </div>

        <aside className="painel-propriedades">
          <span className="rotulo">Propriedades</span>
          <div className="propriedade"><span>Responsáveis</span>
            <EscolherResponsaveis ids={card.responsaveis} pessoas={pessoas} onMudar={(ids) => void salvar({ responsaveis: ids })} /></div>
          <div className="propriedade"><span>Coluna</span><Selecao mini valor={card.coluna_id} onMudar={(v) => { if (v !== card.coluna_id) onMover(v) }} opcoes={opcoesColuna} /></div>
          <div className="propriedade"><span>Prioridade</span><Selecao mini valor={card.prioridade} onMudar={(v) => void salvar({ prioridade: v as Card['prioridade'] })} opcoes={OPCOES_PRIORIDADE} /></div>
          <div className="propriedade"><span>Tipo</span><Selecao mini valor={card.tipo_conteudo ?? ''} onMudar={(v) => void salvar({ tipo_conteudo: v || null })} opcoes={opcoesTipoConteudo(TIPOS)} /></div>
          <div className="propriedade"><span><CalendarClock size={13} /> Entrega</span>
            <input type="datetime-local" className="entrada entrada--mini" value={paraInput(card.entrega_em)} onChange={(e) => void salvar({ entrega_em: deInput(e.target.value) })} aria-label="Entrega" /></div>
          <div className="propriedade"><span><Send size={13} /> Postagem</span>
            <input type="datetime-local" className="entrada entrada--mini" value={paraInput(card.postagem_em)} onChange={(e) => void salvar({ postagem_em: deInput(e.target.value) })} aria-label="Postagem" /></div>
          <div className="propriedade"><span>Redes</span>
            <div className="redes">{REDES.map((r) => {
              const ativa = card.redes.includes(r)
              return <button key={r} type="button" aria-pressed={ativa} className={ativa ? 'ativa' : ''} onClick={() => void salvar({ redes: ativa ? card.redes.filter((x) => x !== r) : [...card.redes, r] })}>{r}</button>
            })}</div></div>

          <span className="rotulo" style={{ marginTop: 8 }}>Ações</span>
          <button type="button" className="painel-propriedades__acao painel-propriedades__acao--destaque" onClick={() => { void definir(card.titulo, card.id); onFechar() }}>
            <Play size={15} /> {foco?.card_id === card.id ? 'Você está fazendo agora' : 'Fazer agora'}</button>
          <button type="button" className="painel-propriedades__acao" onClick={() => setEnviarAprovacao(true)}><BadgeCheck size={15} /> {aprovacao?.situacao === 'pendente' ? 'Reenviar para aprovação' : 'Enviar para aprovação'}</button>
          <button type="button" className="painel-propriedades__acao" onClick={() => setEscolherCapa(!escolherCapa)}><ImagePlus size={15} /> Capa</button>
          {escolherCapa && (
            <div className="escolher-capa">
              <div className="escolher-capa__cores">
                {CORES_CAPA.map((c) => <button key={c} type="button" aria-label={`Capa cor ${c}`} style={{ background: c }} className={card.capa_cor === c && !card.capa_path ? 'marcada' : ''} onClick={() => void salvar({ capa_cor: c, capa_path: null })} />)}
              </div>
              <button type="button" className="painel-propriedades__acao" onClick={() => capaArquivo.current?.click()}><Plus size={14} /> Enviar imagem</button>
              {(card.capa_cor || card.capa_path) && <button type="button" className="painel-propriedades__acao" onClick={() => void salvar({ capa_cor: null, capa_path: null })}><X size={14} /> Tirar capa</button>}
              <input ref={capaArquivo} type="file" accept="image/*" hidden onChange={(e) => { void anexar(e.target.files, true); e.target.value = '' }} />
            </div>
          )}
          <button type="button" className="painel-propriedades__acao" onClick={() => arquivo.current?.click()}><Paperclip size={15} /> Anexar</button>
          <button type="button" className="painel-propriedades__acao painel-propriedades__acao--perigo" onClick={() => { if (confirm('Excluir este card? Esta ação não pode ser desfeita.')) void onExcluir() }}><Trash2 size={15} /> Excluir card</button>
        </aside>
      </div>
      {enviarAprovacao && <EnviarAprovacao card={card} onFechar={() => setEnviarAprovacao(false)} onEnviado={setAprovacao} onProgramar={(iso) => salvar({ postagem_em: iso })} />}
      {/* Aviso flutuante no canto: não empurra o conteúdo da ficha */}
      <span className={`ficha-card__salvo${salvo ? ' visivel' : ''}`} role="status" aria-live="polite">{salvo && <><Check size={14} /> Salvo</>}</span>
    </Janela>
  )
}
