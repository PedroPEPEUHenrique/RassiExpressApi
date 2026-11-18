import { CasoDeUso } from '../../../compartilhado/aplicacao/CasoDeUso.js';
import { Conflito, NaoEncontrado } from '../../../compartilhado/dominio/erros.js';
import { garantirAberta, planejarFechamento } from '../dominio/Comanda.js';

/**
 * Casos de uso da comanda.
 *
 * Cada um recebe suas dependências no construtor e expõe `executar(entrada)`.
 * Nenhum importa banco, Express ou mysql2 — por isso o teste é instanciar com
 * repositórios falsos e chamar `executar`.
 *
 * `entrada` sempre carrega o contexto de quem age (idEmpresa, idFuncionario),
 * extraído do token pelo adaptador HTTP. O caso de uso nunca o lê de um corpo
 * de requisição: foi assim que o sistema deixou de aceitar que o cliente
 * escolhesse em qual restaurante estava operando.
 */

/**
 * Carrega a comanda confirmando que é do restaurante de quem pergunta.
 *
 * "Não encontrado" em vez de "proibido" quando é de outro restaurante: id de
 * comanda é sequencial, e um 403 confirmaria que aquela comanda existe.
 */
async function daEmpresa(repoComanda, idComanda, idEmpresa, ctx) {
    const comanda = await repoComanda.porId(idComanda, ctx);
    if (!comanda || comanda.id_empresa !== Number(idEmpresa)) {
        throw new NaoEncontrado('Comanda não encontrada');
    }
    return comanda;
}

class ListarComandasAbertas extends CasoDeUso {
    constructor({ repoComanda }) { super(); this.repoComanda = repoComanda; }
    async executar({ idEmpresa }) {
        return await this.repoComanda.listarAbertas(idEmpresa);
    }
}

class VerComanda extends CasoDeUso {
    constructor({ repoComanda, repoRodada }) { super(); this.repoComanda = repoComanda; this.repoRodada = repoRodada; }

    /**
     * A comanda com suas rodadas e itens.
     *
     * Os itens de todas as rodadas vêm numa consulta só e são agrupados aqui,
     * em vez de uma consulta por rodada.
     */
    async executar({ idComanda, idEmpresa }) {
        const comanda = await daEmpresa(this.repoComanda, idComanda, idEmpresa);
        const [rodadas, itens] = await Promise.all([
            this.repoRodada.porComanda(idComanda),
            this.repoRodada.itensDaComanda(idComanda),
        ]);

        const porRodada = new Map();
        for (const item of itens) {
            if (!porRodada.has(item.id_pedido)) porRodada.set(item.id_pedido, []);
            porRodada.get(item.id_pedido).push(item);
        }

        return { ...comanda, rodadas: rodadas.map((r) => ({ ...r, itens: porRodada.get(r.id_pedido) ?? [] })) };
    }
}

class AbrirComanda extends CasoDeUso {
    constructor({ repoComanda, repoMesa, verComanda }) {
        super();
        this.repoComanda = repoComanda; this.repoMesa = repoMesa; this.verComanda = verComanda;
    }

    /**
     * Abre a conta de uma mesa.
     *
     * A unicidade é garantida pelo índice do banco; esta verificação existe só
     * para dar mensagem útil no caso comum. A corrida entre dois garçons
     * tocando a mesma mesa é barrada pelo índice, e o erro de duplicidade é
     * traduzido abaixo.
     */
    async executar({ idMesa, observacao, idEmpresa, idFuncionarioAutor }) {
        const mesa = await this.repoMesa.porId(idMesa);
        if (!mesa || mesa.id_empresa !== Number(idEmpresa) || !mesa.ativo) {
            throw new NaoEncontrado('Mesa não encontrada');
        }

        const aberta = await this.repoComanda.abertaPorMesa(idMesa);
        if (aberta) {
            throw new Conflito(`A mesa ${mesa.numero} já tem uma comanda aberta`, { idComanda: aberta.id_comanda });
        }

        let idComanda;
        try {
            idComanda = await this.repoComanda.criar({ idEmpresa, idMesa, idFuncionario: idFuncionarioAutor, observacao });
        } catch (erro) {
            if (erro.duplicado) throw new Conflito(`A mesa ${mesa.numero} já tem uma comanda aberta`);
            throw erro;
        }

        return await this.verComanda.executar({ idComanda, idEmpresa });
    }
}

class FecharComanda extends CasoDeUso {
    constructor({ repoComanda, repoRodada, registroNoCaixa, unidadeDeTrabalho }) {
        super();
        this.repoComanda = repoComanda; this.repoRodada = repoRodada;
        this.registroNoCaixa = registroNoCaixa; this.unidadeDeTrabalho = unidadeDeTrabalho;
    }

    /**
     * Fecha a conta e libera a mesa.
     *
     * O app não processa pagamento — só apresenta o valor —, então fechar é
     * marcar a comanda como fechada. A mesa volta a aparecer livre sozinha,
     * porque a coluna gerada que a prende passa a ser nula.
     */
    async executar({ idComanda, forcar = false, idEmpresa, idFuncionarioAutor }) {
        const comanda = await daEmpresa(this.repoComanda, idComanda, idEmpresa);
        const rodadas = await this.repoRodada.porComanda(idComanda);
        const { aCancelar } = planejarFechamento(comanda, rodadas, { forcar });

        return await this.unidadeDeTrabalho.executar(async (ctx) => {
            for (const rodada of aCancelar) {
                await this.repoRodada.atualizarStatus(rodada.id_pedido, 'cancelado', ctx);
            }
            // Recalcula depois de cancelar, para o total não cobrar o que não saiu.
            await this.repoComanda.recalcularTotal(idComanda, ctx);

            const fechou = await this.repoComanda.fechar(idComanda, idFuncionarioAutor, ctx);
            if (!fechou) throw new Conflito('Esta comanda já foi fechada');

            const fechada = await this.repoComanda.porId(idComanda, ctx);

            // A venda entra no caixa do turno na MESMA transação: o total da
            // mesa já é o valor da venda, e pedir que o gestor relance à mão
            // seria digitar o mesmo número duas vezes e divergir na primeira
            // distração.
            await this.registroNoCaixa.registrarVendaDaComanda(fechada, idFuncionarioAutor, ctx);
            return fechada;
        });
    }
}

export { ListarComandasAbertas, VerComanda, AbrirComanda, FecharComanda, daEmpresa };
