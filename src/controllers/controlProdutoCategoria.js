import servProdutoCategoria from "../services/servProdutoCategoria.js";
import asyncHandler from "../middleware/asyncHandler.js";

const ListarPorEmpresa = asyncHandler(async (req, res) => {
    const { idEmpresa } = req.params;
    const categorias = await servProdutoCategoria.ListarPorEmpresa(idEmpresa);
    res.status(200).json(categorias);
});

const Criar = asyncHandler(async (req, res) => {
    const categoria = await servProdutoCategoria.Criar(req.body);
    res.status(201).json(categoria);
});

const Atualizar = asyncHandler(async (req, res) => {
    const { idProdutoCategoria } = req.params;
    const categoria = await servProdutoCategoria.Atualizar(idProdutoCategoria, req.body);
    res.status(200).json(categoria);
});

const Deletar = asyncHandler(async (req, res) => {
    const { idProdutoCategoria } = req.params;
    await servProdutoCategoria.Deletar(idProdutoCategoria);
    res.status(204).send();
});

export default { ListarPorEmpresa, Criar, Atualizar, Deletar };
