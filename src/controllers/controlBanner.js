import servBanner from "../services/servBanner.js"

async function ListarPorEmpresa(req, res) {
    try {
        const { idEmpresa } = req.params;
        const banners = await servBanner.ListarPorEmpresa(idEmpresa);
        res.status(200).json(banners);
    } catch (error) {
        const status = error.status || 500;
        res.status(status).json({ mensagem: error.mensagem || "Erro interno do servidor" });
    }
}

export default { ListarPorEmpresa };
