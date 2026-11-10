import servUsuario from "../services/servUsuario.js";
import asyncHandler from "../middleware/asyncHandler.js";

const Login = asyncHandler(async (req, res) => {
    const { email, senha, idEmpresa } = req.body;
    const resultado = await servUsuario.Login(email, senha, idEmpresa);
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

export default { Login, ListarPorId, Atualizar, AlterarSenha };
