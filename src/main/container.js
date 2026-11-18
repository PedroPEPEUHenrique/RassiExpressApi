import { UnidadeDeTrabalhoMySQL } from '../infra/persistencia/mysql.js';
import { HasherBcrypt, EmissorDeTokenJWT } from '../infra/seguranca/index.js';

import { RepositorioUsuarioMySQL, RepositorioFuncionarioMySQL, RepositorioEmpresaMySQL }
  from '../contextos/acesso/infra/repositorios.js';
import { RepositorioMesaMySQL, RepositorioComandaMySQL, RepositorioRodadaMySQL }
  from '../contextos/salao/infra/repositorios.js';
import { RepositorioProdutoMySQL, RepositorioCategoriaMySQL }
  from '../contextos/cardapio/infra/repositorios.js';
import { RepositorioCaixaMySQL, ConsultasDeRelatorioMySQL }
  from '../contextos/financeiro/infra/repositorios.js';
import { RepositorioInsumoMySQL, RepositorioFichaMySQL }
  from '../contextos/estoque/infra/repositorios.js';

import * as acesso from '../contextos/acesso/aplicacao/casos.js';
import * as cardapio from '../contextos/cardapio/aplicacao/casos.js';
import * as financeiro from '../contextos/financeiro/aplicacao/casos.js';
import * as estoque from '../contextos/estoque/aplicacao/casos.js';
import { ListarComandasAbertas, VerComanda, AbrirComanda, FecharComanda }
  from '../contextos/salao/aplicacao/casosComanda.js';
import { VerRodada, VerFilaDaCozinha, LancarRodada, AvancarStatusDaRodada }
  from '../contextos/salao/aplicacao/casosRodada.js';
import { VerSalao, CriarMesa, AtualizarMesa, DesativarMesa }
  from '../contextos/salao/aplicacao/casosMesa.js';

/**
 * Raiz de composição.
 *
 * É o ÚNICO arquivo onde implementação concreta encontra porta. Em nenhum
 * outro lugar um caso de uso sabe que o banco é MySQL, que o hash é bcrypt ou
 * que o token é JWT.
 *
 * Também é o lugar onde as dependências entre contextos são amarradas — e é
 * por isso que elas são visíveis: dá para ler aqui, numa tela, que o Salão
 * precisa de Cardápio (preço), Estoque (baixa) e Financeiro (caixa). Essa
 * informação antes estava escondida em imports no meio dos services.
 */
