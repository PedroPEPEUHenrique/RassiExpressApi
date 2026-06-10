import servProdutoCategoria from "../services/servProdutoCategoria.js"

async function ListarPorEmpresa(req, res) {
    try {
        const { idEmpresa } = req.params;
        const categorias = await servProdutoCategoria.ListarPorEmpresa(idEmpresa);
        res.status(200).json(categorias);
    } catch (error) {
        const status = error.status || 500;
        res.status(status).json({ mensagem: error.mensagem || "Erro interno do servidor" });
    }
}

async function Criar(req, res) {
    try {
        const categoria = await servProdutoCategoria.Criar(req.body);
        res.status(201).json(categoria);
    } catch (error) {
        const status = error.status || 500;
        res.status(status).json({ mensagem: error.mensagem || "Erro interno do servidor" });
    }
}

async function Atualizar(req, res) {
    try {
        const { idProdutoCategoria } = req.params;
        const categoria = await servProdutoCategoria.Atualizar(idProdutoCategoria, req.body);
        res.status(200).json(categoria);
    } catch (error) {
        const status = error.status || 500;
        res.status(status).json({ mensagem: error.mensagem || "Erro interno do servidor" });
    }
}

async function Deletar(req, res) {
    try {
        const { idProdutoCategoria } = req.params;
        await servProdutoCategoria.Deletar(idProdutoCategoria);
        res.status(204).send();
    } catch (error) {
        const status = error.status || 500;
        res.status(status).json({ mensagem: error.mensagem || "Erro interno do servidor" });
    }
}

export default { ListarPorEmpresa, Criar, Atualizar, Deletar };
