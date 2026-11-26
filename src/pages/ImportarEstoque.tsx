import { ImportarPlanilha, type Conversao } from '../components/Planilha'
import { dataIso, normalizar, numero, textoDe } from '../lib/planilhas'
import { CATEGORIAS, UNIDADES, importarEstoque, type ItemImportado } from '../lib/estoque'
import { MODELO_ESTOQUE } from '../lib/modelos'
import { useSessao } from '../lib/sessao'

const SINONIMOS: Record<string, string[]> = {
  nome: ['nome', 'item', 'produto', 'material', 'descricao'],
  categoria: ['categoria', 'tipo', 'grupo'],
  unidade: ['unidade', 'un', 'medida'],
  quantidade: ['quantidade', 'qtd', 'qtde', 'saldo', 'estoque'],
  minimo: ['minimo', 'estoque minimo', 'avisar abaixo de'],
  local: ['local', 'onde fica', 'localizacao', 'armario'],
  validade: ['validade', 'vencimento', 'vence em'],
}


const achar = (lista: string[], t: string) => lista.find((x) => normalizar(x) === normalizar(t)) ?? (t || null)

function converter(l: (string | number | Date | null | undefined)[], m: Record<string, number>): Conversao<ItemImportado> {
  const bruto = (c: string) => (m[c] === undefined ? null : l[m[c]])
  const v = (c: string) => textoDe(bruto(c)).trim()
  const nome = v('nome')
  if (!nome) return { ok: false, erro: 'sem nome do item' }
  const quantidade = numero(bruto('quantidade'))
  if (v('quantidade') && quantidade === null) return { ok: false, erro: `${nome}: quantidade "${v('quantidade')}" não é número` }
  if (quantidade !== null && quantidade < 0) return { ok: false, erro: `${nome}: quantidade negativa` }
  const validade = dataIso(bruto('validade') ?? null)
  if (v('validade') && !validade) return { ok: false, erro: `${nome}: validade "${v('validade')}" (use dd/mm/aaaa)` }
  return {
    ok: true,
    item: { nome, categoria: achar(CATEGORIAS, v('categoria')), unidade: v('unidade') ? achar(UNIDADES, v('unidade').toLowerCase()) : null, quantidade, minimo: numero(bruto('minimo')), local: v('local') || null, validade },
  }
}

/** Importar itens do estoque: cria os novos e atualiza os que já existem pelo nome. */
export function ImportarEstoque({ onFechar, onImportado }: { onFechar: () => void; onImportado: () => Promise<void> }) {
  const { cliente } = useSessao()
  return (
    <ImportarPlanilha<ItemImportado>
      titulo="Importar estoque de planilha" nome="estoque" modelo={MODELO_ESTOQUE}
      sinonimos={SINONIMOS} obrigatorias={['nome']} converter={converter}
      previa={[
        { rotulo: 'Item', valor: (i) => i.nome },
        { rotulo: 'Categoria', valor: (i) => i.categoria ?? '—' },
        { rotulo: 'Quantidade', valor: (i) => (i.quantidade == null ? '—' : `${i.quantidade} ${i.unidade ?? ''}`) },
        { rotulo: 'Mínimo', valor: (i) => i.minimo ?? '—' },
        { rotulo: 'Local', valor: (i) => i.local ?? '—' },
        { rotulo: 'Validade', valor: (i) => (i.validade ? new Date(`${i.validade}T12:00:00`).toLocaleDateString('pt-BR') : '—') },
      ]}
      aviso={<p className="faixa-dica">Itens com o mesmo nome de um que já existe são atualizados. Se a quantidade for diferente, entra como "ajuste pela contagem" no histórico.</p>}
      enviar={async (itens) => {
        const r = await importarEstoque(cliente!.id, itens)
        await onImportado()
        return `${r.novos} ${r.novos === 1 ? 'item novo' : 'itens novos'} e ${r.atualizados} ${r.atualizados === 1 ? 'atualizado' : 'atualizados'}${r.invalidos ? ` · ${r.invalidos} com problema` : ''}.`
      }}
      onFechar={onFechar} />
  )
}
