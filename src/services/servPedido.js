import { withTransaction } from "../database/mysql.js"
import repoPedido from "../repositories/repoPedido.js"
import repoItensPedido from "../repositories/repoItensPedido.js"
import repoComanda from "../repositories/repoComanda.js"
import repoProduto from "../repositories/repoProduto.js"

/**
 * Fluxo de uma rodada na cozinha. Não existe estado "rascunho" aqui: enquanto
 * o garçom monta a rodada ela vive no aparelho dele. Ela só chega ao banco
 * quando é enviada — e nesse instante já está na fila da cozinha.
 */
const FLUXO = {
    enviado: ["em_preparo", "cancelado"],
    em_preparo: ["pronto", "cancelado"],
    pronto: ["entregue"],
    entregue: [],
    cancelado: [],
};

async function buscarDaEmpresa(idPedido, idEmpresa, conn) {
    const pedido = await repoPedido.ListarPorId(idPedido, conn);
    if (!pedido || pedido.id_empresa !== Number(idEmpresa)) {
        throw { status: 404, mensagem: "Pedido não encontrado" };
    }
    return pedido;
}

async function comItens(pedido, conn) {
    const itens = await repoItensPedido.ListarPorPedido(pedido.id_pedido, conn);
    return { ...pedido, itens };
}

async function ListarFilaCozinha(idEmpresa) {
    const rodadas = await repoPedido.ListarFilaCozinha(idEmpresa);
    // A cozinha precisa ver os itens, não só a rodada. São poucas rodadas
    // abertas por vez, então o custo de uma consulta por rodada é aceitável
    // aqui — e manter o SQL simples importa mais nesta tela.
    return await Promise.all(rodadas.map(r => comItens(r)));
}

async function ListarPorId(idPedido, idEmpresa) {
    const pedido = await buscarDaEmpresa(idPedido, idEmpresa);
    return await comItens(pedido);
}

/**
 * Lança uma rodada numa comanda aberta e manda para a cozinha.
 *
 * Duas garantias moram aqui:
 *
 * 1. **Preço vem do banco.** O app envia produto, quantidade e observação —
 *    nunca valor. O preço sai de PRODUTO.valor no instante do lançamento, e
 *    é congelado em vl_unitario junto com o nome. É o número que o cliente
 *    vai pagar; aceitar o que o aparelho mandou seria aceitar que qualquer um
 *    com o token escolhesse quanto custa o prato.
 *
 * 2. **Idempotência por idLocal.** O aparelho gera um UUID por rodada. Se a
 *    rede cair depois do servidor gravar mas antes da resposta chegar, o
 *    garçom reenvia e recebe de volta a MESMA rodada, em vez de o prato ser
 *    feito duas vezes. Sem isso, a fila de reenvio offline seria pior que não
 *    ter reenvio nenhum.
 */
