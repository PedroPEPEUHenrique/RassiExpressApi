/**
 * Portas do contexto Salão.
 *
 * O caso de uso depende DESTAS assinaturas, não do mysql2. Trocar o banco, ou
 * passar um dublê em memória no teste, não toca em nenhuma regra — é o ponto
 * inteiro da inversão de dependência.
 *
 * Os métodos recebem `ctx` opcional: o contexto transacional que a Unidade de
 * Trabalho entrega. O repositório o repassa ao driver sem interpretar, e o
 * caso de uso só precisa saber que, passando o mesmo ctx, tudo cai na mesma
 * transação.
 */

class RepositorioMesa {
    /** @returns {Promise<Array>} mesas com a comanda aberta embutida, se houver */
    async listarComEstado(_idEmpresa, _ctx) { naoImplementado('RepositorioMesa.listarComEstado'); }
    async porId(_idMesa, _ctx) { naoImplementado('RepositorioMesa.porId'); }
    async criar(_mesa, _ctx) { naoImplementado('RepositorioMesa.criar'); }
    async atualizar(_idMesa, _mesa, _ctx) { naoImplementado('RepositorioMesa.atualizar'); }
    async desativar(_idMesa, _ctx) { naoImplementado('RepositorioMesa.desativar'); }
}

class RepositorioComanda {
    async listarAbertas(_idEmpresa, _ctx) { naoImplementado('RepositorioComanda.listarAbertas'); }
    async porId(_idComanda, _ctx) { naoImplementado('RepositorioComanda.porId'); }
    async abertaPorMesa(_idMesa, _ctx) { naoImplementado('RepositorioComanda.abertaPorMesa'); }
    async criar(_comanda, _ctx) { naoImplementado('RepositorioComanda.criar'); }
    /** Recalcula o total somando as rodadas não canceladas, no banco. */
    async recalcularTotal(_idComanda, _ctx) { naoImplementado('RepositorioComanda.recalcularTotal'); }
    async fechar(_idComanda, _idFuncionario, _ctx) { naoImplementado('RepositorioComanda.fechar'); }
    async contarAbertas(_idEmpresa, _ctx) { naoImplementado('RepositorioComanda.contarAbertas'); }
}

class RepositorioRodada {
    async porComanda(_idComanda, _ctx) { naoImplementado('RepositorioRodada.porComanda'); }
    async porId(_idPedido, _ctx) { naoImplementado('RepositorioRodada.porId'); }
    async porIdLocal(_idLocal, _ctx) { naoImplementado('RepositorioRodada.porIdLocal'); }
    async filaCozinha(_idEmpresa, _ctx) { naoImplementado('RepositorioRodada.filaCozinha'); }
    async criar(_rodada, _ctx) { naoImplementado('RepositorioRodada.criar'); }
    async atualizarStatus(_idPedido, _status, _ctx) { naoImplementado('RepositorioRodada.atualizarStatus'); }
    async criarItem(_item, _ctx) { naoImplementado('RepositorioRodada.criarItem'); }
    async itensDaRodada(_idPedido, _ctx) { naoImplementado('RepositorioRodada.itensDaRodada'); }
    async itensDaComanda(_idComanda, _ctx) { naoImplementado('RepositorioRodada.itensDaComanda'); }
}

/**
 * Serviços de outros contextos que o Salão consome.
 *
 * Declarados como porta em vez de importar o caso de uso do outro contexto
 * direto: lançar uma rodada precisa dar baixa no estoque e fechar a conta
 * precisa lançar no caixa, mas o Salão não deve depender da implementação de
 * Estoque nem de Financeiro — só do contrato. É o que mantém os contextos
 * desacoplados e deixa o Salão testável sem nenhum dos dois.
 */
class BaixaDeEstoque {
    /** Produto sem ficha técnica não movimenta nada; ver o contexto Estoque. */
    async baixarPorRodada(_itens, _idPedido, _idEmpresa, _idFuncionario, _ctx) {
        naoImplementado('BaixaDeEstoque.baixarPorRodada');
    }
}

class RegistroNoCaixa {
    /** Sem caixa aberto não falha: a venda segue na comanda e nos relatórios. */
    async registrarVendaDaComanda(_comanda, _idFuncionario, _ctx) {
        naoImplementado('RegistroNoCaixa.registrarVendaDaComanda');
    }
}

function naoImplementado(nome) {
    throw new Error(`${nome} não implementado`);
}

export { RepositorioMesa, RepositorioComanda, RepositorioRodada, BaixaDeEstoque, RegistroNoCaixa };
