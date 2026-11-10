import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import repoUsuario from "../repositories/repoUsuario.js"
import repoFuncionario from "../repositories/repoFuncionario.js"

const SALT_ROUNDS = 10;

// Hash descartável usado quando o e-mail não existe. Comparar contra ele faz o
// login gastar o mesmo tempo nos dois casos, evitando que a diferença de
// duração revele quais e-mails estão cadastrados.
const HASH_DUMMY = "$2b$10$CwTycUXWue0Thq9StjUM0uJ8.e8s9pvQ1tBq3Qyq8Uu2qN0cPdQmO";

/**
 * Autentica e devolve um token já amarrado a um restaurante e a um papel.
 *
 * Senha correta não basta mais: sem vínculo ativo em FUNCIONARIO não existe
 * token a emitir, porque toda rota da API depende de saber em qual restaurante
 * a pessoa está operando e com qual permissão.
 */
async function Login(email, senha, idEmpresa) {
    if (!email || !senha) throw { status: 400, mensagem: "E-mail e senha são obrigatórios" };

    const usuario = await repoUsuario.ListarPorEmail(email);
    const senhaCorreta = await bcrypt.compare(senha, usuario?.senha ?? HASH_DUMMY);

    // Mensagem única para e-mail inexistente e senha errada: dizer qual dos
    // dois falhou entregaria a um atacante a lista de e-mails cadastrados.
    if (!usuario || !senhaCorreta) throw { status: 401, mensagem: "E-mail ou senha inválidos" };

    const vinculos = await repoFuncionario.ListarVinculosAtivosPorUsuario(usuario.id_usuario);
    if (vinculos.length === 0) {
        throw { status: 403, mensagem: "Usuário sem vínculo ativo com um restaurante" };
    }

    let vinculo;
    if (idEmpresa !== undefined && idEmpresa !== null) {
        vinculo = vinculos.find(v => v.id_empresa === Number(idEmpresa));
        if (!vinculo) throw { status: 403, mensagem: "Usuário sem vínculo ativo com o restaurante informado" };
    } else if (vinculos.length === 1) {
        vinculo = vinculos[0];
    } else {
        // Trabalha em mais de um restaurante: o app precisa perguntar onde
        // entrar e repetir o login com o idEmpresa escolhido.
        throw {
            status: 409,
            mensagem: "Informe em qual restaurante deseja entrar",
            dados: {
                empresas: vinculos.map(v => ({
                    idEmpresa: v.id_empresa,
                    nome: v.nome_empresa,
                    papel: v.papel,
                })),
            },
        };
    }

    const { senha: _, ...usuarioSemSenha } = usuario;
    const token = jwt.sign(
        {
            id: usuario.id_usuario,
            email: usuario.email,
            idEmpresa: vinculo.id_empresa,
            idFuncionario: vinculo.id_funcionario,
            papel: vinculo.papel,
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    return {
        token,
        usuario: usuarioSemSenha,
        papel: vinculo.papel,
        empresa: { idEmpresa: vinculo.id_empresa, nome: vinculo.nome_empresa },
    };
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

export default { Login, ListarPorId, Atualizar, AlterarSenha };
