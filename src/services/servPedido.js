import repoPedido from "../repositories/repoPedido.js"
import repoItensPedido from "../repositories/repoItensPedido.js"

const STATUS_VALIDOS = ["pendente", "confirmado", "preparando", "saiu_entrega", "entregue", "cancelado"];

async function Listar() {
    return await repoPedido.Listar();
}

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

async function ListarPorIdParaUsuario(idPedido, idUsuario) {
    const pedido = await ListarPorId(idPedido);
    if (pedido.id_usuario !== Number(idUsuario)) {
        throw { status: 403, mensagem: "Acesso negado a pedido de outro usuário" };
    }
    return pedido;
}

async function AtualizarStatus(idPedido, status, idUsuario) {
    if (!STATUS_VALIDOS.includes(status)) throw { status: 400, mensagem: "Status inválido" };

    const pedido = await repoPedido.ListarPorId(idPedido);
    if (!pedido) throw { status: 404, mensagem: "Pedido não encontrado" };
    if (pedido.id_usuario !== Number(idUsuario)) {
        throw { status: 403, mensagem: "Acesso negado a pedido de outro usuário" };
    }

    await repoPedido.AtualizarStatus(idPedido, status);
}

export default { Listar, Criar, ListarPorUsuario, ListarPorEmpresa, ListarPorId, ListarPorIdParaUsuario, AtualizarStatus };
