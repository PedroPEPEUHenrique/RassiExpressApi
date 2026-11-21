/**
 * Contrato da API — fonte única das formas que trafegam entre servidor e app.
 *
 * Por que existe: até aqui a API devolvia linha crua do banco (`id_pedido`,
 * `vl_total`, `nome_produto`) e cada service do app reconvertia à mão para
 * camelCase. Eram 38 linhas de conversão espalhadas, e renomear uma coluna
 * quebrava o aplicativo em silêncio — o TypeScript não enxerga a API.
 *
 * Agora o servidor apresenta nestes nomes e o app importa estes tipos. Mudar
 * um campo aqui quebra a compilação dos dois lados, que é exatamente o que se
 * quer.
 *
 * ESTE ARQUIVO MORA NA API. A cópia dentro do app é gerada por
 * `npm run contrato:sync` e não deve ser editada lá.
 *
 * Regra de nomes: camelCase; `id` prefixa identificador, `vl` valor
 * monetário, `qtd` quantidade, `dt` data. É a mesma convenção do banco, sem o
 * underscore — a tradução acontece nos apresentadores, em infra/http.
 */

export type Papel = 'gestor' | 'garcom' | 'cozinha';

/** Fluxo de uma rodada na cozinha. Espelha o FLUXO do domínio do salão. */
export type StatusRodada = 'enviado' | 'em_preparo' | 'pronto' | 'entregue' | 'cancelado';

export type StatusComanda = 'aberta' | 'fechada' | 'cancelada';

export type TipoMovimentoCaixa = 'venda' | 'venda_externa' | 'despesa' | 'sangria' | 'suprimento';

export type UnidadeInsumo = 'kg' | 'g' | 'l' | 'ml' | 'un';

// ---------------------------------------------------------------------------
// Acesso
// ---------------------------------------------------------------------------

export interface UsuarioContrato {
  idUsuario: number;
  nome: string;
  email: string;
  telefone?: string | null;
}

export interface EmpresaResumo {
  idEmpresa: number;
  nome: string;
}

/** POST /usuarios/login */
export interface RespostaLogin {
  token: string;
  usuario: UsuarioContrato;
  papel: Papel;
  empresa: EmpresaResumo;
}

/**
 * O 409 do login de quem trabalha em mais de um restaurante.
 *
 * Chega no campo `dados` do erro; o app usa para perguntar onde entrar.
 */
export interface EscolhaDeEmpresa {
  idEmpresa: number;
  nome: string;
  papel: Papel;
}

export interface Funcionario {
  idFuncionario: number;
  idUsuario: number;
  nome: string;
  email: string;
  telefone?: string | null;
  papel: Papel;
  /** Desligar é desativar: o histórico de vendas da pessoa é preservado. */
  ativo: boolean;
  dtAdmissao: string;
}

/** GET /equipe/desempenho */
export interface DesempenhoDeFuncionario {
  idFuncionario: number;
  nome: string;
  papel: Papel;
  ativo: boolean;
  comandas: number;
  rodadas: number;
  vlTotal: number;
  vlTicketMedio: number;
}

export interface Restaurante {
  idEmpresa: number;
  nome: string;
  icone?: string | null;
  cep?: string | null;
  endereco?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  ativo: boolean;
}

// ---------------------------------------------------------------------------
// Cardápio
// ---------------------------------------------------------------------------

export interface Produto {
  idProduto: number;
  idProdutoCategoria: number;
  nome: string;
  descricao: string;
  valor: number;
  icone?: string;
  /** Está no cardápio. Decisão de cardápio, rara. */
  ativo: boolean;
  /** Tem hoje. "Acabou o filé", um toque, toda noite. */
  disponivel: boolean;
}

export interface ProdutoCategoria {
  idProdutoCategoria: number;
  categoria: string;
  ordem: number;
}

/** GET /cardapio — categorias com seus produtos. */
export interface SecaoCardapio extends ProdutoCategoria {
  produtos: Produto[];
}

// ---------------------------------------------------------------------------
// Salão
// ---------------------------------------------------------------------------

/** GET /mesas. `ocupada` é derivado da existência de comanda aberta. */
export interface Mesa {
  idMesa: number;
  numero: string;
  setor?: string | null;
  capacidade?: number | null;
  ocupada: boolean;
  idComanda?: number | null;
  dtAbertura?: string | null;
  vlTotal?: number | null;
  nomeGarcom?: string | null;
}

