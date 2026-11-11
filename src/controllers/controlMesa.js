import servMesa from "../services/servMesa.js";
import asyncHandler from "../middleware/asyncHandler.js";

const ListarSalao = asyncHandler(async (req, res) => {
    const salao = await servMesa.ListarSalao(req.usuario.idEmpresa);
    res.status(200).json(salao);
});

const Criar = asyncHandler(async (req, res) => {
    const mesa = await servMesa.Criar(req.body, req.usuario.idEmpresa);
    res.status(201).json(mesa);
});

const Atualizar = asyncHandler(async (req, res) => {
    const mesa = await servMesa.Atualizar(req.params.idMesa, req.body, req.usuario.idEmpresa);
    res.status(200).json(mesa);
});

const Desativar = asyncHandler(async (req, res) => {
    await servMesa.Desativar(req.params.idMesa, req.usuario.idEmpresa);
    res.status(204).send();
});

export default { ListarSalao, Criar, Atualizar, Desativar };
