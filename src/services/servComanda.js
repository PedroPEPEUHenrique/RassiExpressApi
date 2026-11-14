import { withTransaction } from "../database/mysql.js"
import repoComanda from "../repositories/repoComanda.js"
import repoMesa from "../repositories/repoMesa.js"
import repoPedido from "../repositories/repoPedido.js"
import repoItensPedido from "../repositories/repoItensPedido.js"
import servCaixa from "./servCaixa.js"

const STATUS_PENDENTES = ["enviado", "em_preparo", "pronto"];

/**
 * Carrega a comanda confirmando que é do restaurante do token.
 *
 * 404 em vez de 403 quando é de outro restaurante: id de comanda é
 * sequencial, e um 403 confirmaria que aquela comanda existe.
 */
async function buscarDaEmpresa(idComanda, idEmpresa, conn) {
    const comanda = await repoComanda.ListarPorId(idComanda, conn);
    if (!comanda || comanda.id_empresa !== Number(idEmpresa)) {
        throw { status: 404, mensagem: "Comanda não encontrada" };
    }
    return comanda;
}

async function ListarAbertas(idEmpresa) {
    return await repoComanda.ListarAbertas(idEmpresa);
}

/**
 * Abre a conta de uma mesa.
 *
 * A unicidade de "uma comanda aberta por mesa" é garantida pelo índice do
 * banco (uk_comanda_mesa_aberta), não por esta verificação. A verificação
 * existe só para devolver uma mensagem útil no caso comum; a corrida entre
 * dois garçons tocando a mesma mesa ao mesmo tempo é barrada pelo índice, e
 * o erro de duplicidade é traduzido abaixo.
 */
async function Abrir({ idMesa, observacao }, idEmpresa, idFuncionario) {
    const mesa = await repoMesa.ListarPorId(idMesa);
    if (!mesa || mesa.id_empresa !== Number(idEmpresa) || !mesa.ativo) {
        throw { status: 404, mensagem: "Mesa não encontrada" };
    }

    const aberta = await repoComanda.ListarAbertaPorMesa(idMesa);
    if (aberta) {
        throw { status: 409, mensagem: `A mesa ${mesa.numero} já tem uma comanda aberta`, dados: { idComanda: aberta.id_comanda } };
    }

    let idComanda;
    try {
        idComanda = await repoComanda.Criar({ idEmpresa, idMesa, idFuncionario, observacao });
    } catch (erro) {
        if (erro.code === "ER_DUP_ENTRY") {
            throw { status: 409, mensagem: `A mesa ${mesa.numero} já tem uma comanda aberta` };
        }
        throw erro;
    }

    return await ListarPorId(idComanda, idEmpresa);
}

/**
 * A comanda com suas rodadas e itens — o que o garçom mostra ao cliente.
 *
 * Os itens de todas as rodadas vêm numa consulta só e são agrupados aqui, em
 * vez de uma consulta por rodada.
 */
async function ListarPorId(idComanda, idEmpresa) {
    const comanda = await buscarDaEmpresa(idComanda, idEmpresa);
    const rodadas = await repoPedido.ListarPorComanda(idComanda);
    const itens = await repoItensPedido.ListarPorComanda(idComanda);

    const itensPorRodada = new Map();
    for (const item of itens) {
        if (!itensPorRodada.has(item.id_pedido)) itensPorRodada.set(item.id_pedido, []);
        itensPorRodada.get(item.id_pedido).push(item);
    }

    return {
        ...comanda,
        rodadas: rodadas.map(r => ({ ...r, itens: itensPorRodada.get(r.id_pedido) ?? [] })),
    };
}

/**
 * Fecha a conta e libera a mesa.
 *
 * O app não registra pagamento — só apresenta o valor —, então fechar é
 * marcar a comanda como fechada. A mesa volta a aparecer livre sozinha,
 * porque a coluna gerada id_mesa_aberta passa a ser NULL.
 *
 * Rodada ainda na cozinha bloqueia o fechamento por padrão: fechar com comida
 * em preparo quase sempre é engano, e o valor ia para o faturamento do mesmo
 * jeito. `forcar` existe para o caso legítimo (cliente desistiu), e aí as
 * rodadas pendentes são canceladas e saem do total.
 */
async function Fechar(idComanda, { forcar = false }, idEmpresa, idFuncionario) {
    const comanda = await buscarDaEmpresa(idComanda, idEmpresa);
    if (comanda.status !== "aberta") {
        throw { status: 409, mensagem: "Esta comanda já foi fechada" };
    }

    const rodadas = await repoPedido.ListarPorComanda(idComanda);
    const pendentes = rodadas.filter(r => STATUS_PENDENTES.includes(r.status));

    if (pendentes.length && !forcar) {
        throw {
            status: 409,
            mensagem: `Há ${pendentes.length} pedido(s) ainda não entregues nesta mesa`,
            dados: { pendentes: pendentes.map(r => ({ idPedido: r.id_pedido, status: r.status })) },
        };
    }

    return await withTransaction(async (conn) => {
        for (const rodada of pendentes) {
            await repoPedido.AtualizarStatus(rodada.id_pedido, "cancelado", conn);
        }
        // Recalcula depois de cancelar, para o total não cobrar o que não saiu.
        await repoComanda.RecalcularTotal(idComanda, conn);

        const changes = await repoComanda.Fechar(idComanda, idFuncionario, conn);
        if (!changes) throw { status: 409, mensagem: "Esta comanda já foi fechada" };

        const fechada = await repoComanda.ListarPorId(idComanda, conn);

        // A venda entra no caixa do turno na mesma transação do fechamento: o
        // total da mesa já É o valor da venda, e pedir que o gestor relance à
        // mão seria digitar o mesmo número duas vezes e divergir na primeira
        // distração. Sem caixa aberto não falha — a venda continua em COMANDA
        // e nos relatórios; só não entra no livro do turno.
        await servCaixa.RegistrarVendaDaComanda(fechada, idFuncionario, conn);

        return fechada;
    });
}

export default { ListarAbertas, ListarPorId, Abrir, Fechar, buscarDaEmpresa };
