import servUsuario from "../services/servUsuario.js"

async function Criar(req, res) {
    try {
        const usuario = await servUsuario.Criar(req.body);
        res.status(201).json(usuario);
    } catch (error) {
        const status = error.status || 500;
        res.status(status).json({ mensagem: error.mensagem || "Erro interno do servidor" });
    }
}

async function Login(req, res) {
    try {
        const { email, senha } = req.body;
        const usuario = await servUsuario.Login(email, senha);
        res.status(200).json(usuario);
    } catch (error) {
        const status = error.status || 500;
        res.status(status).json({ mensagem: error.mensagem || "Erro interno do servidor" });
    }
}

async function ListarPorId(req, res) {
    try {
        const { idUsuario } = req.params;
        const usuario = await servUsuario.ListarPorId(idUsuario);
        res.status(200).json(usuario);
    } catch (error) {
        const status = error.status || 500;
        res.status(status).json({ mensagem: error.mensagem || "Erro interno do servidor" });
    }
}

async function Atualizar(req, res) {
    try {
        const { idUsuario } = req.params;
        const usuario = await servUsuario.Atualizar(idUsuario, req.body);
        res.status(200).json(usuario);
    } catch (error) {
        const status = error.status || 500;
        res.status(status).json({ mensagem: error.mensagem || "Erro interno do servidor" });
    }
}

export default { Criar, Login, ListarPorId, Atualizar };
