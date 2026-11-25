import { supabase } from './supabase'

export type Item = {
  id: string; cliente_id: string; nome: string; categoria: string | null; unidade: string; quantidade: number; minimo: number
  local: string | null; validade: string | null; observacoes: string | null; atualizado_em: string
  arquivado_em?: string | null; motivo_arquivamento?: string | null; arquivado_por?: string | null; arquivado_por_nome?: string
}
export type TipoMovimento = 'entrada' | 'saida' | 'ajuste'
export type Movimento = { id: number; item_id: string; tipo: TipoMovimento; quantidade: number; motivo: string | null; evento_id: string | null; autor_id: string; criado_em: string; autor?: string }

export const CATEGORIAS = ['Brindes', 'Saúde', 'Papelaria', 'Eletrônicos', 'Limpeza', 'Outros']
export const UNIDADES = ['un', 'caixa', 'pacote', 'par', 'rolo', 'resma', 'kit']

// ---------------------------------------------------------------- modo demonstração
const em = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10)
let itensDemo: Item[] = [
  ['Fitas de glicemia', 'Saúde', 'caixa', 3, 5, 'Armário 2', em(40)], ['Lancetas', 'Saúde', 'caixa', 12, 5, 'Armário 2', em(200)],
  ['Luvas descartáveis (M)', 'Saúde', 'caixa', 8, 4, 'Armário 2', null], ['Squeeze Novembro Azul', 'Brindes', 'un', 140, 50, 'Depósito', null],
  ['Chaveiro do hospital', 'Brindes', 'un', 35, 50, 'Depósito', null], ['Papel A4', 'Papelaria', 'resma', 6, 3, 'Sala do marketing', null],
  ['Pilhas AA', 'Eletrônicos', 'pacote', 2, 4, 'Sala do marketing', em(500)], ['Fita métrica', 'Saúde', 'un', 10, 5, 'Armário 2', null],
].map(([nome, categoria, unidade, quantidade, minimo, local, validade], i) => ({
  id: `it${i}`, cliente_id: 'hospital', nome, categoria, unidade, quantidade, minimo, local, validade, observacoes: null, atualizado_em: new Date().toISOString(),
})) as Item[]
itensDemo.push({ id: 'itx', cliente_id: 'hospital', nome: 'Folder Outubro Rosa 2025', categoria: 'Papelaria', unidade: 'un', quantidade: 0, minimo: 0, local: null, validade: null, observacoes: null,
  atualizado_em: new Date().toISOString(), arquivado_em: new Date(Date.now() - 20 * 86_400_000).toISOString(), motivo_arquivamento: 'Campanha antiga, não usamos mais', arquivado_por_nome: 'Kiara' })
let movDemo: Movimento[] = [
  { id: 1, item_id: 'it0', tipo: 'saida', quantidade: 8, motivo: 'Mutirão de glicemia na Empresa X', evento_id: null, autor_id: 'demo', autor: 'Braion', criado_em: new Date(Date.now() - 86_400_000).toISOString() },
  { id: 2, item_id: 'it0', tipo: 'entrada', quantidade: 10, motivo: 'Compra', evento_id: null, autor_id: 'demo', autor: 'Kiara', criado_em: new Date(Date.now() - 9 * 86_400_000).toISOString() },
]

/** Itens em uso e itens excluídos (arquivados com o motivo). */
export async function listarItens(clienteId: string): Promise<{ ativos: Item[]; excluidos: Item[] }> {
  if (!supabase) return { ativos: itensDemo.filter((i) => !i.arquivado_em), excluidos: itensDemo.filter((i) => i.arquivado_em) }
  const { data, error } = await supabase.from('estoque_itens').select('*').eq('cliente_id', clienteId).order('nome')
  if (error) throw error
  const itens = (data as Item[]).map((i) => ({ ...i, quantidade: Number(i.quantidade), minimo: Number(i.minimo) }))
  const autores = [...new Set(itens.map((i) => i.arquivado_por).filter(Boolean))] as string[]
  if (autores.length) {
    const p = await supabase.from('perfis').select('id, nome').in('id', autores)
    const nomes = new Map((p.data ?? []).map((x: { id: string; nome: string }) => [x.id, x.nome]))
    itens.forEach((i) => { if (i.arquivado_por) i.arquivado_por_nome = nomes.get(i.arquivado_por) })
  }
  return { ativos: itens.filter((i) => !i.arquivado_em), excluidos: itens.filter((i) => i.arquivado_em) }
}

