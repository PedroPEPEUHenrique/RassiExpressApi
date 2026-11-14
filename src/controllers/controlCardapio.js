import servCardapio from "../services/servCardapio.js";
import asyncHandler from "../middleware/asyncHandler.js";

const Listar = asyncHandler(async (req, res) => {
    const cardapio = await servCardapio.Listar(req.usuario.idEmpresa);
    res.status(200).json(cardapio);
});

export default { Listar };
