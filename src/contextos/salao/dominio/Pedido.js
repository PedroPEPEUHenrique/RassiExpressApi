import { Conflito, EntradaInvalida } from '../../../compartilhado/dominio/erros.js';
import { emCentavos, somar } from '../../../compartilhado/dominio/dinheiro.js';

/**
 * Regras da rodada — o pedido que o garçom manda para a cozinha.
 *
 * Tudo aqui é função pura sobre dados: nenhum acesso a banco, nenhuma noção
 * de HTTP. É o que permite testar o fluxo de status e o cálculo de preço sem
 * subir nada.
 */

/**
 * Fluxo de uma rodada na cozinha.
 *
 * Não existe estado "rascunho": enquanto o garçom monta, a rodada vive no
 * aparelho dele. Ela só nasce aqui quando é enviada — e nesse instante já
 * está na fila da cozinha.
 */
const FLUXO = Object.freeze({
    enviado: ['em_preparo', 'cancelado'],
    em_preparo: ['pronto', 'cancelado'],
    pronto: ['entregue'],
    entregue: [],
    cancelado: [],
});

const STATUS_PENDENTES = Object.freeze(['enviado', 'em_preparo', 'pronto']);

/** Valida a transição e devolve o status novo, ou estoura explicando. */
function avancarStatus(statusAtual, statusNovo) {
    const permitidos = FLUXO[statusAtual];
    if (!permitidos) throw new Conflito(`Status atual desconhecido: ${statusAtual}`);

    if (!permitidos.includes(statusNovo)) {
        throw new Conflito(
            permitidos.length
                ? `Não é possível ir de "${statusAtual}" para "${statusNovo}"`
                : `Pedido já está "${statusAtual}" e não muda mais`,
            { statusAtual, permitidos }
        );
    }
    return statusNovo;
}

/**
 * Converte o que o garçom pediu no que será gravado, usando o cardápio como
 * única fonte de preço.
 *
 * O app envia produto, quantidade e observação — nunca valor. O preço sai do
 * produto e é congelado junto com o nome: é o número que o cliente vai pagar,
 * e aceitar o que o aparelho mandou seria deixar qualquer portador de token
 * escolher quanto custa o prato.
 *
 * @param {Array} itensPedidos  [{ idProduto, quantidade, observacao }]
 * @param {Map<number, object>} cardapio  idProduto -> produto do banco
 */
function montarItens(itensPedidos, cardapio) {
    if (!itensPedidos?.length) throw new EntradaInvalida('A rodada precisa de ao menos um item');

    const itens = itensPedidos.map((item) => {
        const produto = cardapio.get(Number(item.idProduto));
        if (!produto) throw new Conflito(`Produto ${item.idProduto} não encontrado no cardápio`);
        if (!produto.ativo) throw new Conflito(`"${produto.nome}" saiu do cardápio`);

        // Compara com 0 em vez de usar negação: num banco onde a coluna
        // `disponivel` ainda não existe o campo vem undefined, e `!x`
        // recusaria TODOS os pedidos. Sem a coluna não há conceito de falta.
        if (Number(produto.disponivel) === 0) throw new Conflito(`"${produto.nome}" acabou`);

        const quantidade = Number(item.quantidade);
        if (!Number.isInteger(quantidade) || quantidade < 1) {
            throw new EntradaInvalida(`Quantidade inválida para "${produto.nome}"`);
        }

        const vlUnitario = Number(produto.valor);
        return {
            idProduto: produto.id_produto,
            nomeProduto: produto.nome,
            observacao: item.observacao ?? null,
            quantidade,
            vlUnitario,
            vlTotal: emCentavos(vlUnitario * quantidade),
        };
    });

    return { itens, vlSubtotal: somar(itens.map((i) => i.vlTotal)) };
}

/** Rodadas que a cozinha ainda não encerrou. Bloqueiam o fechamento da mesa. */
function pendentes(rodadas) {
    return rodadas.filter((r) => STATUS_PENDENTES.includes(r.status));
}

export { FLUXO, STATUS_PENDENTES, avancarStatus, montarItens, pendentes };
