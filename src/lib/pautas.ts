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
type Regra = { chave: string; nome: string; descricao: string; cor: string; mes: number; dia?: number; semana?: [number, number] /* n-ésimo dia da semana (0 = domingo) */ }
const AZUL = '#2E90FA', ROSA = '#EE46BC', VERMELHO = '#E5484D', AMARELO = '#EAAA08', VERDE = '#12A15F', ROXO = '#7A5AF8', LARANJA = '#F79009', LILAS = '#9E77ED', DOURADO = '#CA8504', CINZA = '#98A2B3', MARCA = '#3D2EF9'
const REGRAS: Regra[] = [
  // Janeiro
  { chave: 'janeiro-branco', nome: 'Janeiro Branco', descricao: 'Saúde mental', cor: CINZA, mes: 1 },
  { chave: 'janeiro-roxo', nome: 'Janeiro Roxo', descricao: 'Hanseníase', cor: ROXO, mes: 1 },
  { chave: 'dia-farmaceutico', nome: 'Dia do Farmacêutico', descricao: '20 de janeiro', cor: VERDE, mes: 1, dia: 20 },
  // Fevereiro
  { chave: 'fevereiro-roxo', nome: 'Fevereiro Roxo', descricao: 'Lúpus, fibromialgia e Alzheimer', cor: ROXO, mes: 2 },
  { chave: 'fevereiro-laranja', nome: 'Fevereiro Laranja', descricao: 'Leucemia e doação de medula', cor: LARANJA, mes: 2 },
  { chave: 'cancer-fev', nome: 'Dia Mundial do Câncer', descricao: '4 de fevereiro', cor: ROXO, mes: 2, dia: 4 },
  // Março
  { chave: 'marco-lilas', nome: 'Março Lilás', descricao: 'Câncer do colo do útero', cor: LILAS, mes: 3 },
  { chave: 'marco-azul', nome: 'Março Azul-marinho', descricao: 'Câncer colorretal', cor: '#1849A9', mes: 3 },
  { chave: 'dia-mulher', nome: 'Dia da Mulher', descricao: '8 de março', cor: ROSA, mes: 3, dia: 8 },
  { chave: 'dia-rim', nome: 'Dia Mundial do Rim', descricao: '2ª quinta-feira de março', cor: AZUL, mes: 3, semana: [2, 4] },
  { chave: 'dia-down', nome: 'Dia da Síndrome de Down', descricao: '21 de março', cor: AMARELO, mes: 3, dia: 21 },
  { chave: 'dia-tuberculose', nome: 'Dia de Combate à Tuberculose', descricao: '24 de março', cor: VERMELHO, mes: 3, dia: 24 },
  // Abril
  { chave: 'abril-azul', nome: 'Abril Azul', descricao: 'Conscientização sobre o autismo', cor: AZUL, mes: 4 },
  { chave: 'abril-verde', nome: 'Abril Verde', descricao: 'Saúde e segurança no trabalho', cor: VERDE, mes: 4 },
  { chave: 'dia-autismo', nome: 'Dia Mundial do Autismo', descricao: '2 de abril', cor: AZUL, mes: 4, dia: 2 },
  { chave: 'dia-saude', nome: 'Dia Mundial da Saúde', descricao: '7 de abril', cor: VERDE, mes: 4, dia: 7 },
  // Maio
  { chave: 'maio-amarelo', nome: 'Maio Amarelo', descricao: 'Segurança no trânsito', cor: AMARELO, mes: 5 },
  { chave: 'dia-maos', nome: 'Dia da Higienização das Mãos', descricao: '5 de maio', cor: '#06AED4', mes: 5, dia: 5 },
  { chave: 'dia-enfermagem', nome: 'Dia da Enfermagem', descricao: '12 de maio', cor: '#06AED4', mes: 5, dia: 12 },
  { chave: 'dia-maes', nome: 'Dia das Mães', descricao: '2º domingo de maio', cor: ROSA, mes: 5, semana: [2, 0] },
  { chave: 'dia-hipertensao', nome: 'Dia Mundial da Hipertensão', descricao: '17 de maio', cor: VERMELHO, mes: 5, dia: 17 },
  { chave: 'dia-sem-tabaco', nome: 'Dia Mundial sem Tabaco', descricao: '31 de maio', cor: CINZA, mes: 5, dia: 31 },
  // Junho
  { chave: 'junho-vermelho', nome: 'Junho Vermelho', descricao: 'Doação de sangue', cor: VERMELHO, mes: 6 },
  { chave: 'junho-laranja', nome: 'Junho Laranja', descricao: 'Anemia e leucemia', cor: LARANJA, mes: 6 },
  { chave: 'dia-doador', nome: 'Dia do Doador de Sangue', descricao: '14 de junho', cor: '#D92D20', mes: 6, dia: 14 },
  // Julho
  { chave: 'julho-amarelo', nome: 'Julho Amarelo', descricao: 'Hepatites virais', cor: AMARELO, mes: 7 },
  { chave: 'julho-verde', nome: 'Julho Verde', descricao: 'Câncer de cabeça e pescoço', cor: VERDE, mes: 7 },
  { chave: 'dia-hospital', nome: 'Dia do Hospital', descricao: '2 de julho', cor: MARCA, mes: 7, dia: 2 },
  { chave: 'dia-avos', nome: 'Dia dos Avós', descricao: '26 de julho', cor: LILAS, mes: 7, dia: 26 },
  // Agosto
  { chave: 'agosto-dourado', nome: 'Agosto Dourado', descricao: 'Aleitamento materno', cor: DOURADO, mes: 8 },
  { chave: 'agosto-lilas', nome: 'Agosto Lilás', descricao: 'Fim da violência contra a mulher', cor: LILAS, mes: 8 },
  { chave: 'dia-pais', nome: 'Dia dos Pais', descricao: '2º domingo de agosto', cor: MARCA, mes: 8, semana: [2, 0] },
  { chave: 'dia-psicologo', nome: 'Dia do Psicólogo', descricao: '27 de agosto', cor: ROXO, mes: 8, dia: 27 },
  { chave: 'dia-nutricionista', nome: 'Dia do Nutricionista', descricao: '31 de agosto', cor: VERDE, mes: 8, dia: 31 },
  // Setembro
  { chave: 'setembro-amarelo', nome: 'Setembro Amarelo', descricao: 'Prevenção do suicídio', cor: AMARELO, mes: 9 },
  { chave: 'setembro-verde', nome: 'Setembro Verde', descricao: 'Doação de órgãos', cor: VERDE, mes: 9 },
  { chave: 'dia-doacao-orgaos', nome: 'Dia da Doação de Órgãos', descricao: '27 de setembro', cor: VERDE, mes: 9, dia: 27 },
  { chave: 'dia-coracao', nome: 'Dia Mundial do Coração', descricao: '29 de setembro', cor: VERMELHO, mes: 9, dia: 29 },
  // Outubro
  { chave: 'outubro-rosa', nome: 'Outubro Rosa', descricao: 'Câncer de mama', cor: ROSA, mes: 10 },
  { chave: 'dia-criancas', nome: 'Dia das Crianças', descricao: '12 de outubro', cor: LARANJA, mes: 10, dia: 12 },
  { chave: 'dia-fisioterapeuta', nome: 'Dia do Fisioterapeuta', descricao: '13 de outubro', cor: AZUL, mes: 10, dia: 13 },
  { chave: 'dia-medico', nome: 'Dia do Médico', descricao: '18 de outubro', cor: VERDE, mes: 10, dia: 18 },
  { chave: 'dia-dentista', nome: 'Dia do Dentista', descricao: '25 de outubro', cor: '#06AED4', mes: 10, dia: 25 },
  { chave: 'dia-avc', nome: 'Dia Mundial do AVC', descricao: '29 de outubro', cor: VERMELHO, mes: 10, dia: 29 },
  // Novembro
  { chave: 'novembro-azul', nome: 'Novembro Azul', descricao: 'Saúde do homem', cor: AZUL, mes: 11 },
  { chave: 'novembro-roxo', nome: 'Novembro Roxo', descricao: 'Prematuridade', cor: ROXO, mes: 11 },
  { chave: 'dia-diabetes', nome: 'Dia Mundial do Diabetes', descricao: '14 de novembro', cor: '#1570EF', mes: 11, dia: 14 },
  { chave: 'dia-prematuridade', nome: 'Dia Mundial da Prematuridade', descricao: '17 de novembro', cor: ROXO, mes: 11, dia: 17 },
  // Dezembro
  { chave: 'dezembro-vermelho', nome: 'Dezembro Vermelho', descricao: 'Prevenção ao HIV e outras ISTs', cor: '#D92D20', mes: 12 },
  { chave: 'dezembro-laranja', nome: 'Dezembro Laranja', descricao: 'Câncer de pele', cor: LARANJA, mes: 12 },
  { chave: 'dia-aids', nome: 'Dia Mundial de Luta contra a Aids', descricao: '1º de dezembro', cor: '#D92D20', mes: 12, dia: 1 },
  { chave: 'natal', nome: 'Natal', descricao: '25 de dezembro', cor: VERDE, mes: 12, dia: 25 },
]
function ocorrencia(r: Regra, ano: number): DataSaude {
  let inicio: Date; let fim: Date
  if (r.semana) {
    const [n, diaSemana] = r.semana
    const primeiro = new Date(ano, r.mes - 1, 1)
    const dia = 1 + ((diaSemana - primeiro.getDay() + 7) % 7) + (n - 1) * 7
    inicio = new Date(ano, r.mes - 1, dia); fim = new Date(ano, r.mes - 1, dia, 23, 59)
  } else if (r.dia) { inicio = new Date(ano, r.mes - 1, r.dia); fim = new Date(ano, r.mes - 1, r.dia, 23, 59) }
  else { inicio = new Date(ano, r.mes - 1, 1); fim = new Date(ano, r.mes, 0, 23, 59) }
  return { chave: r.chave, nome: r.nome, descricao: r.descricao, cor: r.cor, inicio, fim }
}
/** Todas as datas do ano (saúde + do cliente), por mês, para a visão "ano todo". */
export function anoTodo(ano: number, proprias: CampanhaPropria[]): { mes: number; datas: { chave: string; nome: string; descricao: string; cor: string; inicio: Date; quando: string; propria: boolean }[] }[] {
  const lista = [
    ...REGRAS.map((r) => { const o = ocorrencia(r, ano); return { ...o, quando: r.dia || r.semana ? `Dia ${o.inicio.getDate()}` : 'O mês todo', propria: false } }),
    ...proprias.filter((c) => c.anual || c.inicio.startsWith(String(ano))).map((c) => {
      const [, m, d] = c.inicio.split('-').map(Number)
      const [, mf, df] = c.fim.split('-').map(Number)
      const quando = c.inicio === c.fim ? `Dia ${d}` : `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')} a ${String(df).padStart(2, '0')}/${String(mf).padStart(2, '0')}`
      return { chave: `campanha:${c.id}`, nome: c.nome, descricao: c.descricao ?? 'Campanha do cliente', cor: c.cor, inicio: new Date(ano, m - 1, d), quando, propria: true }
    }),
  ]
  return Array.from({ length: 12 }, (_, i) => ({ mes: i + 1, datas: lista.filter((d) => d.inicio.getMonth() === i).sort((a, b) => a.inicio.getTime() - b.inicio.getTime()) }))
}

