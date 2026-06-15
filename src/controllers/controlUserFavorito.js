import servUserFavorito from "../services/servUserFavorito.js";
import asyncHandler from "../middleware/asyncHandler.js";

const ListarPorUsuario = asyncHandler(async (req, res) => {
    const { idUsuario } = req.params;
    const favoritos = await servUserFavorito.ListarPorUsuario(idUsuario);
    res.status(200).json(favoritos);
});

const Criar = asyncHandler(async (req, res) => {
    const favorito = await servUserFavorito.Criar(req.body);
    res.status(201).json(favorito);
});

const Deletar = asyncHandler(async (req, res) => {
    const { idFavorito } = req.params;
    await servUserFavorito.Deletar(idFavorito);
    res.status(204).send();
});

export default { ListarPorUsuario, Criar, Deletar };
