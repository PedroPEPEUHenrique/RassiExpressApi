import bcrypt from 'bcryptjs';
import { withTransaction } from "../database/mysql.js"
import repoUsuario from "../repositories/repoUsuario.js"
import repoFuncionario from "../repositories/repoFuncionario.js"

const SALT_ROUNDS = 10;
const PAPEIS_VALIDOS = ["gestor", "garcom", "cozinha"];

/**
 * Cria a conta de um membro da equipe. Substitui o cadastro público: agora
 * quem admite alguém é o gestor, e o restaurante vem do token dele — nunca do
 * corpo da requisição, senão um gestor poderia inserir funcionário em outro
 * restaurante.
 */
async function Criar({ nome, email, senha, telefone, papel }, idEmpresa) {
    if (!PAPEIS_VALIDOS.includes(papel)) {
        throw { status: 400, mensagem: `Papel inválido. Use um de: ${PAPEIS_VALIDOS.join(", ")}` };
    }

    const existente = await repoUsuario.ListarPorEmail(email);
    if (existente) throw { status: 409, mensagem: "E-mail já cadastrado" };

    const senhaHash = await bcrypt.hash(senha, SALT_ROUNDS);

    // USUARIO e FUNCIONARIO na mesma transação: um usuário sem vínculo não
    // consegue entrar em restaurante nenhum e ficaria órfão no banco, ocupando
    // o e-mail para sempre por causa da chave única.
    return await withTransaction(async (conn) => {
        const idUsuario = await repoUsuario.Criar({ nome, email, senha: senhaHash, telefone }, conn);
        const idFuncionario = await repoFuncionario.Criar({ idUsuario, idEmpresa, papel }, conn);
        return { idFuncionario, idUsuario, nome, email, papel };
    });
}

export default { Criar, PAPEIS_VALIDOS };