export async function criarItem(clienteId: string, dados: Omit<Item, 'id' | 'cliente_id' | 'quantidade' | 'atualizado_em'>, inicial: number) {
  if (!supabase) {
    const id = crypto.randomUUID()
    itensDemo.push({ ...dados, id, cliente_id: clienteId, quantidade: inicial, atualizado_em: new Date().toISOString() })
    return
  }
  const { data, error } = await supabase.from('estoque_itens').insert({ ...dados, cliente_id: clienteId }).select('id').single()
  if (error) throw new Error(error.code === '23505' ? 'Já existe um item com esse nome.' : 'Não foi possível cadastrar.')
  if (inicial > 0) await movimentar(data.id as string, 'entrada', inicial, 'Saldo inicial')
}

export type DadosItem = Pick<Item, 'nome' | 'categoria' | 'unidade' | 'minimo' | 'local' | 'validade' | 'observacoes'>
export async function editarItem(id: string, dados: Partial<DadosItem>) {
  if (!supabase) { itensDemo = itensDemo.map((i) => (i.id === id ? { ...i, ...dados } : i)); return }
  const { error } = await supabase.from('estoque_itens').update(dados).eq('id', id)
  if (error) throw new Error(error.code === '23505' ? 'Já existe outro item com esse nome.' : 'Não foi possível salvar.')
}

export const MOTIVOS_EXCLUSAO = ['Não usamos mais', 'Produto descontinuado', 'Cadastrado errado ou duplicado', 'Acabou e não vamos repor']

/** Tira o item da lista registrando o porquê. Saldo e histórico ficam guardados; dá para restaurar. */
export async function excluirItem(id: string, motivo: string) {
  if (!supabase) { itensDemo = itensDemo.map((i) => (i.id === id ? { ...i, arquivado_em: new Date().toISOString(), motivo_arquivamento: motivo, arquivado_por_nome: 'Você' } : i)); return }
  const { error } = await supabase.from('estoque_itens').update({ arquivado_em: new Date().toISOString(), motivo_arquivamento: motivo }).eq('id', id)
  if (error) throw error
}

export async function restaurarItem(id: string) {
  if (!supabase) { itensDemo = itensDemo.map((i) => (i.id === id ? { ...i, arquivado_em: null, motivo_arquivamento: null } : i)); return }
  const { error } = await supabase.from('estoque_itens').update({ arquivado_em: null }).eq('id', id)
  if (error) throw new Error(error.code === '23505' ? 'Já existe um item em uso com esse nome.' : 'Não foi possível restaurar.')
}

export async function movimentar(itemId: string, tipo: TipoMovimento, quantidade: number, motivo: string | null, eventoId: string | null = null) {
  if (!supabase) {
    const item = itensDemo.find((i) => i.id === itemId)!
    if (tipo === 'saida' && quantidade > item.quantidade) throw new Error(`Saldo insuficiente: há ${item.quantidade} em estoque`)
    item.quantidade = tipo === 'ajuste' ? quantidade : item.quantidade + (tipo === 'entrada' ? quantidade : -quantidade)
    movDemo.unshift({ id: Date.now(), item_id: itemId, tipo, quantidade, motivo, evento_id: eventoId, autor_id: 'demo', autor: 'Você', criado_em: new Date().toISOString() })
    return
  }
  const { error } = await supabase.from('estoque_movimentos').insert({ item_id: itemId, tipo, quantidade, motivo, evento_id: eventoId })
  if (error) throw new Error(error.message.includes('Saldo insuficiente') ? error.message : 'Não foi possível registrar.')
}

export async function historicoItem(itemId: string): Promise<Movimento[]> {
  if (!supabase) return movDemo.filter((m) => m.item_id === itemId)
  const { data } = await supabase.from('estoque_movimentos').select('*').eq('item_id', itemId).order('criado_em', { ascending: false }).limit(50)
  const movs = (data ?? []) as Movimento[]
  const ids = [...new Set(movs.map((m) => m.autor_id))]
  if (ids.length) {
    const p = await supabase.from('perfis').select('id, nome').in('id', ids)
    const nomes = new Map((p.data ?? []).map((x: { id: string; nome: string }) => [x.id, x.nome]))
    movs.forEach((m) => { m.autor = nomes.get(m.autor_id) })
  }
  return movs
}

export const fmt = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
export function situacao(i: Item) {
  if (i.quantidade <= 0) return 'zerado' as const
  if (i.quantidade <= i.minimo) return 'baixo' as const
  return 'ok' as const
}
export function venceEmDias(i: Item) {
  if (!i.validade) return null
  return Math.ceil((new Date(`${i.validade}T12:00:00`).getTime() - Date.now()) / 86_400_000)
}
