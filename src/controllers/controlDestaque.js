import servDestaque from "../services/servDestaque.js"

async function ListarPorEmpresa(req, res) {
    try {
        const { idEmpresa } = req.params;
        const destaques = await servDestaque.ListarPorEmpresa(idEmpresa);
        res.status(200).json(destaques);
    } catch (error) {
        const status = error.status || 500;
        res.status(status).json({ mensagem: error.mensagem || "Erro interno do servidor" });
    }
}

export default { ListarPorEmpresa };
