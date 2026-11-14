import servFuncionario from "../services/servFuncionario.js";
import asyncHandler from "../middleware/asyncHandler.js";
import { resolverPeriodo } from "../utils/periodo.js";

const Listar = asyncHandler(async (req, res) => {
    const equipe = await servFuncionario.Listar(req.usuario.idEmpresa);
    res.status(200).json(equipe);
});

// O restaurante vem do token do gestor, nunca do corpo da requisição.
const Criar = asyncHandler(async (req, res) => {
    const funcionario = await servFuncionario.Criar(req.body, req.usuario.idEmpresa);
    res.status(201).json(funcionario);
});

// idFuncionarioLogado vai junto para o service barrar que alguém mude o
// próprio papel ou se desligue sozinho.
const AlterarPapel = asyncHandler(async (req, res) => {
    const funcionario = await servFuncionario.AlterarPapel(
        req.params.idFuncionario, req.body.papel,
        req.usuario.idEmpresa, req.usuario.idFuncionario
    );
    res.status(200).json(funcionario);
});

const AlterarAtivo = asyncHandler(async (req, res) => {
    const funcionario = await servFuncionario.AlterarAtivo(
        req.params.idFuncionario, req.body.ativo,
        req.usuario.idEmpresa, req.usuario.idFuncionario
    );
    res.status(200).json(funcionario);
});

const Desempenho = asyncHandler(async (req, res) => {
    const periodo = resolverPeriodo(req.query);
    const linhas = await servFuncionario.Desempenho(req.usuario.idEmpresa, periodo.de, periodo.ate);
    res.status(200).json({ periodo: periodo.rotulo, equipe: linhas });
});

export default { Listar, Criar, AlterarPapel, AlterarAtivo, Desempenho };
