import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Lock, BadgeCheck, CalendarClock, Check, Copy, Download, ExternalLink, Info, Link2, Pencil, Send, Zap } from 'lucide-react'
import { Botao } from '../components/ui'
import { Janela } from '../components/Janela'
import { COR_TIPO, iconeTipo } from '../components/opcoes'
import { comemorar } from '../lib/comemorar'
import { useSessao } from '../lib/sessao'
import { supabase } from '../lib/supabase'
import { carregarQuadro, linksArquivos, listarPessoas, salvarCard, type Card, type Pessoa, type Quadro } from '../lib/kanban'
import { listarAprovacoes, type SituacaoAprovacao } from '../lib/aprovacoes'
import { REDES_SOCIAIS, baixarImagens, imagensDoCard, linkRede, listarContas, marcarPostado, salvarConta, type ContaSocial, type Rede } from '../lib/agendamento'
import { Responsaveis } from './kanban/Pessoas'
import './kanban.css'
import './agendamento.css'

const paraInput = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '')
const chaveDia = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
const nomeDia = (d: Date, hoje: Date) => {
  const dias = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).getTime()) / 86_400_000)
  if (dias === 0) return 'Hoje'; if (dias === 1) return 'Amanhã'; if (dias < 0) return 'Atrasados'
  return d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' })
}

