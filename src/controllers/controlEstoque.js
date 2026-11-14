import servEstoque from "../services/servEstoque.js";
import asyncHandler from "../middleware/asyncHandler.js";

const Listar = asyncHandler(async (req, res) => {
    res.status(200).json(await servEstoque.Listar(req.usuario.idEmpresa));
});

const Criar = asyncHandler(async (req, res) => {
    res.status(201).json(await servEstoque.Criar(req.body, req.usuario.idEmpresa));
});

const Atualizar = asyncHandler(async (req, res) => {
    res.status(200).json(await servEstoque.Atualizar(req.params.idInsumo, req.body, req.usuario.idEmpresa));
});

const Desativar = asyncHandler(async (req, res) => {
    await servEstoque.Desativar(req.params.idInsumo, req.usuario.idEmpresa);
    res.status(204).send();
});

const Movimentar = asyncHandler(async (req, res) => {
    const insumo = await servEstoque.Movimentar(
        req.params.idInsumo, req.body, req.usuario.idEmpresa, req.usuario.idFuncionario
    );
    res.status(201).json(insumo);
});

const Movimentos = asyncHandler(async (req, res) => {
    res.status(200).json(await servEstoque.Movimentos(req.params.idInsumo, req.usuario.idEmpresa));
});

const ObterFicha = asyncHandler(async (req, res) => {
    res.status(200).json(await servEstoque.ObterFicha(req.params.idProduto, req.usuario.idEmpresa));
});

const SalvarFicha = asyncHandler(async (req, res) => {
    await servEstoque.SalvarFicha(req.params.idProduto, req.body.itens, req.usuario.idEmpresa);
    res.status(200).json(await servEstoque.ObterFicha(req.params.idProduto, req.usuario.idEmpresa));
});

const RemoverDaFicha = asyncHandler(async (req, res) => {
    await servEstoque.RemoverDaFicha(req.params.idProduto, req.params.idInsumo, req.usuario.idEmpresa);
    res.status(204).send();
});

export default { Listar, Criar, Atualizar, Desativar, Movimentar, Movimentos, ObterFicha, SalvarFicha, RemoverDaFicha };