export type CampanhaPropria = { id: string; cliente_id: string; nome: string; descricao: string | null; cor: string; inicio: string; fim: string; anual: boolean; criado_por: string; criado_em: string }
export type DataCalendario = DataSaude & { origem: 'saude' | 'propria'; id?: string }
export type Calendario = { proximas: DataCalendario[]; todas: { chave: string; nome: string; descricao: string; cor: string; origem: DataCalendario['origem'] }[]; porChave: (chave: string | null) => { nome: string; descricao: string; cor: string } | null }
export const CORES_CAMPANHA = ['#3D2EF9', '#7A5AF8', '#EE46BC', '#E5484D', '#F79009', '#EAAA08', '#12A15F', '#2E90FA']

const dia = (iso: string, fimDoDia = false) => { const [a, m, d] = iso.slice(0, 10).split('-').map(Number); return new Date(a, m - 1, d, fimDoDia ? 23 : 0, fimDoDia ? 59 : 0) }

/** Junta as datas da saúde e as campanhas/datas criadas pela equipe. `proximas`: acontecendo agora ou nos próximos `dias`. */
export function montarCalendario(agora: Date, proprias: CampanhaPropria[] = [], dias = 75): Calendario {
  const ano = agora.getFullYear()
  const saude: DataCalendario[] = REGRAS.map((r) => {
    const esta = ocorrencia(r, ano)
    return { ...(esta.fim.getTime() >= agora.getTime() ? esta : ocorrencia(r, ano + 1)), origem: 'saude' as const }
  })
  const minhas: DataCalendario[] = proprias.map((c) => {
    let inicio = dia(c.inicio); let fim = dia(c.fim, true)
    while (c.anual && fim.getTime() < agora.getTime()) { inicio = new Date(inicio.getFullYear() + 1, inicio.getMonth(), inicio.getDate()); fim = new Date(fim.getFullYear() + 1, fim.getMonth(), fim.getDate(), 23, 59) }
    return { chave: `campanha:${c.id}`, id: c.id, nome: c.nome, descricao: c.descricao ?? (c.anual ? 'Campanha do cliente · todo ano' : 'Campanha do cliente'), cor: c.cor, inicio, fim, origem: 'propria' as const }
  })
  const todas = [...minhas, ...saude]
  const limite = agora.getTime() + dias * 86_400_000
  return {
    proximas: todas.filter((d) => d.fim.getTime() >= agora.getTime() && d.inicio.getTime() <= limite).sort((a, b) => a.inicio.getTime() - b.inicio.getTime()),
    todas: [...minhas, ...REGRAS.map((r) => ({ chave: r.chave, nome: r.nome, descricao: r.descricao, cor: r.cor, origem: 'saude' as const }))]
      .map(({ chave, nome, descricao, cor, origem }) => ({ chave, nome, descricao, cor, origem })),
    porChave: (chave) => (chave ? todas.find((d) => d.chave === chave) ?? null : null),
  }
}

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

