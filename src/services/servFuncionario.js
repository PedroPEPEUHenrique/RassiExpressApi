import bcrypt from 'bcryptjs';
import { withTransaction } from "../database/mysql.js"
import repoUsuario from "../repositories/repoUsuario.js"
import repoFuncionario from "../repositories/repoFuncionario.js"

const SALT_ROUNDS = 10;
const PAPEIS_VALIDOS = ["gestor", "garcom", "cozinha"];

async function buscarDaEmpresa(idFuncionario, idEmpresa) {
    const funcionario = await repoFuncionario.ListarPorId(idFuncionario);
    if (!funcionario || funcionario.id_empresa !== Number(idEmpresa)) {
        throw { status: 404, mensagem: "Funcionário não encontrado" };
    }
    return funcionario;
}

async function Listar(idEmpresa) {
    return await repoFuncionario.ListarPorEmpresa(idEmpresa);
}

/**
 * Cria a conta de um membro da equipe. Substitui o cadastro público: quem
 * admite alguém é o gestor, e o restaurante vem do token dele — nunca do
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

/**
 * Muda o papel de alguém.
 *
 * Duas travas, as duas pela mesma razão — impedir que o restaurante fique sem
 * ninguém com poder de administrar:
 *
 *   1. O gestor não muda o próprio papel. Rebaixar-se por engano é um toque,
 *      e desfazer exigiria justamente o acesso que ele acabou de perder.
 *   2. O último gestor ativo não deixa de ser gestor. Sem gestor não há quem
 *      cadastre produto, mesa ou funcionário — nem quem promova alguém de
 *      volta.
 */
async function AlterarPapel(idFuncionario, papel, idEmpresa, idFuncionarioLogado) {
    if (!PAPEIS_VALIDOS.includes(papel)) {
        throw { status: 400, mensagem: `Papel inválido. Use um de: ${PAPEIS_VALIDOS.join(", ")}` };
    }

    const funcionario = await buscarDaEmpresa(idFuncionario, idEmpresa);

    if (funcionario.id_funcionario === Number(idFuncionarioLogado) && papel !== "gestor") {
        throw { status: 409, mensagem: "Você não pode mudar o seu próprio papel. Peça a outro gestor." };
    }

    if (funcionario.papel === "gestor" && papel !== "gestor") {
        const gestores = await repoFuncionario.ContarGestoresAtivos(idEmpresa);
        if (gestores <= 1) {
            throw { status: 409, mensagem: "Este é o único gestor do restaurante. Promova outra pessoa antes." };
        }
    }

    const changes = await repoFuncionario.AtualizarPapel(idFuncionario, papel);
    if (!changes) throw { status: 404, mensagem: "Funcionário não encontrado" };
    return { ...funcionario, papel };
}

/**
 * Liga e desliga o acesso.
 *
 * Mesmas travas do papel: ninguém se desliga sozinho e o último gestor ativo
 * não pode sair. Comanda aberta não impede — outro garçom assume a mesa, e
 * travar aqui deixaria o desligamento refém de uma conta esquecida em aberto.
 */
async function AlterarAtivo(idFuncionario, ativo, idEmpresa, idFuncionarioLogado) {
    const funcionario = await buscarDaEmpresa(idFuncionario, idEmpresa);

    if (!ativo) {
        if (funcionario.id_funcionario === Number(idFuncionarioLogado)) {
            throw { status: 409, mensagem: "Você não pode desligar a si mesmo." };
        }
        if (funcionario.papel === "gestor") {
            const gestores = await repoFuncionario.ContarGestoresAtivos(idEmpresa);
            if (gestores <= 1) {
                throw { status: 409, mensagem: "Este é o único gestor do restaurante. Promova outra pessoa antes." };
            }
        }
    }

    const changes = await repoFuncionario.AtualizarAtivo(idFuncionario, ativo);
    if (!changes) throw { status: 404, mensagem: "Funcionário não encontrado" };
    return { ...funcionario, ativo: ativo ? 1 : 0 };
}

async function Desempenho(idEmpresa, de, ate) {
    const linhas = await repoFuncionario.Desempenho(idEmpresa, de, ate);
    return linhas.map(l => ({
        ...l,
        vl_total: Number(l.vl_total),
        comandas: Number(l.comandas),
        rodadas: Number(l.rodadas),
        // Ticket médio por comanda atendida. Sem comanda no período o campo é
        // zero, e não uma divisão por zero.
        vl_ticket_medio: Number(l.comandas) > 0
            ? Math.round((Number(l.vl_total) / Number(l.comandas)) * 100) / 100
            : 0,
    }));
}

export default { Listar, Criar, AlterarPapel, AlterarAtivo, Desempenho, PAPEIS_VALIDOS };
