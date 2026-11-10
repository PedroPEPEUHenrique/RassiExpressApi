import servFuncionario from "../services/servFuncionario.js";
import asyncHandler from "../middleware/asyncHandler.js";

// O restaurante vem do token do gestor, nunca do corpo da requisição.
const Criar = asyncHandler(async (req, res) => {
    const funcionario = await servFuncionario.Criar(req.body, req.usuario.idEmpresa);
    res.status(201).json(funcionario);
});

export default { Criar };
