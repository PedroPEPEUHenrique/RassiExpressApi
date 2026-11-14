import { withTransaction } from "../database/mysql.js"
import repoCaixa from "../repositories/repoCaixa.js"

const TIPOS_MANUAIS = ["venda_externa", "despesa", "sangria", "suprimento"];

async function buscarDaEmpresa(idCaixa, idEmpresa, conn) {
    const caixa = await repoCaixa.ListarPorId(idCaixa, conn);
    if (!caixa || caixa.id_empresa !== Number(idEmpresa)) {
        throw { status: 404, mensagem: "Caixa não encontrado" };
    }
    return caixa;
}

function montarResumo(caixa, totais) {
    const abertura = Number(caixa.vl_abertura ?? 0);
    const saldoMovimentos = Number(totais.saldo_movimentos ?? 0);
    const esperado = Math.round((abertura + saldoMovimentos) * 100) / 100;
    const informado = caixa.vl_informado === null || caixa.vl_informado === undefined
        ? null
        : Number(caixa.vl_informado);

    return {
        vlAbertura: abertura,
        vendas: Number(totais.vendas ?? 0),
        vendasExternas: Number(totais.vendas_externas ?? 0),
        suprimentos: Number(totais.suprimentos ?? 0),
        despesas: Number(totais.despesas ?? 0),
        sangrias: Number(totais.sangrias ?? 0),
        movimentos: Number(totais.movimentos ?? 0),
        /** Quanto deveria haver na gaveta. */
        vlEsperado: esperado,
        vlInformado: informado,
        /** Positivo = sobrou dinheiro; negativo = faltou. */
        vlDiferenca: informado === null ? null : Math.round((informado - esperado) * 100) / 100,
    };
}

async function Atual(idEmpresa) {
    const caixa = await repoCaixa.ListarAberto(idEmpresa);
    if (!caixa) return null;
    const [totais, movimentos] = await Promise.all([
        repoCaixa.Resumo(caixa.id_caixa),
        repoCaixa.ListarMovimentos(caixa.id_caixa),
    ]);
    return { ...caixa, resumo: montarResumo(caixa, totais), movimentos };
}

async function ListarPorId(idCaixa, idEmpresa) {
    const caixa = await buscarDaEmpresa(idCaixa, idEmpresa);
    const [totais, movimentos] = await Promise.all([
        repoCaixa.Resumo(idCaixa),
        repoCaixa.ListarMovimentos(idCaixa),
    ]);
    return { ...caixa, resumo: montarResumo(caixa, totais), movimentos };
}

async function Historico(idEmpresa, de, ate) {
    const caixas = await repoCaixa.ListarPorEmpresa(idEmpresa, de, ate);
    return await Promise.all(caixas.map(async (c) => ({
        ...c,
        resumo: montarResumo(c, await repoCaixa.Resumo(c.id_caixa)),
    })));
}

/**
 * Abre o turno.
 *
 * A unicidade de um caixa aberto por restaurante é do índice do banco; esta
 * verificação existe para dar mensagem útil no caso comum, e a corrida entre
 * dois gestores abrindo ao mesmo tempo é traduzida abaixo.
 */
async function Abrir({ vlAbertura = 0, observacao }, idEmpresa, idFuncionario) {
    if (Number(vlAbertura) < 0) throw { status: 400, mensagem: "O valor de abertura não pode ser negativo" };

    const aberto = await repoCaixa.ListarAberto(idEmpresa);
    if (aberto) {
        throw { status: 409, mensagem: "Já existe um caixa aberto", dados: { idCaixa: aberto.id_caixa } };
    }

    try {
        const idCaixa = await repoCaixa.Abrir({ idEmpresa, idFuncionario, vlAbertura, observacao });
        return await ListarPorId(idCaixa, idEmpresa);
    } catch (erro) {
        if (erro.code === "ER_DUP_ENTRY") {
            throw { status: 409, mensagem: "Já existe um caixa aberto" };
        }
        throw erro;
    }
}

/**
 * Fecha o turno conferindo o dinheiro contado contra o esperado.
 *
 * A diferença é registrada, não recusada: quebra de caixa acontece e esconder
 * o número seria pior do que mostrá-lo. O fechamento só é barrado quando
 * ainda há mesa aberta, porque essas vendas entrariam no caixa seguinte e o
 * turno fecharia com um buraco que ninguém saberia explicar depois.
 */
