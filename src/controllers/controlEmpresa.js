import servEmpresa from "../services/servEmpresa.js"

async function Listar(req, res) {
    try {
        const empresas = await servEmpresa.Listar();
        res.status(200).json(empresas);
    } catch (error) {
        const status = error.status || 500;
        res.status(status).json({ mensagem: error.mensagem || "Erro interno do servidor" });
    }
}

async function ListarPorId(req, res) {
    try {
        const { idEmpresa } = req.params;
        const empresa = await servEmpresa.ListarPorId(idEmpresa);
        res.status(200).json(empresa);
    } catch (error) {
        const status = error.status || 500;
        res.status(status).json({ mensagem: error.mensagem || "Erro interno do servidor" });
    }
}

async function ListarPorCategoria(req, res) {
    try {
        const { idCategoria } = req.params;
        const empresas = await servEmpresa.ListarPorCategoria(idCategoria);
        res.status(200).json(empresas);
    } catch (error) {
        const status = error.status || 500;
        res.status(status).json({ mensagem: error.mensagem || "Erro interno do servidor" });
    }
}

async function Criar(req, res) {
    try {
        const empresa = await servEmpresa.Criar(req.body);
        res.status(201).json(empresa);
    } catch (error) {
        const status = error.status || 500;
        res.status(status).json({ mensagem: error.mensagem || "Erro interno do servidor" });
    }
}

async function Atualizar(req, res) {
    try {
        const { idEmpresa } = req.params;
        const empresa = await servEmpresa.Atualizar(idEmpresa, req.body);
        res.status(200).json(empresa);
    } catch (error) {
        const status = error.status || 500;
        res.status(status).json({ mensagem: error.mensagem || "Erro interno do servidor" });
    }
}

async function Deletar(req, res) {
    try {
        const { idEmpresa } = req.params;
        await servEmpresa.Deletar(idEmpresa);
        res.status(204).send();
    } catch (error) {
        const status = error.status || 500;
        res.status(status).json({ mensagem: error.mensagem || "Erro interno do servidor" });
    }
}

export default { Listar, ListarPorId, ListarPorCategoria, Criar, Atualizar, Deletar };
