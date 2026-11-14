import { Router } from "express";
import controlEmpresa from "./controllers/controlEmpresa.js"
import controlProduto from "./controllers/controlProduto.js"
import controlProdutoCategoria from "./controllers/controlProdutoCategoria.js"
import controlUsuario from "./controllers/controlUsuario.js"
import controlFuncionario from "./controllers/controlFuncionario.js"
import controlMesa from "./controllers/controlMesa.js"
import controlComanda from "./controllers/controlComanda.js"
import controlPedido from "./controllers/controlPedido.js"
import controlCardapio from "./controllers/controlCardapio.js"
import controlCaixa from "./controllers/controlCaixa.js"
import controlRelatorio from "./controllers/controlRelatorio.js"
import controlEstoque from "./controllers/controlEstoque.js"
import validate from "./middleware/validate.js"
import { autenticar, autorizarProprietario, autorizarPapel, escopoEmpresa } from "./middleware/auth.js"
import { loginSchema, atualizarUsuarioSchema, alterarSenhaSchema } from "./validators/usuarioValidators.js"
import { criarFuncionarioSchema, alterarPapelSchema, alterarAtivoSchema } from "./validators/funcionarioValidators.js"
import { abrirCaixaSchema, fecharCaixaSchema, lancarMovimentoSchema } from "./validators/caixaValidators.js"
import { criarInsumoSchema, atualizarInsumoSchema, movimentarSchema, salvarFichaSchema } from "./validators/estoqueValidators.js"
import { atualizarEmpresaSchema } from "./validators/empresaValidators.js"
import { criarProdutoSchema, atualizarProdutoSchema, disponibilidadeSchema } from "./validators/produtoValidators.js"
import { criarProdutoCategoriaSchema, atualizarProdutoCategoriaSchema } from "./validators/produtoCategoriaValidators.js"
import { criarMesaSchema, atualizarMesaSchema } from "./validators/mesaValidators.js"
import { abrirComandaSchema, fecharComandaSchema } from "./validators/comandaValidators.js"
import { lancarRodadaSchema, atualizarStatusSchema } from "./validators/pedidoValidators.js"

const router = Router();

// ===========================================================================
// POLÍTICA DE ACESSO
//
// Não existe rota pública além do login. Três camadas se combinam:
//   autenticar     — token válido, já contendo empresa e papel
//   escopoEmpresa  — quando o id do restaurante vem pela URL, exige o do token
//   autorizarPapel — restringe a gestor, garçom ou cozinha
//
// Quando o id do restaurante NÃO vem pela URL, o valor usado é sempre
// req.usuario.idEmpresa. O corpo da requisição nunca decide isso.
//
// Papéis no salão:
//   garçom  — abre mesa, lança rodada, entrega, fecha a conta
//   cozinha — vê a fila e avança o preparo
//   gestor  — tudo, mais cardápio, mesas e equipe
// ===========================================================================

const EQUIPE = ["gestor", "garcom", "cozinha"];
const SALAO = ["gestor", "garcom"];

// ---------------------------------------------------------------------------
// Pública — única porta de entrada.
// ---------------------------------------------------------------------------
router.post("/usuarios/login", validate(loginSchema), controlUsuario.Login)

// ---------------------------------------------------------------------------
// Salão — mapa de mesas.
// ---------------------------------------------------------------------------
router.get("/mesas", autenticar, autorizarPapel(...EQUIPE), controlMesa.ListarSalao)
router.post("/mesas", autenticar, autorizarPapel("gestor"), validate(criarMesaSchema), controlMesa.Criar)
router.put("/mesas/:idMesa", autenticar, autorizarPapel("gestor"), validate(atualizarMesaSchema), controlMesa.Atualizar)
router.delete("/mesas/:idMesa", autenticar, autorizarPapel("gestor"), controlMesa.Desativar)

// ---------------------------------------------------------------------------
// Comandas — a conta da mesa.
// ---------------------------------------------------------------------------
router.get("/comandas", autenticar, autorizarPapel(...EQUIPE), controlComanda.ListarAbertas)
router.post("/comandas", autenticar, autorizarPapel(...SALAO), validate(abrirComandaSchema), controlComanda.Abrir)
router.get("/comandas/:idComanda", autenticar, autorizarPapel(...EQUIPE), controlComanda.ListarPorId)
router.patch("/comandas/:idComanda/fechar", autenticar, autorizarPapel(...SALAO), validate(fecharComandaSchema), controlComanda.Fechar)

