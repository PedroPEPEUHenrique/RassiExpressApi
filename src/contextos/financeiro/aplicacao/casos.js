import { CasoDeUso } from '../../../compartilhado/aplicacao/CasoDeUso.js';
import { Conflito, NaoEncontrado } from '../../../compartilhado/dominio/erros.js';
import { emCentavos, media } from '../../../compartilhado/dominio/dinheiro.js';
import { validarLancamento, montarResumo, validarAbertura, garantirPodeFechar } from '../dominio/Caixa.js';

const LIMITE_MAIS_VENDIDOS = 10;

async function caixaDaEmpresa(repo, idCaixa, idEmpresa, ctx) {
  const c = await repo.porId(idCaixa, ctx);
  if (!c || c.id_empresa !== Number(idEmpresa)) throw new NaoEncontrado('Caixa não encontrado');
  return c;
}

async function comResumo(repo, caixa, ctx) {
  const [totais, movimentos] = await Promise.all([
    repo.totais(caixa.id_caixa, ctx),
    repo.movimentos(caixa.id_caixa, ctx),
  ]);
  return { ...caixa, resumo: montarResumo(caixa, totais), movimentos };
}

/** Devolve null sem turno aberto: a tela usa isso para oferecer a abertura. */
class VerCaixaAtual extends CasoDeUso {
  constructor({ repoCaixa }) { super(); this.repoCaixa = repoCaixa; }
  async executar({ idEmpresa }) {
    const caixa = await this.repoCaixa.aberto(idEmpresa);
    return caixa ? await comResumo(this.repoCaixa, caixa) : null;
  }
}

class VerCaixa extends CasoDeUso {
  constructor({ repoCaixa }) { super(); this.repoCaixa = repoCaixa; }
  async executar({ idCaixa, idEmpresa }) {
    const caixa = await caixaDaEmpresa(this.repoCaixa, idCaixa, idEmpresa);
    return await comResumo(this.repoCaixa, caixa);
  }
}

class VerHistoricoDeCaixa extends CasoDeUso {
  constructor({ repoCaixa }) { super(); this.repoCaixa = repoCaixa; }
  async executar({ idEmpresa, de, ate }) {
    const caixas = await this.repoCaixa.porPeriodo(idEmpresa, de, ate);
    return await Promise.all(caixas.map(async (c) => ({
      ...c, resumo: montarResumo(c, await this.repoCaixa.totais(c.id_caixa)),
    })));
  }
}

class AbrirCaixa extends CasoDeUso {
  constructor({ repoCaixa, verCaixa }) { super(); this.repoCaixa = repoCaixa; this.verCaixa = verCaixa; }

  /**
   * A unicidade de um caixa aberto por restaurante é do índice do banco; esta
   * verificação existe para dar mensagem útil no caso comum, e a corrida
   * entre dois gestores é traduzida abaixo.
   */
  async executar({ vlAbertura = 0, observacao, idEmpresa, idFuncionarioAutor }) {
    validarAbertura(vlAbertura);

    const aberto = await this.repoCaixa.aberto(idEmpresa);
    if (aberto) throw new Conflito('Já existe um caixa aberto', { idCaixa: aberto.id_caixa });

    try {
      const idCaixa = await this.repoCaixa.abrir({ idEmpresa, idFuncionario: idFuncionarioAutor, vlAbertura, observacao });
      return await this.verCaixa.executar({ idCaixa, idEmpresa });
    } catch (erro) {
      if (erro.duplicado) throw new Conflito('Já existe um caixa aberto');
      throw erro;
    }
  }
}

class FecharCaixa extends CasoDeUso {
  constructor({ repoCaixa, contagemDeComandasAbertas, unidadeDeTrabalho }) {
    super();
    this.repoCaixa = repoCaixa;
    this.contagemDeComandasAbertas = contagemDeComandasAbertas;
    this.unidadeDeTrabalho = unidadeDeTrabalho;
  }

  async executar({ idCaixa, vlInformado, observacao, forcar = false, idEmpresa, idFuncionarioAutor }) {
    const caixa = await caixaDaEmpresa(this.repoCaixa, idCaixa, idEmpresa);
    const abertas = await this.contagemDeComandasAbertas(idEmpresa);
    garantirPodeFechar(caixa, vlInformado, abertas, { forcar });

    return await this.unidadeDeTrabalho.executar(async (ctx) => {
      const fechou = await this.repoCaixa.fechar(idCaixa, { idFuncionario: idFuncionarioAutor, vlInformado, observacao }, ctx);
      if (!fechou) throw new Conflito('Este caixa já foi fechado');

      const atualizado = await this.repoCaixa.porId(idCaixa, ctx);
      const totais = await this.repoCaixa.totais(idCaixa, ctx);
      return { ...atualizado, resumo: montarResumo(atualizado, totais) };
    });
  }
}

class LancarMovimento extends CasoDeUso {
  constructor({ repoCaixa, verCaixa }) { super(); this.repoCaixa = repoCaixa; this.verCaixa = verCaixa; }

