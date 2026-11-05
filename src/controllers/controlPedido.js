import servPedido from "../services/servPedido.js";
import asyncHandler from "../middleware/asyncHandler.js";

const Listar = asyncHandler(async (req, res) => {
    const pedidos = await servPedido.Listar();
    res.status(200).json(pedidos);
});

const Criar = asyncHandler(async (req, res) => {
    const pedido = await servPedido.Criar({ ...req.body, idUsuario: req.usuario.id });
    res.status(201).json(pedido);
});

const ListarPorUsuario = asyncHandler(async (req, res) => {
    const { idUsuario } = req.params;
    const pedidos = await servPedido.ListarPorUsuario(idUsuario);
    res.status(200).json(pedidos);
});

const ListarPorEmpresa = asyncHandler(async (req, res) => {
    const { idEmpresa } = req.params;
    const pedidos = await servPedido.ListarPorEmpresa(idEmpresa);
    res.status(200).json(pedidos);
});

const ListarPorId = asyncHandler(async (req, res) => {
    const { idPedido } = req.params;
    const pedido = await servPedido.ListarPorIdParaUsuario(idPedido, req.usuario.id);
    res.status(200).json(pedido);
});

const AtualizarStatus = asyncHandler(async (req, res) => {
    const { idPedido } = req.params;
    const { status } = req.body;
    await servPedido.AtualizarStatus(idPedido, status, req.usuario.id);
    res.status(200).json({ mensagem: "Status atualizado com sucesso" });
});

export default { Listar, Criar, ListarPorUsuario, ListarPorEmpresa, ListarPorId, AtualizarStatus };
