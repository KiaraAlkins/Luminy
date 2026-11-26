import { supabase } from './supabase'
import { carregarQuadro, criarCard, salvarCard } from './kanban'

export type Referencia = { id: string; nome: string; url: string }
export type Pauta = {
  id: string; cliente_id: string; titulo: string; descricao: string | null; tipo_conteudo: string | null; tema: string | null; data_ref: string | null
  referencias: Referencia[]; reutilizavel: boolean; situacao: 'ideia' | 'usada' | 'arquivada'; card_id: string | null; usada_em: string | null
  criado_por: string; criado_em: string
  votos: string[]   // quem votou
}
export type EdicaoPauta = Partial<Pick<Pauta, 'titulo' | 'descricao' | 'tipo_conteudo' | 'tema' | 'data_ref' | 'referencias' | 'reutilizavel' | 'situacao' | 'card_id' | 'usada_em'>>

export const TEMAS = ['Institucional', 'Prevenção', 'Saúde da mulher', 'Saúde do homem', 'Infantil', 'Bastidores', 'Equipe', 'Serviços', 'Datas comemorativas', 'Depoimentos', 'Dicas de saúde']

// ---------------------------------------------------------------- datas da saúde
export type DataSaude = { chave: string; nome: string; descricao: string; cor: string; inicio: Date; fim: Date }
type Regra = { chave: string; nome: string; descricao: string; cor: string; mes: number; dia?: number; domingo?: number /* n-ésimo domingo */ }
const REGRAS: Regra[] = [
  { chave: 'janeiro-branco', nome: 'Janeiro Branco', descricao: 'Saúde mental', cor: '#98A2B3', mes: 1 },
  { chave: 'cancer-fev', nome: 'Dia Mundial do Câncer', descricao: '4 de fevereiro', cor: '#7A5AF8', mes: 2, dia: 4 },
  { chave: 'marco-lilas', nome: 'Março Lilás', descricao: 'Câncer do colo do útero', cor: '#9E77ED', mes: 3 },
  { chave: 'dia-mulher', nome: 'Dia da Mulher', descricao: '8 de março', cor: '#D6297A', mes: 3, dia: 8 },
  { chave: 'abril-azul', nome: 'Abril Azul', descricao: 'Conscientização sobre o autismo', cor: '#2E90FA', mes: 4 },
  { chave: 'dia-saude', nome: 'Dia Mundial da Saúde', descricao: '7 de abril', cor: '#12A15F', mes: 4, dia: 7 },
  { chave: 'maio-amarelo', nome: 'Maio Amarelo', descricao: 'Segurança no trânsito', cor: '#EAAA08', mes: 5 },
  { chave: 'dia-enfermagem', nome: 'Dia da Enfermagem', descricao: '12 de maio', cor: '#06AED4', mes: 5, dia: 12 },
  { chave: 'dia-maes', nome: 'Dia das Mães', descricao: '2º domingo de maio', cor: '#EE46BC', mes: 5, domingo: 2 },
  { chave: 'junho-vermelho', nome: 'Junho Vermelho', descricao: 'Doação de sangue', cor: '#E5484D', mes: 6 },
  { chave: 'dia-doador', nome: 'Dia do Doador de Sangue', descricao: '14 de junho', cor: '#D92D20', mes: 6, dia: 14 },
  { chave: 'julho-amarelo', nome: 'Julho Amarelo', descricao: 'Hepatites virais', cor: '#EAAA08', mes: 7 },
  { chave: 'agosto-dourado', nome: 'Agosto Dourado', descricao: 'Aleitamento materno', cor: '#CA8504', mes: 8 },
  { chave: 'dia-pais', nome: 'Dia dos Pais', descricao: '2º domingo de agosto', cor: '#3D2EF9', mes: 8, domingo: 2 },
  { chave: 'setembro-amarelo', nome: 'Setembro Amarelo', descricao: 'Prevenção do suicídio', cor: '#EAAA08', mes: 9 },
  { chave: 'dia-coracao', nome: 'Dia Mundial do Coração', descricao: '29 de setembro', cor: '#E5484D', mes: 9, dia: 29 },
  { chave: 'outubro-rosa', nome: 'Outubro Rosa', descricao: 'Câncer de mama', cor: '#EE46BC', mes: 10 },
  { chave: 'dia-medico', nome: 'Dia do Médico', descricao: '18 de outubro', cor: '#12A15F', mes: 10, dia: 18 },
  { chave: 'novembro-azul', nome: 'Novembro Azul', descricao: 'Saúde do homem', cor: '#2E90FA', mes: 11 },
  { chave: 'dia-diabetes', nome: 'Dia Mundial do Diabetes', descricao: '14 de novembro', cor: '#1570EF', mes: 11, dia: 14 },
  { chave: 'dezembro-vermelho', nome: 'Dezembro Vermelho', descricao: 'Prevenção ao HIV', cor: '#D92D20', mes: 12 },
  { chave: 'natal', nome: 'Natal', descricao: '25 de dezembro', cor: '#12A15F', mes: 12, dia: 25 },
]
function ocorrencia(r: Regra, ano: number): DataSaude {
  let inicio: Date; let fim: Date
  if (r.domingo) {
    const primeiro = new Date(ano, r.mes - 1, 1)
    const dia = 1 + ((7 - primeiro.getDay()) % 7) + (r.domingo - 1) * 7
    inicio = new Date(ano, r.mes - 1, dia); fim = new Date(ano, r.mes - 1, dia, 23, 59)
  } else if (r.dia) { inicio = new Date(ano, r.mes - 1, r.dia); fim = new Date(ano, r.mes - 1, r.dia, 23, 59) }
  else { inicio = new Date(ano, r.mes - 1, 1); fim = new Date(ano, r.mes, 0, 23, 59) }
  return { chave: r.chave, nome: r.nome, descricao: r.descricao, cor: r.cor, inicio, fim }
}
/** Datas da saúde acontecendo agora ou nos próximos `dias`, em ordem. */
export function proximasDatas(agora: Date, dias = 75): DataSaude[] {
  const limite = agora.getTime() + dias * 86_400_000
  return REGRAS.map((r) => {
    const esta = ocorrencia(r, agora.getFullYear())
    return esta.fim.getTime() >= agora.getTime() ? esta : ocorrencia(r, agora.getFullYear() + 1)
  }).filter((d) => d.inicio.getTime() <= limite).sort((a, b) => a.inicio.getTime() - b.inicio.getTime())
}
export const todasAsDatas = () => REGRAS.map((r) => ({ chave: r.chave, nome: r.nome, descricao: r.descricao, cor: r.cor, mes: r.mes }))
export const dataPorChave = (chave: string | null) => (chave ? REGRAS.find((r) => r.chave === chave) ?? null : null)

