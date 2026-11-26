import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BadgeCheck, Check, Columns3, Copy, ExternalLink, MessageCircle, PenLine } from 'lucide-react'
import { Botao } from '../components/ui'
import { Janela } from '../components/Janela'
import { useSessao } from '../lib/sessao'
import { linkAprovacao, listarAprovacoes, responderAprovacao, type Aprovacao } from '../lib/aprovacoes'
import './aprovacoes.css'

type Filtro = 'pendente' | 'ajuste' | 'aprovado' | 'todas'
const NOMES: Record<Exclude<Filtro, 'todas'>, string> = { pendente: 'Aguardando', ajuste: 'Ajustes pedidos', aprovado: 'Aprovados' }
const quando = (iso: string) => {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 60) return `há ${Math.max(1, min)} min`; const h = Math.round(min / 60); if (h < 24) return `há ${h} h`
  const d = Math.round(h / 24); return d === 1 ? 'ontem' : `há ${d} dias`
}

/** Aprovações: posts enviados para a diretoria/cliente aprovar pelo link, e o que voltou. */
export function Aprovacoes() {
  const { cliente, usuario, ehAdminCliente } = useSessao()
  const [lista, setLista] = useState<Aprovacao[] | null>(null)
  const [filtro, setFiltro] = useState<Filtro>('pendente')
  const [copiado, setCopiado] = useState<string | null>(null)
  const [ajuste, setAjuste] = useState<Aprovacao | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const carregar = useCallback(async () => { if (cliente) setLista(await listarAprovacoes(cliente.id)) }, [cliente])
  useEffect(() => { void Promise.resolve().then(carregar) }, [carregar])

  async function responderAqui(a: Aprovacao, aprovar: boolean, comentario: string | null) {
    setErro(null)
    try { await responderAprovacao(a.token, aprovar, usuario.nome || 'Equipe', comentario); setAjuste(null); await carregar() } catch (e) { setErro((e as Error).message) }
  }

  if (!cliente) return <div className="corpo"><h2>Aprovações</h2><p className="texto-2">Crie um cliente primeiro.</p></div>
  const conta = (f: Filtro) => (lista ?? []).filter((a) => f === 'todas' || a.situacao === f).length
  const visiveis = (lista ?? []).filter((a) => filtro === 'todas' || a.situacao === filtro)

  return (
    <div className="corpo">
      <div className="linha" style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div><h2>Aprovações</h2><p className="pequeno">Posts enviados para aprovação pelo link. Para enviar um, abra o card no Kanban › "Enviar para aprovação".</p></div>
        <div className="segmentos" role="radiogroup" aria-label="Filtrar">
          {(['pendente', 'ajuste', 'aprovado', 'todas'] as Filtro[]).map((f) => (
            <button key={f} type="button" role="radio" aria-checked={filtro === f} className={filtro === f ? 'marcado' : ''} onClick={() => setFiltro(f)}>{f === 'todas' ? 'Todas' : NOMES[f]} <span>{conta(f)}</span></button>
          ))}
        </div>
      </div>
      {erro && <p className="importar__erro">{erro}</p>}

      {lista !== null && visiveis.length === 0 && (
        <div className="vazio-grande"><BadgeCheck size={34} /><h3>{filtro === 'pendente' ? 'Nada aguardando aprovação' : 'Nada por aqui'}</h3>
          <p className="texto-2">Abra um card no Kanban e toque em "Enviar para aprovação" para gerar o link e mandar pelo WhatsApp.</p>
          <Link className="botao botao--secundario" to="/kanban"><Columns3 size={16} /> Ir para o Kanban</Link></div>
      )}

      <div className="grade-aprovacoes">
        {visiveis.map((a) => {
          const expirada = a.situacao === 'pendente' && new Date(a.expira_em) < new Date()
          const link = linkAprovacao(a.token)
          return (
            <article key={a.id} className={`aprovacao aprovacao--${expirada ? 'expirada' : a.situacao}`}>
              <div className="aprovacao__imagem">
                {a.imagens[0] ? <img src={a.imagens[0].url} alt="" /> : <span className="pequeno">sem imagem</span>}
                {a.imagens.length > 1 && <span className="aprovacao__quantas">+{a.imagens.length - 1}</span>}
                <span className={`aprovacao__selo aprovacao__selo--${expirada ? 'expirada' : a.situacao}`}>
                  {expirada ? 'Link expirado' : a.situacao === 'pendente' ? 'Aguardando' : a.situacao === 'aprovado' ? '✓ Aprovado' : 'Ajuste pedido'}
                </span>
              </div>
              <div className="aprovacao__corpo">
                <strong className="aprovacao__titulo">{a.titulo}</strong>
                <span className="pequeno">{[a.tipo_conteudo, a.redes.join(', '), a.postagem_em && `sai ${new Date(a.postagem_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`].filter(Boolean).join(' · ')}</span>
                <span className="pequeno">Enviado {quando(a.enviado_em)}{a.aprovador ? ` para ${a.aprovador}` : ''}</span>
                {a.situacao !== 'pendente' && (
                  <div className={`aprovacao__resposta aprovacao__resposta--${a.situacao}`}>
                    <strong>{a.situacao === 'aprovado' ? <Check size={14} /> : <PenLine size={14} />} {a.respondido_por_nome}{a.respondido_em ? ` · ${quando(a.respondido_em)}` : ''}</strong>
                    {a.resposta && <p>"{a.resposta}"</p>}
                  </div>
                )}
                <div className="aprovacao__acoes">
                  <Link className="botao botao--secundario botao--mini" to={`/kanban?card=${a.card_id}`}><Columns3 size={14} /> Abrir card</Link>
                  {a.situacao === 'pendente' && !expirada && <>
                    <a className="botao botao--whats botao--mini" href={`https://wa.me/?text=${encodeURIComponent(`${a.mensagem ?? `Segue "${a.titulo}" para aprovação.`}\n\nPara aprovar ou pedir ajuste: ${link}`)}`} target="_blank" rel="noreferrer"><MessageCircle size={14} /> Lembrar</a>
                    <button type="button" className="icone-botao" style={{ width: 32, height: 32 }} title="Copiar link" aria-label="Copiar link" onClick={() => { void navigator.clipboard.writeText(link); setCopiado(a.id); setTimeout(() => setCopiado(null), 1500) }}>{copiado === a.id ? <Check size={14} /> : <Copy size={14} />}</button>
                    <a className="icone-botao" style={{ width: 32, height: 32 }} href={link} target="_blank" rel="noreferrer" title="Ver como quem aprova vê" aria-label="Abrir link"><ExternalLink size={14} /></a>
                  </>}
                </div>
                {a.situacao === 'pendente' && !expirada && ehAdminCliente && (
                  <div className="aprovacao__interna">
                    <span className="pequeno">Aprovado por telefone ou pessoalmente?</span>
                    <button type="button" className="anexo__acao" onClick={() => void responderAqui(a, true, 'Registrado pela equipe')}>Marcar como aprovado</button>
                    <button type="button" className="anexo__acao" onClick={() => setAjuste(a)}>Registrar ajuste</button>
                  </div>
                )}
              </div>
            </article>
          )
        })}
      </div>

      {ajuste && <RegistrarAjuste a={ajuste} onFechar={() => setAjuste(null)} onConfirmar={(t) => void responderAqui(ajuste, false, t)} />}
    </div>
  )
}

function RegistrarAjuste({ a, onFechar, onConfirmar }: { a: Aprovacao; onFechar: () => void; onConfirmar: (t: string) => void }) {
  const [texto, setTexto] = useState('')
  return (
    <Janela titulo={`Ajuste pedido: ${a.titulo}`} onFechar={onFechar}>
      <div className="janela__corpo">
        <textarea className="entrada" rows={3} autoFocus value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="O que pediram para mudar?" />
        <div className="linha" style={{ justifyContent: 'flex-end' }}><Botao variante="fantasma" onClick={onFechar}>Cancelar</Botao><Botao disabled={texto.trim().length < 3} onClick={() => onConfirmar(texto.trim())}>Registrar</Botao></div>
      </div>
    </Janela>
  )
}
