import { useCallback, useEffect, useState } from 'react'
import { CalendarCheck, Eye, Mail, MessageCircle, Phone, Send, ShieldCheck, Trash2, UserX } from 'lucide-react'
import { Botao, Chip } from '../../components/ui'
import { Janela } from '../../components/Janela'
import { ChipConvenio } from '../../components/Convenio'
import { useSessao } from '../../lib/sessao'
import {
  ETAPAS_LEAD, MOTIVOS_PERDA, SEM_PLANO, abrirLead, excluirLead, nomeEtapaLead, numeroWhats, registrarEventoLead, salvarLead, tempoRelativo,
  type Campanha, type EtapaLead, type EventoLead, type Lead,
} from '../../lib/campanhas'

const DESCRICAO: Record<string, (d: EventoLead['detalhe']) => string> = {
  criado: () => 'Preencheu o formulário do QR',
  aberto: () => 'Abriu a ficha',
  etapa: (d) => `Mudou de ${nomeEtapaLead(d.de as EtapaLead)} para ${nomeEtapaLead(d.para as EtapaLead)}${d.motivo && d.para === 'perdido' ? ` (${d.motivo})` : ''}`,
  whatsapp: () => 'Chamou no WhatsApp',
  ligacao: () => 'Ligou',
  email: () => 'Mandou e-mail',
  campanha: (d) => `Recebeu campanha por ${d.canal === 'email' ? 'e-mail' : 'WhatsApp'}${d.titulo ? `: ${d.titulo}` : ''}`,
  descadastro: () => 'Pediu para não receber mais campanhas',
}
const ehPlano = (chave: string) => /convenio|plano/.test(chave)
const ICONE: Record<string, React.ElementType> = { aberto: Eye, whatsapp: MessageCircle, ligacao: Phone, email: Mail, campanha: Send, descadastro: UserX, etapa: CalendarCheck }

