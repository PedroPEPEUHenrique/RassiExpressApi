import { CasoDeUso } from '../../../compartilhado/aplicacao/CasoDeUso.js';
import { Conflito, NaoAutenticado, NaoEncontrado } from '../../../compartilhado/dominio/erros.js';
import { media } from '../../../compartilhado/dominio/dinheiro.js';
import { escolherVinculo, credencialInvalida } from '../dominio/Sessao.js';
import { validarPapel, garantirTrocaDePapel, garantirDesligamento } from '../dominio/Funcionario.js';

/**
 * Hash descartável usado quando o e-mail não existe. Comparar contra ele faz o
 * login gastar o mesmo tempo nos dois casos, evitando que a diferença de
 * duração revele quais e-mails estão cadastrados.
 */
const HASH_DUMMY = '$2b$10$CwTycUXWue0Thq9StjUM0uJ8.e8s9pvQ1tBq3Qyq8Uu2qN0cPdQmO';

class Autenticar extends CasoDeUso {
  constructor({ repoUsuario, repoFuncionario, hasher, emissorDeToken }) {
    super();
    this.repoUsuario = repoUsuario; this.repoFuncionario = repoFuncionario;
    this.hasher = hasher; this.emissorDeToken = emissorDeToken;
  }

  async executar({ email, senha, idEmpresa }) {
    const usuario = await this.repoUsuario.porEmail(email);
    const senhaCorreta = await this.hasher.conferir(senha, usuario?.senha ?? HASH_DUMMY);
    if (!usuario || !senhaCorreta) throw credencialInvalida();

    const vinculos = await this.repoFuncionario.vinculosAtivos(usuario.id_usuario);
    const vinculo = escolherVinculo(vinculos, idEmpresa);

    const { senha: _ignorada, ...usuarioSemSenha } = usuario;
    const token = this.emissorDeToken.emitir({
      id: usuario.id_usuario,
      email: usuario.email,
      idEmpresa: vinculo.id_empresa,
      idFuncionario: vinculo.id_funcionario,
      papel: vinculo.papel,
    });

    return {
      token,
      usuario: usuarioSemSenha,
      papel: vinculo.papel,
      empresa: { idEmpresa: vinculo.id_empresa, nome: vinculo.nome_empresa },
    };
  }
}

class ListarEquipe extends CasoDeUso {
  constructor({ repoFuncionario }) { super(); this.repoFuncionario = repoFuncionario; }
  async executar({ idEmpresa }) { return await this.repoFuncionario.porEmpresa(idEmpresa); }
}

class AdmitirFuncionario extends CasoDeUso {
  constructor({ repoUsuario, repoFuncionario, hasher, unidadeDeTrabalho }) {
    super();
    this.repoUsuario = repoUsuario; this.repoFuncionario = repoFuncionario;
    this.hasher = hasher; this.unidadeDeTrabalho = unidadeDeTrabalho;
  }

  /**
   * Cria a conta de um membro da equipe. Substitui o cadastro público: quem
   * admite é o gestor, e o restaurante vem do token dele.
   */
  async executar({ nome, email, senha, telefone, papel, idEmpresa }) {
    validarPapel(papel);
    if (await this.repoUsuario.porEmail(email)) throw new Conflito('E-mail já cadastrado');

    const hash = await this.hasher.gerar(senha);

    // Identidade e vínculo na mesma transação: um usuário sem vínculo não
    // entra em restaurante nenhum e ficaria órfão, ocupando o e-mail para
    // sempre por causa da chave única.
    return await this.unidadeDeTrabalho.executar(async (ctx) => {
      const idUsuario = await this.repoUsuario.criar({ nome, email, senha: hash, telefone }, ctx);
      const idFuncionario = await this.repoFuncionario.criar({ idUsuario, idEmpresa, papel }, ctx);
      return { idFuncionario, idUsuario, nome, email, papel };
    });
  }
}

async function vinculoDaEmpresa(repo, idFuncionario, idEmpresa) {
  const f = await repo.porId(idFuncionario);
  if (!f || f.id_empresa !== Number(idEmpresa)) throw new NaoEncontrado('Funcionário não encontrado');
  return f;
}

class AlterarPapel extends CasoDeUso {
  constructor({ repoFuncionario }) { super(); this.repoFuncionario = repoFuncionario; }
  async executar({ idFuncionario, papel, idEmpresa, idFuncionarioAutor }) {
    const alvo = await vinculoDaEmpresa(this.repoFuncionario, idFuncionario, idEmpresa);
    const gestores = await this.repoFuncionario.contarGestoresAtivos(idEmpresa);
    garantirTrocaDePapel(alvo, idFuncionarioAutor, papel, gestores);

    const mudou = await this.repoFuncionario.atualizarPapel(idFuncionario, papel);
    if (!mudou) throw new NaoEncontrado('Funcionário não encontrado');
    return { ...alvo, papel };
  }
}

