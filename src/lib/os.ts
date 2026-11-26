import { supabase } from './supabase'
import type { Prioridade } from './kanban'

export type SituacaoOS = 'aberta' | 'em_andamento' | 'aguardando' | 'concluida' | 'cancelada'
export type TipoFoto = 'local' | 'referencia' | 'resultado'
export type FotoOS = { id: string; caminho: string; tipo: TipoFoto; nome: string; criado_em: string }
export type LinkOS = { id: string; url: string; nome: string }
export type OS = {
  id: string; cliente_id: string; numero: string; titulo: string; descricao: string | null; solicitante: string | null; contato: string | null
  setor: string | null; local: string | null; tipo: string | null; pedido_em: string; prazo: string | null; prioridade: Prioridade
  situacao: SituacaoOS; motivo: string | null; responsavel_id: string | null; fotos: FotoOS[]; links: LinkOS[]
  custo: number | null; fornecedor: string | null; concluida_em: string | null; criado_por: string; criado_em: string; atualizado_em: string
}
export type EventoOS = { id: number; os_id: string; autor_id: string | null; tipo: 'comentario' | 'situacao' | 'criada' | 'material'; texto: string | null; detalhe: Record<string, string | number | null>; criado_em: string; autor?: string }

export const SITUACOES_OS: { id: SituacaoOS; nome: string; cor: string; motivo?: boolean }[] = [
  { id: 'aberta', nome: 'Aberta', cor: 'var(--info)' },
  { id: 'em_andamento', nome: 'Em andamento', cor: 'var(--alerta)' },
  { id: 'aguardando', nome: 'Aguardando', cor: '#7A5AF8', motivo: true },
  { id: 'concluida', nome: 'Concluída', cor: 'var(--sucesso)' },
  { id: 'cancelada', nome: 'Cancelada', cor: '#98A2B3', motivo: true },
]
export const nomeSituacaoOS = (s: SituacaoOS) => SITUACOES_OS.find((x) => x.id === s)?.nome ?? s
export const TIPOS_OS = ['Sinalização', 'Placa', 'Adesivo', 'Impressão', 'Banner', 'Ambientação', 'Comunicação visual', 'Outro']
export const SETORES_OS = ['RH', 'Diretoria', 'Nutrição', 'UTI', 'Pronto-socorro', 'Centro cirúrgico', 'Maternidade', 'Recepção', 'Internação', 'Ambulatório', 'Administração']
export const MOTIVOS_AGUARDANDO = ['Material', 'Fornecedor / gráfica', 'Aprovação', 'Informações do setor', 'Liberação do local']
export const NOME_FOTO: Record<TipoFoto, string> = { local: 'Local (antes)', referencia: 'Referência do pedido', resultado: 'Resultado (depois)' }

