import { Conflito, EntradaInvalida } from '../../../compartilhado/dominio/erros.js';
import { emCentavos } from '../../../compartilhado/dominio/dinheiro.js';

/**
 * Regras do caixa — o livro do turno.
 *
 * O app não processa pagamento: ele mostra o valor e registra que a venda
 * aconteceu. O caixa responde "o que passou pela gaveta", que é pergunta
 * diferente de "quanto o restaurante faturou" — essa é dos relatórios.
 */

/**
 * Tipos que o gestor lança à mão.
 *
 * 'venda' está fora de propósito: venda de mesa é registrada automaticamente
 * no fechamento da comanda, e permitir lançá-la à mão deixaria a mesma venda
 * entrar duas vezes no mesmo turno.
 */
const TIPOS_MANUAIS = Object.freeze(['venda_externa', 'despesa', 'sangria', 'suprimento']);

/** Sinal por tipo, numa definição só — divergir aqui viraria quebra fantasma. */
const ENTRADAS = Object.freeze(['venda', 'venda_externa', 'suprimento']);

function validarLancamento({ tipo, valor }) {
    if (!TIPOS_MANUAIS.includes(tipo)) {
        throw new EntradaInvalida(
            tipo === 'venda'
                ? 'Venda de mesa entra sozinha no fechamento da comanda'
                : `Tipo inválido. Use um de: ${TIPOS_MANUAIS.join(', ')}`
        );
    }
    if (!(Number(valor) > 0)) throw new EntradaInvalida('O valor deve ser maior que zero');
}

/**
 * Monta o resumo do turno a partir dos totais vindos do banco.
 *
 * `vlEsperado` é o que deveria haver na gaveta; `vlDiferenca` é a quebra. A
 * diferença é registrada, não recusada: quebra de caixa acontece, e esconder
 * o número seria pior do que mostrá-lo.
 */
function montarResumo(caixa, totais) {
    const abertura = Number(caixa.vl_abertura ?? 0);
    const esperado = emCentavos(abertura + Number(totais.saldo_movimentos ?? 0));
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
        vlEsperado: esperado,
        vlInformado: informado,
        /** Positivo = sobrou dinheiro; negativo = faltou. */
        vlDiferenca: informado === null ? null : emCentavos(informado - esperado),
    };
}

function validarAbertura(vlAbertura) {
    if (Number(vlAbertura) < 0) throw new EntradaInvalida('O valor de abertura não pode ser negativo');
}

/**
 * Decide se o turno pode fechar.
 *
 * Mesa aberta trava: essas vendas entrariam no caixa seguinte e o turno
 * fecharia com um buraco que ninguém saberia explicar depois.
 */
function garantirPodeFechar(caixa, vlInformado, comandasAbertas, { forcar = false } = {}) {
    if (caixa.status !== 'aberto') throw new Conflito('Este caixa já foi fechado');
    if (Number(vlInformado) < 0) throw new EntradaInvalida('O valor contado não pode ser negativo');

    if (comandasAbertas > 0 && !forcar) {
        throw new Conflito(
            `Há ${comandasAbertas} mesa(s) com comanda aberta. Feche as contas antes de fechar o caixa.`,
            { comandasAbertas }
        );
    }
}

export { TIPOS_MANUAIS, ENTRADAS, validarLancamento, montarResumo, validarAbertura, garantirPodeFechar };
