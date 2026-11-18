/** Portas do contexto Cardápio. */

function naoImplementado(n) { throw new Error(`${n} não implementado`); }

class RepositorioProduto {
  /** Lista do garçom: só o que está no cardápio E tem hoje. */
  async disponiveisPorEmpresa(_idEmpresa, _ctx) { naoImplementado('RepositorioProduto.disponiveisPorEmpresa'); }
  /** Lista do gestor: tudo, inclusive em falta e fora do cardápio. */
  async todosPorEmpresa(_idEmpresa, _ctx) { naoImplementado('RepositorioProduto.todosPorEmpresa'); }
  async disponiveisPorCategoria(_idCategoria, _ctx) { naoImplementado('RepositorioProduto.disponiveisPorCategoria'); }
  async porId(_idProduto, _ctx) { naoImplementado('RepositorioProduto.porId'); }
  async porIds(_ids, _idEmpresa, _ctx) { naoImplementado('RepositorioProduto.porIds'); }
  async criar(_produto, _ctx) { naoImplementado('RepositorioProduto.criar'); }
  async atualizar(_id, _produto, _ctx) { naoImplementado('RepositorioProduto.atualizar'); }
  async atualizarDisponibilidade(_id, _disponivel, _ctx) { naoImplementado('RepositorioProduto.atualizarDisponibilidade'); }
  async desativar(_id, _ctx) { naoImplementado('RepositorioProduto.desativar'); }
}

class RepositorioCategoria {
  async porEmpresa(_idEmpresa, _ctx) { naoImplementado('RepositorioCategoria.porEmpresa'); }
  async porId(_id, _ctx) { naoImplementado('RepositorioCategoria.porId'); }
  async contarProdutos(_id, _ctx) { naoImplementado('RepositorioCategoria.contarProdutos'); }
  async criar(_categoria, _ctx) { naoImplementado('RepositorioCategoria.criar'); }
  async atualizar(_id, _categoria, _ctx) { naoImplementado('RepositorioCategoria.atualizar'); }
  async remover(_id, _ctx) { naoImplementado('RepositorioCategoria.remover'); }
}

export { RepositorioProduto, RepositorioCategoria };
