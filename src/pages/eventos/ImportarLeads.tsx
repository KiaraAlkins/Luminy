import { Chip } from '../../components/ui'
import { ImportarPlanilha, type Conversao } from '../../components/Planilha'
import { normalizar, simNao, textoDe } from '../../lib/planilhas'
import { ETAPAS_LEAD, importarLeads, nomeEtapaLead, type EtapaLead, type LeadImportado } from '../../lib/campanhas'
import { MODELO_LEADS } from '../../lib/modelos'
import { useSessao } from '../../lib/sessao'

const SINONIMOS: Record<string, string[]> = {
  nome: ['nome', 'nome completo', 'paciente', 'cliente', 'lead'],
  whatsapp: ['whatsapp', 'whats', 'zap', 'celular', 'telefone', 'fone', 'contato'],
  email: ['email', 'e mail'],
  convenio: ['plano de saude', 'plano', 'convenio'],
  segmentos: ['segmentos', 'segmento', 'etiquetas', 'tags', 'grupo'],
  aceita: ['aceita campanhas', 'aceita receber', 'recebe campanhas', 'autoriza campanhas', 'campanhas'],
  etapa: ['etapa', 'situacao', 'status', 'fase'],
}


function converter(l: (string | number | Date | null | undefined)[], m: Record<string, number>, cab: unknown[]): Conversao<LeadImportado> {
  const v = (c: string) => (m[c] === undefined ? '' : textoDe(l[m[c]]).trim())
  const nome = v('nome')
  const whatsapp = v('whatsapp') || null
  const email = v('email').toLowerCase() || null
  if (!nome) return { ok: false, erro: 'sem nome' }
  if (!whatsapp && !email) return { ok: false, erro: `${nome} está sem WhatsApp e sem e-mail` }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, erro: `e-mail inválido (${email})` }
  const etapaTxt = normalizar(v('etapa'))
  const etapa = (ETAPAS_LEAD.find((e) => normalizar(e.nome) === etapaTxt || e.id === etapaTxt.replace(/ /g, '_'))?.id ?? null) as EtapaLead | null
  // Colunas que não são campos conhecidos entram como respostas extras do lead
  const usados = new Set(Object.values(m))
  const dados: Record<string, string> = {}
  if (v('convenio')) dados.convenio = v('convenio')
  cab.forEach((c, i) => { const t = textoDe(l[i]).trim(); if (!usados.has(i) && t && textoDe(c as never).trim()) dados[normalizar(textoDe(c as never)).replace(/ /g, '_')] = t })
  return {
    ok: true,
    item: { nome, whatsapp, email, dados, segmentos: v('segmentos').split(/[;,|]/).map((s) => s.trim()).filter(Boolean), aceita_campanhas: simNao(v('aceita')), etapa },
  }
}

/** Importar leads de planilha (só administradores). Pede a confirmação da LGPD. */
export function ImportarLeads({ onFechar, onImportado }: { onFechar: () => void; onImportado: () => Promise<void> }) {
  const { cliente } = useSessao()
  return (
    <ImportarPlanilha<LeadImportado>
      titulo="Importar leads de planilha" nome="leads" modelo={MODELO_LEADS}
      sinonimos={SINONIMOS} obrigatorias={['nome']} converter={converter}
      previa={[
        { rotulo: 'Nome', valor: (l) => l.nome },
        { rotulo: 'Contato', valor: (l) => l.whatsapp ?? l.email },
        { rotulo: 'Plano', valor: (l) => l.dados.convenio ?? '—' },
        { rotulo: 'Segmentos', valor: (l) => l.segmentos.map((s) => <Chip key={s} tom="alerta">{s}</Chip>) },
        { rotulo: 'Campanhas', valor: (l) => (l.aceita_campanhas ? 'Aceita' : 'Só contato') },
        { rotulo: 'Etapa', valor: (l) => nomeEtapaLead(l.etapa ?? 'novo') },
      ]}
      aviso={<p className="faixa-dica">Colunas reconhecidas: Nome, WhatsApp (ou Celular/Telefone), E-mail, Plano de saúde, Segmentos, Aceita campanhas e Etapa. As outras colunas entram como respostas extras.</p>}
      confirmacao="Confirmo que essas pessoas autorizaram o contato do hospital, e que só marquei “Aceita campanhas” para quem aceitou receber campanhas (LGPD)."
      enviar={async (itens, origem) => {
        const r = await importarLeads(cliente!.id, itens, origem)
        await onImportado()
        return `${r.inseridos} ${r.inseridos === 1 ? 'lead importado' : 'leads importados'}${r.repetidos ? ` · ${r.repetidos} já existiam (mesmo WhatsApp ou e-mail) e ficaram de fora` : ''}${r.invalidos ? ` · ${r.invalidos} sem dados suficientes` : ''}.`
      }}
      onFechar={onFechar} />
  )
}
