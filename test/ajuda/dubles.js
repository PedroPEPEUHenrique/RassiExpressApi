import { UnidadeDeTrabalho } from '../../src/compartilhado/aplicacao/UnidadeDeTrabalho.js';

/**
 * Dublês em memória.
 *
 * É o que a Clean Architecture comprou: como os casos de uso recebem as
 * portas pelo construtor, testá-los é passar estes objetos — sem MySQL, sem
 * Express, sem Docker. A suíte inteira roda em menos de um segundo.
 */

/**
 * Unidade de trabalho falsa.
 *
 * Registra begin/commit/rollback para o teste poder afirmar que uma operação
 * de várias escritas aconteceu dentro de uma transação — que é a garantia que
 * protege o total da comanda.
 */
class UnidadeDeTrabalhoFalsa extends UnidadeDeTrabalho {
  constructor() { super(); this.diario = []; }
  async executar(fn) {
    this.diario.push('begin');
    try {
      const r = await fn({ transacao: true });
      this.diario.push('commit');
      return r;
    } catch (e) {
      this.diario.push('rollback');
      throw e;
    }
  }
  get commitou() { return this.diario.includes('commit'); }
  get reverteu() { return this.diario.includes('rollback'); }
}

/** Erro que imita a violação de índice único já traduzida pelo adaptador. */
function erroDuplicado() {
  const e = new Error('duplicado');
  e.duplicado = true;
  return e;
}

/**
 * Repositório genérico sobre um Map.
 *
 * `registro` guarda o que foi gravado, para o teste afirmar não só o
 * resultado como o que chegou ao banco — foi assim que se pegou o preço vindo
 * do corpo em vez do cardápio.
 */
class RepositorioFalso {
  constructor(linhas = [], chave = 'id') {
    this.chave = chave;
    this.linhas = new Map(linhas.map((l) => [l[chave], l]));
    this.registro = [];
    this.proximoId = Math.max(0, ...linhas.map((l) => Number(l[chave]) || 0)) + 1;
  }
  todas() { return [...this.linhas.values()]; }
  porChave(id) { return this.linhas.get(Number(id)) ?? null; }
  inserir(linha) {
    const id = this.proximoId++;
    const completa = { ...linha, [this.chave]: id };
    this.linhas.set(id, completa);
    this.registro.push({ acao: 'inserir', linha: completa });
    return id;
  }
  alterar(id, campos) {
    const atual = this.linhas.get(Number(id));
    if (!atual) return 0;
    this.linhas.set(Number(id), { ...atual, ...campos });
    this.registro.push({ acao: 'alterar', id: Number(id), campos });
    return 1;
  }
}

export { UnidadeDeTrabalhoFalsa, RepositorioFalso, erroDuplicado };