// Lançar rodada é operação sobre a comanda, e a URL diz isso: a rodada não
// existe fora de uma conta aberta.
router.post("/comandas/:idComanda/pedidos", autenticar, autorizarPapel(...SALAO), validate(lancarRodadaSchema), controlComanda.LancarRodada)

// ---------------------------------------------------------------------------
// Cozinha — a fila de preparo.
//
// O garçom também avança status: é ele quem marca "entregue" ao levar o prato
// à mesa.
// ---------------------------------------------------------------------------
router.get("/cozinha/fila", autenticar, autorizarPapel(...EQUIPE), controlPedido.ListarFilaCozinha)
router.get("/pedidos/:idPedido", autenticar, autorizarPapel(...EQUIPE), controlPedido.ListarPorId)
router.patch("/pedidos/:idPedido/status", autenticar, autorizarPapel(...EQUIPE), validate(atualizarStatusSchema), controlPedido.AtualizarStatus)

// ---------------------------------------------------------------------------
// Restaurante e equipe.
// ---------------------------------------------------------------------------
router.get("/empresas/:idEmpresa", autenticar, escopoEmpresa(), controlEmpresa.ListarPorId)
router.put("/empresas/:idEmpresa", autenticar, escopoEmpresa(), autorizarPapel("gestor"), validate(atualizarEmpresaSchema), controlEmpresa.Atualizar)

// ---------------------------------------------------------------------------
// Equipe — só o gestor administra.
//
// Promover e desligar têm duas travas no service, as duas pela mesma razão:
// ninguém muda o próprio papel nem se desliga, e o último gestor ativo não
// pode deixar de ser gestor. Sem elas o restaurante ficaria trancado para
// fora do próprio sistema, sem ninguém com poder de destrancar.
// ---------------------------------------------------------------------------
router.get("/funcionarios", autenticar, autorizarPapel("gestor"), controlFuncionario.Listar)
router.post("/funcionarios", autenticar, autorizarPapel("gestor"), validate(criarFuncionarioSchema), controlFuncionario.Criar)
router.patch("/funcionarios/:idFuncionario/papel", autenticar, autorizarPapel("gestor"), validate(alterarPapelSchema), controlFuncionario.AlterarPapel)
router.patch("/funcionarios/:idFuncionario/ativo", autenticar, autorizarPapel("gestor"), validate(alterarAtivoSchema), controlFuncionario.AlterarAtivo)
router.get("/equipe/desempenho", autenticar, autorizarPapel("gestor"), controlFuncionario.Desempenho)

// ---------------------------------------------------------------------------
// Caixa — o livro do turno.
//
// Abrir e fechar é do gestor. Lançar movimento é liberado ao salão porque
// sangria e suprimento acontecem durante o serviço, com o gestor longe do
// aparelho; a cozinha fica de fora por não lidar com dinheiro.
// ---------------------------------------------------------------------------
router.get("/caixa", autenticar, autorizarPapel(...SALAO), controlCaixa.Atual)
router.post("/caixa", autenticar, autorizarPapel("gestor"), validate(abrirCaixaSchema), controlCaixa.Abrir)
router.patch("/caixa/:idCaixa/fechar", autenticar, autorizarPapel("gestor"), validate(fecharCaixaSchema), controlCaixa.Fechar)
router.post("/caixa/movimentos", autenticar, autorizarPapel(...SALAO), validate(lancarMovimentoSchema), controlCaixa.Lancar)
router.get("/caixa/historico", autenticar, autorizarPapel("gestor"), controlCaixa.Historico)
router.get("/caixa/:idCaixa", autenticar, autorizarPapel("gestor"), controlCaixa.ListarPorId)

// ---------------------------------------------------------------------------
// Relatórios — faturamento, mais vendidos, desempenho e horário de pico.
// ---------------------------------------------------------------------------
router.get("/relatorios/painel", autenticar, autorizarPapel("gestor"), controlRelatorio.Painel)

