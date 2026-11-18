import { CasoDeUso } from '../../../compartilhado/aplicacao/CasoDeUso.js';
import { NaoEncontrado } from '../../../compartilhado/dominio/erros.js';
import {
  validarDadosDoProduto, garantirPodeAlternarDisponibilidade,
  garantirCategoriaVazia, agruparEmSecoes,
} from '../dominio/Produto.js';

/**
 * "Não encontrado" quando é de outro restaurante, nunca "proibido": id de
 * produto é sequencial e adivinhável, e um 403 confirmaria a existência do
 * item do concorrente.
 */
async function produtoDaEmpresa(repoProduto, idProduto, idEmpresa) {
  const p = await repoProduto.porId(idProduto);
  if (!p || p.id_empresa !== Number(idEmpresa)) throw new NaoEncontrado('Produto não encontrado');
  return p;
}

async function categoriaDaEmpresa(repoCategoria, idCategoria, idEmpresa) {
  const c = await repoCategoria.porId(idCategoria);
  if (!c || c.id_empresa !== Number(idEmpresa)) throw new NaoEncontrado('Categoria de produto não encontrada');
  return c;
}

/** Cardápio completo do gestor, agrupado, numa requisição só. */
class VerCardapio extends CasoDeUso {
  constructor({ repoProduto, repoCategoria }) { super(); this.repoProduto = repoProduto; this.repoCategoria = repoCategoria; }
  async executar({ idEmpresa }) {
    const [categorias, produtos] = await Promise.all([
      this.repoCategoria.porEmpresa(idEmpresa),
      this.repoProduto.todosPorEmpresa(idEmpresa),
    ]);
    return agruparEmSecoes(categorias, produtos);
  }
}

/** Lista do garçom: a API filtra pelos dois estados, não a tela. */
class ListarProdutosDisponiveis extends CasoDeUso {
  constructor({ repoProduto }) { super(); this.repoProduto = repoProduto; }
  async executar({ idEmpresa }) { return await this.repoProduto.disponiveisPorEmpresa(idEmpresa); }
}

class ListarProdutosDaCategoria extends CasoDeUso {
  constructor({ repoProduto, repoCategoria }) { super(); this.repoProduto = repoProduto; this.repoCategoria = repoCategoria; }
  async executar({ idCategoria, idEmpresa }) {
    await categoriaDaEmpresa(this.repoCategoria, idCategoria, idEmpresa);
    return await this.repoProduto.disponiveisPorCategoria(idCategoria);
  }
}

class VerProduto extends CasoDeUso {
  constructor({ repoProduto }) { super(); this.repoProduto = repoProduto; }
  async executar({ idProduto, idEmpresa }) { return await produtoDaEmpresa(this.repoProduto, idProduto, idEmpresa); }
}

class CriarProduto extends CasoDeUso {
  constructor({ repoProduto, repoCategoria }) { super(); this.repoProduto = repoProduto; this.repoCategoria = repoCategoria; }
  async executar({ idEmpresa, ...dados }) {
    validarDadosDoProduto(dados);
    await categoriaDaEmpresa(this.repoCategoria, dados.idProdutoCategoria, idEmpresa);
    // idEmpresa vem do token: era por aqui que um gestor podia cadastrar
    // produto no cardápio de outro restaurante.
    const idProduto = await this.repoProduto.criar({ ...dados, idEmpresa });
    return { idProduto, ...dados, idEmpresa };
  }
}

class AtualizarProduto extends CasoDeUso {
  constructor({ repoProduto, repoCategoria }) { super(); this.repoProduto = repoProduto; this.repoCategoria = repoCategoria; }
  async executar({ idProduto, idEmpresa, ...dados }) {
    const atual = await produtoDaEmpresa(this.repoProduto, idProduto, idEmpresa);
    if (dados.idProdutoCategoria) {
      await categoriaDaEmpresa(this.repoCategoria, dados.idProdutoCategoria, idEmpresa);
    }
    // Campo ausente mantém o valor atual: o UPDATE reescreve a linha inteira.
    const atualizado = {
      idProdutoCategoria: dados.idProdutoCategoria ?? atual.id_produto_categoria,
      nome: dados.nome ?? atual.nome,
      descricao: dados.descricao ?? atual.descricao,
      icone: dados.icone ?? atual.icone,
      valor: dados.valor ?? atual.valor,
      ativo: dados.ativo ?? atual.ativo,
      disponivel: dados.disponivel ?? atual.disponivel,
    };
    const mudou = await this.repoProduto.atualizar(idProduto, atualizado);
    if (!mudou) throw new NaoEncontrado('Produto não encontrado');
    return { idProduto: Number(idProduto), ...atualizado };
  }
}

