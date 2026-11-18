import { CasoDeUso } from '../../../compartilhado/aplicacao/CasoDeUso.js';
import { Conflito, EntradaInvalida, NaoEncontrado } from '../../../compartilhado/dominio/erros.js';
import { emMilesimos } from '../../../compartilhado/dominio/dinheiro.js';
import { validarUnidade, planejarMovimento, calcularConsumo, calcularMargem } from '../dominio/Estoque.js';

const LIMITE_MOVIMENTOS = 50;

async function insumoDaEmpresa(repo, idInsumo, idEmpresa, ctx) {
  const i = await repo.porId(idInsumo, ctx);
  if (!i || i.id_empresa !== Number(idEmpresa)) throw new NaoEncontrado('Insumo não encontrado');
  return i;
}

class ListarInsumos extends CasoDeUso {
  constructor({ repoInsumo }) { super(); this.repoInsumo = repoInsumo; }
  async executar({ idEmpresa }) {
    const insumos = await this.repoInsumo.porEmpresa(idEmpresa);
    return insumos.map((i) => ({
      idInsumo: i.id_insumo,
      nome: i.nome,
      unidade: i.unidade,
      qtdAtual: Number(i.qtd_atual),
      qtdMinima: Number(i.qtd_minima),
      vlCustoMedio: Number(i.vl_custo_medio),
      repor: !!Number(i.repor),
    }));
  }
}

class CriarInsumo extends CasoDeUso {
  constructor({ repoInsumo }) { super(); this.repoInsumo = repoInsumo; }
  async executar({ nome, unidade, qtdMinima, vlCustoMedio, idEmpresa }) {
    if (!nome?.trim()) throw new EntradaInvalida('O insumo precisa de um nome');
    validarUnidade(unidade);
    try {
      const id = await this.repoInsumo.criar({ idEmpresa, nome: nome.trim(), unidade, qtdMinima, vlCustoMedio });
      return await insumoDaEmpresa(this.repoInsumo, id, idEmpresa);
    } catch (erro) {
      if (erro.duplicado) throw new Conflito(`Já existe o insumo "${nome}" neste restaurante`);
      throw erro;
    }
  }
}

class AtualizarInsumo extends CasoDeUso {
  constructor({ repoInsumo }) { super(); this.repoInsumo = repoInsumo; }
  async executar({ idInsumo, idEmpresa, ...dados }) {
    const atual = await insumoDaEmpresa(this.repoInsumo, idInsumo, idEmpresa);
    const unidade = validarUnidade(dados.unidade ?? atual.unidade);
    const mudou = await this.repoInsumo.atualizar(idInsumo, {
      nome: dados.nome ?? atual.nome,
      unidade,
      qtdMinima: dados.qtdMinima ?? atual.qtd_minima,
    });
    if (!mudou) throw new NaoEncontrado('Insumo não encontrado');
    return await insumoDaEmpresa(this.repoInsumo, idInsumo, idEmpresa);
  }
}

class DesativarInsumo extends CasoDeUso {
  constructor({ repoInsumo }) { super(); this.repoInsumo = repoInsumo; }
  async executar({ idInsumo, idEmpresa }) {
    await insumoDaEmpresa(this.repoInsumo, idInsumo, idEmpresa);
    await this.repoInsumo.desativar(idInsumo);
  }
}

class MovimentarEstoque extends CasoDeUso {
  constructor({ repoInsumo, unidadeDeTrabalho }) {
    super(); this.repoInsumo = repoInsumo; this.unidadeDeTrabalho = unidadeDeTrabalho;
  }

  /**
   * Entrada, perda ou ajuste manual.
   *
   * A entrada recalcula o custo médio ponderado ANTES de somar o saldo — a
   * ordem importa, porque a média usa o saldo anterior.
   */
  async executar({ idInsumo, idEmpresa, idFuncionarioAutor, motivo, ...dados }) {
    const insumo = await insumoDaEmpresa(this.repoInsumo, idInsumo, idEmpresa);
    const plano = planejarMovimento(dados, insumo);

    return await this.unidadeDeTrabalho.executar(async (ctx) => {
      if (plano.recalcularCusto) {
        await this.repoInsumo.atualizarCustoMedio(idInsumo, Number(dados.quantidade), Number(dados.vlUnitario), ctx);
      }
      await this.repoInsumo.ajustarSaldo(idInsumo, plano.variacao, ctx);
      await this.repoInsumo.criarMovimento({
        idEmpresa, idInsumo, tipo: dados.tipo,
        quantidade: plano.quantidadeRegistrada,
        vlUnitario: plano.custoDoMovimento,
        idFuncionario: idFuncionarioAutor, motivo,
      }, ctx);
      return await this.repoInsumo.porId(idInsumo, ctx);
    });
  }
}

