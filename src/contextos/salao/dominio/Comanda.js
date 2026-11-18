import { Conflito } from '../../../compartilhado/dominio/erros.js';
import { pendentes } from './Pedido.js';

/**
 * Regras da comanda — a conta da mesa, aberta até o fechamento.
 *
 * A unicidade de "uma comanda aberta por mesa" NÃO mora aqui: é um índice
 * único do banco sobre coluna gerada. Regra de corrida pertence ao lugar que
 * consegue garanti-la sob concorrência, e dois garçons tocando a mesma mesa
 * ao mesmo tempo é o caso normal, não a exceção.
 */

function garantirAberta(comanda) {
    if (comanda.status !== 'aberta') throw new Conflito('Esta comanda já foi fechada');
    return comanda;
}

/**
 * Decide se a conta pode fechar.
 *
 * Rodada ainda na cozinha bloqueia por padrão: fechar com comida em preparo
 * quase sempre é engano, e o valor iria para o faturamento do mesmo jeito.
 * `forcar` existe para o caso legítimo — cliente desistiu — e aí as pendentes
 * são canceladas e saem do total.
 *
 * @returns {{ aCancelar: Array }} rodadas que o caso de uso deve cancelar
 */
function planejarFechamento(comanda, rodadas, { forcar = false } = {}) {
    garantirAberta(comanda);

    const naCozinha = pendentes(rodadas);
    if (naCozinha.length && !forcar) {
        throw new Conflito(
            `Há ${naCozinha.length} pedido(s) ainda não entregues nesta mesa`,
            { pendentes: naCozinha.map((r) => ({ idPedido: r.id_pedido, status: r.status })) }
        );
    }

    return { aCancelar: naCozinha };
}

export { garantirAberta, planejarFechamento };
