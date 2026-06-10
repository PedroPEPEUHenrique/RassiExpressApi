import servUserFavorito from "../services/servUserFavorito.js"

async function ListarPorUsuario(req, res) {
    try {
        const { idUsuario } = req.params;
        const favoritos = await servUserFavorito.ListarPorUsuario(idUsuario);
        res.status(200).json(favoritos);
    } catch (error) {
        const status = error.status || 500;
        res.status(status).json({ mensagem: error.mensagem || "Erro interno do servidor" });
    }
}

async function Criar(req, res) {
    try {
        const favorito = await servUserFavorito.Criar(req.body);
        res.status(201).json(favorito);
    } catch (error) {
        const status = error.status || 500;
        res.status(status).json({ mensagem: error.mensagem || "Erro interno do servidor" });
    }
}

async function Deletar(req, res) {
    try {
        const { idFavorito } = req.params;
        await servUserFavorito.Deletar(idFavorito);
        res.status(204).send();
    } catch (error) {
        const status = error.status || 500;
        res.status(status).json({ mensagem: error.mensagem || "Erro interno do servidor" });
    }
}

export default { ListarPorUsuario, Criar, Deletar };
