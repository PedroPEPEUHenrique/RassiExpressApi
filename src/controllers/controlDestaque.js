import servDestaque from "../services/servDestaque.js";
import asyncHandler from "../middleware/asyncHandler.js";

const ListarPorEmpresa = asyncHandler(async (req, res) => {
    const { idEmpresa } = req.params;
    const destaques = await servDestaque.ListarPorEmpresa(idEmpresa);
    res.status(200).json(destaques);
});

const Listar = asyncHandler(async (req, res) => {
    const destaques = await servDestaque.Listar();
    res.status(200).json(destaques);
});

export default { Listar, ListarPorEmpresa };
