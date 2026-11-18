/**
 * Porta: Unidade de Trabalho (transação).
 *
 * O caso de uso precisa dizer "isto tudo acontece junto ou nada acontece",
 * sem saber que a implementação é uma transação do MySQL. Antes, os services
 * importavam `withTransaction` direto do módulo de banco — dependência da
 * regra para a infraestrutura, exatamente o que a regra de dependência proíbe.
 *
 * Como JavaScript não tem interface, a porta é uma classe abstrata que estoura
 * se alguém esquecer de implementar. A verificação vem em tempo de execução,
 * mas vem no primeiro teste em vez de virar um `undefined is not a function`
 * no meio de uma venda.
 */
class UnidadeDeTrabalho {
    /**
     * Executa `fn` dentro de uma transação.
     * @param {(ctx: unknown) => Promise<T>} fn recebe o contexto transacional,
     *        que os repositórios repassam adiante sem interpretar
     * @returns {Promise<T>}
     * @template T
     */
    async executar(fn) {
        throw new Error('UnidadeDeTrabalho.executar não implementada');
    }
}

export { UnidadeDeTrabalho };
