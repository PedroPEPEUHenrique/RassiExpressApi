import servPedido from "../services/servPedido.js";
import asyncHandler from "../middleware/asyncHandler.js";

const ListarFilaCozinha = asyncHandler(async (req, res) => {
    const fila = await servPedido.ListarFilaCozinha(req.usuario.idEmpresa);
    res.status(200).json(fila);
});

const ListarPorId = asyncHandler(async (req, res) => {
    const pedido = await servPedido.ListarPorId(req.params.idPedido, req.usuario.idEmpresa);
    res.status(200).json(pedido);
});

const AtualizarStatus = asyncHandler(async (req, res) => {
    const pedido = await servPedido.AtualizarStatus(
        req.params.idPedido, req.body.status, req.usuario.idEmpresa
    );
    res.status(200).json(pedido);
});

export default { ListarFilaCozinha, ListarPorId, AtualizarStatus };
