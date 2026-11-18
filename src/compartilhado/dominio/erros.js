/**
 * Erros de domínio.
 *
 * O código antigo lançava `{ status: 409, mensagem }` de dentro das regras de
 * negócio — ou seja, a regra conhecia código HTTP. Isso quebra a regra de
 * dependência: o domínio não deve saber que existe um protocolo web do lado
 * de fora, nem que 409 significa conflito.
 *
 * Aqui o domínio fala a própria língua (NaoEncontrado, Conflito, Proibido) e
 * a tradução para HTTP acontece uma única vez, no adaptador — em
 * infra/http/mapearErro.js. Trocar Express por gRPC ou por uma fila não
 * tocaria em nenhuma linha de regra.
 */

class ErroDominio extends Error {
    /**
     * @param {string} mensagem  texto que o operador vai ler
     * @param {object} [dados]   contexto estruturado para o cliente agir
     *                           (lista de restaurantes no login múltiplo,
     *                           rodadas pendentes no fechamento da comanda)
     */
    constructor(mensagem, dados) {
        super(mensagem);
        this.name = new.target.name;
        this.mensagem = mensagem;
        if (dados !== undefined) this.dados = dados;
    }
}

/** O recurso não existe — ou não é visível para quem perguntou. */
class NaoEncontrado extends ErroDominio {}

/** A entrada é inválida por si só: quantidade zero, papel inexistente. */
class EntradaInvalida extends ErroDominio {}

/** O estado atual impede a operação: comanda fechada, produto em falta. */
class Conflito extends ErroDominio {}

/** Identidade não comprovada. */
class NaoAutenticado extends ErroDominio {}

/** Identidade comprovada, mas sem permissão para isto. */
class Proibido extends ErroDominio {}

export { ErroDominio, NaoEncontrado, EntradaInvalida, Conflito, NaoAutenticado, Proibido };