// ---------------------------------------------------------------- demonstração
const dia = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10)
const base = { descricao: null, contato: null, motivo: null, fotos: [], links: [], custo: null, fornecedor: null, concluida_em: null, criado_por: 'p2', prioridade: 'comum' as Prioridade }
let demo: OS[] = [
  { ...base, id: 'o1', cliente_id: 'hospital', numero: '48213', titulo: 'Placa de identificação da nova UTI', descricao: 'Placa em ACM com o nome "UTI Adulto 2" e o horário de visitas. Seguir o padrão das outras alas.', solicitante: 'Enf. Carla Mendes', contato: 'Ramal 2214', setor: 'UTI', local: 'Bloco B, 3º andar, entrada da UTI', tipo: 'Placa', pedido_em: dia(-6), prazo: dia(2), prioridade: 'alta', situacao: 'em_andamento', responsavel_id: 'p1', criado_em: new Date(Date.now() - 6 * 86_400_000).toISOString(), atualizado_em: new Date().toISOString(),
    links: [{ id: 'l1', url: 'https://drive.google.com/', nome: 'Manual de sinalização do hospital' }] },
  { ...base, id: 'o2', cliente_id: 'hospital', numero: '48190', titulo: 'Adesivos de "Proibido fumar" nas escadas', solicitante: 'Segurança do Trabalho', contato: 'Ramal 2030', setor: 'Administração', local: 'Escadas de emergência, todos os andares', tipo: 'Adesivo', pedido_em: dia(-10), prazo: dia(-1), situacao: 'aguardando', motivo: 'Fornecedor / gráfica', responsavel_id: 'p3', fornecedor: 'Gráfica Rápida DF', custo: 240, criado_em: new Date(Date.now() - 10 * 86_400_000).toISOString(), atualizado_em: new Date().toISOString() },
  { ...base, id: 'o3', cliente_id: 'hospital', numero: '48244', titulo: 'Banner do Outubro Rosa na recepção', solicitante: 'Dra. Paula Reis', setor: 'Diretoria', local: 'Recepção principal', tipo: 'Banner', pedido_em: dia(-1), prazo: dia(6), situacao: 'aberta', responsavel_id: null, criado_em: new Date(Date.now() - 86_400_000).toISOString(), atualizado_em: new Date().toISOString() },
  { ...base, id: 'o4', cliente_id: 'hospital', numero: '48102', titulo: 'Quadro de avisos da maternidade', solicitante: 'Enf. Joana Lima', contato: 'Ramal 2120', setor: 'Maternidade', local: 'Corredor da maternidade', tipo: 'Comunicação visual', pedido_em: dia(-20), prazo: dia(-12), situacao: 'concluida', responsavel_id: 'p2', custo: 180, concluida_em: new Date(Date.now() - 13 * 86_400_000).toISOString(), criado_em: new Date(Date.now() - 20 * 86_400_000).toISOString(), atualizado_em: new Date().toISOString() },
]
let eventosDemo: EventoOS[] = [{ id: 1, os_id: 'o2', autor_id: 'p3', autor: 'Braion Silva', tipo: 'comentario', texto: 'Gráfica disse que entrega na segunda.', detalhe: {}, criado_em: new Date(Date.now() - 5 * 3_600_000).toISOString() }]
const arquivosDemo = new Map<string, string>()

// ---------------------------------------------------------------- API
export async function listarOS(clienteId: string): Promise<OS[]> {
  if (!supabase) return [...demo]
  const { data, error } = await supabase.from('ordens_servico').select('*').eq('cliente_id', clienteId).order('pedido_em', { ascending: false })
  if (error) throw error
  return (data as OS[]).map((o) => ({ ...o, custo: o.custo == null ? null : Number(o.custo) }))
}

export type NovaOS = Pick<OS, 'numero' | 'titulo' | 'descricao' | 'solicitante' | 'contato' | 'setor' | 'local' | 'tipo' | 'pedido_em' | 'prazo' | 'prioridade' | 'responsavel_id' | 'links'>
export async function criarOS(clienteId: string, d: NovaOS): Promise<OS> {
  if (!supabase) {
    if (demo.some((o) => o.numero.trim().toLowerCase() === d.numero.trim().toLowerCase())) throw new Error(`A OS ${d.numero} já está cadastrada.`)
    const nova: OS = { ...base, ...d, id: crypto.randomUUID(), cliente_id: clienteId, situacao: 'aberta', criado_por: 'p1', criado_em: new Date().toISOString(), atualizado_em: new Date().toISOString() }
    demo = [nova, ...demo]; return nova
  }
  const { data, error } = await supabase.from('ordens_servico').insert({ ...d, cliente_id: clienteId }).select('*').single()
  if (error) throw new Error(error.code === '23505' ? `A OS ${d.numero} já está cadastrada.` : 'Não foi possível registrar a OS.')
  return data as OS
}