export interface ItemRodada {
  idItensPedido: number;
  idProduto: number;
  nomeProduto: string;
  observacao?: string | null;
  quantidade: number;
  vlUnitario: number;
  vlTotal: number;
}

export interface Rodada {
  idPedido: number;
  idComanda: number | null;
  status: StatusRodada;
  dtPedido: string;
  vlTotal: number;
  numeroMesa?: string | null;
  nomeGarcom?: string | null;
  itens: ItemRodada[];
}

export interface Comanda {
  idComanda: number;
  idMesa: number;
  numeroMesa: string;
  setor?: string | null;
  status: StatusComanda;
  vlTotal: number;
  dtAbertura: string;
  dtFechamento?: string | null;
  nomeGarcom?: string | null;
  rodadas: Rodada[];
}

/** GET /comandas — a lista não carrega as rodadas. */
export interface ComandaResumo {
  idComanda: number;
  idMesa: number;
  numeroMesa: string;
  setor?: string | null;
  status: StatusComanda;
  vlTotal: number;
  dtAbertura: string;
  nomeGarcom?: string | null;
}

// ---------------------------------------------------------------------------
// Financeiro
// ---------------------------------------------------------------------------

export interface MovimentoCaixa {
  idMovimento: number;
  /** 'venda' nasce do fechamento da comanda; os outros são manuais. */
  tipo: TipoMovimentoCaixa;
  descricao: string;
  valor: number;
  numeroMesa?: string | null;
  nomeFuncionario?: string | null;
  dtMovimento: string;
}

export interface ResumoCaixa {
  vlAbertura: number;
  vendas: number;
  vendasExternas: number;
  suprimentos: number;
  despesas: number;
  sangrias: number;
  movimentos: number;
  /** Quanto deveria haver na gaveta. */
  vlEsperado: number;
  vlInformado: number | null;
  /** Positivo = sobrou; negativo = faltou. null enquanto o caixa está aberto. */
  vlDiferenca: number | null;
}

export interface Caixa {
  idCaixa: number;
  status: 'aberto' | 'fechado';
  dtAbertura: string;
  dtFechamento: string | null;
  nomeAbertura?: string | null;
  resumo: ResumoCaixa;
  movimentos: MovimentoCaixa[];
}

/** GET /relatorios/painel */
export interface PainelRelatorio {
  periodo: { de: string; ate: string };
  resumo: {
    comandas: number;
    faturamento: number;
    ticketMedio: number;
    rodadasCanceladas: number;
  };
  porDia: { dia: string; comandas: number; faturamento: number }[];
  maisVendidos: { nome: string; quantidade: number; faturamento: number }[];
  porHora: { hora: number; comandas: number; faturamento: number }[];
  equipe: {
    idFuncionario: number;
    nome: string;
    papel: Papel;
    comandas: number;
    faturamento: number;
  }[];
}

// ---------------------------------------------------------------------------
// Estoque
// ---------------------------------------------------------------------------

export interface Insumo {
  idInsumo: number;
  nome: string;
  unidade: UnidadeInsumo;
  qtdAtual: number;
  qtdMinima: number;
  vlCustoMedio: number;
  /** Saldo no mínimo ou abaixo. */
  repor: boolean;
}

export interface MovimentoEstoque {
  idMovimento: number;
  tipo: 'entrada' | 'saida_venda' | 'perda' | 'ajuste';
  quantidade: number;
  vlUnitario: number | null;
  idPedido?: number | null;
  nomeFuncionario?: string | null;
  motivo?: string | null;
  dtMovimento: string;
}

export interface ItemFichaTecnica {
  idInsumo: number;
  nome: string;
  unidade: UnidadeInsumo;
  quantidade: number;
  vlCustoMedio: number;
  vlCusto: number;
}

export interface FichaTecnica {
  idProduto: number;
  nome: string;
  valor: number;
  itens: ItemFichaTecnica[];
  vlCusto: number;
  /** null quando não há ficha: sem receita o custo é desconhecido, não zero. */
  vlMargem: number | null;
  percMargem: number | null;
}

// ---------------------------------------------------------------------------
// Erro
// ---------------------------------------------------------------------------

/** Toda recusa da API responde nesta forma. */
export interface ErroApi {
  mensagem: string;
  /** Contexto para o app agir: lista de empresas, rodadas pendentes, etc. */
  dados?: Record<string, unknown>;
}
