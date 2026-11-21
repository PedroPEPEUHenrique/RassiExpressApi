import { Router } from 'express';
import { adaptar } from '../infra/http/adaptador.js';
import ap from '../infra/http/apresentadores.js';
import validate from '../infra/http/middleware/validate.js';
import { autorizarProprietario, autorizarPapel, escopoEmpresa } from '../infra/http/middleware/auth.js';
import { limiteEscrita, limiteLoginPorIp, limiteLoginPorEmail } from '../infra/http/middleware/rateLimit.js';
import { resolverPeriodo } from '../infra/http/periodo.js';

import { loginSchema, atualizarUsuarioSchema, alterarSenhaSchema } from '../infra/http/validators/usuarioValidators.js';
import { criarFuncionarioSchema, alterarPapelSchema, alterarAtivoSchema } from '../infra/http/validators/funcionarioValidators.js';
import { atualizarEmpresaSchema } from '../infra/http/validators/empresaValidators.js';
import { criarProdutoSchema, atualizarProdutoSchema, disponibilidadeSchema } from '../infra/http/validators/produtoValidators.js';
import { criarProdutoCategoriaSchema, atualizarProdutoCategoriaSchema } from '../infra/http/validators/produtoCategoriaValidators.js';
import { criarMesaSchema, atualizarMesaSchema } from '../infra/http/validators/mesaValidators.js';
import { abrirComandaSchema, fecharComandaSchema } from '../infra/http/validators/comandaValidators.js';
import { lancarRodadaSchema, atualizarStatusSchema } from '../infra/http/validators/pedidoValidators.js';
import { abrirCaixaSchema, fecharCaixaSchema, lancarMovimentoSchema } from '../infra/http/validators/caixaValidators.js';
import { criarInsumoSchema, atualizarInsumoSchema, movimentarSchema, salvarFichaSchema } from '../infra/http/validators/estoqueValidators.js';

/**
 * Rotas: a borda externa.
 *
 * Cada linha liga um caminho HTTP a um caso de uso através de `adaptar`. Não
 * há controller: a tradução é sempre a mesma e virou uma função.
 *
 * As três camadas de acesso continuam explícitas na própria rota — é a
 * documentação viva de quem pode o quê:
 *   autenticar     token válido, já contendo empresa e papel
 *   escopoEmpresa  quando o id do restaurante vem pela URL, exige o do token
 *   autorizarPapel restringe a gestor, garçom ou cozinha
 */
