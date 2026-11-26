import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Download, Lock, MessageCircle, Search, Send, ShieldCheck, Tag } from 'lucide-react'
import { Botao, Chip } from '../../components/ui'
import { useSessao } from '../../lib/sessao'
import {
  ETAPAS_LEAD, SEM_PLANO, listarCampanhas, listarLeads, nomeEtapaLead, podeReceberCampanha, tempoRelativo,
  type Campanha, type EtapaLead, type Lead,
} from '../../lib/campanhas'
import { LeadDetalhe } from './LeadDetalhe'
import { LogoConvenio } from '../../components/Convenio'
import { EnvioEmMassa } from './EnvioEmMassa'
import { Selecao } from '../../components/Selecao'
import { opcaoCampanha } from '../../components/opcoes'
import './campanhas.css'

/** Leads que chegaram pelos QR: funil, segmentos e envio de campanhas. Sigiloso: só quem tem acesso a leads. */
export function Leads() {
  const { cliente, ehAdminCliente } = useSessao()
  const [params, setParams] = useSearchParams()
  const [leads, setLeads] = useState<Lead[] | null>(null)
  const [campanhas, setCampanhas] = useState<Campanha[]>([])
  const [busca, setBusca] = useState('')
  const [etapa, setEtapa] = useState<EtapaLead | ''>('')
  const [segmento, setSegmento] = useState('')
  const [soAceite, setSoAceite] = useState(false)
  const [marcados, setMarcados] = useState<Set<string>>(new Set())
  const [envio, setEnvio] = useState<Lead[] | null>(null)
  const campanhaId = params.get('campanha') ?? ''
  const aberto = params.get('lead')

  const carregar = useCallback(async () => {
    if (!cliente) return
    const [l, c] = await Promise.all([listarLeads(cliente.id), listarCampanhas(cliente.id)])
    setLeads(l); setCampanhas(c.campanhas)
  }, [cliente])
  useEffect(() => { void Promise.resolve().then(carregar) }, [carregar])

  const segmentos = useMemo(() => {
    const m = new Map<string, number>()
    ;(leads ?? []).forEach((l) => l.segmentos.forEach((s) => m.set(s, (m.get(s) ?? 0) + 1)))
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [leads])

  const base = useMemo(() => (leads ?? []).filter((l) =>
    (!busca || `${l.nome} ${l.whatsapp ?? ''} ${l.email ?? ''}`.toLowerCase().includes(busca.toLowerCase())) &&
    (!campanhaId || l.campanha_id === campanhaId) && (!segmento || l.segmentos.includes(segmento)) &&
    (!soAceite || podeReceberCampanha(l))), [leads, busca, campanhaId, segmento, soAceite])
  const filtrados = base.filter((l) => !etapa || l.etapa === etapa)
  const nomeCampanha = (id: string | null) => campanhas.find((c) => c.id === id)?.nome ?? 'Sem campanha'
  const mudarParam = (k: string, v: string) => { const p = new URLSearchParams(params); if (v) p.set(k, v); else p.delete(k); setParams(p, { replace: true }) }

  const todosMarcados = filtrados.length > 0 && filtrados.every((l) => marcados.has(l.id))
  function marcarTodos() {
    const n = new Set(marcados)
    if (todosMarcados) filtrados.forEach((l) => n.delete(l.id)); else filtrados.forEach((l) => n.add(l.id))
    setMarcados(n)
  }
  const selecionados = (leads ?? []).filter((l) => marcados.has(l.id))
  const alvoEnvio = selecionados.length ? selecionados : filtrados

  function exportar() {
    const linhas = [['Nome', 'WhatsApp', 'E-mail', 'Etapa', 'Campanha', 'Segmentos', 'Aceita campanhas', 'Chegou em'],
      ...alvoEnvio.map((l) => [l.nome, l.whatsapp ?? '', l.email ?? '', nomeEtapaLead(l.etapa), nomeCampanha(l.campanha_id), l.segmentos.join(' | '), podeReceberCampanha(l) ? 'Sim' : 'Não', new Date(l.criado_em).toLocaleString('pt-BR')])]
    const csv = linhas.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' })); a.download = 'leads.csv'; a.click()
  }

  return (
    <>
      <div className="funil funil--leads" role="group" aria-label="Filtrar por etapa">
        {ETAPAS_LEAD.map((x) => (
          <button key={x.id} type="button" className={`funil__etapa${etapa === x.id ? ' marcada' : ''}`} aria-pressed={etapa === x.id}
            style={{ '--cor': x.cor } as React.CSSProperties} onClick={() => setEtapa(etapa === x.id ? '' : x.id)}>
            <strong>{base.filter((l) => l.etapa === x.id).length}</strong><span>{x.nome}</span>
          </button>
        ))}
      </div>

      <div className="filtros">
        <label className="busca busca-local" style={{ width: 'auto' }}>
          <Search size={16} aria-hidden />
          <input aria-label="Buscar lead" placeholder="Buscar por nome, WhatsApp ou e-mail" value={busca} onChange={(e) => setBusca(e.target.value)} style={{ border: 0, outline: 0, background: 'none', flex: 1 }} />
        </label>
        <Selecao rotulo="Campanha" valor={campanhaId} onMudar={(v) => mudarParam('campanha', v)} largura={260}
          opcoes={[{ valor: '', rotulo: 'Todas as campanhas' }, ...campanhas.map(opcaoCampanha)]} />
        <button type="button" className={`opcao${soAceite ? ' marcada' : ''}`} aria-pressed={soAceite} onClick={() => setSoAceite(!soAceite)}>Só quem aceita campanhas</button>
      </div>

      {segmentos.length > 0 && (
        <div className="linha segmentos-lista" role="group" aria-label="Segmentos">
          <span className="rotulo"><Tag size={12} /> Segmentos</span>
          {segmentos.map(([s, n]) => (
            <button key={s} type="button" className={`opcao opcao--mini${segmento === s ? ' marcada' : ''}`} aria-pressed={segmento === s} onClick={() => setSegmento(segmento === s ? '' : s)}>{s} · {n}</button>
          ))}
        </div>
      )}

      <div className="barra-acoes">
        <label className="linha pequeno" style={{ gap: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={todosMarcados} onChange={marcarTodos} style={{ accentColor: 'var(--marca)', width: 16, height: 16 }} />
          {marcados.size ? `${marcados.size} selecionados` : `${filtrados.length} leads`}
        </label>
        {marcados.size > 0 && <button type="button" className="botao botao--fantasma botao--mini" onClick={() => setMarcados(new Set())}>Limpar seleção</button>}
        <span style={{ flex: 1 }} />
        {ehAdminCliente && <Botao variante="secundario" icone={<Download size={15} />} onClick={exportar} disabled={!alvoEnvio.length}>Exportar</Botao>}
        <Botao icone={<Send size={15} />} onClick={() => setEnvio(alvoEnvio)} disabled={!alvoEnvio.length}>
          Enviar campanha para {marcados.size ? 'selecionados' : segmento ? `"${segmento}"` : 'esta lista'}
        </Botao>
      </div>

      <div className="tabela-leads">
        {leads === null && <div className="vazio">Carregando…</div>}
        {leads?.length === 0 && <div className="vazio">Nenhum lead ainda. Os leads chegam quando alguém preenche o formulário de um QR. <Link to="/eventos/campanhas">Ver campanhas</Link></div>}
        {leads && leads.length > 0 && filtrados.length === 0 && <div className="vazio">Nenhum lead com esses filtros.</div>}
        {filtrados.map((l) => {
          const et = ETAPAS_LEAD.find((x) => x.id === l.etapa)!
          return (
            <div key={l.id} className={`linha-lead${marcados.has(l.id) ? ' marcada' : ''}`} role="button" tabIndex={0}
              onClick={() => mudarParam('lead', l.id)} onKeyDown={(e) => { if (e.key === 'Enter') mudarParam('lead', l.id) }}>
              <input type="checkbox" aria-label={`Selecionar ${l.nome}`} checked={marcados.has(l.id)} onClick={(e) => e.stopPropagation()}
                onChange={() => { const n = new Set(marcados); if (n.has(l.id)) n.delete(l.id); else n.add(l.id); setMarcados(n) }} />
              <span className="linha-lead__nome">
                <strong>{l.nome}</strong>
                <span className="pequeno">{l.dados.convenio && l.dados.convenio !== SEM_PLANO && <span className="lead-plano" title={l.dados.convenio}><LogoConvenio nome={l.dados.convenio} tamanho={14} /></span>}{l.whatsapp ?? l.email ?? 'sem contato'}{!podeReceberCampanha(l) && <span title="Não aceitou receber campanhas"> · <Lock size={11} style={{ verticalAlign: -1 }} /> só contato</span>}</span>
              </span>
              <span className="pequeno corta">{nomeCampanha(l.campanha_id)}</span>
              <span className="chips">{l.segmentos.map((s) => <Chip key={s} tom="alerta">{s}</Chip>)}</span>
              <span className="etapa-lead" style={{ '--cor': et.cor } as React.CSSProperties}>{et.nome}</span>
              <span className="pequeno">{tempoRelativo(l.criado_em)}</span>
              {l.whatsapp && <a className="icone-botao" style={{ width: 34, height: 34 }} title="Abrir ficha para chamar no WhatsApp" aria-label={`Chamar ${l.nome}`}
                href={`?lead=${l.id}`} onClick={(e) => { e.preventDefault(); e.stopPropagation(); mudarParam('lead', l.id) }}><MessageCircle size={15} /></a>}
            </div>
          )
        })}
      </div>
      <p className="pequeno linha" style={{ gap: 6 }}><ShieldCheck size={14} /> Dados sigilosos. Só quem tem acesso a leads vê esta lista, e cada ficha aberta fica registrada.</p>

      {aberto && <LeadDetalhe id={aberto} campanhas={campanhas} podeExcluir={ehAdminCliente} onFechar={() => mudarParam('lead', '')} onMudou={carregar} />}
      {envio && <EnvioEmMassa leads={envio} rotulo={segmento || (campanhaId ? nomeCampanha(campanhaId) : '')} onFechar={() => setEnvio(null)} onEnviado={carregar} />}
    </>
  )
}
