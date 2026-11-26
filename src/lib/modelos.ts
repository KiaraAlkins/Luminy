import type { Tabela } from './planilhas'

/** Planilhas modelo com as colunas que o Luminy reconhece na importação. */
export const MODELO_LEADS: Tabela = {
  colunas: ['Nome', 'WhatsApp', 'E-mail', 'Plano de saúde', 'Segmentos', 'Aceita campanhas', 'Etapa'],
  linhas: [['Maria Souza', '(61) 99999-0000', 'maria@exemplo.com', 'Unimed', 'Risco de diabetes', 'Sim', 'Novo']],
}

export const MODELO_ESTOQUE: Tabela = {
  colunas: ['Nome', 'Categoria', 'Unidade', 'Quantidade', 'Mínimo', 'Local', 'Validade'],
  linhas: [['Fitas de glicemia', 'Saúde', 'caixa', 10, 5, 'Armário 2', '31/12/2027'], ['Squeeze Novembro Azul', 'Brindes', 'un', 140, 50, 'Depósito', null]],
}