async function Criar(idComanda, { itens, idLocal }, idEmpresa, idFuncionario) {
    if (!itens?.length) throw { status: 400, mensagem: "A rodada precisa de ao menos um item" };

    if (idLocal) {
        const existente = await repoPedido.ListarPorIdLocal(idLocal);
        if (existente) {
            // Reenvio de algo que já chegou: devolve o que existe, não duplica.
            if (existente.id_empresa !== Number(idEmpresa)) {
                throw { status: 409, mensagem: "Identificador de rodada já utilizado" };
            }
            return await comItens(existente);
        }
    }

    const comanda = await repoComanda.ListarPorId(idComanda);
    if (!comanda || comanda.id_empresa !== Number(idEmpresa)) {
        throw { status: 404, mensagem: "Comanda não encontrada" };
    }
    if (comanda.status !== "aberta") {
        throw { status: 409, mensagem: "Esta comanda está fechada. Abra a mesa novamente para lançar." };
    }

    const ids = [...new Set(itens.map(i => Number(i.idProduto)))];
    const produtos = await repoProduto.ListarPorIdsDaEmpresa(ids, idEmpresa);
    const porId = new Map(produtos.map(p => [p.id_produto, p]));

    const itensCalculados = itens.map((item) => {
        const produto = porId.get(Number(item.idProduto));
        if (!produto) throw { status: 404, mensagem: `Produto ${item.idProduto} não encontrado no cardápio` };
        if (!produto.ativo) throw { status: 409, mensagem: `"${produto.nome}" não está mais disponível` };

        const quantidade = Number(item.quantidade);
        if (!Number.isInteger(quantidade) || quantidade < 1) {
            throw { status: 400, mensagem: `Quantidade inválida para "${produto.nome}"` };
        }

        const vlUnitario = Number(produto.valor);
        return {
            idProduto: produto.id_produto,
            nomeProduto: produto.nome,
            observacao: item.observacao ?? null,
            quantidade,
            vlUnitario,
            // Arredonda a duas casas: o DECIMAL(10,2) do banco truncaria, e a
            // soma das rodadas tem que bater com o total da comanda ao centavo.
            vlTotal: Math.round(vlUnitario * quantidade * 100) / 100,
        };
    });

    const vlSubtotal = Math.round(itensCalculados.reduce((s, i) => s + i.vlTotal, 0) * 100) / 100;

    // Rodada, itens e o novo total da comanda numa transação só: uma rodada
    // pela metade deixaria a conta da mesa errada.
    const idPedido = await withTransaction(async (conn) => {
        let novoId;
        try {
            novoId = await repoPedido.Criar({
                idEmpresa, idComanda, idFuncionario, tipo: "mesa", idLocal,
                vlSubtotal, vlTotal: vlSubtotal,
            }, conn);
        } catch (erro) {
            // Dois envios simultâneos da mesma rodada: o índice único de
            // id_local barra o segundo. Não é erro — a rodada chegou.
            if (erro.code === "ER_DUP_ENTRY") return null;
            throw erro;
        }

        for (const item of itensCalculados) {
            await repoItensPedido.Criar({ ...item, idPedido: novoId }, conn);
        }
        await repoComanda.RecalcularTotal(idComanda, conn);
        return novoId;
    });

    if (idPedido === null) {
        const existente = await repoPedido.ListarPorIdLocal(idLocal);
        // Só chega aqui com ER_DUP_ENTRY, que no PEDIDO só pode vir do índice
        // de id_local — então a rodada existe. Se ainda assim não vier, é
        // melhor um erro explícito do que estourar ao ler campo de undefined.
        if (!existente) {
            throw { status: 409, mensagem: "Não foi possível confirmar o envio desta rodada. Recarregue a comanda." };
        }
        return await comItens(existente);
    }

    return await ListarPorId(idPedido, idEmpresa);
}

/**
 * Avança a rodada na cozinha.
 *
 * A regra antiga comparava o pedido com o id do usuário dono dele — herança
 * do delivery, onde o cliente acompanhava o próprio pedido. Aqui quem move o
 * status é a equipe do restaurante, e o que importa é a rodada ser da empresa
 * do token e a transição existir no fluxo.
 */
async function AtualizarStatus(idPedido, status, idEmpresa) {
    const pedido = await buscarDaEmpresa(idPedido, idEmpresa);

    const permitidos = FLUXO[pedido.status];
    if (!permitidos) throw { status: 409, mensagem: `Status atual desconhecido: ${pedido.status}` };
    if (!permitidos.includes(status)) {
        throw {
            status: 409,
            mensagem: permitidos.length
                ? `Não é possível ir de "${pedido.status}" para "${status}"`
                : `Pedido já está "${pedido.status}" e não muda mais`,
            dados: { statusAtual: pedido.status, permitidos },
        };
    }

    return await withTransaction(async (conn) => {
        await repoPedido.AtualizarStatus(idPedido, status, conn);
        // Cancelar tira o valor da conta, então o total da mesa é refeito.
        if (status === "cancelado" && pedido.id_comanda) {
            await repoComanda.RecalcularTotal(pedido.id_comanda, conn);
        }
        const atualizado = await repoPedido.ListarPorId(idPedido, conn);
        return await comItens(atualizado, conn);
    });
}

export default { ListarFilaCozinha, ListarPorId, Criar, AtualizarStatus, FLUXO };
