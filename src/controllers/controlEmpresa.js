import servEmpresa from "../services/servEmpresa.js";
import asyncHandler from "../middleware/asyncHandler.js";

const Listar = asyncHandler(async (req, res) => {
    const empresas = await servEmpresa.Listar();
    res.status(200).json(empresas);
});

const ListarPorId = asyncHandler(async (req, res) => {
    const { idEmpresa } = req.params;
    const empresa = await servEmpresa.ListarPorId(idEmpresa);
    res.status(200).json(empresa);
});

const ListarPorCategoria = asyncHandler(async (req, res) => {
    const { idCategoria } = req.params;
    const empresas = await servEmpresa.ListarPorCategoria(idCategoria);
    res.status(200).json(empresas);
});

const Criar = asyncHandler(async (req, res) => {
    const empresa = await servEmpresa.Criar(req.body);
    res.status(201).json(empresa);
});

const Atualizar = asyncHandler(async (req, res) => {
    const { idEmpresa } = req.params;
    const empresa = await servEmpresa.Atualizar(idEmpresa, req.body);
    res.status(200).json(empresa);
});

const Deletar = asyncHandler(async (req, res) => {
    const { idEmpresa } = req.params;
    await servEmpresa.Deletar(idEmpresa);
    res.status(204).send();
});

export default { Listar, ListarPorId, ListarPorCategoria, Criar, Atualizar, Deletar };