// ---------------------------------------------------------------- dados
let demo: Pauta[] = (() => {
  const d = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString()
  const p = (o: Partial<Pauta> & Pick<Pauta, 'id' | 'titulo'>): Pauta => ({ cliente_id: 'hospital', descricao: null, tipo_conteudo: null, tema: null, data_ref: null, referencias: [], reutilizavel: false, situacao: 'ideia', card_id: null, usada_em: null, criado_por: 'p1', criado_em: d(3), votos: [], ...o })
  return [
    p({ id: 'i1', titulo: 'HIV tem tratamento: desmistificando o teste rápido', descricao: 'Carrossel mostrando como é o teste rápido no hospital, que é sigiloso e gratuito.', tipo_conteudo: 'Carrossel', tema: 'Prevenção', data_ref: 'dezembro-vermelho', votos: ['p2', 'p3', 'p4'], criado_por: 'p2', criado_em: d(2),
      referencias: [{ id: 'r1', nome: 'Referência de carrossel', url: 'https://www.instagram.com/' }] }),
    p({ id: 'i2', titulo: 'Bastidores da ceia de Natal da nutrição', descricao: 'Reels curto com a equipe da nutrição preparando a ceia dos pacientes internados.', tipo_conteudo: 'Reels', tema: 'Bastidores', data_ref: 'natal', votos: ['p1', 'p3'], criado_por: 'p3', criado_em: d(5) }),
    p({ id: 'i3', titulo: 'Quem cuida de quem cuida: um dia com a enfermagem', descricao: 'Série de stories acompanhando um plantão (com autorização da equipe).', tipo_conteudo: 'Story', tema: 'Equipe', votos: ['p2'], criado_por: 'p4', criado_em: d(1) }),
    p({ id: 'i4', titulo: '5 sinais de que é hora de ir ao pronto-socorro', tipo_conteudo: 'Carrossel', tema: 'Dicas de saúde', votos: [], criado_em: d(8) }),
    p({ id: 'i5', titulo: 'Campanha de doação de sangue com o hemocentro', descricao: 'Repetir a parceria de junho, com contagem de bolsas coletadas.', tipo_conteudo: 'Campanha', tema: 'Prevenção', data_ref: 'junho-vermelho', reutilizavel: true, usada_em: d(160), votos: ['p1', 'p2'], criado_em: d(200) }),
    p({ id: 'i6', titulo: 'Depoimento: paciente que venceu o câncer de próstata', tipo_conteudo: 'Vídeo', tema: 'Depoimentos', data_ref: 'novembro-azul', situacao: 'usada', card_id: 'k4', usada_em: d(12), votos: ['p3'], criado_em: d(30) }),
  ]
})()

