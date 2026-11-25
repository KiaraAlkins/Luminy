import { useState } from 'react'
import { Check, Copy, Mail, MessageCircle, SkipForward } from 'lucide-react'
import { Botao } from '../../components/ui'
import { Janela } from '../../components/Janela'
import { useSessao } from '../../lib/sessao'
import { numeroWhats, podeReceberCampanha, registrarEventoLead, type Lead } from '../../lib/campanhas'

type Canal = 'whatsapp' | 'email'
const preencher = (msg: string, l: Lead) => msg.replace(/\{nome\}/g, l.nome.split(' ')[0])

/**
 * Envio de campanha para um grupo (ex.: segmento "Risco de diabetes").
 * Só entra quem aceitou receber campanhas e não pediu para sair (LGPD).
 * WhatsApp: abre cada conversa com a mensagem pronta, em fila; é só apertar enviar.
 * E-mail: abre o e-mail com todos em cópia oculta.
 */
export function EnvioEmMassa({ leads, rotulo, onFechar, onEnviado }: { leads: Lead[]; rotulo: string; onFechar: () => void; onEnviado: () => Promise<void> }) {
  const { cliente } = useSessao()
  const [canal, setCanal] = useState<Canal>('whatsapp')
  const [titulo, setTitulo] = useState(rotulo ? `Campanha ${rotulo}` : '')
  const [msg, setMsg] = useState(`Oi, {nome}! Aqui é do ${cliente?.nome ?? 'hospital'}. `)
  const [fila, setFila] = useState<number | null>(null)
  const [enviados, setEnviados] = useState<Set<string>>(new Set())
  const [copiado, setCopiado] = useState(false)

  const aptos = leads.filter(podeReceberCampanha)
  const comCanal = aptos.filter((l) => (canal === 'whatsapp' ? !!l.whatsapp : !!l.email))
  const foraLgpd = leads.length - aptos.length
  const semCanal = aptos.length - comCanal.length
  const exemplo = comCanal[0]
  const registrar = (ids: string[]) => registrarEventoLead(ids, 'campanha', { canal, titulo: titulo.trim(), mensagem: msg.slice(0, 500) })

  function abrirWhats(i: number) {
    const l = comCanal[i]
    window.open(`https://wa.me/${numeroWhats(l.whatsapp)}?text=${encodeURIComponent(preencher(msg, l))}`, '_blank', 'noreferrer')
    void registrar([l.id])
    setEnviados((s) => new Set(s).add(l.id))
    setFila(i + 1 < comCanal.length ? i + 1 : comCanal.length)
  }

  async function abrirEmail() {
    const bcc = comCanal.map((l) => l.email).join(',')
    const corpo = msg.replace(/\{nome\}/g, '').replace(/^Oi, !\s*/, 'Olá! ')
    const a = document.createElement('a'); a.href = `mailto:?bcc=${encodeURIComponent(bcc)}&subject=${encodeURIComponent(titulo)}&body=${encodeURIComponent(corpo)}`; a.click()
    await registrar(comCanal.map((l) => l.id)); await onEnviado(); onFechar()
  }

  const atual = fila !== null && fila < comCanal.length ? comCanal[fila] : null
  return (
    <Janela titulo="Enviar campanha" onFechar={() => { void onEnviado(); onFechar() }} largura={640}>
      <div className="janela__corpo">
        <div className="envio-resumo">
          <strong>{comCanal.length}</strong>
          <span>{comCanal.length === 1 ? 'pessoa vai receber' : 'pessoas vão receber'}{rotulo ? <> · <em>{rotulo}</em></> : ''}</span>
        </div>
        {(foraLgpd > 0 || semCanal > 0) && (
          <p className="pequeno">
            {foraLgpd > 0 && <>{foraLgpd} {foraLgpd === 1 ? 'fica' : 'ficam'} de fora porque não {foraLgpd === 1 ? 'aceitou' : 'aceitaram'} receber campanhas ou pediu para sair (LGPD). </>}
            {semCanal > 0 && <>{semCanal} sem {canal === 'whatsapp' ? 'WhatsApp' : 'e-mail'} cadastrado.</>}
          </p>
        )}

        {fila === null ? (
          <>
            <div className="segmentos" role="radiogroup" aria-label="Canal">
              <button type="button" role="radio" aria-checked={canal === 'whatsapp'} className={canal === 'whatsapp' ? 'marcado' : ''} onClick={() => setCanal('whatsapp')}><MessageCircle size={14} /> WhatsApp</button>
              <button type="button" role="radio" aria-checked={canal === 'email'} className={canal === 'email' ? 'marcado' : ''} onClick={() => setCanal('email')}><Mail size={14} /> E-mail</button>
            </div>
            <div className="campo"><label htmlFor="env-tit">{canal === 'email' ? 'Assunto' : 'Nome do envio (para o histórico)'}</label>
              <input id="env-tit" className="entrada" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Convite para o mutirão de glicemia" /></div>
            <div className="campo">
              <label htmlFor="env-msg">Mensagem</label>
              <textarea id="env-msg" className="entrada" rows={5} value={msg} onChange={(e) => setMsg(e.target.value)} />
              {canal === 'whatsapp' && <button type="button" className="opcao opcao--mini" style={{ alignSelf: 'flex-start' }} onClick={() => setMsg(msg + '{nome}')}>+ {'{nome}'} primeiro nome da pessoa</button>}
            </div>
            {exemplo && canal === 'whatsapp' && <div className="balao"><span className="rotulo">Como {exemplo.nome.split(' ')[0]} vai ver</span><p>{preencher(msg, exemplo)}</p></div>}
            <p className="pequeno">
              {canal === 'whatsapp'
                ? 'O Luminy abre a conversa de cada pessoa com a mensagem pronta, uma por vez: você só aperta enviar no WhatsApp. O envio 100% automático precisa da API oficial do WhatsApp (Meta), que dá para ligar depois.'
                : 'Abre seu e-mail com todos em cópia oculta (ninguém vê o e-mail dos outros). Para listas grandes, use "Copiar e-mails".'}
            </p>
            <div className="linha" style={{ justifyContent: 'flex-end' }}>
              {canal === 'email' && <Botao variante="secundario" icone={copiado ? <Check size={15} /> : <Copy size={15} />} disabled={!comCanal.length}
                onClick={() => { void navigator.clipboard.writeText(comCanal.map((l) => l.email).join(', ')); setCopiado(true); void registrar(comCanal.map((l) => l.id)) }}>{copiado ? 'Copiados' : 'Copiar e-mails'}</Botao>}
              <Botao disabled={!comCanal.length || !msg.trim() || (canal === 'email' && !titulo.trim())}
                onClick={() => (canal === 'whatsapp' ? setFila(0) : void abrirEmail())}>
                {canal === 'whatsapp' ? 'Começar envio' : 'Abrir no e-mail'}
              </Botao>
            </div>
          </>
        ) : (
          <div className="fila">
            <div className="fila__barra"><span style={{ width: `${(enviados.size / comCanal.length) * 100}%` }} /></div>
            <p className="pequeno">{enviados.size} de {comCanal.length} enviados</p>
            {atual ? (
              <div className="fila__atual" key={atual.id}>
                <span className="rotulo">Próximo</span>
                <strong>{atual.nome}</strong>
                <span className="pequeno">{atual.whatsapp}</span>
                <div className="linha" style={{ justifyContent: 'center', marginTop: 8 }}>
                  <button type="button" className="botao botao--whats" onClick={() => abrirWhats(fila!)}><MessageCircle size={16} /> Abrir WhatsApp de {atual.nome.split(' ')[0]}</button>
                  <button type="button" className="botao botao--fantasma" onClick={() => setFila(fila! + 1)}><SkipForward size={15} /> Pular</button>
                </div>
              </div>
            ) : (
              <div className="fila__atual">
                <Check size={32} style={{ color: 'var(--sucesso)' }} />
                <strong>Pronto! {enviados.size} {enviados.size === 1 ? 'conversa aberta' : 'conversas abertas'}.</strong>
                <span className="pequeno">Ficou registrado no histórico de cada lead.</span>
                <Botao onClick={() => { void onEnviado(); onFechar() }}>Fechar</Botao>
              </div>
            )}
          </div>
        )}
      </div>
    </Janela>
  )
}
