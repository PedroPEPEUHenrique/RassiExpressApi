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

const router = Router();

// Categorias
router.get("/categorias", controlCategoria.Listar)

// Empresas
router.get("/empresas", controlEmpresa.Listar)
router.get("/empresas/:idEmpresa", controlEmpresa.ListarPorId)
router.get("/empresas/categoria/:idCategoria", controlEmpresa.ListarPorCategoria)
router.post("/empresas", controlEmpresa.Criar)
router.put("/empresas/:idEmpresa", controlEmpresa.Atualizar)
router.delete("/empresas/:idEmpresa", controlEmpresa.Deletar)

// Banners
router.get("/banners/:idEmpresa", controlBanner.ListarPorEmpresa)

// Destaques
router.get("/destaques/:idEmpresa", controlDestaque.ListarPorEmpresa)

// Produtos
router.get("/produtos/empresa/:idEmpresa", controlProduto.ListarPorEmpresa)
router.get("/produtos/categoria/:idProdutoCategoria", controlProduto.ListarPorCategoria)
router.get("/produtos/:idProduto", controlProduto.ListarPorId)
router.post("/produtos", controlProduto.Criar)
router.put("/produtos/:idProduto", controlProduto.Atualizar)
router.delete("/produtos/:idProduto", controlProduto.Deletar)

// Categorias de Produtos
router.get("/produto-categorias/:idEmpresa", controlProdutoCategoria.ListarPorEmpresa)
router.post("/produto-categorias", controlProdutoCategoria.Criar)
router.put("/produto-categorias/:idProdutoCategoria", controlProdutoCategoria.Atualizar)
router.delete("/produto-categorias/:idProdutoCategoria", controlProdutoCategoria.Deletar)

// Usuários
router.post("/usuarios", controlUsuario.Criar)
router.post("/usuarios/login", controlUsuario.Login)
router.get("/usuarios/:idUsuario", controlUsuario.ListarPorId)
router.put("/usuarios/:idUsuario", controlUsuario.Atualizar)

// Pedidos
router.post("/pedidos", controlPedido.Criar)
router.get("/pedidos/usuario/:idUsuario", controlPedido.ListarPorUsuario)
router.get("/pedidos/empresa/:idEmpresa", controlPedido.ListarPorEmpresa)
router.get("/pedidos/:idPedido", controlPedido.ListarPorId)
router.patch("/pedidos/:idPedido/status", controlPedido.AtualizarStatus)

// Favoritos
router.get("/favoritos/usuario/:idUsuario", controlUserFavorito.ListarPorUsuario)
router.post("/favoritos", controlUserFavorito.Criar)
router.delete("/favoritos/:idFavorito", controlUserFavorito.Deletar)

export default router;