/**
 * Marca o produto como em falta ou de volta. Recebe só o booleano: é o gesto
 * mais frequente do dia e não deve arrastar nome, preço e categoria junto —
 * enviar o produto inteiro abriria espaço para sobrescrever preço por engano.
 */
class AlternarDisponibilidade extends CasoDeUso {
  constructor({ repoProduto }) { super(); this.repoProduto = repoProduto; }
  async executar({ idProduto, disponivel, idEmpresa }) {
    const produto = await produtoDaEmpresa(this.repoProduto, idProduto, idEmpresa);
    garantirPodeAlternarDisponibilidade(produto);

    const mudou = await this.repoProduto.atualizarDisponibilidade(idProduto, disponivel);
    if (!mudou) throw new NaoEncontrado('Produto não encontrado');
    return { idProduto: Number(idProduto), disponivel: !!disponivel };
  }
}

class RemoverProduto extends CasoDeUso {
  constructor({ repoProduto }) { super(); this.repoProduto = repoProduto; }
  async executar({ idProduto, idEmpresa }) {
    await produtoDaEmpresa(this.repoProduto, idProduto, idEmpresa);
    const mudou = await this.repoProduto.desativar(idProduto);
    if (!mudou) throw new NaoEncontrado('Produto não encontrado');
  }
}

class ListarCategorias extends CasoDeUso {
  constructor({ repoCategoria }) { super(); this.repoCategoria = repoCategoria; }
  async executar({ idEmpresa }) { return await this.repoCategoria.porEmpresa(idEmpresa); }
}

class CriarCategoria extends CasoDeUso {
  constructor({ repoCategoria }) { super(); this.repoCategoria = repoCategoria; }
  async executar({ categoria, ordem, idEmpresa }) {
    const id = await this.repoCategoria.criar({ categoria, ordem, idEmpresa });
    return { idProdutoCategoria: id, categoria, ordem, idEmpresa };
  }
}

class AtualizarCategoria extends CasoDeUso {
  constructor({ repoCategoria }) { super(); this.repoCategoria = repoCategoria; }
  async executar({ idCategoria, categoria, ordem, idEmpresa }) {
    const atual = await categoriaDaEmpresa(this.repoCategoria, idCategoria, idEmpresa);
    const atualizado = { categoria: categoria ?? atual.categoria, ordem: ordem ?? atual.ordem };
    const mudou = await this.repoCategoria.atualizar(idCategoria, atualizado);
    if (!mudou) throw new NaoEncontrado('Categoria de produto não encontrada');
    return { idProdutoCategoria: Number(idCategoria), ...atualizado };
  }
}

class RemoverCategoria extends CasoDeUso {
  constructor({ repoCategoria }) { super(); this.repoCategoria = repoCategoria; }
  async executar({ idCategoria, idEmpresa }) {
    const categoria = await categoriaDaEmpresa(this.repoCategoria, idCategoria, idEmpresa);
    const produtos = await this.repoCategoria.contarProdutos(idCategoria);
    garantirCategoriaVazia(categoria, produtos);

    const removeu = await this.repoCategoria.remover(idCategoria);
    if (!removeu) throw new NaoEncontrado('Categoria de produto não encontrada');
  }
}

/**
 * Consulta que o Salão usa para precificar a rodada.
 *
 * Exposta como caso de uso próprio em vez de o Salão alcançar o repositório
 * de Cardápio: a dependência entre contextos passa por um contrato explícito.
 */
class ConsultarPrecos extends CasoDeUso {
  constructor({ repoProduto }) { super(); this.repoProduto = repoProduto; }
  async porIds(ids, idEmpresa) { return await this.repoProduto.porIds(ids, idEmpresa); }
  async executar({ ids, idEmpresa }) { return await this.porIds(ids, idEmpresa); }
}

export {
  VerCardapio, ListarProdutosDisponiveis, ListarProdutosDaCategoria, VerProduto,
  CriarProduto, AtualizarProduto, AlternarDisponibilidade, RemoverProduto,
  ListarCategorias, CriarCategoria, AtualizarCategoria, RemoverCategoria, ConsultarPrecos,
};
