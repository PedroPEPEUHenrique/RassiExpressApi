import repoPedido from "../repositories/repoPedido.js"
import repoItensPedido from "../repositories/repoItensPedido.js"

async function Criar(pedido) {
    if (!pedido.idEmpresa) throw { status: 400, mensagem: "Empresa é obrigatória" };
    if (!pedido.idUsuario) throw { status: 400, mensagem: "Usuário é obrigatório" };
    if (!pedido.itens || pedido.itens.length === 0) throw { status: 400, mensagem: "O pedido deve ter ao menos um item" };

    const idPedido = await repoPedido.Criar(pedido);

    for (const item of pedido.itens) {
        await repoItensPedido.Criar({ ...item, idPedido });
    }

    return await ListarPorId(idPedido);
}

async function ListarPorUsuario(idUsuario) {
    return await repoPedido.ListarPorUsuario(idUsuario);
}

async function ListarPorEmpresa(idEmpresa) {
    return await repoPedido.ListarPorEmpresa(idEmpresa);
}

async function ListarPorId(idPedido) {
    const pedido = await repoPedido.ListarPorId(idPedido);
    if (!pedido) throw { status: 404, mensagem: "Pedido não encontrado" };
    const itens = await repoItensPedido.ListarPorPedido(idPedido);
    return { ...pedido, itens };
}

async function AtualizarStatus(idPedido, status) {
    const statusValidos = ["pendente", "confirmado", "preparando", "saiu_entrega", "entregue", "cancelado"];
    if (!statusValidos.includes(status)) throw { status: 400, mensagem: "Status inválido" };
    const changes = await repoPedido.AtualizarStatus(idPedido, status);
    if (!changes) throw { status: 404, mensagem: "Pedido não encontrado" };
}

export default { Criar, ListarPorUsuario, ListarPorEmpresa, ListarPorId, AtualizarStatus };