export async function listarPautas(clienteId: string): Promise<Pauta[]> {
  if (!supabase) return demo.map((p) => ({ ...p }))
  const { data, error } = await supabase.from('pautas').select('*, pauta_votos(usuario_id)').eq('cliente_id', clienteId).order('criado_em', { ascending: false })
  if (error) throw error
  return (data ?? []).map(({ pauta_votos, ...p }) => ({ ...p, votos: (pauta_votos as { usuario_id: string }[]).map((v) => v.usuario_id) })) as Pauta[]
}

export async function criarPauta(clienteId: string, criadoPor: string, p: EdicaoPauta & { titulo: string }): Promise<Pauta> {
  if (!supabase) {
    const nova: Pauta = { id: crypto.randomUUID(), cliente_id: clienteId, descricao: null, tipo_conteudo: null, tema: null, data_ref: null, referencias: [], reutilizavel: false, situacao: 'ideia', card_id: null, usada_em: null, criado_por: criadoPor, criado_em: new Date().toISOString(), votos: [], ...p }
    demo = [nova, ...demo]; return nova
  }
  const { data, error } = await supabase.from('pautas').insert({ cliente_id: clienteId, ...p }).select('*').single()
  if (error) throw error
  return { ...(data as Omit<Pauta, 'votos'>), votos: [] }
}

export async function salvarPauta(id: string, p: EdicaoPauta) {
  if (!supabase) { demo = demo.map((x) => (x.id === id ? { ...x, ...p } : x)); return }
  const { error } = await supabase.from('pautas').update(p).eq('id', id)
  if (error) throw error
}

export async function excluirPauta(id: string) {
  if (!supabase) { demo = demo.filter((x) => x.id !== id); return }
  const { error } = await supabase.from('pautas').delete().eq('id', id)
  if (error) throw error
}

export async function votar(p: Pauta, usuarioId: string, dar: boolean) {
  if (!supabase) { demo = demo.map((x) => (x.id === p.id ? { ...x, votos: dar ? [...x.votos, usuarioId] : x.votos.filter((v) => v !== usuarioId) } : x)); return }
  const { error } = dar ? await supabase.from('pauta_votos').insert({ pauta_id: p.id }) : await supabase.from('pauta_votos').delete().eq('pauta_id', p.id).eq('usuario_id', usuarioId)
  if (error) throw error
}

/** Leva a ideia para a primeira coluna do Kanban, com briefing e referências. Devolve o id do card. */
export async function virarCard(p: Pauta, clienteId: string): Promise<string> {
  const quadro = await carregarQuadro(clienteId)
  if (!quadro || !quadro.colunas.length) throw new Error('O cliente ainda não tem um Kanban de redes sociais.')
  const coluna = quadro.colunas[0]
  const posicao = quadro.cards.filter((c) => c.coluna_id === coluna.id).length + 1
  const id = await criarCard(quadro.id, coluna.id, p.titulo, posicao)
  const data = dataPorChave(p.data_ref)
  const briefing = [p.descricao, data && `Data: ${data.nome} (${data.descricao})`, p.tema && `Tema: ${p.tema}`, 'Ideia vinda do Acervo de Pauta.'].filter(Boolean).join('\n\n')
  await salvarCard(id, {
    briefing, tipo_conteudo: p.tipo_conteudo,
    anexos: p.referencias.map((r) => ({ id: r.id, tipo: 'link' as const, nome: r.nome, url: r.url, criado_em: new Date().toISOString() })),
  })
  await salvarPauta(p.id, { situacao: p.reutilizavel ? 'ideia' : 'usada', card_id: id, usada_em: new Date().toISOString() })
  return id
}
