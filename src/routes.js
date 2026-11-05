import { Router } from "express";
import controlCategoria from "./controllers/controlCategoria.js"
import controlEmpresa from "./controllers/controlEmpresa.js"
import controlBanner from "./controllers/controlBanner.js"
import controlDestaque from "./controllers/controlDestaque.js"
import controlProduto from "./controllers/controlProduto.js"
import controlProdutoCategoria from "./controllers/controlProdutoCategoria.js"
import controlUsuario from "./controllers/controlUsuario.js"
import controlPedido from "./controllers/controlPedido.js"
import controlUserFavorito from "./controllers/controlUserFavorito.js"
import validate from "./middleware/validate.js"
import { autenticar, autorizarProprietario } from "./middleware/auth.js"
import { criarUsuarioSchema, loginSchema, atualizarUsuarioSchema, alterarSenhaSchema } from "./validators/usuarioValidators.js"
import { criarEmpresaSchema, atualizarEmpresaSchema } from "./validators/empresaValidators.js"
import { criarProdutoSchema, atualizarProdutoSchema } from "./validators/produtoValidators.js"
import { criarProdutoCategoriaSchema, atualizarProdutoCategoriaSchema } from "./validators/produtoCategoriaValidators.js"
import { criarPedidoSchema, atualizarStatusSchema } from "./validators/pedidoValidators.js"
import { criarFavoritoSchema } from "./validators/favoritoValidators.js"

const router = Router();

// ---------------------------------------------------------------------------
// Rotas públicas — catálogo. São somente leitura e não expõem dado de usuário.
// ---------------------------------------------------------------------------

// Categorias
router.get("/categorias", controlCategoria.Listar)

// Empresas
router.get("/empresas", controlEmpresa.Listar)
router.get("/empresas/:idEmpresa", controlEmpresa.ListarPorId)
router.get("/empresas/categoria/:idCategoria", controlEmpresa.ListarPorCategoria)

// Banners
router.get("/banners/:idEmpresa", controlBanner.ListarPorEmpresa)
router.get("/banners", controlBanner.Listar)

// Destaques
router.get("/destaques/:idEmpresa", controlDestaque.ListarPorEmpresa)
router.get("/destaques", controlDestaque.Listar)

// Produtos
router.get("/produtos", controlProduto.Listar)
router.get("/produtos/empresa/:idEmpresa", controlProduto.ListarPorEmpresa)
router.get("/produtos/categoria/:idProdutoCategoria", controlProduto.ListarPorCategoria)
router.get("/produtos/:idProduto", controlProduto.ListarPorId)

// Categorias de Produtos
router.get("/produto-categorias", controlProdutoCategoria.Listar)
router.get("/produto-categorias/:idEmpresa", controlProdutoCategoria.ListarPorEmpresa)

// ---------------------------------------------------------------------------
// Autenticação — únicas rotas de usuário abertas.
// ---------------------------------------------------------------------------
router.post("/usuarios", validate(criarUsuarioSchema), controlUsuario.Criar)
router.post("/usuarios/login", validate(loginSchema), controlUsuario.Login)

// ---------------------------------------------------------------------------
// Rotas autenticadas — exigem "Authorization: Bearer <token>".
// autorizarProprietario garante que o usuário do token é o dono do recurso.
// ---------------------------------------------------------------------------

// Usuários
router.patch("/usuarios/senha", autenticar, validate(alterarSenhaSchema), controlUsuario.AlterarSenha)
router.get("/usuarios/:idUsuario", autenticar, autorizarProprietario("idUsuario"), controlUsuario.ListarPorId)
router.put("/usuarios/:idUsuario", autenticar, autorizarProprietario("idUsuario"), validate(atualizarUsuarioSchema), controlUsuario.Atualizar)

// Pedidos — o idUsuario vem do token, nunca do corpo da requisição.
router.post("/pedidos", autenticar, validate(criarPedidoSchema), controlPedido.Criar)
router.get("/pedidos/usuario/:idUsuario", autenticar, autorizarProprietario("idUsuario"), controlPedido.ListarPorUsuario)
router.get("/pedidos/:idPedido", autenticar, controlPedido.ListarPorId)
router.patch("/pedidos/:idPedido/status", autenticar, validate(atualizarStatusSchema), controlPedido.AtualizarStatus)

// Favoritos
router.get("/favoritos/usuario/:idUsuario", autenticar, autorizarProprietario("idUsuario"), controlUserFavorito.ListarPorUsuario)
router.post("/favoritos", autenticar, validate(criarFavoritoSchema), controlUserFavorito.Criar)
router.delete("/favoritos/:idFavorito", autenticar, controlUserFavorito.Deletar)

// ---------------------------------------------------------------------------
// Rotas administrativas — hoje exigem apenas autenticação.
// TODO: a tabela USUARIO não tem coluna de papel; o controle de acesso por
// papel (admin / lojista) depende dessa modelagem e está pendente.
// ---------------------------------------------------------------------------
router.get("/usuarios", autenticar, controlUsuario.Listar)
router.get("/pedidos", autenticar, controlPedido.Listar)
router.get("/pedidos/empresa/:idEmpresa", autenticar, controlPedido.ListarPorEmpresa)

router.post("/empresas", autenticar, validate(criarEmpresaSchema), controlEmpresa.Criar)
router.put("/empresas/:idEmpresa", autenticar, validate(atualizarEmpresaSchema), controlEmpresa.Atualizar)
router.delete("/empresas/:idEmpresa", autenticar, controlEmpresa.Deletar)

router.post("/produtos", autenticar, validate(criarProdutoSchema), controlProduto.Criar)
router.put("/produtos/:idProduto", autenticar, validate(atualizarProdutoSchema), controlProduto.Atualizar)
router.delete("/produtos/:idProduto", autenticar, controlProduto.Deletar)

router.post("/produto-categorias", autenticar, validate(criarProdutoCategoriaSchema), controlProdutoCategoria.Criar)
router.put("/produto-categorias/:idProdutoCategoria", autenticar, validate(atualizarProdutoCategoriaSchema), controlProdutoCategoria.Atualizar)
router.delete("/produto-categorias/:idProdutoCategoria", autenticar, controlProdutoCategoria.Deletar)

export default router;
