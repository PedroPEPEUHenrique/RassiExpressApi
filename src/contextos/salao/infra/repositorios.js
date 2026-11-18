import { executar } from '../../../infra/persistencia/mysql.js';
import { RepositorioMesa, RepositorioComanda, RepositorioRodada } from '../aplicacao/portas.js';

/**
 * Implementações MySQL das portas do Salão.
 *
 * Todo o SQL do contexto está aqui e em nenhum outro lugar. As classes herdam
 * das portas para que um método esquecido estoure com nome, em vez de virar
 * `undefined is not a function` no meio de uma venda.
 */

class RepositorioMesaMySQL extends RepositorioMesa {
    /**
     * Mesas com o estado do salão derivado, não armazenado.
     *
     * A comanda aberta entra por LEFT JOIN em id_mesa_aberta — a coluna gerada
     * que só tem valor enquanto a comanda está aberta. Assim "livre" e
     * "ocupada" saem de um fato só.
     */
    async listarComEstado(idEmpresa, ctx) {
        return await executar(`
            SELECT m.id_mesa, m.numero, m.setor, m.capacidade,
                   c.id_comanda, c.dt_abertura, c.vl_total,
                   u.nome AS nome_garcom
            FROM MESA m
            LEFT JOIN COMANDA c     ON c.id_mesa_aberta = m.id_mesa
            LEFT JOIN FUNCIONARIO f ON f.id_funcionario = c.id_funcionario_abertura
            LEFT JOIN USUARIO u     ON u.id_usuario = f.id_usuario
            WHERE m.id_empresa = ? AND m.ativo = 1
            ORDER BY m.setor, LENGTH(m.numero), m.numero
        `, [idEmpresa], 'todos', ctx);
    }

    async porId(idMesa, ctx) {
        return await executar('SELECT * FROM MESA WHERE id_mesa = ?', [idMesa], 'um', ctx);
    }

    async criar(mesa, ctx) {
        const r = await executar(
            'INSERT INTO MESA (id_empresa, numero, setor, capacidade, ativo) VALUES (?, ?, ?, ?, 1)',
            [mesa.idEmpresa, mesa.numero, mesa.setor ?? null, mesa.capacidade ?? null], 'escrita', ctx
        );
        return r.id;
    }

    async atualizar(idMesa, mesa, ctx) {
        const r = await executar(
            'UPDATE MESA SET numero = ?, setor = ?, capacidade = ? WHERE id_mesa = ?',
            [mesa.numero, mesa.setor ?? null, mesa.capacidade ?? null, idMesa], 'escrita', ctx
        );
        return r.afetadas;
    }

    // Desativa em vez de apagar: a mesa aparece em comandas já fechadas, e o
    // DELETE cascatearia o histórico de faturamento junto.
    async desativar(idMesa, ctx) {
        const r = await executar('UPDATE MESA SET ativo = 0 WHERE id_mesa = ?', [idMesa], 'escrita', ctx);
        return r.afetadas;
    }
}

class RepositorioComandaMySQL extends RepositorioComanda {
    async listarAbertas(idEmpresa, ctx) {
        return await executar(`
            SELECT c.id_comanda, c.id_mesa, c.status, c.vl_total, c.dt_abertura,
                   m.numero AS numero_mesa, m.setor, u.nome AS nome_garcom
            FROM COMANDA c
            INNER JOIN MESA m       ON m.id_mesa = c.id_mesa
            LEFT JOIN FUNCIONARIO f ON f.id_funcionario = c.id_funcionario_abertura
            LEFT JOIN USUARIO u     ON u.id_usuario = f.id_usuario
            WHERE c.id_empresa = ? AND c.status = 'aberta'
            ORDER BY c.dt_abertura
        `, [idEmpresa], 'todos', ctx);
    }

    async porId(idComanda, ctx) {
        return await executar(`
            SELECT c.*, m.numero AS numero_mesa, m.setor, u.nome AS nome_garcom
            FROM COMANDA c
            INNER JOIN MESA m       ON m.id_mesa = c.id_mesa
            LEFT JOIN FUNCIONARIO f ON f.id_funcionario = c.id_funcionario_abertura
            LEFT JOIN USUARIO u     ON u.id_usuario = f.id_usuario
            WHERE c.id_comanda = ?
        `, [idComanda], 'um', ctx);
    }

    async abertaPorMesa(idMesa, ctx) {
        return await executar('SELECT * FROM COMANDA WHERE id_mesa_aberta = ?', [idMesa], 'um', ctx);
    }

    async criar(comanda, ctx) {
        const r = await executar(`
            INSERT INTO COMANDA (id_empresa, id_mesa, id_funcionario_abertura, status, vl_total, observacao, dt_abertura)
            VALUES (?, ?, ?, 'aberta', 0, ?, NOW())
        `, [comanda.idEmpresa, comanda.idMesa, comanda.idFuncionario, comanda.observacao ?? null], 'escrita', ctx);
        return r.id;
    }

    /**
     * Recalcula o total a partir das rodadas não canceladas.
     *
     * A soma acontece no banco, nunca em JavaScript sobre uma lista carregada:
     * é o número que o cliente vai pagar e o gestor vai conferir, e precisa
     * ser o mesmo independente do que a tela trouxe.
     */
    async recalcularTotal(idComanda, ctx) {
        const r = await executar(`
            UPDATE COMANDA c
            SET c.vl_total = (
                SELECT COALESCE(SUM(p.vl_total), 0) FROM PEDIDO p
                WHERE p.id_comanda = c.id_comanda AND p.status <> 'cancelado'
            )
            WHERE c.id_comanda = ?
        `, [idComanda], 'escrita', ctx);
        return r.afetadas;
    }