function montarRotas({ casos, autenticar }) {
  const router = Router();
  const caso = (nome) => () => casos[nome];

  // Toda rota que grava passa por ESCRITA. O limite vem DEPOIS de autenticar
  // porque é lá que req.usuario existe, e contar por usuário em vez de por IP
  // é o que mantém o limite justo num restaurante onde todos os aparelhos
  // dividem o mesmo WiFi.
  const ESCRITA = [autenticar, limiteEscrita];
  const EQUIPE = ['gestor', 'garcom', 'cozinha'];
  const SALAO = ['gestor', 'garcom'];

  /** Período a partir de ?de=&ate=, com hoje como padrão. */
  const comPeriodo = (req) => {
    const p = resolverPeriodo(req.query);
    return { ...req.params, de: p.de, ate: p.ate, rotulo: p.rotulo };
  };

  // ---- Pública: única porta de entrada ------------------------------------
  router.post('/usuarios/login',
    limiteLoginPorIp, limiteLoginPorEmail, validate(loginSchema),
    adaptar(caso('autenticar'), { apresentar: ap.login }));

  // ---- Salão: mapa de mesas -----------------------------------------------
  router.get('/mesas', autenticar, autorizarPapel(...EQUIPE), adaptar(caso('verSalao')));
  router.post('/mesas', ...ESCRITA, autorizarPapel('gestor'), validate(criarMesaSchema),
    adaptar(caso('criarMesa'), { status: 201 }));
  router.put('/mesas/:idMesa', ...ESCRITA, autorizarPapel('gestor'), validate(atualizarMesaSchema),
    adaptar(caso('atualizarMesa')));
  router.delete('/mesas/:idMesa', ...ESCRITA, autorizarPapel('gestor'), adaptar(caso('desativarMesa')));

  // ---- Comandas: a conta da mesa ------------------------------------------
  router.get('/comandas', autenticar, autorizarPapel(...EQUIPE), adaptar(caso('listarComandasAbertas'), { apresentar: ap.comandas }));
  router.post('/comandas', ...ESCRITA, autorizarPapel(...SALAO), validate(abrirComandaSchema),
    adaptar(caso('abrirComanda'), { status: 201, apresentar: ap.comanda }));
  router.get('/comandas/:idComanda', autenticar, autorizarPapel(...EQUIPE), adaptar(caso('verComanda'), { apresentar: ap.comanda }));
  router.patch('/comandas/:idComanda/fechar', ...ESCRITA, autorizarPapel(...SALAO), validate(fecharComandaSchema),
    adaptar(caso('fecharComanda'), { apresentar: ap.comanda }));

  // Lançar rodada é operação sobre a comanda, e a URL diz isso: a rodada não
  // existe fora de uma conta aberta.
  router.post('/comandas/:idComanda/pedidos', ...ESCRITA, autorizarPapel(...SALAO), validate(lancarRodadaSchema),
    adaptar(caso('lancarRodada'), { status: 201, apresentar: ap.rodada }));

  // ---- Cozinha ------------------------------------------------------------
  router.get('/cozinha/fila', autenticar, autorizarPapel(...EQUIPE), adaptar(caso('verFilaDaCozinha'), { apresentar: ap.rodadas }));
  router.get('/pedidos/:idPedido', autenticar, autorizarPapel(...EQUIPE), adaptar(caso('verRodada'), { apresentar: ap.rodada }));
  // O garçom também avança status: é ele quem marca "entregue" na mesa.
  router.patch('/pedidos/:idPedido/status', ...ESCRITA, autorizarPapel(...EQUIPE), validate(atualizarStatusSchema),
    adaptar(caso('avancarStatusDaRodada'), { apresentar: ap.rodada }));

  // ---- Equipe --------------------------------------------------------------
  router.get('/funcionarios', autenticar, autorizarPapel('gestor'), adaptar(caso('listarEquipe'), { apresentar: (l) => l.map(ap.funcionario) }));
  router.post('/funcionarios', ...ESCRITA, autorizarPapel('gestor'), validate(criarFuncionarioSchema),
    adaptar(caso('admitirFuncionario'), { status: 201 }));
  router.patch('/funcionarios/:idFuncionario/papel', ...ESCRITA, autorizarPapel('gestor'), validate(alterarPapelSchema),
    adaptar(caso('alterarPapel'), { apresentar: ap.funcionario }));
  router.patch('/funcionarios/:idFuncionario/ativo', ...ESCRITA, autorizarPapel('gestor'), validate(alterarAtivoSchema),
    adaptar(caso('alterarAcesso'), { apresentar: ap.funcionario }));
  router.get('/equipe/desempenho', autenticar, autorizarPapel('gestor'),
    adaptar(caso('verDesempenhoDaEquipe'), { entrada: comPeriodo, apresentar: ap.desempenho }));

  // ---- Caixa ---------------------------------------------------------------
  // Abrir e fechar é do gestor. Lançar movimento é liberado ao salão porque
  // sangria e suprimento acontecem durante o serviço, com o gestor longe do
  // aparelho; a cozinha fica de fora por não lidar com dinheiro.
  router.get('/caixa', autenticar, autorizarPapel(...SALAO), adaptar(caso('verCaixaAtual'), { apresentar: ap.caixa }));
  router.post('/caixa', ...ESCRITA, autorizarPapel('gestor'), validate(abrirCaixaSchema),
    adaptar(caso('abrirCaixa'), { status: 201, apresentar: ap.caixa }));
  router.patch('/caixa/:idCaixa/fechar', ...ESCRITA, autorizarPapel('gestor'), validate(fecharCaixaSchema),
    adaptar(caso('fecharCaixa'), { apresentar: ap.caixa }));
  router.post('/caixa/movimentos', ...ESCRITA, autorizarPapel(...SALAO), validate(lancarMovimentoSchema),
    adaptar(caso('lancarMovimento'), { status: 201, apresentar: ap.caixa }));
  router.get('/caixa/historico', autenticar, autorizarPapel('gestor'),
    adaptar(caso('verHistoricoDeCaixa'), { entrada: comPeriodo, apresentar: ap.caixas }));
  router.get('/caixa/:idCaixa', autenticar, autorizarPapel('gestor'), adaptar(caso('verCaixa'), { apresentar: ap.caixa }));

  // ---- Relatórios ----------------------------------------------------------
  router.get('/relatorios/painel', autenticar, autorizarPapel('gestor'),
    adaptar(caso('verPainelDeRelatorios'), { entrada: comPeriodo }));

  // ---- Restaurante e perfil ------------------------------------------------
  router.get('/empresas/:idEmpresa', autenticar, escopoEmpresa(), adaptar(caso('verRestaurante'), { apresentar: ap.restaurante }));
  router.put('/empresas/:idEmpresa', ...ESCRITA, escopoEmpresa(), autorizarPapel('gestor'),
    validate(atualizarEmpresaSchema), adaptar(caso('atualizarRestaurante'), { apresentar: ap.restaurante }));

  router.patch('/usuarios/senha', ...ESCRITA, validate(alterarSenhaSchema), adaptar(caso('alterarSenha')));
  router.get('/usuarios/:idUsuario', autenticar, autorizarProprietario('idUsuario'), adaptar(caso('verPerfil'), { apresentar: ap.usuario }));
  router.put('/usuarios/:idUsuario', ...ESCRITA, autorizarProprietario('idUsuario'),
    validate(atualizarUsuarioSchema), adaptar(caso('atualizarPerfil'), { apresentar: ap.usuario }));

  // ---- Cardápio ------------------------------------------------------------
  // Leitura para toda a equipe (o garçom lança a partir dela); escrita só
  // para o gestor.
  router.get('/cardapio', autenticar, autorizarPapel('gestor'), adaptar(caso('verCardapio'), { apresentar: ap.cardapio }));
  router.get('/produto-categorias/:idEmpresa', autenticar, escopoEmpresa(), adaptar(caso('listarCategorias'), { apresentar: ap.categorias }));
  router.get('/produtos/empresa/:idEmpresa', autenticar, escopoEmpresa(), adaptar(caso('listarProdutosDisponiveis'), { apresentar: ap.produtos }));
  router.get('/produtos/categoria/:idCategoria', autenticar, adaptar(caso('listarProdutosDaCategoria'), { apresentar: ap.produtos }));
  router.get('/produtos/:idProduto', autenticar, adaptar(caso('verProduto'), { apresentar: ap.produto }));

  // Marcar "acabou" é liberado para toda a equipe: quem descobre que o filé
  // acabou é quem está no salão ou na cozinha, e exigir o gestor significaria
  // continuar vendendo o que não existe.
  router.patch('/produtos/:idProduto/disponibilidade', ...ESCRITA, autorizarPapel(...EQUIPE),
    validate(disponibilidadeSchema), adaptar(caso('alternarDisponibilidade')));

  router.post('/produto-categorias', ...ESCRITA, autorizarPapel('gestor'), validate(criarProdutoCategoriaSchema),
    adaptar(caso('criarCategoria'), { status: 201 }));
  router.put('/produto-categorias/:idCategoria', ...ESCRITA, autorizarPapel('gestor'),
    validate(atualizarProdutoCategoriaSchema), adaptar(caso('atualizarCategoria')));
  router.delete('/produto-categorias/:idCategoria', ...ESCRITA, autorizarPapel('gestor'),
    adaptar(caso('removerCategoria')));

  router.post('/produtos', ...ESCRITA, autorizarPapel('gestor'), validate(criarProdutoSchema),
    adaptar(caso('criarProduto'), { status: 201 }));
  router.put('/produtos/:idProduto', ...ESCRITA, autorizarPapel('gestor'), validate(atualizarProdutoSchema),
    adaptar(caso('atualizarProduto')));
  router.delete('/produtos/:idProduto', ...ESCRITA, autorizarPapel('gestor'), adaptar(caso('removerProduto')));

  // ---- Estoque -------------------------------------------------------------
  // Registrar perda é liberado ao salão e à cozinha: quem derruba o prato ou
  // vê o insumo estragar é quem está lá. Criar e dar entrada seguem com o
  // gestor, porque mexem em custo.
  router.get('/insumos', autenticar, autorizarPapel(...EQUIPE), adaptar(caso('listarInsumos')));
  router.post('/insumos', ...ESCRITA, autorizarPapel('gestor'), validate(criarInsumoSchema),
    adaptar(caso('criarInsumo'), { status: 201 }));
  router.put('/insumos/:idInsumo', ...ESCRITA, autorizarPapel('gestor'), validate(atualizarInsumoSchema),
    adaptar(caso('atualizarInsumo')));
  router.delete('/insumos/:idInsumo', ...ESCRITA, autorizarPapel('gestor'), adaptar(caso('desativarInsumo')));
  router.get('/insumos/:idInsumo/movimentos', autenticar, autorizarPapel('gestor'),
    adaptar(caso('verMovimentosDoInsumo'), { apresentar: ap.movimentosEstoque }));
  router.post('/insumos/:idInsumo/movimentos', ...ESCRITA, autorizarPapel(...EQUIPE), validate(movimentarSchema),
    adaptar(caso('movimentarEstoque'), { status: 201 }));

  router.get('/produtos/:idProduto/ficha', autenticar, autorizarPapel('gestor'), adaptar(caso('verFichaTecnica')));
  router.put('/produtos/:idProduto/ficha', ...ESCRITA, autorizarPapel('gestor'), validate(salvarFichaSchema),
    adaptar(caso('salvarFichaTecnica')));
  router.delete('/produtos/:idProduto/ficha/:idInsumo', ...ESCRITA, autorizarPapel('gestor'),
    adaptar(caso('removerDaFichaTecnica')));

  return router;
}

export { montarRotas };
