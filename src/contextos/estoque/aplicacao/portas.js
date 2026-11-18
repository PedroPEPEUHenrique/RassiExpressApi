/** Portas do contexto Estoque. */

function naoImplementado(n) { throw new Error(`${n} não implementado`); }

class RepositorioInsumo {
  async porEmpresa(_idEmpresa, _ctx) { naoImplementado('RepositorioInsumo.porEmpresa'); }
  async porId(_idInsumo, _ctx) { naoImplementado('RepositorioInsumo.porId'); }
  async criar(_insumo, _ctx) { naoImplementado('RepositorioInsumo.criar'); }
  async atualizar(_id, _insumo, _ctx) { naoImplementado('RepositorioInsumo.atualizar'); }
  async desativar(_id, _ctx) { naoImplementado('RepositorioInsumo.desativar'); }
  /** Soma a variação no SQL — ver a nota na implementação. */
  async ajustarSaldo(_id, _variacao, _ctx) { naoImplementado('RepositorioInsumo.ajustarSaldo'); }
  async atualizarCustoMedio(_id, _qtdEntrada, _vlUnitario, _ctx) { naoImplementado('RepositorioInsumo.atualizarCustoMedio'); }
  async criarMovimento(_mov, _ctx) { naoImplementado('RepositorioInsumo.criarMovimento'); }
  async movimentos(_idInsumo, _limite, _ctx) { naoImplementado('RepositorioInsumo.movimentos'); }
}

class RepositorioFicha {
  async porProduto(_idProduto, _ctx) { naoImplementado('RepositorioFicha.porProduto'); }
  async deProdutos(_idsProduto, _ctx) { naoImplementado('RepositorioFicha.deProdutos'); }
  async salvarItem(_item, _ctx) { naoImplementado('RepositorioFicha.salvarItem'); }
  async removerItem(_idProduto, _idInsumo, _ctx) { naoImplementado('RepositorioFicha.removerItem'); }
}

export { RepositorioInsumo, RepositorioFicha };