// ---------------------------------------------------------------------------
// Estoque — insumos e ficha técnica.
//
// Registrar perda é liberado ao salão e à cozinha: quem derruba o prato ou vê
// o insumo estragar é quem está lá, e a baixa precisa sair no momento. Criar,
// editar e dar entrada continuam com o gestor, porque mexem em custo.
// ---------------------------------------------------------------------------
router.get("/insumos", autenticar, autorizarPapel(...EQUIPE), controlEstoque.Listar)
router.post("/insumos", autenticar, autorizarPapel("gestor"), validate(criarInsumoSchema), controlEstoque.Criar)
router.put("/insumos/:idInsumo", autenticar, autorizarPapel("gestor"), validate(atualizarInsumoSchema), controlEstoque.Atualizar)
router.delete("/insumos/:idInsumo", autenticar, autorizarPapel("gestor"), controlEstoque.Desativar)
router.get("/insumos/:idInsumo/movimentos", autenticar, autorizarPapel("gestor"), controlEstoque.Movimentos)
router.post("/insumos/:idInsumo/movimentos", autenticar, autorizarPapel(...EQUIPE), validate(movimentarSchema), controlEstoque.Movimentar)

router.get("/produtos/:idProduto/ficha", autenticar, autorizarPapel("gestor"), controlEstoque.ObterFicha)
router.put("/produtos/:idProduto/ficha", autenticar, autorizarPapel("gestor"), validate(salvarFichaSchema), controlEstoque.SalvarFicha)
router.delete("/produtos/:idProduto/ficha/:idInsumo", autenticar, autorizarPapel("gestor"), controlEstoque.RemoverDaFicha)

// ---------------------------------------------------------------------------
// Perfil próprio — qualquer papel cuida da própria conta.
// ---------------------------------------------------------------------------
router.patch("/usuarios/senha", autenticar, validate(alterarSenhaSchema), controlUsuario.AlterarSenha)
router.get("/usuarios/:idUsuario", autenticar, autorizarProprietario("idUsuario"), controlUsuario.ListarPorId)
router.put("/usuarios/:idUsuario", autenticar, autorizarProprietario("idUsuario"), validate(atualizarUsuarioSchema), controlUsuario.Atualizar)

// ---------------------------------------------------------------------------
// Cardápio — leitura para toda a equipe (o garçom lança a partir dela),
// escrita só para o gestor.
// ---------------------------------------------------------------------------
router.get("/produto-categorias/:idEmpresa", autenticar, escopoEmpresa(), controlProdutoCategoria.ListarPorEmpresa)
router.get("/produtos/empresa/:idEmpresa", autenticar, escopoEmpresa(), controlProduto.ListarPorEmpresa)
router.get("/produtos/categoria/:idProdutoCategoria", autenticar, controlProduto.ListarPorCategoria)
router.get("/produtos/:idProduto", autenticar, controlProduto.ListarPorId)

router.post("/produto-categorias", autenticar, autorizarPapel("gestor"), validate(criarProdutoCategoriaSchema), controlProdutoCategoria.Criar)
router.put("/produto-categorias/:idProdutoCategoria", autenticar, autorizarPapel("gestor"), validate(atualizarProdutoCategoriaSchema), controlProdutoCategoria.Atualizar)
router.delete("/produto-categorias/:idProdutoCategoria", autenticar, autorizarPapel("gestor"), controlProdutoCategoria.Deletar)

// Cardápio completo do gestor: inclui o que está em falta e o que saiu do
// cardápio, que a lista do garçom não traz.
router.get("/cardapio", autenticar, autorizarPapel("gestor"), controlCardapio.Listar)

// Marcar "acabou" é liberado para toda a equipe, não só para o gestor. Quem
// descobre que o filé acabou é quem está no salão ou na cozinha, e exigir o
// gestor significaria continuar vendendo o que não existe. O erro é de um
// toque e se desfaz com outro; o custo de não permitir é prato vendido e não
// entregue.
router.patch("/produtos/:idProduto/disponibilidade", autenticar, autorizarPapel(...EQUIPE), validate(disponibilidadeSchema), controlProduto.AlternarDisponibilidade)

router.post("/produtos", autenticar, autorizarPapel("gestor"), validate(criarProdutoSchema), controlProduto.Criar)
router.put("/produtos/:idProduto", autenticar, autorizarPapel("gestor"), validate(atualizarProdutoSchema), controlProduto.Atualizar)
router.delete("/produtos/:idProduto", autenticar, autorizarPapel("gestor"), controlProduto.Deletar)

export default router;
