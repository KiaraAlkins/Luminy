import { supabase } from './supabase'

export type Prioridade = 'alta' | 'comum' | 'baixa'
export type Coluna = { id: string; nome: string; posicao: number; exige_motivo: boolean }
export type Card = {
  id: string
  coluna_id: string
  titulo: string
  briefing: string | null
  tipo_conteudo: string | null
  redes: string[]
  entrega_em: string | null
  postagem_em: string | null
  prioridade: Prioridade
  posicao: number
  motivo_impedimento: string | null
  coluna_antes_impedimento: string | null
}
export type Quadro = { id: string; nome: string; colunas: Coluna[]; cards: Card[] }

export const TIPOS = ['Post', 'Carrossel', 'Story', 'Reels', 'Vídeo', 'Campanha', 'Cobertura', 'Outro']
export const REDES = ['Instagram', 'Facebook', 'TikTok', 'LinkedIn', 'YouTube']

// ---------------------------------------------------------------- modo demonstração (sem Supabase)
const colunasDemo: Coluna[] = ['Backlog (ideias)', 'Briefing aprovado', 'Fazendo', 'Feito e aprovado', 'Postado e feito', 'Impedimento']
  .map((nome, i) => ({ id: `c${i + 1}`, nome, posicao: i + 1, exige_motivo: nome === 'Impedimento' }))
const base = { briefing: null, entrega_em: null, postagem_em: null, motivo_impedimento: null, coluna_antes_impedimento: null }
let cardsDemo: Card[] = [
  { ...base, id: 'k1', coluna_id: 'c1', titulo: 'Série: mitos sobre o coração', tipo_conteudo: 'Carrossel', redes: ['Instagram'], prioridade: 'comum', posicao: 1 },
  { ...base, id: 'k2', coluna_id: 'c1', titulo: 'Bastidores da maternidade', tipo_conteudo: 'Reels', redes: ['Instagram'], prioridade: 'baixa', posicao: 2 },
  { ...base, id: 'k3', coluna_id: 'c2', titulo: 'Campanha da vacina da gripe', tipo_conteudo: 'Post', redes: ['Instagram', 'Facebook'], prioridade: 'comum', posicao: 1, entrega_em: '2026-11-26T12:00:00' },
  { ...base, id: 'k4', coluna_id: 'c3', titulo: 'Carrossel Novembro Azul', tipo_conteudo: 'Carrossel', redes: ['Instagram', 'Facebook'], prioridade: 'alta', posicao: 1, entrega_em: '2026-11-24T16:00:00', postagem_em: '2026-11-24T18:00:00',
    briefing: 'Carrossel de 6 telas sobre prevenção do câncer de próstata. Tom acolhedor, sem alarmismo.' },
  { ...base, id: 'k5', coluna_id: 'c3', titulo: 'Reels Dia do Homem', tipo_conteudo: 'Reels', redes: ['Instagram', 'TikTok'], prioridade: 'comum', posicao: 2, entrega_em: '2026-11-25T10:00:00' },
  { ...base, id: 'k6', coluna_id: 'c4', titulo: 'Post Doação de sangue', tipo_conteudo: 'Post', redes: ['Instagram'], prioridade: 'comum', posicao: 1, postagem_em: '2026-11-27T12:00:00' },
  { ...base, id: 'k7', coluna_id: 'c6', titulo: 'Vídeo institucional da UTI', tipo_conteudo: 'Vídeo', redes: ['YouTube'], prioridade: 'comum', posicao: 1,
    motivo_impedimento: 'Aguardando autorização de imagem dos pacientes', coluna_antes_impedimento: 'c3' },
]

// ---------------------------------------------------------------- API
export async function carregarQuadro(clienteId: string): Promise<Quadro | null> {
  if (!supabase) return { id: 'demo', nome: 'Redes sociais', colunas: colunasDemo, cards: [...cardsDemo] }
  const { data: q, error } = await supabase.from('quadros').select('id, nome')
    .eq('cliente_id', clienteId).eq('tipo', 'oficial').order('criado_em').limit(1).maybeSingle()
  if (error) throw error
  if (!q) return null
  const [colunas, cards] = await Promise.all([
    supabase.from('colunas').select('id, nome, posicao, exige_motivo').eq('quadro_id', q.id).order('posicao'),
    supabase.from('cards').select('*').eq('quadro_id', q.id).order('posicao'),
  ])
  if (colunas.error) throw colunas.error
  if (cards.error) throw cards.error
  return { id: q.id, nome: q.nome, colunas: colunas.data as Coluna[], cards: cards.data as Card[] }
}

export async function moverCard(card: Card, colunaId: string, posicao: number, motivo?: string) {
  const mudanca = { coluna_id: colunaId, posicao, motivo_impedimento: motivo ?? null }
  if (!supabase) {
    cardsDemo = cardsDemo.map((c) => c.id === card.id
      ? { ...c, ...mudanca, coluna_antes_impedimento: motivo ? card.coluna_id : null } : c)
    return
  }
  const { error } = await supabase.from('cards').update(mudanca).eq('id', card.id)
  if (error) throw error
}

export async function criarCard(quadroId: string, colunaId: string, titulo: string, posicao: number) {
  if (!supabase) {
    cardsDemo = [...cardsDemo, { ...base, id: crypto.randomUUID(), coluna_id: colunaId, titulo, tipo_conteudo: null, redes: [], prioridade: 'comum', posicao }]
    return
  }
  const { error } = await supabase.from('cards').insert({ quadro_id: quadroId, coluna_id: colunaId, titulo, posicao })
  if (error) throw error
}

export type EdicaoCard = Pick<Card, 'titulo' | 'briefing' | 'tipo_conteudo' | 'redes' | 'entrega_em' | 'postagem_em' | 'prioridade'>

export async function salvarCard(id: string, edicao: EdicaoCard) {
  if (!supabase) { cardsDemo = cardsDemo.map((c) => (c.id === id ? { ...c, ...edicao } : c)); return }
  const { error } = await supabase.from('cards').update(edicao).eq('id', id)
  if (error) throw error
}

export async function excluirCard(id: string) {
  if (!supabase) { cardsDemo = cardsDemo.filter((c) => c.id !== id); return }
  const { error } = await supabase.from('cards').delete().eq('id', id)
  if (error) throw error
}

/** Data curta para os cards: "Hoje, 16:00", "Amanhã, 10:00" ou "26/11". */
export function dataCurta(iso: string | null, agora = new Date()) {
  if (!iso) return null
  const d = new Date(iso)
  const dia = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diff = Math.round((dia(d) - dia(agora)) / 86_400_000)
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  if (diff === 0) return `hoje, ${hora}`
  if (diff === 1) return `amanhã, ${hora}`
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}