class VerMovimentosDoInsumo extends CasoDeUso {
  constructor({ repoInsumo }) { super(); this.repoInsumo = repoInsumo; }
  async executar({ idInsumo, idEmpresa }) {
    await insumoDaEmpresa(this.repoInsumo, idInsumo, idEmpresa);
    return await this.repoInsumo.movimentos(idInsumo, LIMITE_MOVIMENTOS);
  }
}

/**
 * Baixa o estoque de uma rodada enviada à cozinha.
 *
 * Implementa a porta `BaixaDeEstoque` que o Salão declara. Chamado de dentro
 * da transação que grava a rodada, com a mesma conexão: se a rodada existe, o
 * consumo existe.
 */
class BaixarEstoquePorRodada {
  constructor({ repoInsumo, repoFicha }) { this.repoInsumo = repoInsumo; this.repoFicha = repoFicha; }

  async baixarPorRodada(itens, idPedido, idEmpresa, idFuncionario, ctx) {
    const idsProduto = [...new Set(itens.map((i) => Number(i.idProduto)))];
    const fichas = await this.repoFicha.deProdutos(idsProduto, ctx);
    if (!fichas.length) return { baixas: 0, custo: 0 };

    const consumo = calcularConsumo(itens, fichas);

    let custo = 0;
    for (const [idInsumo, dados] of consumo) {
      await this.repoInsumo.ajustarSaldo(idInsumo, -dados.quantidade, ctx);
      await this.repoInsumo.criarMovimento({
        idEmpresa, idInsumo, tipo: 'saida_venda',
        quantidade: dados.quantidade, vlUnitario: dados.custo,
        idPedido, idFuncionario, motivo: null,
      }, ctx);
      custo += dados.quantidade * dados.custo;
    }

    return { baixas: consumo.size, custo: emMilesimos(custo) };
  }
}

class VerFichaTecnica extends CasoDeUso {
  constructor({ repoFicha, consultarProduto }) { super(); this.repoFicha = repoFicha; this.consultarProduto = consultarProduto; }

  async executar({ idProduto, idEmpresa }) {
    const produto = await this.consultarProduto.executar({ idProduto, idEmpresa });
    const itens = await this.repoFicha.porProduto(idProduto);
    const margem = calcularMargem(produto.valor, itens);

    return {
      idProduto: produto.id_produto,
      nome: produto.nome,
      valor: Number(produto.valor),
      itens: itens.map((i) => ({
        idInsumo: i.id_insumo,
        nome: i.nome,
        unidade: i.unidade,
        quantidade: Number(i.quantidade),
        vlCustoMedio: Number(i.vl_custo_medio),
        vlCusto: Math.round(Number(i.quantidade) * Number(i.vl_custo_medio) * 100) / 100,
      })),
      ...margem,
    };
  }
}

class SalvarFichaTecnica extends CasoDeUso {
  constructor({ repoFicha, repoInsumo, consultarProduto, verFichaTecnica, unidadeDeTrabalho }) {
    super();
    this.repoFicha = repoFicha; this.repoInsumo = repoInsumo;
    this.consultarProduto = consultarProduto; this.verFichaTecnica = verFichaTecnica;
    this.unidadeDeTrabalho = unidadeDeTrabalho;
  }

  async executar({ idProduto, itens, idEmpresa }) {
    await this.consultarProduto.executar({ idProduto, idEmpresa });
    if (!Array.isArray(itens)) throw new EntradaInvalida('Informe os itens da ficha');

    for (const item of itens) {
      await insumoDaEmpresa(this.repoInsumo, item.idInsumo, idEmpresa);
      if (!(Number(item.quantidade) > 0)) {
        throw new EntradaInvalida('A quantidade de cada insumo deve ser maior que zero');
      }
    }

    await this.unidadeDeTrabalho.executar(async (ctx) => {
      for (const item of itens) {
        await this.repoFicha.salvarItem({ idProduto, idInsumo: item.idInsumo, quantidade: item.quantidade }, ctx);
      }
    });

    return await this.verFichaTecnica.executar({ idProduto, idEmpresa });
  }
}

class RemoverDaFichaTecnica extends CasoDeUso {
  constructor({ repoFicha, consultarProduto }) { super(); this.repoFicha = repoFicha; this.consultarProduto = consultarProduto; }
  async executar({ idProduto, idInsumo, idEmpresa }) {
    await this.consultarProduto.executar({ idProduto, idEmpresa });
    const removeu = await this.repoFicha.removerItem(idProduto, idInsumo);
    if (!removeu) throw new NaoEncontrado('Insumo não está na ficha deste produto');
  }
}

export {
  ListarInsumos, CriarInsumo, AtualizarInsumo, DesativarInsumo, MovimentarEstoque,
  VerMovimentosDoInsumo, BaixarEstoquePorRodada, VerFichaTecnica,
  SalvarFichaTecnica, RemoverDaFichaTecnica,
};
