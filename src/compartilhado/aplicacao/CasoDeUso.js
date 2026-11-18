/**
 * Porta: caso de uso.
 *
 * Todo caso de uso expõe `executar(entrada)` e nada mais. A forma única é o
 * que permite ao adaptador HTTP tratar qualquer um deles igual, e ao teste
 * exercitá-los sem Express e sem banco — basta passar repositórios falsos no
 * construtor.
 */
class CasoDeUso {
    async executar(_entrada) {
        throw new Error('CasoDeUso.executar não implementado');
    }
}

export { CasoDeUso };
