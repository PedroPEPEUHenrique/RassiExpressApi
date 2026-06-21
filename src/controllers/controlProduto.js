import servProduto from "../services/servProduto.js";
import asyncHandler from "../middleware/asyncHandler.js";

const Listar = asyncHandler(async (req, res) => {
    const produtos = await servProduto.Listar();
    res.status(200).json(produtos);
});


const ListarPorEmpresa = asyncHandler(async (req, res) => {
    const { idEmpresa } = req.params;
    const produtos = await servProduto.ListarPorEmpresa(idEmpresa);
    res.status(200).json(produtos);
});

const ListarPorCategoria = asyncHandler(async (req, res) => {
    const { idProdutoCategoria } = req.params;
    const produtos = await servProduto.ListarPorCategoria(idProdutoCategoria);
    res.status(200).json(produtos);
});

const ListarPorId = asyncHandler(async (req, res) => {
    const { idProduto } = req.params;
    const produto = await servProduto.ListarPorId(idProduto);
    res.status(200).json(produto);
});

const Criar = asyncHandler(async (req, res) => {
    const produto = await servProduto.Criar(req.body);
    res.status(201).json(produto);
});

const Atualizar = asyncHandler(async (req, res) => {
    const { idProduto } = req.params;
    const produto = await servProduto.Atualizar(idProduto, req.body);
    res.status(200).json(produto);
});

const Deletar = asyncHandler(async (req, res) => {
    const { idProduto } = req.params;
    await servProduto.Deletar(idProduto);
    res.status(204).send();
});

export default { Listar, ListarPorEmpresa, ListarPorCategoria, ListarPorId, Criar, Atualizar, Deletar };
