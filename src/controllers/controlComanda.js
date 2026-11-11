import servComanda from "../services/servComanda.js";
import servPedido from "../services/servPedido.js";
import asyncHandler from "../middleware/asyncHandler.js";

const ListarAbertas = asyncHandler(async (req, res) => {
    const comandas = await servComanda.ListarAbertas(req.usuario.idEmpresa);
    res.status(200).json(comandas);
});

const ListarPorId = asyncHandler(async (req, res) => {
    const comanda = await servComanda.ListarPorId(req.params.idComanda, req.usuario.idEmpresa);
    res.status(200).json(comanda);
});

// Quem abriu a comanda sai do token, não do corpo: a conta registra o garçom
// que de fato estava com o aparelho na mão.
const Abrir = asyncHandler(async (req, res) => {
    const comanda = await servComanda.Abrir(
        req.body, req.usuario.idEmpresa, req.usuario.idFuncionario
    );
    res.status(201).json(comanda);
});

const Fechar = asyncHandler(async (req, res) => {
    const comanda = await servComanda.Fechar(
        req.params.idComanda, req.body ?? {}, req.usuario.idEmpresa, req.usuario.idFuncionario
    );
    res.status(200).json(comanda);
});

const LancarRodada = asyncHandler(async (req, res) => {
    const rodada = await servPedido.Criar(
        req.params.idComanda, req.body, req.usuario.idEmpresa, req.usuario.idFuncionario
    );
    res.status(201).json(rodada);
});

export default { ListarAbertas, ListarPorId, Abrir, Fechar, LancarRodada };
