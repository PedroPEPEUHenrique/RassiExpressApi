import serviceCategoria from "../services/servCategoria.js";
import asyncHandler from "../middleware/asyncHandler.js";

const Listar = asyncHandler(async (req, res) => {
    const categorias = await serviceCategoria.Listar();
    res.status(200).json(categorias);
});

export default { Listar };