let demoCampanhas: CampanhaPropria[] = [
  { id: 'cp1', cliente_id: 'hospital', nome: 'Aniversário de 40 anos do hospital', descricao: 'Campanha do cliente · todo ano', cor: '#7A5AF8', inicio: '2026-12-10', fim: '2026-12-10', anual: true, criado_por: 'p1', criado_em: new Date().toISOString() },
]

export async function listarCampanhasPauta(clienteId: string): Promise<CampanhaPropria[]> {
  if (!supabase) return [...demoCampanhas]
  const { data, error } = await supabase.from('campanhas_pauta').select('*').eq('cliente_id', clienteId).order('inicio')
  if (error) throw error
  return data as CampanhaPropria[]
}
export type EdicaoCampanha = Pick<CampanhaPropria, 'nome' | 'descricao' | 'cor' | 'inicio' | 'fim' | 'anual'>
export async function salvarCampanhaPauta(clienteId: string, id: string | null, c: EdicaoCampanha) {
  if (!supabase) {
    demoCampanhas = id ? demoCampanhas.map((x) => (x.id === id ? { ...x, ...c } : x))
      : [...demoCampanhas, { id: crypto.randomUUID(), cliente_id: clienteId, criado_por: 'p1', criado_em: new Date().toISOString(), ...c }]
    return
  }
  const { error } = id ? await supabase.from('campanhas_pauta').update(c).eq('id', id) : await supabase.from('campanhas_pauta').insert({ cliente_id: clienteId, ...c })
  if (error) throw error
}
export async function excluirCampanhaPauta(id: string) {
  if (!supabase) { demoCampanhas = demoCampanhas.filter((x) => x.id !== id); return }
  const { error } = await supabase.from('campanhas_pauta').delete().eq('id', id)
  if (error) throw error
}

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
export async function virarCard(p: Pauta, clienteId: string, data: { nome: string; descricao: string } | null): Promise<string> {
  const quadro = await carregarQuadro(clienteId)
  if (!quadro || !quadro.colunas.length) throw new Error('O cliente ainda não tem um Kanban de redes sociais.')
  const coluna = quadro.colunas[0]
  const posicao = quadro.cards.filter((c) => c.coluna_id === coluna.id).length + 1
  const id = await criarCard(quadro.id, coluna.id, p.titulo, posicao)
  const briefing = [p.descricao, data && `Data/campanha: ${data.nome} (${data.descricao})`, p.tema && `Tema: ${p.tema}`, 'Ideia vinda do Acervo de Pauta.'].filter(Boolean).join('\n\n')
  await salvarCard(id, {
    briefing, tipo_conteudo: p.tipo_conteudo,
    anexos: p.referencias.map((r) => ({ id: r.id, tipo: 'link' as const, nome: r.nome, url: r.url, criado_em: new Date().toISOString() })),
  })
  await salvarPauta(p.id, { situacao: p.reutilizavel ? 'ideia' : 'usada', card_id: id, usada_em: new Date().toISOString() })
  return id
}

// ---------------------------------------------------------------- TV do marketing
let demoMostrarNaTv = true
/** Se as campanhas aparecem na TV. null = o cliente ainda não tem link da TV (ou quem pergunta não é administrador). */
export async function mostrarCampanhasNaTv(clienteId: string): Promise<boolean | null> {
  if (!supabase) return demoMostrarNaTv
  const { data } = await supabase.from('paineis_tv').select('mostrar_campanhas').eq('cliente_id', clienteId).maybeSingle()
  return data ? Boolean(data.mostrar_campanhas) : null
}
export async function definirCampanhasNaTv(clienteId: string, mostrar: boolean) {
  if (!supabase) { demoMostrarNaTv = mostrar; return }
  const { error } = await supabase.from('paineis_tv').update({ mostrar_campanhas: mostrar }).eq('cliente_id', clienteId)
  if (error) throw error
}
