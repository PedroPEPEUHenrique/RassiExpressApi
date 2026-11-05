import servUsuario from "../services/servUsuario.js";
import asyncHandler from "../middleware/asyncHandler.js";

const Listar = asyncHandler(async (req, res) => {
    const usuarios = await servUsuario.Listar();
    res.status(200).json(usuarios);
});

const Criar = asyncHandler(async (req, res) => {
    const usuario = await servUsuario.Criar(req.body);
    res.status(201).json(usuario);
});

const Login = asyncHandler(async (req, res) => {
    const { email, senha } = req.body;
    const resultado = await servUsuario.Login(email, senha);
    res.status(200).json(resultado);
});

const ListarPorId = asyncHandler(async (req, res) => {
    const { idUsuario } = req.params;
    const usuario = await servUsuario.ListarPorId(idUsuario);
    res.status(200).json(usuario);
});

const Atualizar = asyncHandler(async (req, res) => {
    const { idUsuario } = req.params;
    const usuario = await servUsuario.Atualizar(idUsuario, req.body);
    res.status(200).json(usuario);
});

const AlterarSenha = asyncHandler(async (req, res) => {
    const { senhaAtual, novaSenha } = req.body;
    await servUsuario.AlterarSenha(req.usuario.id, senhaAtual, novaSenha);
    res.status(200).json({ mensagem: "Senha alterada com sucesso" });
});

export default { Listar, Criar, Login, ListarPorId, Atualizar, AlterarSenha };
