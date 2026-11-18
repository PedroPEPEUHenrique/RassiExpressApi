import { Conflito, NaoAutenticado, Proibido } from '../../../compartilhado/dominio/erros.js';

/**
 * Regra de qual vínculo vira sessão.
 *
 * Senha correta não basta: sem vínculo ativo não há token a emitir, porque
 * toda rota depende de saber em qual restaurante a pessoa está operando e com
 * qual permissão.
 */
function escolherVinculo(vinculos, idEmpresaEscolhida) {
    if (!vinculos.length) {
        throw new Proibido('Usuário sem vínculo ativo com um restaurante');
    }

    if (idEmpresaEscolhida !== undefined && idEmpresaEscolhida !== null) {
        const escolhido = vinculos.find((v) => v.id_empresa === Number(idEmpresaEscolhida));
        if (!escolhido) throw new Proibido('Usuário sem vínculo ativo com o restaurante informado');
        return escolhido;
    }

    if (vinculos.length === 1) return vinculos[0];

    // Trabalha em mais de um restaurante: o app precisa perguntar onde entrar
    // e repetir o login com o idEmpresa escolhido.
    throw new Conflito('Informe em qual restaurante deseja entrar', {
        empresas: vinculos.map((v) => ({ idEmpresa: v.id_empresa, nome: v.nome_empresa, papel: v.papel })),
    });
}

/** Mensagem única para e-mail inexistente e senha errada. */
function credencialInvalida() {
    return new NaoAutenticado('E-mail ou senha inválidos');
}

export { escolherVinculo, credencialInvalida };
