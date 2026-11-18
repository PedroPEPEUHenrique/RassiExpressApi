import { CasoDeUso } from '../../../compartilhado/aplicacao/CasoDeUso.js';
import { Conflito, NaoEncontrado } from '../../../compartilhado/dominio/erros.js';
import { avancarStatus, montarItens } from '../dominio/Pedido.js';

/** Carrega a rodada confirmando o restaurante. Ver a nota em casosComanda. */
async function rodadaDaEmpresa(repoRodada, idPedido, idEmpresa, ctx) {
    const rodada = await repoRodada.porId(idPedido, ctx);
    if (!rodada || rodada.id_empresa !== Number(idEmpresa)) {
        throw new NaoEncontrado('Pedido não encontrado');
    }
    return rodada;
}

async function comItens(repoRodada, rodada, ctx) {
    return { ...rodada, itens: await repoRodada.itensDaRodada(rodada.id_pedido, ctx) };
}

class VerRodada extends CasoDeUso {
    constructor({ repoRodada }) { super(); this.repoRodada = repoRodada; }
    async executar({ idPedido, idEmpresa }) {
        const rodada = await rodadaDaEmpresa(this.repoRodada, idPedido, idEmpresa);
        return await comItens(this.repoRodada, rodada);
    }
}

class VerFilaDaCozinha extends CasoDeUso {
    constructor({ repoRodada }) { super(); this.repoRodada = repoRodada; }
    async executar({ idEmpresa }) {
        const rodadas = await this.repoRodada.filaCozinha(idEmpresa);
        // A cozinha precisa ver os itens, não só a rodada. São poucas rodadas
        // abertas por vez, então uma consulta por rodada é aceitável aqui — e
        // manter o SQL simples importa mais nesta tela.
        return await Promise.all(rodadas.map((r) => comItens(this.repoRodada, r)));
    }
}

class LancarRodada extends CasoDeUso {
    constructor({ repoRodada, repoComanda, cardapioConsulta, baixaDeEstoque, unidadeDeTrabalho }) {
        super();
        this.repoRodada = repoRodada; this.repoComanda = repoComanda;
        this.cardapioConsulta = cardapioConsulta; this.baixaDeEstoque = baixaDeEstoque;
        this.unidadeDeTrabalho = unidadeDeTrabalho;
    }

    /**
     * Lança uma rodada numa comanda aberta e manda para a cozinha.
     *
     * Duas garantias moram aqui:
     *
     * 1. **Preço vem do cardápio**, nunca do corpo da requisição. O cálculo é
     *    do domínio (montarItens); este caso de uso só busca os dados.
     *
     * 2. **Idempotência por idLocal.** O aparelho gera um UUID por rodada. Se
     *    a rede cair depois do servidor gravar mas antes da resposta chegar, o
     *    garçom reenvia e recebe de volta a MESMA rodada, em vez de o prato
     *    ser feito duas vezes. Sem isso, a fila de reenvio offline do app
     *    seria pior do que não ter reenvio nenhum.
     */
    async executar({ idComanda, itens, idLocal, idEmpresa, idFuncionarioAutor }) {
        if (idLocal) {
            const existente = await this.repoRodada.porIdLocal(idLocal);
            if (existente) {
                if (existente.id_empresa !== Number(idEmpresa)) {
                    throw new Conflito('Identificador de rodada já utilizado');
                }
                return await comItens(this.repoRodada, existente);
            }
        }

        const comanda = await this.repoComanda.porId(idComanda);
        if (!comanda || comanda.id_empresa !== Number(idEmpresa)) {
            throw new NaoEncontrado('Comanda não encontrada');
        }
        if (comanda.status !== 'aberta') {
            throw new Conflito('Esta comanda está fechada. Abra a mesa novamente para lançar.');
        }

        const ids = [...new Set((itens ?? []).map((i) => Number(i.idProduto)))];
        const produtos = await this.cardapioConsulta.porIds(ids, idEmpresa);
        const cardapio = new Map(produtos.map((p) => [p.id_produto, p]));

        const { itens: itensCalculados, vlSubtotal } = montarItens(itens, cardapio);

        // Rodada, itens, total da comanda e baixa de estoque numa transação
        // só: uma rodada pela metade deixaria a conta da mesa errada.
        const idPedido = await this.unidadeDeTrabalho.executar(async (ctx) => {
            let novoId;
            try {
                novoId = await this.repoRodada.criar({
                    idEmpresa, idComanda, idFuncionario: idFuncionarioAutor, tipo: 'mesa', idLocal,
                    vlSubtotal, vlTotal: vlSubtotal,
                }, ctx);
            } catch (erro) {
                // Dois envios simultâneos da mesma rodada: o índice único de
                // idLocal barra o segundo. Não é erro — a rodada chegou.
                if (erro.duplicado) return null;
                throw erro;
            }

            for (const item of itensCalculados) {
                await this.repoRodada.criarItem({ ...item, idPedido: novoId }, ctx);
            }
            await this.repoComanda.recalcularTotal(idComanda, ctx);
            await this.baixaDeEstoque.baixarPorRodada(itensCalculados, novoId, idEmpresa, idFuncionarioAutor, ctx);
            return novoId;
        });

        if (idPedido === null) {
            const existente = await this.repoRodada.porIdLocal(idLocal);
            // Só se chega aqui com duplicidade, que nesta tabela só pode vir
            // do índice de idLocal — então a rodada existe. Se ainda assim não
            // vier, erro explícito é melhor do que estourar lendo undefined.
            if (!existente) {
                throw new Conflito('Não foi possível confirmar o envio desta rodada. Recarregue a comanda.');
            }
            return await comItens(this.repoRodada, existente);
        }

        const criada = await this.repoRodada.porId(idPedido);
        return await comItens(this.repoRodada, criada);
    }
}

class AvancarStatusDaRodada extends CasoDeUso {
    constructor({ repoRodada, repoComanda, unidadeDeTrabalho }) {
        super();
        this.repoRodada = repoRodada; this.repoComanda = repoComanda;
        this.unidadeDeTrabalho = unidadeDeTrabalho;
    }

    /**
     * Avança a rodada na cozinha.
     *
     * A regra antiga comparava o pedido com o id do usuário dono dele —
     * herança do delivery, onde o cliente acompanhava o próprio pedido. Aqui
     * quem move o status é a equipe, e o que importa é a rodada ser da empresa
     * do token e a transição existir no fluxo (validada pelo domínio).
     */
    async executar({ idPedido, status, idEmpresa }) {
        const rodada = await rodadaDaEmpresa(this.repoRodada, idPedido, idEmpresa);
        const novo = avancarStatus(rodada.status, status);

        return await this.unidadeDeTrabalho.executar(async (ctx) => {
            await this.repoRodada.atualizarStatus(idPedido, novo, ctx);
            // Cancelar tira o valor da conta, então o total da mesa é refeito.
            if (novo === 'cancelado' && rodada.id_comanda) {
                await this.repoComanda.recalcularTotal(rodada.id_comanda, ctx);
            }
            const atualizada = await this.repoRodada.porId(idPedido, ctx);
            return await comItens(this.repoRodada, atualizada, ctx);
        });
    }
}

export { VerRodada, VerFilaDaCozinha, LancarRodada, AvancarStatusDaRodada };