  async executar({ tipo, valor, descricao, idEmpresa, idFuncionarioAutor }) {
    validarLancamento({ tipo, valor });

    const caixa = await this.repoCaixa.aberto(idEmpresa);
    if (!caixa) throw new Conflito('Abra o caixa antes de lançar movimentos');

    await this.repoCaixa.criarMovimento({
      idCaixa: caixa.id_caixa, idEmpresa, idFuncionario: idFuncionarioAutor, tipo, descricao, valor: Number(valor),
    });
    return await this.verCaixa.executar({ idCaixa: caixa.id_caixa, idEmpresa });
  }
}

/**
 * Registra a venda de uma comanda recém-fechada, se houver caixa aberto.
 *
 * Implementa a porta `RegistroNoCaixa` que o Salão declara. Chamado de dentro
 * da transação que fecha a comanda, com a mesma conexão.
 *
 * Sem caixa aberto a venda não se perde: ela continua em COMANDA e aparece
 * nos relatórios; o que falta é só o lançamento no livro do turno. Barrar o
 * fechamento da mesa por isso prenderia o cliente na porta.
 */
class RegistrarVendaNoCaixa {
  constructor({ repoCaixa }) { this.repoCaixa = repoCaixa; }

  async registrarVendaDaComanda(comanda, idFuncionario, ctx) {
    const valor = Number(comanda.vl_total ?? 0);
    if (!(valor > 0)) return null;

    const caixa = await this.repoCaixa.aberto(comanda.id_empresa, ctx);
    if (!caixa) return null;

    try {
      return await this.repoCaixa.criarMovimento({
        idCaixa: caixa.id_caixa,
        idEmpresa: comanda.id_empresa,
        idFuncionario,
        tipo: 'venda',
        descricao: `Mesa ${comanda.numero_mesa ?? comanda.id_mesa}`,
        valor,
        idComanda: comanda.id_comanda,
      }, ctx);
    } catch (erro) {
      // Já lançada: fechamento repetido não duplica a receita do turno.
      if (erro.duplicado) return null;
      throw erro;
    }
  }
}

/**
 * Painel do gestor para um período, numa chamada só.
 *
 * As consultas correm em paralelo porque nenhuma depende da outra — o gestor
 * abre a tela para ver o dia, e cinco requisições em sequência deixariam a
 * tela montando aos pedaços.
 */
class VerPainelDeRelatorios extends CasoDeUso {
  constructor({ consultasDeRelatorio, verDesempenhoDaEquipe }) {
    super();
    this.consultas = consultasDeRelatorio;
    this.verDesempenhoDaEquipe = verDesempenhoDaEquipe;
  }

  async executar({ idEmpresa, de, ate }) {
    const [resumo, porDia, maisVendidos, porHora, canceladas, equipe] = await Promise.all([
      this.consultas.resumo(idEmpresa, de, ate),
      this.consultas.porDia(idEmpresa, de, ate),
      this.consultas.maisVendidos(idEmpresa, de, ate, LIMITE_MAIS_VENDIDOS),
      this.consultas.porHora(idEmpresa, de, ate),
      this.consultas.rodadasCanceladas(idEmpresa, de, ate),
      this.verDesempenhoDaEquipe.executar({ idEmpresa, de, ate }),
    ]);

    return {
      resumo: {
        comandas: Number(resumo?.comandas ?? 0),
        faturamento: emCentavos(resumo?.faturamento),
        ticketMedio: emCentavos(resumo?.ticket_medio),
        rodadasCanceladas: canceladas,
      },
      porDia: porDia.map((d) => ({
        dia: typeof d.dia === 'string' ? d.dia : new Date(d.dia).toISOString().slice(0, 10),
        comandas: Number(d.comandas),
        faturamento: emCentavos(d.faturamento),
      })),
      maisVendidos: maisVendidos.map((p) => ({
        nome: p.nome_produto ?? '(sem nome)',
        quantidade: Number(p.quantidade),
        faturamento: emCentavos(p.faturamento),
      })),
      porHora: porHora.map((h) => ({
        hora: Number(h.hora),
        comandas: Number(h.comandas),
        faturamento: emCentavos(h.faturamento),
      })),
      // Só quem vendeu entra no ranking da tela de relatórios; a lista
      // completa, com zeros, é assunto da tela de Equipe.
      equipe: equipe
        .filter((f) => Number(f.vl_total) > 0)
        .map((f) => ({
          idFuncionario: f.id_funcionario,
          nome: f.nome,
          papel: f.papel,
          comandas: Number(f.comandas),
          faturamento: emCentavos(f.vl_total),
        })),
    };
  }
}

export {
  VerCaixaAtual, VerCaixa, VerHistoricoDeCaixa, AbrirCaixa, FecharCaixa,
  LancarMovimento, RegistrarVendaNoCaixa, VerPainelDeRelatorios,
};
