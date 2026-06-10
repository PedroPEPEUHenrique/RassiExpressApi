import servPedido from "../services/servPedido.js"

async function Criar(req, res) {
    try {
        const pedido = await servPedido.Criar(req.body);
        res.status(201).json(pedido);
    } catch (error) {
        const status = error.status || 500;
        res.status(status).json({ mensagem: error.mensagem || "Erro interno do servidor" });
    }
}

async function ListarPorUsuario(req, res) {
    try {
        const { idUsuario } = req.params;
        const pedidos = await servPedido.ListarPorUsuario(idUsuario);
        res.status(200).json(pedidos);
    } catch (error) {
        const status = error.status || 500;
        res.status(status).json({ mensagem: error.mensagem || "Erro interno do servidor" });
    }
}

async function ListarPorEmpresa(req, res) {
    try {
        const { idEmpresa } = req.params;
        const pedidos = await servPedido.ListarPorEmpresa(idEmpresa);
        res.status(200).json(pedidos);
    } catch (error) {
        const status = error.status || 500;
        res.status(status).json({ mensagem: error.mensagem || "Erro interno do servidor" });
    }
}

async function ListarPorId(req, res) {
    try {
        const { idPedido } = req.params;
        const pedido = await servPedido.ListarPorId(idPedido);
        res.status(200).json(pedido);
    } catch (error) {
        const status = error.status || 500;
        res.status(status).json({ mensagem: error.mensagem || "Erro interno do servidor" });
    }
}

async function AtualizarStatus(req, res) {
    try {
        const { idPedido } = req.params;
        const { status } = req.body;
        await servPedido.AtualizarStatus(idPedido, status);
        res.status(200).json({ mensagem: "Status atualizado com sucesso" });
    } catch (error) {
        const status = error.status || 500;
        res.status(status).json({ mensagem: error.mensagem || "Erro interno do servidor" });
    }
}

export default { Criar, ListarPorUsuario, ListarPorEmpresa, ListarPorId, AtualizarStatus };
