import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CalendarClock, Check, ChevronLeft, ChevronRight, PenLine, Send } from 'lucide-react'
import { comemorar } from '../lib/comemorar'
import { responderAprovacao, verAprovacao, type AprovacaoPublica } from '../lib/aprovacoes'
import './aprovar.css'

const CHAVE_NOME = 'luminy.aprovador.nome'
const lerNome = () => { try { return localStorage.getItem(CHAVE_NOME) ?? '' } catch { return '' } }

/**
 * Página aberta pelo link da aprovação (sem login): quem aprova vê o post como vai sair
 * e toca em Aprovar ou Pedir ajuste.
 */
export function AprovarPost() {
  const { token = '' } = useParams()
  const [a, setA] = useState<AprovacaoPublica | null>(null)
  const [foto, setFoto] = useState(0)
  const [nome, setNome] = useState(lerNome)
  const [ajuste, setAjuste] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const trilho = useRef<HTMLDivElement>(null)

  useEffect(() => { void verAprovacao(token).then(setA) }, [token])

  async function responder(aprovar: boolean) {
    if (nome.trim().length < 2) { setErro('Escreva seu nome antes de responder.'); return }
    setEnviando(true); setErro(null)
    try {
      try { localStorage.setItem(CHAVE_NOME, nome.trim()) } catch { /* sem armazenamento */ }
      await responderAprovacao(token, aprovar, nome.trim(), aprovar ? null : ajuste)
      if (aprovar) comemorar('grande')
      setA(await verAprovacao(token))
    } catch (e) { setErro((e as Error).message) }
    setEnviando(false)
  }
  const irPara = (i: number) => { setFoto(i); trilho.current?.children[i]?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' }) }

  if (!a) return <main className="aprovar"><p className="aprovar__aviso">Carregando…</p></main>
  if (a.situacao === 'inexistente') return <main className="aprovar"><div className="aprovar__cartao aprovar__corpo"><h2>Link não encontrado</h2><p className="texto-2">Este link não existe ou foi substituído por um mais novo. Peça o link atualizado para a equipe de marketing.</p></div></main>
  if (a.situacao === 'expirada') return <main className="aprovar"><div className="aprovar__cartao aprovar__corpo"><h2>Este link expirou</h2><p className="texto-2">Peça um novo link para a equipe de marketing do {a.cliente}.</p></div></main>

  const respondida = a.situacao !== 'pendente'
  return (
    <main className="aprovar">
      <div className="aprovar__cartao">
        <header className="aprovar__topo" style={{ background: a.cor }}>
          <span className="rotulo" style={{ color: '#fff' }}>{a.cliente} · aprovação de conteúdo</span>
          <h1>{a.titulo}</h1>
          <span className="aprovar__meta">
            {a.tipo && <span>{a.tipo}</span>}{a.redes.map((r) => <span key={r}>{r}</span>)}
            {a.postagem_em && <span><CalendarClock size={13} /> {new Date(a.postagem_em).toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>}
          </span>
        </header>

        {a.mensagem && <p className="aprovar__recado">{a.mensagem}</p>}

        {a.imagens.length > 0 && (
          <div className="aprovar__galeria">
            <div className="aprovar__trilho" ref={trilho} onScroll={(e) => { const el = e.currentTarget; setFoto(Math.round(el.scrollLeft / el.clientWidth)) }}>
              {a.imagens.map((im, i) => <img key={i} src={im.url} alt={`Imagem ${i + 1} de ${a.imagens.length}`} />)}
            </div>
            {a.imagens.length > 1 && (
              <>
                <button type="button" className="aprovar__seta esquerda" aria-label="Imagem anterior" disabled={foto === 0} onClick={() => irPara(foto - 1)}><ChevronLeft size={20} /></button>
                <button type="button" className="aprovar__seta direita" aria-label="Próxima imagem" disabled={foto === a.imagens.length - 1} onClick={() => irPara(foto + 1)}><ChevronRight size={20} /></button>
                <div className="aprovar__pontos">{a.imagens.map((_, i) => <button key={i} type="button" aria-label={`Ver imagem ${i + 1}`} className={i === foto ? 'ativo' : ''} onClick={() => irPara(i)} />)}</div>
              </>
            )}
          </div>
        )}

        {a.legenda && (
          <div className="aprovar__corpo"><span className="rotulo">Legenda</span><p className="aprovar__legenda">{a.legenda}</p></div>
        )}

        <div className="aprovar__corpo aprovar__resposta">
          {respondida ? (
            <div className={`aprovar__resultado aprovar__resultado--${a.situacao}`}>
              {a.situacao === 'aprovado' ? <Check size={28} /> : <PenLine size={26} />}
              <strong>{a.situacao === 'aprovado' ? 'Aprovado' : 'Ajuste pedido'}{a.respondido_por ? ` por ${a.respondido_por}` : ''}</strong>
              {a.resposta && <p>"{a.resposta}"</p>}
              <span className="pequeno">{a.respondido_em && new Date(a.respondido_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} · a equipe já foi avisada</span>
            </div>
          ) : (
            <>
              <div className="campo"><label htmlFor="ap-nome">Seu nome</label>
                <input id="ap-nome" className="entrada" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Dra. Paula" autoComplete="name" /></div>
              {ajuste === null ? (
                <div className="aprovar__botoes">
                  <button type="button" className="aprovar__botao aprovar__botao--ok" disabled={enviando} onClick={() => void responder(true)}><Check size={20} /> Aprovar</button>
                  <button type="button" className="aprovar__botao aprovar__botao--ajuste" disabled={enviando} onClick={() => setAjuste('')}><PenLine size={18} /> Pedir ajuste</button>
                </div>
              ) : (
                <div className="campo">
                  <label htmlFor="ap-ajuste">O que precisa mudar?</label>
                  <textarea id="ap-ajuste" className="entrada" rows={4} autoFocus value={ajuste} onChange={(e) => setAjuste(e.target.value)} placeholder="Ex.: trocar a foto da capa e corrigir o telefone na última tela" />
                  <div className="aprovar__botoes">
                    <button type="button" className="aprovar__botao aprovar__botao--enviar" disabled={enviando || ajuste.trim().length < 3} onClick={() => void responder(false)}><Send size={18} /> Enviar pedido de ajuste</button>
                    <button type="button" className="aprovar__voltar" onClick={() => setAjuste(null)}>Voltar</button>
                  </div>
                </div>
              )}
              {erro && <p className="aprovar__erro" role="alert">{erro}</p>}
            </>
          )}
        </div>
      </div>
      <p className="pequeno aprovar__rodape">Link seguro · Luminy</p>
    </main>
  )
}
