import { Conflito, EntradaInvalida } from '../../../compartilhado/dominio/erros.js';

/**
 * Regras de vínculo e papel.
 *
 * As duas travas abaixo existem pela mesma razão: impedir que o restaurante
 * fique trancado para fora do próprio sistema, sem ninguém com poder de
 * destrancar.
 */

const PAPEIS = Object.freeze(['gestor', 'garcom', 'cozinha']);

function validarPapel(papel) {
    if (!PAPEIS.includes(papel)) {
        throw new EntradaInvalida(`Papel inválido. Use um de: ${PAPEIS.join(', ')}`);
    }
    return papel;
}

/**
 * @param {object} alvo            vínculo que será alterado
 * @param {number} idQuemAge       funcionário autenticado
 * @param {string} papelNovo
 * @param {number} gestoresAtivos  quantos gestores a casa ainda tem
 */
function garantirTrocaDePapel(alvo, idQuemAge, papelNovo, gestoresAtivos) {
    validarPapel(papelNovo);

    // Rebaixar-se por engano é um toque, e desfazer exigiria justamente o
    // acesso que a pessoa acabou de perder.
    if (alvo.id_funcionario === Number(idQuemAge) && papelNovo !== 'gestor') {
        throw new Conflito('Você não pode mudar o seu próprio papel. Peça a outro gestor.');
    }

    // Sem gestor não há quem cadastre produto, mesa ou funcionário — nem quem
    // promova alguém de volta.
    if (alvo.papel === 'gestor' && papelNovo !== 'gestor' && gestoresAtivos <= 1) {
        throw new Conflito('Este é o único gestor do restaurante. Promova outra pessoa antes.');
    }
}

function garantirDesligamento(alvo, idQuemAge, gestoresAtivos) {
    if (alvo.id_funcionario === Number(idQuemAge)) {
        throw new Conflito('Você não pode desligar a si mesmo.');
    }
    if (alvo.papel === 'gestor' && gestoresAtivos <= 1) {
        throw new Conflito('Este é o único gestor do restaurante. Promova outra pessoa antes.');
    }
}

export { PAPEIS, validarPapel, garantirTrocaDePapel, garantirDesligamento };
