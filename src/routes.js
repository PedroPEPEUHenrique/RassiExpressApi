import { Router } from "express";
import controlEmpresa from "./controllers/controlEmpresa.js"
import controlProduto from "./controllers/controlProduto.js"
import controlProdutoCategoria from "./controllers/controlProdutoCategoria.js"
import controlUsuario from "./controllers/controlUsuario.js"
import controlFuncionario from "./controllers/controlFuncionario.js"
import validate from "./middleware/validate.js"
import { autenticar, autorizarProprietario, autorizarPapel, escopoEmpresa } from "./middleware/auth.js"
import { loginSchema, atualizarUsuarioSchema, alterarSenhaSchema } from "./validators/usuarioValidators.js"
import { criarFuncionarioSchema } from "./validators/funcionarioValidators.js"
import { atualizarEmpresaSchema } from "./validators/empresaValidators.js"
import { criarProdutoSchema, atualizarProdutoSchema } from "./validators/produtoValidators.js"
import { criarProdutoCategoriaSchema, atualizarProdutoCategoriaSchema } from "./validators/produtoCategoriaValidators.js"

const router = Router();

// ===========================================================================
// POLÍTICA DE ACESSO
//
// Não existe mais rota pública além do login. O catálogo era aberto porque o
// app de delivery precisava mostrar restaurante a quem nem tinha conta; num
// app interno, cardápio é dado do negócio.
//
// Três camadas se combinam:
//   autenticar       — exige token válido já contendo empresa e papel
//   escopoEmpresa    — quando o id do restaurante vem pela URL, exige que seja
//                      o do token
//   autorizarPapel   — restringe a operação a gestor, garçom ou cozinha
//
// Quando o id do restaurante NÃO vem pela URL, o valor usado é sempre
// req.usuario.idEmpresa. O corpo da requisição nunca decide isso.
//
// Saíram desta fase, e por quê:
//   - GET /empresas, /empresas/categoria/:id, /banners, /destaques,
//     /categorias, GET /produtos e /produto-categorias sem filtro, GET
//     /usuarios, GET /pedidos: vitrine do delivery e, pior, listagens que
//     devolviam dado de todos os restaurantes a qualquer token.
//   - POST /usuarios (cadastro público): quem admite alguém agora é o gestor,
//     via POST /funcionarios.
//   - POST e DELETE /empresas: cadastro e exclusão de restaurante é operação
//     de plataforma. Ver o comentário em servEmpresa.js.
//   - Rotas de /pedidos e /favoritos: modeladas para cliente de delivery. A
//     Fase 1 reintroduz pedido sobre MESA e COMANDA.
// ===========================================================================

// ---------------------------------------------------------------------------
// Pública — única porta de entrada.
// ---------------------------------------------------------------------------
router.post("/usuarios/login", validate(loginSchema), controlUsuario.Login)

// ---------------------------------------------------------------------------
// Restaurante — o gestor lê e edita apenas o próprio.
// ---------------------------------------------------------------------------
router.get("/empresas/:idEmpresa", autenticar, escopoEmpresa(), controlEmpresa.ListarPorId)
router.put("/empresas/:idEmpresa", autenticar, escopoEmpresa(), autorizarPapel("gestor"), validate(atualizarEmpresaSchema), controlEmpresa.Atualizar)

// ---------------------------------------------------------------------------
// Equipe — admissão. A gestão completa (listar, promover, desativar) vem na
// Fase 3; aqui existe o mínimo para o gestor dar acesso a garçom e cozinha.
// ---------------------------------------------------------------------------
router.post("/funcionarios", autenticar, autorizarPapel("gestor"), validate(criarFuncionarioSchema), controlFuncionario.Criar)

// ---------------------------------------------------------------------------
// Perfil próprio — qualquer papel cuida da própria conta.
// ---------------------------------------------------------------------------
router.patch("/usuarios/senha", autenticar, validate(alterarSenhaSchema), controlUsuario.AlterarSenha)
router.get("/usuarios/:idUsuario", autenticar, autorizarProprietario("idUsuario"), controlUsuario.ListarPorId)
router.put("/usuarios/:idUsuario", autenticar, autorizarProprietario("idUsuario"), validate(atualizarUsuarioSchema), controlUsuario.Atualizar)

// ---------------------------------------------------------------------------
// Cardápio — leitura liberada a toda a equipe: o garçom lança o pedido a
// partir dela e a cozinha confere o que foi pedido.
//
// As duas últimas recebem id de produto ou de categoria, não de empresa, então
// escopoEmpresa não se aplica: a conferência de dono acontece no service, que
// compara o id_empresa do registro com o do token.
// ---------------------------------------------------------------------------
router.get("/produto-categorias/:idEmpresa", autenticar, escopoEmpresa(), controlProdutoCategoria.ListarPorEmpresa)
router.get("/produtos/empresa/:idEmpresa", autenticar, escopoEmpresa(), controlProduto.ListarPorEmpresa)
router.get("/produtos/categoria/:idProdutoCategoria", autenticar, controlProduto.ListarPorCategoria)
router.get("/produtos/:idProduto", autenticar, controlProduto.ListarPorId)

// ---------------------------------------------------------------------------
// Cardápio — escrita restrita ao gestor.
// ---------------------------------------------------------------------------
router.post("/produto-categorias", autenticar, autorizarPapel("gestor"), validate(criarProdutoCategoriaSchema), controlProdutoCategoria.Criar)
router.put("/produto-categorias/:idProdutoCategoria", autenticar, autorizarPapel("gestor"), validate(atualizarProdutoCategoriaSchema), controlProdutoCategoria.Atualizar)
router.delete("/produto-categorias/:idProdutoCategoria", autenticar, autorizarPapel("gestor"), controlProdutoCategoria.Deletar)

router.post("/produtos", autenticar, autorizarPapel("gestor"), validate(criarProdutoSchema), controlProduto.Criar)
router.put("/produtos/:idProduto", autenticar, autorizarPapel("gestor"), validate(atualizarProdutoSchema), controlProduto.Atualizar)
router.delete("/produtos/:idProduto", autenticar, autorizarPapel("gestor"), controlProduto.Deletar)

export default router;