export async function salvarOS(id: string, dados: Partial<Omit<OS, 'id' | 'cliente_id' | 'criado_por' | 'criado_em'>>) {
  if (!supabase) {
    const antes = demo.find((o) => o.id === id)
    if (antes && dados.situacao && dados.situacao !== antes.situacao) eventosDemo.unshift({ id: Date.now(), os_id: id, autor_id: 'p1', autor: 'Você', tipo: 'situacao', texto: null, detalhe: { de: antes.situacao, para: dados.situacao, motivo: dados.motivo ?? null }, criado_em: new Date().toISOString() })
    demo = demo.map((o) => (o.id === id ? { ...o, ...dados, concluida_em: dados.situacao ? (dados.situacao === 'concluida' ? new Date().toISOString() : null) : o.concluida_em } : o)); return
  }
  const { error } = await supabase.from('ordens_servico').update(dados).eq('id', id)
  if (error) throw new Error(error.code === '23505' ? 'Já existe outra OS com esse número.' : error.code === '23514' ? 'Escreva o motivo.' : 'Não foi possível salvar.')
}

export async function excluirOS(id: string) {
  if (!supabase) { demo = demo.filter((o) => o.id !== id); return }
  const { error } = await supabase.from('ordens_servico').delete().eq('id', id)
  if (error) throw new Error('Só administradores excluem OS.')
}

export async function eventosOS(id: string): Promise<EventoOS[]> {
  if (!supabase) return eventosDemo.filter((e) => e.os_id === id)
  const { data } = await supabase.from('os_eventos').select('*').eq('os_id', id).order('criado_em', { ascending: false }).limit(100)
  const lista = (data ?? []) as EventoOS[]
  const autores = [...new Set(lista.map((e) => e.autor_id).filter(Boolean))] as string[]
  if (autores.length) {
    const p = await supabase.from('perfis').select('id, nome').in('id', autores)
    const nomes = new Map((p.data ?? []).map((x: { id: string; nome: string }) => [x.id, x.nome]))
    lista.forEach((e) => { if (e.autor_id) e.autor = nomes.get(e.autor_id) })
  }
  return lista
}

export async function registrarEventoOS(id: string, tipo: 'comentario' | 'material', texto: string, detalhe: Record<string, string | number> = {}) {
  if (!supabase) { eventosDemo = [{ id: Date.now(), os_id: id, autor_id: 'p1', autor: 'Você', tipo, texto, detalhe, criado_em: new Date().toISOString() }, ...eventosDemo]; return }
  const { data: u } = await supabase.auth.getUser()
  const { error } = await supabase.from('os_eventos').insert({ os_id: id, tipo, texto, detalhe, autor_id: u.user?.id })
  if (error) throw new Error('Não foi possível registrar.')
}

// ---------------------------------------------------------------- fotos (armazenamento privado)
export async function enviarFotoOS(os: OS, arquivo: File, tipo: TipoFoto): Promise<FotoOS> {
  const { reduzirImagem } = await import('./imagens')
  const blob = await reduzirImagem(arquivo, 1600)
  const caminho = `${os.cliente_id}/${os.id}/${tipo}-${Date.now()}.webp`
  const foto: FotoOS = { id: crypto.randomUUID(), caminho, tipo, nome: arquivo.name, criado_em: new Date().toISOString() }
  if (!supabase) { arquivosDemo.set(caminho, URL.createObjectURL(blob)); return foto }
  const { error } = await supabase.storage.from('os').upload(caminho, blob, { contentType: 'image/webp' })
  if (error) throw new Error('Não foi possível enviar a foto.')
  return foto
}
export async function linksFotosOS(caminhos: string[]): Promise<Map<string, string>> {
  if (!caminhos.length) return new Map()
  if (!supabase) return new Map(caminhos.map((c) => [c, arquivosDemo.get(c) ?? '']))
  const { data } = await supabase.storage.from('os').createSignedUrls(caminhos, 3600)
  return new Map((data ?? []).filter((x) => x.path && x.signedUrl).map((x) => [x.path as string, x.signedUrl as string]))
}
export async function apagarFotoOS(caminho: string) {
  if (!supabase) { arquivosDemo.delete(caminho); return }
  await supabase.storage.from('os').remove([caminho])
}
