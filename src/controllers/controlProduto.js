import servProduto from "../services/servProduto.js";
import asyncHandler from "../middleware/asyncHandler.js";

const ListarPorEmpresa = asyncHandler(async (req, res) => {
    const { idEmpresa } = req.params;
    const produtos = await servProduto.ListarPorEmpresa(idEmpresa);
    res.status(200).json(produtos);
});

const ListarPorCategoria = asyncHandler(async (req, res) => {
    const { idProdutoCategoria } = req.params;
    const produtos = await servProduto.ListarPorCategoria(idProdutoCategoria, req.usuario.idEmpresa);
    res.status(200).json(produtos);
});

const ListarPorId = asyncHandler(async (req, res) => {
    const { idProduto } = req.params;
    const produto = await servProduto.ListarPorId(idProduto, req.usuario.idEmpresa);
    res.status(200).json(produto);
});

const Criar = asyncHandler(async (req, res) => {
    const produto = await servProduto.Criar(req.body, req.usuario.idEmpresa);
    res.status(201).json(produto);
});

const Atualizar = asyncHandler(async (req, res) => {
    const { idProduto } = req.params;
    const produto = await servProduto.Atualizar(idProduto, req.body, req.usuario.idEmpresa);
    res.status(200).json(produto);
});

const Deletar = asyncHandler(async (req, res) => {
    const { idProduto } = req.params;
    await servProduto.Deletar(idProduto, req.usuario.idEmpresa);
    res.status(204).send();
});

const AlternarDisponibilidade = asyncHandler(async (req, res) => {
    const { idProduto } = req.params;
    const produto = await servProduto.AlternarDisponibilidade(
        idProduto, req.body.disponivel, req.usuario.idEmpresa
    );
    res.status(200).json(produto);
});

export default { ListarPorEmpresa, ListarPorCategoria, ListarPorId, Criar, Atualizar, AlternarDisponibilidade, Deletar };