/** Agendamento: fila do que vai ao ar, com tudo pronto para postar, e as contas das redes do cliente. */
export function Agendamento() {
  const { cliente, usuario, ehAdminCliente } = useSessao()
  const [quadro, setQuadro] = useState<Quadro | null | undefined>(undefined)
  const [aprovacoes, setAprovacoes] = useState<Map<string, SituacaoAprovacao>>(new Map())
  const [contas, setContas] = useState<ContaSocial[]>([])
  const [pessoas, setPessoas] = useState<Pessoa[]>([])
  const [postar, setPostar] = useState<Card | null>(null)
  const [editarConta, setEditarConta] = useState<Rede | null>(null)
  const [guia, setGuia] = useState(false)
  const [agora] = useState(() => new Date())

  const carregar = useCallback(async () => {
    if (!cliente) return
    const [q, a, c, p] = await Promise.all([carregarQuadro(cliente.id), listarAprovacoes(cliente.id).catch(() => []), listarContas(cliente.id), listarPessoas(cliente.id)])
    const m = new Map<string, SituacaoAprovacao>(); a.forEach((x) => { if (!m.has(x.card_id)) m.set(x.card_id, x.situacao) })
    setQuadro(q); setAprovacoes(m); setContas(c); setPessoas(p)
  }, [cliente])
  useEffect(() => { void Promise.resolve().then(carregar) }, [carregar])

  const colunaDe = useCallback((c: Card) => quadro?.colunas.find((x) => x.id === c.coluna_id)?.nome ?? '', [quadro])
  const jaPostado = useCallback((c: Card) => !!c.postado_em || /^postado/i.test(colunaDe(c)), [colunaDe])
  const aprovado = (c: Card) => aprovacoes.get(c.id) === 'aprovado' || /aprovado/i.test(colunaDe(c))

  const { porDia, semData, recentes } = useMemo(() => {
    const cards = quadro?.cards ?? []
    const comData = cards.filter((c) => c.postagem_em && !jaPostado(c)).sort((a, b) => a.postagem_em!.localeCompare(b.postagem_em!))
    const grupos = new Map<string, { dia: Date; cards: Card[] }>()
    comData.forEach((c) => {
      const d = new Date(c.postagem_em!); const k = d < agora && chaveDia(d) !== chaveDia(agora) ? 'atrasados' : chaveDia(d)
      if (!grupos.has(k)) grupos.set(k, { dia: k === 'atrasados' ? new Date(0) : d, cards: [] })
      grupos.get(k)!.cards.push(c)
    })
    return {
      porDia: [...grupos.values()],
      semData: cards.filter((c) => !c.postagem_em && !jaPostado(c) && /aprovado/i.test(colunaDe(c))),
      recentes: cards.filter((c) => c.postado_em && new Date(c.postado_em) > new Date(agora.getTime() - 7 * 86_400_000)).sort((a, b) => b.postado_em!.localeCompare(a.postado_em!)),
    }
  }, [quadro, agora, jaPostado, colunaDe])

  if (!cliente) return <div className="corpo"><h2>Agendamento</h2><p className="texto-2">Crie um cliente primeiro.</p></div>
  const horaDePostar = (c: Card) => !!c.postagem_em && new Date(c.postagem_em).getTime() - agora.getTime() < 30 * 60_000

  const item = (c: Card) => {
    const ap = aprovacoes.get(c.id)
    const ok = aprovado(c)
    const passou = !!c.postagem_em && new Date(c.postagem_em) < agora
    const urgente = horaDePostar(c) && ok
    return (
      <li key={c.id} className={`agenda-post${urgente ? ' agenda-post--agora' : ''}${passou && !ok ? ' agenda-post--perdido' : ''}`}>
        <span className="agenda-post__hora">{c.postagem_em ? new Date(c.postagem_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—'}
          {c.postagem_em && chaveDia(new Date(c.postagem_em)) !== chaveDia(agora) && new Date(c.postagem_em) < agora && <small>{new Date(c.postagem_em).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</small>}</span>
        {c.capa_url ? <img className="agenda-post__capa" src={c.capa_url} alt="" /> : <span className="agenda-post__capa agenda-post__capa--vazia" style={c.capa_cor ? { background: c.capa_cor } : undefined} />}
        <div className="agenda-post__texto">
          <strong>{c.titulo}</strong>
          <span className="agenda-post__meta">
            {c.tipo_conteudo && <span className="etiqueta" style={{ '--cor': COR_TIPO[c.tipo_conteudo] ?? '#667085' } as React.CSSProperties}>{iconeTipo(c.tipo_conteudo, 11)} {c.tipo_conteudo}</span>}
            {c.redes.map((r) => <span key={r} className="pequeno">{r}</span>)}
          </span>
        </div>
        <span className={`agenda-post__aprov agenda-post__aprov--${ok ? 'ok' : passou ? 'sem' : ap ?? 'sem'}`}>
          {ok ? <><BadgeCheck size={14} /> Liberado</>
            : passou ? <><AlertTriangle size={13} /> {ap === 'ajuste' ? 'Voltou para alteração' : ap === 'pendente' ? 'Não aprovado a tempo' : 'Sem aprovação'}</>
            : ap === 'pendente' ? <><Lock size={13} /> Travado: aguardando aprovação</> : ap === 'ajuste' ? <><Lock size={13} /> Travado: em alteração</> : <><AlertTriangle size={13} /> Sem aprovação</>}
        </span>
        <Responsaveis ids={c.responsaveis} pessoas={pessoas} />
        <span className="agenda-post__acoes">
          <Link className="botao botao--fantasma botao--mini" to={`/kanban?card=${c.id}`}>Abrir</Link>
          <button type="button" className={`botao botao--mini ${urgente || (passou && !ok) ? 'botao--primario' : 'botao--secundario'}`} onClick={() => setPostar(c)}><Send size={14} /> {urgente ? 'Postar agora' : !ok && passou ? 'Postar manualmente' : 'Postar'}</button>
        </span>
      </li>
    )
  }

  return (
    <div className="corpo">
      <div className="linha" style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div style={{ maxWidth: 720 }}><h2>Agendamento</h2><p className="pequeno">A data é programada ao enviar para aprovação. Só é liberado o que for aprovado; o que ficar pendente ou voltar para alteração não vai ao ar e precisa ser postado manualmente.</p></div>
        <Link className="botao botao--secundario" to="/kanban"><CalendarClock size={16} /> Ver no Kanban por data</Link>
      </div>

      <section className="contas-redes">
        {REDES_SOCIAIS.map((r) => {
          const c = contas.find((x) => x.rede === r)
          return (
            <div key={r} className={`conta-rede conta-rede--${(c?.situacao ?? 'vazia')}`}>
              <span className={`conta-rede__logo conta-rede__logo--${r.toLowerCase()}`}>{r.slice(0, 2)}</span>
              <span className="conta-rede__texto"><strong>{r}</strong><small>{c?.usuario ?? 'Conta não informada'}</small>
                <span className="conta-rede__situacao">{c?.situacao === 'conectada' ? <><Zap size={11} /> Publica sozinho</> : 'Publicação manual'}</span></span>
              {ehAdminCliente && <button type="button" className="icone-botao" style={{ width: 28, height: 28, border: 0 }} aria-label={`Editar conta do ${r}`} onClick={() => setEditarConta(r)}><Pencil size={13} /></button>}
            </div>
          )
        })}
        <button type="button" className="contas-redes__info" onClick={() => setGuia(true)}><Info size={15} /> Como ligar a publicação automática</button>
      </section>

      {quadro === undefined && <p className="pequeno">Carregando…</p>}
      {quadro && porDia.length === 0 && semData.length === 0 && (
        <div className="vazio-grande"><CalendarClock size={34} /><h3>Nada agendado</h3><p className="texto-2">Coloque a data de postagem nos cards do Kanban (ou arraste no Kanban por data) e eles aparecem aqui na ordem.</p></div>
      )}

      {porDia.map((g) => (
        <section key={g.dia.getTime()} className={`agenda-dia${g.dia.getTime() === 0 ? ' agenda-dia--atrasado' : ''}`}>
          <h3>{g.dia.getTime() === 0 ? 'Não foi ao ar: passou do horário' : nomeDia(g.dia, agora)} <span>{g.cards.length}</span></h3>
          <ul>{g.cards.map(item)}</ul>
        </section>
      ))}

      {semData.length > 0 && (
        <section className="agenda-dia agenda-dia--sem-data">
          <h3>Aprovados sem data <span>{semData.length}</span></h3>
          <ul>{semData.map((c) => (
            <li key={c.id} className="agenda-post">
              {c.capa_url ? <img className="agenda-post__capa" src={c.capa_url} alt="" /> : <span className="agenda-post__capa agenda-post__capa--vazia" style={c.capa_cor ? { background: c.capa_cor } : undefined} />}
              <div className="agenda-post__texto"><strong>{c.titulo}</strong><span className="pequeno">{c.redes.join(', ') || 'Sem rede definida'}</span></div>
              <label className="linha pequeno" style={{ gap: 6 }}>Agendar para
                <input type="datetime-local" className="entrada entrada--mini" style={{ width: 200 }} value={paraInput(c.postagem_em)} onChange={(e) => e.target.value && void salvarCard(c.id, { postagem_em: new Date(e.target.value).toISOString() }).then(carregar)} />
              </label>
            </li>
          ))}</ul>
        </section>
      )}

      {recentes.length > 0 && (
        <section className="agenda-dia agenda-dia--feitos">
          <h3>Publicados nos últimos 7 dias <span>{recentes.length}</span></h3>
          <ul>{recentes.map((c) => (
            <li key={c.id} className="agenda-post agenda-post--feito">
              <span className="agenda-post__hora"><Check size={15} /></span>
              <div className="agenda-post__texto"><strong>{c.titulo}</strong><span className="pequeno">{new Date(c.postado_em!).toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}{c.postado_por ? ` · ${pessoas.find((p) => p.usuario_id === c.postado_por)?.nome.split(' ')[0] ?? ''}` : ''}</span></div>
              {c.link_post && <a className="botao botao--fantasma botao--mini" href={c.link_post} target="_blank" rel="noreferrer"><ExternalLink size={13} /> Ver post</a>}
            </li>
          ))}</ul>
        </section>
      )}

      {postar && quadro && <PostarAgora card={postar} contas={contas} aprovado={aprovado(postar)} onFechar={() => setPostar(null)}
        onPostado={async (link) => { await marcarPostado(postar, quadro.colunas, supabase ? usuario.id : 'p1', link); comemorar(); setPostar(null); await carregar() }} />}
      {editarConta && <EditarConta rede={editarConta} atual={contas.find((c) => c.rede === editarConta)?.usuario ?? ''} onFechar={() => setEditarConta(null)}
        onSalvar={async (u) => { await salvarConta(cliente.id, editarConta, u); setEditarConta(null); await carregar() }} />}
      {guia && <GuiaMeta onFechar={() => setGuia(false)} />}
    </div>
  )
}

/** Tudo pronto para postar à mão: artes na ordem, legenda para copiar e o botão "Já postei". */
function PostarAgora({ card, contas, aprovado, onFechar, onPostado }: { card: Card; contas: ContaSocial[]; aprovado: boolean; onFechar: () => void; onPostado: (link: string | null) => Promise<void> }) {
  const imagens = imagensDoCard(card)
  const [links, setLinks] = useState<Map<string, string>>(new Map())
  const [copiado, setCopiado] = useState(false)
  const [baixando, setBaixando] = useState(false)
  const [link, setLink] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [copiou, setCopiou] = useState<'link' | 'texto' | null>(null)
  const story = card.tipo_conteudo === 'Story'
  const temTexto = !story || !!card.legenda
  const temSticker = story && !!card.story_link
  const numeros = [1, 2, temTexto ? 3 : 2, 2 + Number(temTexto) + Number(temSticker)]
  const caminhos = imagens.map((i) => i.caminho!).join('|')
  useEffect(() => { void linksArquivos(caminhos ? caminhos.split('|') : []).then(setLinks) }, [caminhos])

  return (
    <Janela titulo="Postar agora" onFechar={onFechar} largura={680}>
      <div className="janela__corpo postar-agora">
        <div><h3 style={{ margin: 0 }}>{card.titulo}</h3>
          <span className="pequeno">{[card.tipo_conteudo, card.redes.join(', '), card.postagem_em && new Date(card.postagem_em).toLocaleString('pt-BR', { weekday: 'long', hour: '2-digit', minute: '2-digit' })].filter(Boolean).join(' · ')}</span></div>
        {!aprovado && <p className="faixa-dica" style={{ background: 'rgb(232 137 12 / .12)', color: '#8a5000' }}><AlertTriangle size={15} /> Este post ainda não foi aprovado.</p>}

        <section className="postar-agora__passo">
          <span className="postar-agora__numero">{numeros[0]}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <strong>{story ? (imagens.length > 1 ? 'Baixe os stories (na ordem)' : 'Baixe o story') : <>Baixe as artes {imagens.length > 1 && '(já numeradas na ordem do carrossel)'}</>}</strong>
            {imagens.length ? (
              <div className="postar-agora__imagens">{imagens.map((im, i) => (
                <span key={im.id} className="postar-agora__imagem">{links.get(im.caminho!) && <img src={links.get(im.caminho!)} alt="" />}<small>{i + 1}</small></span>
              ))}</div>
            ) : <p className="pequeno">Nenhuma imagem anexada no card.</p>}
            {imagens.length > 0 && <Botao variante="secundario" icone={<Download size={15} />} disabled={baixando} onClick={() => { setBaixando(true); void baixarImagens(card, imagens).finally(() => setBaixando(false)) }}>{baixando ? 'Baixando…' : imagens.length > 1 ? `Baixar as ${imagens.length} artes` : 'Baixar a arte'}</Botao>}
          </div>
        </section>

        {(!story || card.legenda) && (
        <section className="postar-agora__passo">
          <span className="postar-agora__numero">{numeros[1]}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <strong>{story ? 'Copie o texto do story' : 'Copie a legenda'}</strong>
            {card.legenda ? <p className="postar-agora__legenda">{card.legenda}</p> : <p className="pequeno">O card está sem legenda.</p>}
            {card.legenda && <Botao variante="secundario" icone={copiado ? <Check size={15} /> : <Copy size={15} />} onClick={() => { void navigator.clipboard.writeText(card.legenda ?? ''); setCopiado(true) }}>{copiado ? 'Legenda copiada' : 'Copiar legenda'}</Botao>}
          </div>
        </section>
        )}
        {story && card.story_link && (
          <section className="postar-agora__passo">
            <span className="postar-agora__numero">{numeros[2]}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <strong>Adicione o sticker de link</strong>
              <span className="pequeno" style={{ display: 'block' }}>No story: Figurinhas › Link. Cole o link e troque o texto do sticker.</span>
              <div className="postar-agora__sticker">
                <span className="story-link__previa"><Link2 size={13} /> {(card.story_link_texto || card.story_link.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]).toUpperCase()}</span>
                <Botao variante="secundario" icone={copiou === 'link' ? <Check size={15} /> : <Copy size={15} />} onClick={() => { void navigator.clipboard.writeText(card.story_link ?? ''); setCopiou('link') }}>{copiou === 'link' ? 'Link copiado' : 'Copiar link'}</Botao>
                {card.story_link_texto && <Botao variante="secundario" icone={copiou === 'texto' ? <Check size={15} /> : <Copy size={15} />} onClick={() => { void navigator.clipboard.writeText(card.story_link_texto ?? ''); setCopiou('texto') }}>{copiou === 'texto' ? 'Texto copiado' : 'Copiar texto do sticker'}</Botao>}
              </div>
              <span className="pequeno postar-agora__url">{card.story_link}</span>
            </div>
          </section>
        )}
        <section className="postar-agora__passo">
          <span className="postar-agora__numero">{numeros[3]}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <strong>Publique na rede</strong>
            <div className="linha" style={{ gap: 6, marginTop: 6 }}>
              {(card.redes.length ? card.redes : ['Instagram']).map((r) => (
                <a key={r} className="botao botao--secundario botao--mini" href={linkRede(r as Rede, contas.find((c) => c.rede === r)?.usuario ?? null)} target="_blank" rel="noreferrer"><ExternalLink size={13} /> Abrir {r}</a>
              ))}
            </div>
          </div>
        </section>

        <section className="postar-agora__passo postar-agora__passo--final">
          <span className="postar-agora__numero"><Check size={15} /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <strong>Marque como postado</strong>
            <div className="linha" style={{ gap: 8, marginTop: 6, flexWrap: 'nowrap' }}>
              <span className="postar-agora__link"><Link2 size={14} /><input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Link do post (opcional)" aria-label="Link do post" /></span>
              <Botao disabled={salvando} onClick={() => { setSalvando(true); void onPostado(link).finally(() => setSalvando(false)) }}>{salvando ? 'Salvando…' : 'Já postei'}</Botao>
            </div>
            <span className="pequeno">O card vai para "Postado e feito" e fica registrado quem postou e quando.</span>
          </div>
        </section>
      </div>
    </Janela>
  )
}

function EditarConta({ rede, atual, onFechar, onSalvar }: { rede: Rede; atual: string; onFechar: () => void; onSalvar: (u: string | null) => Promise<void> }) {
  const [u, setU] = useState(atual)
  return (
    <Janela titulo={`Conta do ${rede}`} onFechar={onFechar}>
      <form className="janela__corpo" onSubmit={(e) => { e.preventDefault(); void onSalvar(u.trim() || null) }}>
        <div className="campo"><label htmlFor="conta-u">{rede === 'Facebook' ? 'Nome da página' : '@ da conta'}</label>
          <input id="conta-u" className="entrada" autoFocus value={u} onChange={(e) => setU(e.target.value)} placeholder={rede === 'Facebook' ? 'Hospital Santa Marta' : '@hospitalsantamarta'} /></div>
        <p className="pequeno">Por enquanto serve para abrir a conta certa na hora de postar. A publicação automática entra quando a conta for ligada pela Meta.</p>
        <div className="linha" style={{ justifyContent: 'flex-end' }}><Botao type="button" variante="fantasma" onClick={onFechar}>Cancelar</Botao><Botao type="submit">Salvar</Botao></div>
      </form>
    </Janela>
  )
}

/** Passo a passo do que o hospital precisa preparar para a publicação automática. */
function GuiaMeta({ onFechar }: { onFechar: () => void }) {
  return (
    <Janela titulo="Publicação automática no Instagram e Facebook" onFechar={onFechar} largura={640}>
      <div className="janela__corpo guia-meta">
        <p className="texto-2">Para o Luminy publicar sozinho, a Meta (dona do Instagram e do Facebook) precisa autorizar. O que preparar:</p>
        <ol>
          <li><strong>Instagram do hospital como conta profissional.</strong> No app: Configurações › Tipo de conta e ferramentas › Mudar para conta profissional › Empresa.</li>
          <li><strong>Ligar o Instagram à página do Facebook do hospital.</strong> Na página do Facebook: Configurações › Contas vinculadas › Instagram.</li>
          <li><strong>Ter acesso de administrador</strong> à página do Facebook (de preferência pelo Meta Business Suite, em business.facebook.com).</li>
          <li><strong>Criar o aplicativo do Luminy na Meta</strong> (developers.facebook.com). Eu te guio passo a passo nessa parte.</li>
          <li><strong>Análise da Meta:</strong> pedimos a permissão de publicar, com um vídeo mostrando o Luminy. Costuma levar de alguns dias a algumas semanas.</li>
        </ol>
        <p className="faixa-dica"><Zap size={15} /> Liberado, as contas aparecem aqui como "Publica sozinho" e os posts aprovados com data vão ao ar no horário, sem ninguém tocar. Até lá, o Agendamento avisa e deixa tudo pronto para postar.</p>
        <div className="linha" style={{ justifyContent: 'flex-end' }}><Botao onClick={onFechar}>Entendi</Botao></div>
      </div>
    </Janela>
  )
}
