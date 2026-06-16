import jwt from 'jsonwebtoken';
import repoUsuario from "../repositories/repoUsuario.js"

async function Listar() {
    return await repoUsuario.Listar();
}

async function Criar(usuario) {
    if (!usuario.nome) throw { status: 400, mensagem: "Nome é obrigatório" };
    if (!usuario.email) throw { status: 400, mensagem: "E-mail é obrigatório" };
    if (!usuario.senha) throw { status: 400, mensagem: "Senha é obrigatória" };

    const existente = await repoUsuario.ListarPorEmail(usuario.email);
    if (existente) throw { status: 409, mensagem: "E-mail já cadastrado" };

    const idUsuario = await repoUsuario.Criar(usuario);
    return { idUsuario, nome: usuario.nome, email: usuario.email };
}

async function Login(email, senha) {
    if (!email || !senha) throw { status: 400, mensagem: "E-mail e senha são obrigatórios" };

    const usuario = await repoUsuario.ListarPorEmail(email);
    if (!usuario || usuario.senha !== senha) throw { status: 401, mensagem: "E-mail ou senha inválidos" };

    const { senha: _, ...usuarioSemSenha } = usuario;
    const token = jwt.sign(
        { id: usuario.id_usuario, email: usuario.email },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
    return { token, usuario: usuarioSemSenha };
}

async function ListarPorId(idUsuario) {
    const usuario = await repoUsuario.ListarPorId(idUsuario);
    if (!usuario) throw { status: 404, mensagem: "Usuário não encontrado" };
    return usuario;
}

async function Atualizar(idUsuario, usuario) {
    const changes = await repoUsuario.Atualizar(idUsuario, usuario);
    if (!changes) throw { status: 404, mensagem: "Usuário não encontrado" };
    return await repoUsuario.ListarPorId(idUsuario);
}

export default { Listar, Criar, Login, ListarPorId, Atualizar };
