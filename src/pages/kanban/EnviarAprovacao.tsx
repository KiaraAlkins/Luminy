import { useEffect, useState } from 'react'
import { Check, Copy, MessageCircle, Send } from 'lucide-react'
import { Janela } from '../../components/Janela'
import { Botao } from '../../components/ui'
import { useSessao } from '../../lib/sessao'
import { linksArquivos, type Card } from '../../lib/kanban'
import { enviarParaAprovacao, linkAprovacao, type Aprovacao } from '../../lib/aprovacoes'

/** Envia o post para aprovação: escolhe as imagens, escreve o recado e gera o link para mandar no WhatsApp. */
export function EnviarAprovacao({ card, onFechar, onEnviado }: { card: Card; onFechar: () => void; onEnviado: (a: Aprovacao) => void }) {
  const { cliente } = useSessao()
  const imagens = card.anexos.filter((a) => a.tipo === 'arquivo' && /^image\//.test(a.mime ?? '') && a.caminho)
  const [escolhidas, setEscolhidas] = useState<string[]>(() => {
    const capa = card.capa_path && imagens.some((i) => i.caminho === card.capa_path) ? [card.capa_path] : []
    return [...capa, ...imagens.map((i) => i.caminho!).filter((c) => !capa.includes(c))]
  })
  const [links, setLinks] = useState<Map<string, string>>(new Map())
  const [aprovador, setAprovador] = useState('')
  const [mensagem, setMensagem] = useState(() => `Olá! Segue "${card.titulo}" para aprovação.${card.postagem_em ? ` A publicação está prevista para ${new Date(card.postagem_em).toLocaleString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}.` : ''}`)
  const [enviada, setEnviada] = useState<Aprovacao | null>(null)
  const [copiado, setCopiado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const caminhos = imagens.map((i) => i.caminho!).join('|')
  useEffect(() => { void linksArquivos(caminhos ? caminhos.split('|') : []).then(setLinks) }, [caminhos])
  const alternar = (c: string) => setEscolhidas(escolhidas.includes(c) ? escolhidas.filter((x) => x !== c) : [...escolhidas, c])

  async function enviar() {
    if (!cliente) return
    setEnviando(true); setErro(null)
    try { const a = await enviarParaAprovacao(card, cliente.id, { caminhos: escolhidas, mensagem: mensagem.trim() || null, aprovador: aprovador.trim() || null }); setEnviada(a); onEnviado(a) }
    catch (e) { setErro((e as Error).message) }
    setEnviando(false)
  }

  const link = enviada ? linkAprovacao(enviada.token) : ''
  const textoWhats = `${mensagem}\n\nPara aprovar ou pedir ajuste, é só abrir: ${link}`
  return (
    <Janela titulo="Enviar para aprovação" onFechar={onFechar} largura={640}>
      <div className="janela__corpo enviar-aprovacao">
        {!enviada ? (
          <>
            <div>
              <span className="rotulo-campo">Imagens que vão junto</span>
              {imagens.length ? (
                <div className="escolher-imagens">
                  {imagens.map((i) => {
                    const marcada = escolhidas.includes(i.caminho!)
                    return (
                      <button key={i.id} type="button" className={`escolher-imagem${marcada ? ' marcada' : ''}`} aria-pressed={marcada} onClick={() => alternar(i.caminho!)}>
                        {links.get(i.caminho!) && <img src={links.get(i.caminho!)} alt={i.nome} />}
                        {marcada && <span className="escolher-imagem__ordem">{escolhidas.indexOf(i.caminho!) + 1}</span>}
                      </button>
                    )
                  })}
                </div>
              ) : <p className="pequeno">O card não tem imagens anexadas. Anexe as artes no card para quem aprova ver o post (dá para enviar só com a legenda também).</p>}
              {imagens.length > 1 && <span className="pequeno">Toque para tirar ou pôr. O número mostra a ordem do carrossel.</span>}
            </div>
            {!card.legenda && <p className="faixa-dica">O card está sem legenda. Quem aprova costuma querer ver o texto também.</p>}
            <div className="campo"><label htmlFor="ap-para">Para quem (opcional)</label><input id="ap-para" className="entrada" value={aprovador} onChange={(e) => setAprovador(e.target.value)} placeholder="Ex.: Dra. Paula, diretoria" /></div>
            <div className="campo"><label htmlFor="ap-msg">Recado</label><textarea id="ap-msg" className="entrada" rows={3} value={mensagem} onChange={(e) => setMensagem(e.target.value)} /></div>
            <p className="pequeno">O link vale 14 dias e não precisa de conta. Enviar de novo este card invalida o link anterior.</p>
            {erro && <p className="importar__erro">{erro}</p>}
            <div className="linha" style={{ justifyContent: 'flex-end' }}>
              <Botao variante="fantasma" onClick={onFechar}>Cancelar</Botao>
              <Botao icone={<Send size={16} />} disabled={enviando} onClick={() => void enviar()}>{enviando ? 'Gerando…' : 'Gerar link de aprovação'}</Botao>
            </div>
          </>
        ) : (
          <div className="aprovacao-pronta">
            <span className="aprovacao-pronta__ok"><Check size={26} /></span>
            <strong>Link pronto! Agora é só mandar.</strong>
            <code>{link}</code>
            <div className="linha" style={{ justifyContent: 'center' }}>
              <a className="botao botao--whats" href={`https://wa.me/?text=${encodeURIComponent(textoWhats)}`} target="_blank" rel="noreferrer"><MessageCircle size={16} /> Mandar no WhatsApp</a>
              <Botao variante="secundario" icone={copiado ? <Check size={16} /> : <Copy size={16} />} onClick={() => { void navigator.clipboard.writeText(textoWhats); setCopiado(true) }}>{copiado ? 'Copiado' : 'Copiar mensagem'}</Botao>
            </div>
            <span className="pequeno">Quando responderem, aparece no card e em Design › Aprovações. Se aprovarem, o card vai sozinho para "Feito e aprovado".</span>
            <Botao variante="fantasma" onClick={onFechar}>Fechar</Botao>
          </div>
        )}
      </div>
    </Janela>
  )
}
