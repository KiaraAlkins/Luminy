import { useState } from 'react'
import { Building2 } from 'lucide-react'
import { Selecao, type Opcao } from './Selecao'
import type { Empresa } from '../lib/parcerias'

const CORES = ['#3D2EF9', '#2E90FA', '#12A15F', '#E8890C', '#D6297A', '#7A5AF8', '#0E9384']

/** Foto da empresa (logo ou fachada); sem foto, mostra as iniciais. */
export function FotoEmpresa({ empresa, tamanho = 36 }: { empresa: Pick<Empresa, 'nome' | 'foto_url'>; tamanho?: number }) {
  const [falhou, setFalhou] = useState(false)
  const iniciais = empresa.nome.split(/\s+/).filter((p) => p.length > 2 || /^[A-Z]/.test(p)).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('') || empresa.nome[0]?.toUpperCase()
  const cor = CORES[[...empresa.nome].reduce((s, c) => s + c.charCodeAt(0), 0) % CORES.length]
  const estilo = { width: tamanho, height: tamanho, borderRadius: Math.round(tamanho * 0.28) }
  if (empresa.foto_url && !falhou) {
    return <img className="foto-empresa" src={empresa.foto_url} alt="" style={estilo} loading="lazy" onError={() => setFalhou(true)} />
  }
  return <span className="foto-empresa foto-empresa--iniciais" aria-hidden style={{ ...estilo, background: cor, fontSize: Math.max(10, tamanho * 0.36) }}>{iniciais}</span>
}

/** Escolher empresa vendo a foto, o nome, o segmento e os planos (em vez de uma lista só de texto). */
export function SeletorEmpresa({ empresas, valor, onMudar, semEmpresa = 'Nenhuma empresa', id }: {
  empresas: Empresa[]; valor: string; onMudar: (id: string) => void; semEmpresa?: string; id?: string
}) {
  const opcoes: Opcao[] = [
    { valor: '', rotulo: semEmpresa, icone: <span className="seletor-empresa__vazio"><Building2 size={15} /></span> },
    ...empresas.map((e) => ({
      valor: e.id, rotulo: e.nome, icone: <FotoEmpresa empresa={e} tamanho={30} />,
      descricao: [e.segmento, e.convenios.join(' / ')].filter(Boolean).join(' · ') || undefined,
    })),
  ]
  return <Selecao id={id} valor={valor} onMudar={onMudar} opcoes={opcoes} busca={empresas.length > 5} />
}