/** Ficha do lead. Abrir registra o acesso. Ações de um toque: WhatsApp, ligar, mudar etapa. */
export function LeadDetalhe({ id, campanhas, podeExcluir, onFechar, onMudou }: {
  id: string; campanhas: Campanha[]; podeExcluir: boolean; onFechar: () => void; onMudou: () => Promise<void>
}) {
  const { cliente } = useSessao()
  const [dados, setDados] = useState<{ lead: Lead | null; eventos: EventoLead[] } | null>(null)
  const [perdendo, setPerdendo] = useState(false)
  const [motivo, setMotivo] = useState('')

  const carregar = useCallback(async () => setDados(await abrirLead(id)), [id])
  useEffect(() => { void Promise.resolve().then(carregar) }, [carregar])

  if (!dados) return <Janela titulo="Lead" onFechar={onFechar} largura={720}><div className="janela__corpo"><p className="pequeno">Abrindo…</p></div></Janela>
  const { lead, eventos } = dados
  if (!lead) return <Janela titulo="Lead" onFechar={onFechar} largura={720}><div className="janela__corpo"><p className="texto-2">Lead não encontrado.</p></div></Janela>

  const campanha = campanhas.find((c) => c.id === lead.campanha_id)
  const rotulo = (chave: string) => campanha?.formulario.find((f) => f.chave === chave)?.rotulo ?? chave
  const primeiroNome = lead.nome.split(' ')[0]
  const msgWhats = `Oi, ${primeiroNome}! Aqui é do ${cliente?.nome ?? 'hospital'}. Recebemos seu cadastro${campanha?.titulo_publico || campanha?.nome ? ` na campanha ${campanha.titulo_publico || campanha.nome}` : ''}. Podemos conversar?`

  async function mudar(d: Parameters<typeof salvarLead>[1]) { await salvarLead(lead!.id, d); await carregar(); await onMudou() }
  async function registrar(tipo: string) {
    await registrarEventoLead([lead!.id], tipo)
    if (lead!.etapa === 'novo') await salvarLead(lead!.id, { etapa: 'em_contato' })
    await carregar(); await onMudou()
  }

  return (
    <Janela titulo="Ficha do lead" onFechar={onFechar} largura={760}>
      <div className="janela__corpo ficha-lead">
        <div className="ficha-lead__topo">
          <div>
            <h2>{lead.nome}</h2>
            <p className="pequeno">Chegou {tempoRelativo(lead.criado_em)} · {campanha?.nome ?? 'Campanha excluída'}</p>
            {lead.segmentos.length > 0 && <div className="linha" style={{ gap: 6, marginTop: 6 }}>{lead.segmentos.map((s) => <Chip key={s} tom="alerta">{s}</Chip>)}</div>}
          </div>
          <div className="linha" style={{ gap: 8 }}>
            {lead.whatsapp && <a className="botao botao--whats" href={`https://wa.me/${numeroWhats(lead.whatsapp)}?text=${encodeURIComponent(msgWhats)}`} target="_blank" rel="noreferrer" onClick={() => void registrar('whatsapp')}><MessageCircle size={16} /> WhatsApp</a>}
            {lead.whatsapp && <a className="botao botao--secundario" href={`tel:${lead.whatsapp.replace(/\D/g, '')}`} onClick={() => void registrar('ligacao')}><Phone size={16} /> Ligar</a>}
            {lead.email && <a className="botao botao--secundario" href={`mailto:${lead.email}`} onClick={() => void registrar('email')}><Mail size={16} /></a>}
          </div>
        </div>

        <div className="etapas-lead" role="radiogroup" aria-label="Etapa do lead">
          {ETAPAS_LEAD.map((x) => (
            <button key={x.id} type="button" role="radio" aria-checked={lead.etapa === x.id} style={{ '--cor': x.cor } as React.CSSProperties}
              className={`etapas-lead__item${lead.etapa === x.id ? ' marcado' : ''}`}
              onClick={() => { if (x.id === 'perdido') setPerdendo(true); else if (x.id !== lead.etapa) void mudar({ etapa: x.id, motivo_perda: null }) }}>
              {x.nome}
            </button>
          ))}
        </div>
        {perdendo && (
          <div className="sugestao" style={{ flexWrap: 'wrap', background: 'rgb(229 72 77 / .08)', color: 'var(--texto)' }}>
            <span style={{ flex: '1 0 100%' }}><strong>Por que perdeu?</strong></span>
            {MOTIVOS_PERDA.map((m) => <button key={m} type="button" className={`opcao opcao--mini${motivo === m ? ' marcada' : ''}`} onClick={() => setMotivo(m)}>{m}</button>)}
            <input className="entrada entrada--mini" style={{ flex: 1, minWidth: 160 }} placeholder="Outro motivo" value={MOTIVOS_PERDA.includes(motivo) ? '' : motivo} onChange={(e) => setMotivo(e.target.value)} />
            <button type="button" className="botao botao--perigo botao--mini" disabled={motivo.trim().length < 3} onClick={() => { void mudar({ etapa: 'perdido', motivo_perda: motivo.trim() }); setPerdendo(false) }}>Marcar como perdido</button>
            <button type="button" className="botao botao--fantasma botao--mini" onClick={() => setPerdendo(false)}>Cancelar</button>
          </div>
        )}
        {lead.etapa === 'perdido' && lead.motivo_perda && <p className="pequeno">Motivo: {lead.motivo_perda}</p>}

        <div className="ficha-lead__grade">
          <section>
            <h4>Respostas</h4>
            <dl className="respostas">
              {lead.whatsapp && <><dt>WhatsApp</dt><dd>{lead.whatsapp}</dd></>}
              {lead.email && <><dt>E-mail</dt><dd>{lead.email}</dd></>}
              {Object.entries(lead.dados).map(([k, v]) => <div key={k} style={{ display: 'contents' }}><dt>{rotulo(k)}</dt><dd>{ehPlano(k) && v !== SEM_PLANO ? <ChipConvenio nome={v} /> : v}</dd></div>)}
            </dl>
            <h4 style={{ marginTop: 16 }}>Consentimento (LGPD)</h4>
            <p className="pequeno linha" style={{ gap: 6 }}><ShieldCheck size={14} style={{ color: 'var(--sucesso)' }} /> Aceitou contato em {new Date(lead.aceite_contato_em).toLocaleString('pt-BR')}</p>
            {lead.descadastrado_em
              ? <p className="pequeno linha" style={{ gap: 6, color: 'var(--perigo)' }}><UserX size={14} /> Pediu para sair das campanhas em {new Date(lead.descadastrado_em).toLocaleDateString('pt-BR')}</p>
              : lead.aceite_campanhas_em
                ? <p className="pequeno linha" style={{ gap: 6 }}><ShieldCheck size={14} style={{ color: 'var(--sucesso)' }} /> Aceitou receber campanhas</p>
                : <p className="pequeno linha" style={{ gap: 6 }}>Não aceitou receber campanhas: só pode ser contatado sobre esta solicitação</p>}
            {lead.aceite_campanhas_em && !lead.descadastrado_em && (
              <button type="button" className="botao botao--fantasma botao--mini" style={{ paddingLeft: 0 }}
                onClick={() => void registrarEventoLead([lead.id], 'descadastro').then(() => mudar({ descadastrado_em: new Date().toISOString() }))}>
                <UserX size={14} /> Pediu para não receber mais campanhas
              </button>
            )}
          </section>
          <section>
            <h4>Histórico</h4>
            <ol className="historico-lead">
              {eventos.map((e) => {
                const Icone = ICONE[e.tipo] ?? Send
                return (
                  <li key={e.id}>
                    <span className="historico-lead__icone"><Icone size={13} /></span>
                    <span><span style={{ display: 'block' }}>{(DESCRICAO[e.tipo] ?? (() => e.tipo))(e.detalhe)}</span>
                      <span className="pequeno">{tempoRelativo(e.criado_em)}{e.autor ? ` · ${e.autor}` : ''}</span></span>
                  </li>
                )
              })}
            </ol>
          </section>
        </div>

        {podeExcluir && (
          <Botao variante="fantasma" style={{ color: 'var(--perigo)', alignSelf: 'flex-start' }} icone={<Trash2 size={15} />}
            onClick={() => { if (confirm(`Excluir os dados de ${lead.nome}? Use quando a pessoa pedir a exclusão (LGPD). Não pode ser desfeito.`)) void excluirLead(lead.id).then(onMudou).then(onFechar) }}>
            Excluir dados a pedido da pessoa
          </Botao>
        )}
      </div>
    </Janela>
  )
}