function montarContainer() {
  // ---- infraestrutura -----------------------------------------------------
  const unidadeDeTrabalho = new UnidadeDeTrabalhoMySQL();
  const hasher = new HasherBcrypt();
  const emissorDeToken = new EmissorDeTokenJWT({
    segredo: process.env.JWT_SECRET,
    expiraEm: process.env.JWT_EXPIRES_IN,
  });

  // ---- repositórios -------------------------------------------------------
  const repoUsuario = new RepositorioUsuarioMySQL();
  const repoFuncionario = new RepositorioFuncionarioMySQL();
  const repoEmpresa = new RepositorioEmpresaMySQL();
  const repoMesa = new RepositorioMesaMySQL();
  const repoComanda = new RepositorioComandaMySQL();
  const repoRodada = new RepositorioRodadaMySQL();
  const repoProduto = new RepositorioProdutoMySQL();
  const repoCategoria = new RepositorioCategoriaMySQL();
  const repoCaixa = new RepositorioCaixaMySQL();
  const consultasDeRelatorio = new ConsultasDeRelatorioMySQL();
  const repoInsumo = new RepositorioInsumoMySQL();
  const repoFicha = new RepositorioFichaMySQL();

  // ---- contexto Acesso ----------------------------------------------------
  const verDesempenhoDaEquipe = new acesso.VerDesempenhoDaEquipe({ repoFuncionario });
  const casosAcesso = {
    autenticar: new acesso.Autenticar({ repoUsuario, repoFuncionario, hasher, emissorDeToken }),
    listarEquipe: new acesso.ListarEquipe({ repoFuncionario }),
    admitirFuncionario: new acesso.AdmitirFuncionario({ repoUsuario, repoFuncionario, hasher, unidadeDeTrabalho }),
    alterarPapel: new acesso.AlterarPapel({ repoFuncionario }),
    alterarAcesso: new acesso.AlterarAcesso({ repoFuncionario }),
    verDesempenhoDaEquipe,
    verPerfil: new acesso.VerPerfil({ repoUsuario }),
    atualizarPerfil: new acesso.AtualizarPerfil({ repoUsuario }),
    alterarSenha: new acesso.AlterarSenha({ repoUsuario, hasher }),
    verRestaurante: new acesso.VerRestaurante({ repoEmpresa }),
    atualizarRestaurante: new acesso.AtualizarRestaurante({ repoEmpresa }),
  };

  // ---- contexto Cardápio --------------------------------------------------
  const verProduto = new cardapio.VerProduto({ repoProduto });
  const consultarPrecos = new cardapio.ConsultarPrecos({ repoProduto });
  const casosCardapio = {
    verCardapio: new cardapio.VerCardapio({ repoProduto, repoCategoria }),
    listarProdutosDisponiveis: new cardapio.ListarProdutosDisponiveis({ repoProduto }),
    listarProdutosDaCategoria: new cardapio.ListarProdutosDaCategoria({ repoProduto, repoCategoria }),
    verProduto,
    criarProduto: new cardapio.CriarProduto({ repoProduto, repoCategoria }),
    atualizarProduto: new cardapio.AtualizarProduto({ repoProduto, repoCategoria }),
    alternarDisponibilidade: new cardapio.AlternarDisponibilidade({ repoProduto }),
    removerProduto: new cardapio.RemoverProduto({ repoProduto }),
    listarCategorias: new cardapio.ListarCategorias({ repoCategoria }),
    criarCategoria: new cardapio.CriarCategoria({ repoCategoria }),
    atualizarCategoria: new cardapio.AtualizarCategoria({ repoCategoria }),
    removerCategoria: new cardapio.RemoverCategoria({ repoCategoria }),
  };

  // ---- contexto Estoque ---------------------------------------------------
  // Implementa a porta BaixaDeEstoque que o Salão declara.
  const baixaDeEstoque = new estoque.BaixarEstoquePorRodada({ repoInsumo, repoFicha });
  const verFichaTecnica = new estoque.VerFichaTecnica({ repoFicha, consultarProduto: verProduto });
  const casosEstoque = {
    listarInsumos: new estoque.ListarInsumos({ repoInsumo }),
    criarInsumo: new estoque.CriarInsumo({ repoInsumo }),
    atualizarInsumo: new estoque.AtualizarInsumo({ repoInsumo }),
    desativarInsumo: new estoque.DesativarInsumo({ repoInsumo }),
    movimentarEstoque: new estoque.MovimentarEstoque({ repoInsumo, unidadeDeTrabalho }),
    verMovimentosDoInsumo: new estoque.VerMovimentosDoInsumo({ repoInsumo }),
    verFichaTecnica,
    salvarFichaTecnica: new estoque.SalvarFichaTecnica({
      repoFicha, repoInsumo, consultarProduto: verProduto, verFichaTecnica, unidadeDeTrabalho,
    }),
    removerDaFichaTecnica: new estoque.RemoverDaFichaTecnica({ repoFicha, consultarProduto: verProduto }),
  };

  // ---- contexto Financeiro ------------------------------------------------
  const verCaixa = new financeiro.VerCaixa({ repoCaixa });
  // Implementa a porta RegistroNoCaixa que o Salão declara.
  const registroNoCaixa = new financeiro.RegistrarVendaNoCaixa({ repoCaixa });
  const casosFinanceiro = {
    verCaixaAtual: new financeiro.VerCaixaAtual({ repoCaixa }),
    verCaixa,
    verHistoricoDeCaixa: new financeiro.VerHistoricoDeCaixa({ repoCaixa }),
    abrirCaixa: new financeiro.AbrirCaixa({ repoCaixa, verCaixa }),
    fecharCaixa: new financeiro.FecharCaixa({
      repoCaixa,
      // O Financeiro precisa saber se há mesa aberta, mas não deve conhecer o
      // repositório do Salão: recebe uma função, não o repositório inteiro.
      contagemDeComandasAbertas: (idEmpresa) => repoComanda.contarAbertas(idEmpresa),
      unidadeDeTrabalho,
    }),
    lancarMovimento: new financeiro.LancarMovimento({ repoCaixa, verCaixa }),
    verPainelDeRelatorios: new financeiro.VerPainelDeRelatorios({ consultasDeRelatorio, verDesempenhoDaEquipe }),
  };

  // ---- contexto Salão -----------------------------------------------------
  const verComanda = new VerComanda({ repoComanda, repoRodada });
  const casosSalao = {
    verSalao: new VerSalao({ repoMesa }),
    criarMesa: new CriarMesa({ repoMesa }),
    atualizarMesa: new AtualizarMesa({ repoMesa }),
    desativarMesa: new DesativarMesa({ repoMesa, repoComanda }),
    listarComandasAbertas: new ListarComandasAbertas({ repoComanda }),
    verComanda,
    abrirComanda: new AbrirComanda({ repoComanda, repoMesa, verComanda }),
    fecharComanda: new FecharComanda({ repoComanda, repoRodada, registroNoCaixa, unidadeDeTrabalho }),
    verRodada: new VerRodada({ repoRodada }),
    verFilaDaCozinha: new VerFilaDaCozinha({ repoRodada }),
    lancarRodada: new LancarRodada({
      repoRodada, repoComanda, cardapioConsulta: consultarPrecos, baixaDeEstoque, unidadeDeTrabalho,
    }),
    avancarStatusDaRodada: new AvancarStatusDaRodada({ repoRodada, repoComanda, unidadeDeTrabalho }),
  };

  return { ...casosAcesso, ...casosCardapio, ...casosSalao, ...casosFinanceiro, ...casosEstoque };
}

export { montarContainer };