    async fechar(idComanda, idFuncionario, ctx) {
        const r = await executar(`
            UPDATE COMANDA
            SET status = 'fechada', id_funcionario_fechamento = ?, dt_fechamento = NOW()
            WHERE id_comanda = ? AND status = 'aberta'
        `, [idFuncionario, idComanda], 'escrita', ctx);
        return r.afetadas;
    }

    async contarAbertas(idEmpresa, ctx) {
        const linha = await executar(
            "SELECT COUNT(*) AS total FROM COMANDA WHERE id_empresa = ? AND status = 'aberta'",
            [idEmpresa], 'um', ctx
        );
        return Number(linha?.total ?? 0);
    }
}

class RepositorioRodadaMySQL extends RepositorioRodada {
    async porComanda(idComanda, ctx) {
        return await executar(`
            SELECT p.*, u.nome AS nome_garcom
            FROM PEDIDO p
            LEFT JOIN FUNCIONARIO f ON f.id_funcionario = p.id_funcionario
            LEFT JOIN USUARIO u     ON u.id_usuario = f.id_usuario
            WHERE p.id_comanda = ?
            ORDER BY p.dt_pedido
        `, [idComanda], 'todos', ctx);
    }

    async porId(idPedido, ctx) {
        return await executar(`
            SELECT p.*, c.id_mesa, m.numero AS numero_mesa, u.nome AS nome_garcom
            FROM PEDIDO p
            LEFT JOIN COMANDA c     ON c.id_comanda = p.id_comanda
            LEFT JOIN MESA m        ON m.id_mesa = c.id_mesa
            LEFT JOIN FUNCIONARIO f ON f.id_funcionario = p.id_funcionario
            LEFT JOIN USUARIO u     ON u.id_usuario = f.id_usuario
            WHERE p.id_pedido = ?
        `, [idPedido], 'um', ctx);
    }

    async porIdLocal(idLocal, ctx) {
        return await executar('SELECT * FROM PEDIDO WHERE id_local = ?', [idLocal], 'um', ctx);
    }

    /** Fila da cozinha: o que entrou primeiro sai primeiro. */
    async filaCozinha(idEmpresa, ctx) {
        return await executar(`
            SELECT p.id_pedido, p.status, p.dt_pedido, p.tipo, p.id_comanda,
                   m.numero AS numero_mesa, u.nome AS nome_garcom
            FROM PEDIDO p
            LEFT JOIN COMANDA c     ON c.id_comanda = p.id_comanda
            LEFT JOIN MESA m        ON m.id_mesa = c.id_mesa
            LEFT JOIN FUNCIONARIO f ON f.id_funcionario = p.id_funcionario
            LEFT JOIN USUARIO u     ON u.id_usuario = f.id_usuario
            WHERE p.id_empresa = ? AND p.status IN ('enviado', 'em_preparo', 'pronto')
            ORDER BY p.dt_pedido
        `, [idEmpresa], 'todos', ctx);
    }

    async criar(rodada, ctx) {
        const r = await executar(`
            INSERT INTO PEDIDO (id_empresa, id_comanda, id_funcionario, tipo, id_local,
                                vl_subtotal, vl_taxa_entrega, vl_total, dt_pedido, status)
            VALUES (?, ?, ?, ?, ?, ?, 0, ?, NOW(), 'enviado')
        `, [
            rodada.idEmpresa, rodada.idComanda, rodada.idFuncionario,
            rodada.tipo ?? 'mesa', rodada.idLocal ?? null, rodada.vlSubtotal, rodada.vlTotal,
        ], 'escrita', ctx);
        return r.id;
    }

    async atualizarStatus(idPedido, status, ctx) {
        const r = await executar('UPDATE PEDIDO SET status = ? WHERE id_pedido = ?', [status, idPedido], 'escrita', ctx);
        return r.afetadas;
    }

    async criarItem(item, ctx) {
        const r = await executar(`
            INSERT INTO ITENS_PEDIDO (id_pedido, id_produto, nome_produto, observacao, quantidade, vl_unitario, vl_total)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
            item.idPedido, item.idProduto, item.nomeProduto ?? null, item.observacao ?? null,
            item.quantidade, item.vlUnitario, item.vlTotal,
        ], 'escrita', ctx);
        return r.id;
    }

    async itensDaRodada(idPedido, ctx) {
        return await executar(`
            SELECT ip.*, p.icone FROM ITENS_PEDIDO ip
            LEFT JOIN PRODUTO p ON p.id_produto = ip.id_produto
            WHERE ip.id_pedido = ? ORDER BY ip.id_itens_pedido
        `, [idPedido], 'todos', ctx);
    }

    // Itens de várias rodadas de uma vez, para montar a comanda sem uma
    // consulta por rodada.
    async itensDaComanda(idComanda, ctx) {
        return await executar(`
            SELECT ip.*, p.icone FROM ITENS_PEDIDO ip
            INNER JOIN PEDIDO pe ON pe.id_pedido = ip.id_pedido
            LEFT JOIN PRODUTO p  ON p.id_produto = ip.id_produto
            WHERE pe.id_comanda = ? ORDER BY ip.id_itens_pedido
        `, [idComanda], 'todos', ctx);
    }
}

export { RepositorioMesaMySQL, RepositorioComandaMySQL, RepositorioRodadaMySQL };