class AlterarAcesso extends CasoDeUso {
  constructor({ repoFuncionario }) { super(); this.repoFuncionario = repoFuncionario; }

  /**
   * Liga e desliga o acesso. Desligar é desativar, nunca apagar: a pessoa
   * aparece em comandas e rodadas antigas, e o DELETE cascatearia o histórico
   * de vendas junto.
   */
  async executar({ idFuncionario, ativo, idEmpresa, idFuncionarioAutor }) {
    const alvo = await vinculoDaEmpresa(this.repoFuncionario, idFuncionario, idEmpresa);
    if (!ativo) {
      const gestores = await this.repoFuncionario.contarGestoresAtivos(idEmpresa);
      garantirDesligamento(alvo, idFuncionarioAutor, gestores);
    }
    const mudou = await this.repoFuncionario.atualizarAtivo(idFuncionario, ativo);
    if (!mudou) throw new NaoEncontrado('Funcionário não encontrado');
    return { ...alvo, ativo: ativo ? 1 : 0 };
  }
}

class VerDesempenhoDaEquipe extends CasoDeUso {
  constructor({ repoFuncionario }) { super(); this.repoFuncionario = repoFuncionario; }
  async executar({ idEmpresa, de, ate }) {
    const linhas = await this.repoFuncionario.desempenho(idEmpresa, de, ate);
    return linhas.map((l) => ({
      ...l,
      vl_total: Number(l.vl_total),
      comandas: Number(l.comandas),
      rodadas: Number(l.rodadas),
      vl_ticket_medio: media(l.vl_total, l.comandas),
    }));
  }
}

class VerPerfil extends CasoDeUso {
  constructor({ repoUsuario }) { super(); this.repoUsuario = repoUsuario; }
  async executar({ idUsuario }) {
    const u = await this.repoUsuario.porId(idUsuario);
    if (!u) throw new NaoEncontrado('Usuário não encontrado');
    return u;
  }
}

class AtualizarPerfil extends CasoDeUso {
  constructor({ repoUsuario }) { super(); this.repoUsuario = repoUsuario; }
  async executar({ idUsuario, nome, telefone }) {
    const mudou = await this.repoUsuario.atualizar(idUsuario, { nome, telefone });
    if (!mudou) throw new NaoEncontrado('Usuário não encontrado');
    return await this.repoUsuario.porId(idUsuario);
  }
}

class AlterarSenha extends CasoDeUso {
  constructor({ repoUsuario, hasher }) { super(); this.repoUsuario = repoUsuario; this.hasher = hasher; }
  async executar({ idUsuarioAutenticado: idUsuario, senhaAtual, novaSenha }) {
    const u = await this.repoUsuario.comSenhaPorId(idUsuario);
    if (!u) throw new NaoEncontrado('Usuário não encontrado');
    if (!(await this.hasher.conferir(senhaAtual, u.senha))) {
      throw new NaoAutenticado('Senha atual incorreta');
    }
    await this.repoUsuario.atualizarSenha(idUsuario, await this.hasher.gerar(novaSenha));
  }
}

class VerRestaurante extends CasoDeUso {
  constructor({ repoEmpresa }) { super(); this.repoEmpresa = repoEmpresa; }
  async executar({ idEmpresa }) {
    const e = await this.repoEmpresa.porId(idEmpresa);
    if (!e) throw new NaoEncontrado('Restaurante não encontrado');
    return e;
  }
}

class AtualizarRestaurante extends CasoDeUso {
  constructor({ repoEmpresa }) { super(); this.repoEmpresa = repoEmpresa; }
  async executar({ idEmpresa, ...dados }) {
    const atual = await this.repoEmpresa.porId(idEmpresa);
    if (!atual) throw new NaoEncontrado('Restaurante não encontrado');

    // Campo ausente mantém o valor atual: o UPDATE reescreve a linha inteira
    // e zeraria o que o app não enviou.
    const atualizado = {
      nome: dados.nome ?? atual.nome,
      icone: dados.icone ?? atual.icone,
      taxaEntrega: dados.taxaEntrega ?? atual.taxa_entrega,
      cep: dados.cep ?? atual.cep,
      endereco: dados.endereco ?? atual.endereco,
      numero: dados.numero ?? atual.numero,
      complemento: dados.complemento ?? atual.complemento,
      bairro: dados.bairro ?? atual.bairro,
      cidade: dados.cidade ?? atual.cidade,
      estado: dados.estado ?? atual.estado,
      ativo: dados.ativo ?? atual.ativo,
    };
    const mudou = await this.repoEmpresa.atualizar(idEmpresa, atualizado);
    if (!mudou) throw new NaoEncontrado('Restaurante não encontrado');
    return { idEmpresa: Number(idEmpresa), ...atualizado };
  }
}

export {
  Autenticar, ListarEquipe, AdmitirFuncionario, AlterarPapel, AlterarAcesso,
  VerDesempenhoDaEquipe, VerPerfil, AtualizarPerfil, AlterarSenha,
  VerRestaurante, AtualizarRestaurante,
};
