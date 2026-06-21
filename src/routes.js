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
import { criarUsuarioSchema, loginSchema, atualizarUsuarioSchema } from "./validators/usuarioValidators.js"
import { criarEmpresaSchema, atualizarEmpresaSchema } from "./validators/empresaValidators.js"
import { criarProdutoSchema, atualizarProdutoSchema } from "./validators/produtoValidators.js"
import { criarProdutoCategoriaSchema, atualizarProdutoCategoriaSchema } from "./validators/produtoCategoriaValidators.js"
import { criarPedidoSchema, atualizarStatusSchema } from "./validators/pedidoValidators.js"
import { criarFavoritoSchema } from "./validators/favoritoValidators.js"

const router = Router();

// Categorias
router.get("/categorias", controlCategoria.Listar)

// Empresas
router.get("/empresas", controlEmpresa.Listar)
router.get("/empresas/:idEmpresa", controlEmpresa.ListarPorId)
router.get("/empresas/categoria/:idCategoria", controlEmpresa.ListarPorCategoria)
router.post("/empresas", validate(criarEmpresaSchema), controlEmpresa.Criar)
router.put("/empresas/:idEmpresa", validate(atualizarEmpresaSchema), controlEmpresa.Atualizar)
router.delete("/empresas/:idEmpresa", controlEmpresa.Deletar)

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
router.post("/produtos", validate(criarProdutoSchema), controlProduto.Criar)
router.put("/produtos/:idProduto", validate(atualizarProdutoSchema), controlProduto.Atualizar)
router.delete("/produtos/:idProduto", controlProduto.Deletar)

// Categorias de Produtos
router.get("/produto-categorias", controlProdutoCategoria.Listar)
router.get("/produto-categorias/:idEmpresa", controlProdutoCategoria.ListarPorEmpresa)
router.post("/produto-categorias", validate(criarProdutoCategoriaSchema), controlProdutoCategoria.Criar)
router.put("/produto-categorias/:idProdutoCategoria", validate(atualizarProdutoCategoriaSchema), controlProdutoCategoria.Atualizar)
router.delete("/produto-categorias/:idProdutoCategoria", controlProdutoCategoria.Deletar)

// Usuários
router.post("/usuarios", validate(criarUsuarioSchema), controlUsuario.Criar)
router.post("/usuarios/login", validate(loginSchema), controlUsuario.Login)
router.get("/usuarios", controlUsuario.Listar)
router.get("/usuarios/:idUsuario", controlUsuario.ListarPorId)
router.put("/usuarios/:idUsuario", validate(atualizarUsuarioSchema), controlUsuario.Atualizar)

// Pedidos
router.post("/pedidos", validate(criarPedidoSchema), controlPedido.Criar)
router.get("/pedidos/usuario/:idUsuario", controlPedido.ListarPorUsuario)
router.get("/pedidos/empresa/:idEmpresa", controlPedido.ListarPorEmpresa)
router.get("/pedidos", controlPedido.Listar),
router.get("/pedidos/:idPedido", controlPedido.ListarPorId)
router.patch("/pedidos/:idPedido/status", validate(atualizarStatusSchema), controlPedido.AtualizarStatus)

// Favoritos
router.get("/favoritos/usuario/:idUsuario", controlUserFavorito.ListarPorUsuario)
router.post("/favoritos", validate(criarFavoritoSchema), controlUserFavorito.Criar)
router.delete("/favoritos/:idFavorito", controlUserFavorito.Deletar)

export default router;
