import servProduto from "../services/servProduto.js"

async function ListarPorEmpresa(req, res) {
    try {
        const { idEmpresa } = req.params;
        const produtos = await servProduto.ListarPorEmpresa(idEmpresa);
        res.status(200).json(produtos);
    } catch (error) {
        const status = error.status || 500;
        res.status(status).json({ mensagem: error.mensagem || "Erro interno do servidor" });
    }
}

async function ListarPorCategoria(req, res) {
    try {
        const { idProdutoCategoria } = req.params;
        const produtos = await servProduto.ListarPorCategoria(idProdutoCategoria);
        res.status(200).json(produtos);
    } catch (error) {
        const status = error.status || 500;
        res.status(status).json({ mensagem: error.mensagem || "Erro interno do servidor" });
    }
}

async function ListarPorId(req, res) {
    try {
        const { idProduto } = req.params;
        const produto = await servProduto.ListarPorId(idProduto);
        res.status(200).json(produto);
    } catch (error) {
        const status = error.status || 500;
        res.status(status).json({ mensagem: error.mensagem || "Erro interno do servidor" });
    }
}

async function Criar(req, res) {
    try {
        const produto = await servProduto.Criar(req.body);
        res.status(201).json(produto);
    } catch (error) {
        const status = error.status || 500;
        res.status(status).json({ mensagem: error.mensagem || "Erro interno do servidor" });
    }
}

async function Atualizar(req, res) {
    try {
        const { idProduto } = req.params;
        const produto = await servProduto.Atualizar(idProduto, req.body);
        res.status(200).json(produto);
    } catch (error) {
        const status = error.status || 500;
        res.status(status).json({ mensagem: error.mensagem || "Erro interno do servidor" });
    }
}

async function Deletar(req, res) {
    try {
        const { idProduto } = req.params;
        await servProduto.Deletar(idProduto);
        res.status(204).send();
    } catch (error) {
        const status = error.status || 500;
        res.status(status).json({ mensagem: error.mensagem || "Erro interno do servidor" });
    }
}

export default { ListarPorEmpresa, ListarPorCategoria, ListarPorId, Criar, Atualizar, Deletar };
