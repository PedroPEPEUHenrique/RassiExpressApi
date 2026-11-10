import servEmpresa from "../services/servEmpresa.js";
import asyncHandler from "../middleware/asyncHandler.js";

const ListarPorId = asyncHandler(async (req, res) => {
    const { idEmpresa } = req.params;
    const empresa = await servEmpresa.ListarPorId(idEmpresa);
    res.status(200).json(empresa);
});

const Atualizar = asyncHandler(async (req, res) => {
    const { idEmpresa } = req.params;
    const empresa = await servEmpresa.Atualizar(idEmpresa, req.body);
    res.status(200).json(empresa);
});

export default { ListarPorId, Atualizar };