async function Fechar(idCaixa, { vlInformado, observacao, forcar = false }, idEmpresa, idFuncionario, comandasAbertas = 0) {
    const caixa = await buscarDaEmpresa(idCaixa, idEmpresa);
    if (caixa.status !== "aberto") throw { status: 409, mensagem: "Este caixa já foi fechado" };
    if (Number(vlInformado) < 0) throw { status: 400, mensagem: "O valor contado não pode ser negativo" };

    if (comandasAbertas > 0 && !forcar) {
        throw {
            status: 409,
            mensagem: `Há ${comandasAbertas} mesa(s) com comanda aberta. Feche as contas antes de fechar o caixa.`,
            dados: { comandasAbertas },
        };
    }

    return await withTransaction(async (conn) => {
        const changes = await repoCaixa.Fechar(idCaixa, { idFuncionario, vlInformado, observacao }, conn);
        if (!changes) throw { status: 409, mensagem: "Este caixa já foi fechado" };
        const atualizado = await repoCaixa.ListarPorId(idCaixa, conn);
        const totais = await repoCaixa.Resumo(idCaixa, conn);
        return { ...atualizado, resumo: montarResumo(atualizado, totais) };
    });
}

/**
 * Lançamento manual: delivery, despesa, sangria, suprimento.
 *
 * O tipo 'venda' não entra aqui de propósito. Venda de mesa é registrada
 * automaticamente no fechamento da comanda; deixar lançar à mão abriria a
 * porta para a mesma venda entrar duas vezes no mesmo turno.
 */
async function Lancar({ tipo, valor, descricao }, idEmpresa, idFuncionario) {
    if (!TIPOS_MANUAIS.includes(tipo)) {
        throw {
            status: 400,
            mensagem: tipo === "venda"
                ? "Venda de mesa entra sozinha no fechamento da comanda"
                : `Tipo inválido. Use um de: ${TIPOS_MANUAIS.join(", ")}`,
        };
    }
    if (!(Number(valor) > 0)) throw { status: 400, mensagem: "O valor deve ser maior que zero" };

    const caixa = await repoCaixa.ListarAberto(idEmpresa);
    if (!caixa) throw { status: 409, mensagem: "Abra o caixa antes de lançar movimentos" };

    await repoCaixa.CriarMovimento({
        idCaixa: caixa.id_caixa, idEmpresa, idFuncionario,
        tipo, descricao, valor: Number(valor),
    });

    return await ListarPorId(caixa.id_caixa, idEmpresa);
}

/**
 * Registra a venda de uma comanda recém-fechada, se houver caixa aberto.
 *
 * Chamado de dentro da transação que fecha a comanda, com a mesma conexão.
 * Sem caixa aberto a venda não é perdida — ela continua em COMANDA e aparece
 * nos relatórios; o que falta é só o lançamento no livro do turno. Barrar o
 * fechamento da mesa por causa disso prenderia o cliente na porta.
 *
 * O índice único em id_comanda garante que a mesma comanda não entre duas
 * vezes, mesmo que o fechamento seja repetido.
 */
async function RegistrarVendaDaComanda(comanda, idFuncionario, conn) {
    const valor = Number(comanda.vl_total ?? 0);
    if (!(valor > 0)) return null;

    const caixa = await repoCaixa.ListarAberto(comanda.id_empresa, conn);
    if (!caixa) return null;

    try {
        return await repoCaixa.CriarMovimento({
            idCaixa: caixa.id_caixa,
            idEmpresa: comanda.id_empresa,
            idFuncionario,
            tipo: "venda",
            descricao: `Mesa ${comanda.numero_mesa ?? comanda.id_mesa}`,
            valor,
            idComanda: comanda.id_comanda,
        }, conn);
    } catch (erro) {
        // Já lançada: fechamento repetido não duplica a receita do turno.
        if (erro.code === "ER_DUP_ENTRY") return null;
        throw erro;
    }
}

export default {
    Atual, ListarPorId, Historico, Abrir, Fechar, Lancar,
    RegistrarVendaDaComanda, TIPOS_MANUAIS,
};
