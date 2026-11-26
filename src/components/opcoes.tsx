import {
  AtSign, Battery, CalendarDays, Calendar, Camera, CircleDot, Clapperboard, FileText, GalleryHorizontal, Gift, Hash, HeartPulse,
  Image, ListChecks, Megaphone, Package, Phone, QrCode, Shapes, ShieldCheck, Smartphone, SprayCan, ToggleLeft, Type, User, Video,
} from 'lucide-react'
import type { Opcao } from './Selecao'

const ic = (I: React.ElementType, cor = 'var(--marca)') => <span className="selecao__icone" style={{ color: cor }}><I size={16} /></span>

/** Tipos de conteúdo do Kanban, cada um com seu ícone e cor (as mesmas cores das etiquetas dos cards). */
export const COR_TIPO: Record<string, string> = {
  Post: '#3D2EF9', Carrossel: '#7A5AF8', Story: '#D6297A', Reels: '#E5484D', Vídeo: '#E8890C', Campanha: '#12A15F', Cobertura: '#2E90FA', Outro: '#667085',
}
const ICONE_TIPO: Record<string, React.ElementType> = {
  Post: Image, Carrossel: GalleryHorizontal, Story: Smartphone, Reels: Clapperboard, Vídeo: Video, Campanha: Megaphone, Cobertura: Camera, Outro: Shapes,
}
export const iconeTipo = (t: string, tamanho = 14) => { const I = ICONE_TIPO[t] ?? Shapes; return <I size={tamanho} /> }
export const opcoesTipoConteudo = (tipos: string[]): Opcao[] => [
  { valor: '', rotulo: 'Sem tipo', icone: ic(CircleDot, 'var(--texto-3)') },
  ...tipos.map((t) => ({ valor: t, rotulo: t, icone: ic(ICONE_TIPO[t] ?? Shapes, COR_TIPO[t]) })),
]

export const OPCOES_PRIORIDADE: Opcao[] = [
  { valor: 'alta', rotulo: 'Alta', descricao: 'Passa na frente', cor: 'var(--perigo)' },
  { valor: 'comum', rotulo: 'Comum', cor: 'var(--info)' },
  { valor: 'baixa', rotulo: 'Baixa', descricao: 'Quando der tempo', cor: 'var(--texto-3)' },
]

const ICONE_CATEGORIA: Record<string, [React.ElementType, string]> = {
  Brindes: [Gift, '#D6297A'], Saúde: [HeartPulse, '#E5484D'], Papelaria: [FileText, '#2E90FA'], Eletrônicos: [Battery, '#12A15F'],
  Limpeza: [SprayCan, '#0E9384'], Outros: [Package, '#667085'],
}
export const opcoesCategoria = (cats: string[], vazio?: string): Opcao[] => [
  ...(vazio !== undefined ? [{ valor: '', rotulo: vazio, icone: ic(Package, 'var(--texto-3)') }] : []),
  ...cats.map((c) => { const [I, cor] = ICONE_CATEGORIA[c] ?? [Package, '#667085']; return { valor: c, rotulo: c, icone: ic(I, cor) } }),
]
const NOME_UNIDADE: Record<string, string> = { un: 'Unidade', caixa: 'Caixa', pacote: 'Pacote', par: 'Par', rolo: 'Rolo', resma: 'Resma (500 folhas)', kit: 'Kit' }
export const opcoesUnidade = (us: string[]): Opcao[] => us.map((u) => ({ valor: u, rotulo: NOME_UNIDADE[u] ?? u, descricao: u !== (NOME_UNIDADE[u] ?? u).toLowerCase() ? u : undefined }))

const ICONE_CAMPO: Record<string, React.ElementType> = {
  texto: Type, telefone: Phone, email: AtSign, numero: Hash, data: Calendar, escolha: ListChecks, sim_nao: ToggleLeft, convenio: HeartPulse,
}
export const opcoesTipoCampo = (tipos: { id: string; nome: string }[]): Opcao[] => tipos.map((t) => ({ valor: t.id, rotulo: t.nome, icone: ic(ICONE_CAMPO[t.id] ?? Type) }))

export const opcaoEvento = (v: { id: string; nome: string; data: string }, dataBr: (d: string) => string): Opcao =>
  ({ valor: v.id, rotulo: v.nome, descricao: dataBr(v.data), icone: ic(CalendarDays, 'var(--info)') })
export const opcaoCampanha = (c: { id: string; nome: string; situacao: string }): Opcao =>
  ({ valor: c.id, rotulo: c.nome, descricao: c.situacao === 'ativa' ? 'Ativa' : c.situacao === 'rascunho' ? 'Rascunho' : 'Encerrada', icone: ic(QrCode, c.situacao === 'ativa' ? 'var(--sucesso)' : 'var(--texto-3)') })

export const OPCOES_PAPEL: Opcao[] = [
  { valor: 'membro', rotulo: 'Membro', descricao: 'Usa o dia a dia: tarefas, Kanban, eventos', icone: ic(User) },
  { valor: 'admin', rotulo: 'Administrador', descricao: 'Também convida pessoas e vê Negócios', icone: ic(ShieldCheck, 'var(--sucesso)') },
]
