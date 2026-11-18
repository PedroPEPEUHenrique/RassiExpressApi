/** Portas do contexto Acesso: identidade, vínculo e restaurante. */

function naoImplementado(n) { throw new Error(`${n} não implementado`); }

class RepositorioUsuario {
    async porEmail(_email, _ctx) { naoImplementado('RepositorioUsuario.porEmail'); }
    async porId(_idUsuario, _ctx) { naoImplementado('RepositorioUsuario.porId'); }
    async comSenhaPorId(_idUsuario, _ctx) { naoImplementado('RepositorioUsuario.comSenhaPorId'); }
    async criar(_usuario, _ctx) { naoImplementado('RepositorioUsuario.criar'); }
    async atualizar(_idUsuario, _usuario, _ctx) { naoImplementado('RepositorioUsuario.atualizar'); }
    async atualizarSenha(_idUsuario, _hash, _ctx) { naoImplementado('RepositorioUsuario.atualizarSenha'); }
}

class RepositorioFuncionario {
    async vinculosAtivos(_idUsuario, _ctx) { naoImplementado('RepositorioFuncionario.vinculosAtivos'); }
    async porEmpresa(_idEmpresa, _ctx) { naoImplementado('RepositorioFuncionario.porEmpresa'); }
    async porId(_idFuncionario, _ctx) { naoImplementado('RepositorioFuncionario.porId'); }
    async criar(_funcionario, _ctx) { naoImplementado('RepositorioFuncionario.criar'); }
    async atualizarPapel(_id, _papel, _ctx) { naoImplementado('RepositorioFuncionario.atualizarPapel'); }
    async atualizarAtivo(_id, _ativo, _ctx) { naoImplementado('RepositorioFuncionario.atualizarAtivo'); }
    async contarGestoresAtivos(_idEmpresa, _ctx) { naoImplementado('RepositorioFuncionario.contarGestoresAtivos'); }
    async desempenho(_idEmpresa, _de, _ate, _ctx) { naoImplementado('RepositorioFuncionario.desempenho'); }
}

class RepositorioEmpresa {
    async porId(_idEmpresa, _ctx) { naoImplementado('RepositorioEmpresa.porId'); }
    async atualizar(_idEmpresa, _empresa, _ctx) { naoImplementado('RepositorioEmpresa.atualizar'); }
}

/** Porta de criptografia de senha — o caso de uso não conhece bcrypt. */
class Hasher {
    async gerar(_senha) { naoImplementado('Hasher.gerar'); }
    async conferir(_senha, _hash) { naoImplementado('Hasher.conferir'); }
}

/** Porta de emissão de token — o caso de uso não conhece JWT. */
class EmissorDeToken {
    emitir(_conteudo) { naoImplementado('EmissorDeToken.emitir'); }
    ler(_token) { naoImplementado('EmissorDeToken.ler'); }
}

export { RepositorioUsuario, RepositorioFuncionario, RepositorioEmpresa, Hasher, EmissorDeToken };
