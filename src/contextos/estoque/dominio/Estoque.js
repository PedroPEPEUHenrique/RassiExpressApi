import { EntradaInvalida } from '../../../compartilhado/dominio/erros.js';
import { emCentavos, emMilesimos } from '../../../compartilhado/dominio/dinheiro.js';

/**
 * Regras de estoque.
 *
 * Duas decisões que mantêm o salão funcionando, e que são regra de negócio,
 * não detalhe técnico:
 *
 * 1. **Ficha técnica é opcional.** Produto sem ficha não movimenta nada, então
 *    o restaurante usa o sistema normalmente e cadastra receitas aos poucos.
 *    Exigir ficha completa travaria o salão por cadastro de retaguarda.
 *
 * 2. **Saldo negativo não bloqueia a venda.** O prato já foi pedido e a
 *    cozinha vai prepará-lo; recusar a rodada porque o sistema acha que
 *    acabou a farinha pararia o restaurante por erro de cadastro. O saldo
 *    fica negativo e aparece como sinal de que a contagem está errada — que é
 *    a informação útil.
 */

const UNIDADES = Object.freeze(['kg', 'g', 'l', 'ml', 'un']);
const TIPOS_MANUAIS = Object.freeze(['entrada', 'perda', 'ajuste']);

function validarUnidade(unidade) {
    if (!UNIDADES.includes(unidade)) {
        throw new EntradaInvalida(`Unidade inválida. Use uma de: ${UNIDADES.join(', ')}`);
    }
    return unidade;
}

/**
 * Calcula a variação de saldo de um movimento manual.
 *
 * 'ajuste' DEFINE o saldo em vez de somar: é a contagem física corrigindo o
 * sistema, e somar a diferença exigiria que o gestor a calculasse de cabeça.
 */
function planejarMovimento({ tipo, quantidade, vlUnitario }, insumo) {
    if (!TIPOS_MANUAIS.includes(tipo)) {
        throw new EntradaInvalida('Tipo deve ser entrada, perda ou ajuste');
    }

    const qtd = Number(quantidade);
    if (!Number.isFinite(qtd) || qtd <= 0) {
        throw new EntradaInvalida('A quantidade deve ser maior que zero');
    }
    if (tipo === 'entrada' && !(Number(vlUnitario) > 0)) {
        throw new EntradaInvalida('Informe o custo unitário da entrada');
    }

    const variacao = tipo === 'entrada' ? qtd
        : tipo === 'perda' ? -qtd
        : qtd - Number(insumo.qtd_atual);

    return {
        variacao: emMilesimos(variacao),
        // Perda e ajuste não mexem no custo: a quantidade mudou, o que cada
        // unidade custou não.
        recalcularCusto: tipo === 'entrada',
        quantidadeRegistrada: emMilesimos(Math.abs(variacao) || qtd),
        custoDoMovimento: tipo === 'entrada' ? Number(vlUnitario) : Number(insumo.vl_custo_medio),
    };
}

/**
 * Soma o consumo de uma rodada por insumo.
 *
 * Agrega antes de gravar: dois pratos da mesma rodada que usam o mesmo insumo
 * viram um movimento só, em vez de dois.
 *
 * @param {Array} itens    itens já precificados da rodada
 * @param {Array} fichas   linhas de ficha técnica dos produtos envolvidos
 * @returns {Map<number, {quantidade:number, custo:number}>}
 */
function calcularConsumo(itens, fichas) {
    const porProduto = new Map();
    for (const f of fichas) {
        if (!porProduto.has(f.id_produto)) porProduto.set(f.id_produto, []);
        porProduto.get(f.id_produto).push(f);
    }

    const consumo = new Map();
    for (const item of itens) {
        const ficha = porProduto.get(Number(item.idProduto));
        if (!ficha) continue; // produto sem ficha não movimenta nada
        for (const linha of ficha) {
            const total = Number(linha.quantidade) * Number(item.quantidade);
            const atual = consumo.get(linha.id_insumo) ?? { quantidade: 0, custo: Number(linha.vl_custo_medio) };
            atual.quantidade += total;
            consumo.set(linha.id_insumo, atual);
        }
    }

    for (const [id, dados] of consumo) {
        consumo.set(id, { ...dados, quantidade: emMilesimos(dados.quantidade) });
    }
    return consumo;
}

/**
 * Custo e margem de um prato a partir da ficha.
 *
 * Margem é null sem ficha cadastrada: sem receita o custo é desconhecido, não
 * zero — e zero apareceria como 100% de margem, que é mentira.
 */
function calcularMargem(precoDeVenda, itensDaFicha) {
    const custo = itensDaFicha.reduce((s, i) => s + Number(i.quantidade) * Number(i.vl_custo_medio), 0);
    const preco = Number(precoDeVenda);
    const temFicha = itensDaFicha.length > 0;

    return {
        vlCusto: emCentavos(custo),
        vlMargem: temFicha ? emCentavos(preco - custo) : null,
        percMargem: temFicha && preco > 0 ? Math.round(((preco - custo) / preco) * 1000) / 10 : null,
    };
}

export { UNIDADES, TIPOS_MANUAIS, validarUnidade, planejarMovimento, calcularConsumo, calcularMargem };
