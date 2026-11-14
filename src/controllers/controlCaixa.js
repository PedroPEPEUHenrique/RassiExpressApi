import servCaixa from "../services/servCaixa.js";
import repoRelatorio from "../repositories/repoRelatorio.js";
import asyncHandler from "../middleware/asyncHandler.js";
import { resolverPeriodo } from "../utils/periodo.js";

// Devolve null quando não há turno aberto; a tela usa isso para mostrar o
// botão de abrir caixa em vez de um erro.
const Atual = asyncHandler(async (req, res) => {
    const caixa = await servCaixa.Atual(req.usuario.idEmpresa);
    res.status(200).json(caixa);
});

const Abrir = asyncHandler(async (req, res) => {
    const caixa = await servCaixa.Abrir(req.body, req.usuario.idEmpresa, req.usuario.idFuncionario);
    res.status(201).json(caixa);
});

const Fechar = asyncHandler(async (req, res) => {
    // A contagem de mesas abertas vem do controller para o service não
    // precisar conhecer o repositório de relatórios.
    const abertas = await repoRelatorio.ContarComandasAbertas(req.usuario.idEmpresa);
    const caixa = await servCaixa.Fechar(
        req.params.idCaixa, req.body, req.usuario.idEmpresa, req.usuario.idFuncionario, abertas
    );
    res.status(200).json(caixa);
});

const Lancar = asyncHandler(async (req, res) => {
    const caixa = await servCaixa.Lancar(req.body, req.usuario.idEmpresa, req.usuario.idFuncionario);
    res.status(201).json(caixa);
});

const Historico = asyncHandler(async (req, res) => {
    const periodo = resolverPeriodo(req.query);
    const caixas = await servCaixa.Historico(req.usuario.idEmpresa, periodo.de, periodo.ate);
    res.status(200).json({ periodo: periodo.rotulo, caixas });
});

const ListarPorId = asyncHandler(async (req, res) => {
    const caixa = await servCaixa.ListarPorId(req.params.idCaixa, req.usuario.idEmpresa);
    res.status(200).json(caixa);
});

export default { Atual, Abrir, Fechar, Lancar, Historico, ListarPorId };
