import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import repoUsuario from "../repositories/repoUsuario.js"

const SALT_ROUNDS = 10;

// Hash descartável usado quando o e-mail não existe. Comparar contra ele faz o
// login gastar o mesmo tempo nos dois casos, evitando que a diferença de
// duração revele quais e-mails estão cadastrados.
const HASH_DUMMY = "$2b$10$CwTycUXWue0Thq9StjUM0uJ8.e8s9pvQ1tBq3Qyq8Uu2qN0cPdQmO";

async function Listar() {
    return await repoUsuario.Listar();
}

async function Criar(usuario) {
    if (!usuario.nome) throw { status: 400, mensagem: "Nome é obrigatório" };
    if (!usuario.email) throw { status: 400, mensagem: "E-mail é obrigatório" };
    if (!usuario.senha) throw { status: 400, mensagem: "Senha é obrigatória" };

    const existente = await repoUsuario.ListarPorEmail(usuario.email);
    if (existente) throw { status: 409, mensagem: "E-mail já cadastrado" };

    const senhaHash = await bcrypt.hash(usuario.senha, SALT_ROUNDS);
    const idUsuario = await repoUsuario.Criar({ ...usuario, senha: senhaHash });
    return { idUsuario, nome: usuario.nome, email: usuario.email };
}

async function Login(email, senha) {
    if (!email || !senha) throw { status: 400, mensagem: "E-mail e senha são obrigatórios" };

    const usuario = await repoUsuario.ListarPorEmail(email);
    const senhaCorreta = await bcrypt.compare(senha, usuario?.senha ?? HASH_DUMMY);

    // Mensagem única para e-mail inexistente e senha errada: dizer qual dos
    // dois falhou entregaria a um atacante a lista de e-mails cadastrados.
    if (!usuario || !senhaCorreta) throw { status: 401, mensagem: "E-mail ou senha inválidos" };

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

async function AlterarSenha(idUsuario, senhaAtual, novaSenha) {
    const usuario = await repoUsuario.ListarComSenhaPorId(idUsuario);
    if (!usuario) throw { status: 404, mensagem: "Usuário não encontrado" };

    const senhaCorreta = await bcrypt.compare(senhaAtual, usuario.senha);
    if (!senhaCorreta) throw { status: 401, mensagem: "Senha atual incorreta" };

    const senhaHash = await bcrypt.hash(novaSenha, SALT_ROUNDS);
    await repoUsuario.AtualizarSenha(idUsuario, senhaHash);
}

export default { Listar, Criar, Login, ListarPorId, Atualizar, AlterarSenha };
