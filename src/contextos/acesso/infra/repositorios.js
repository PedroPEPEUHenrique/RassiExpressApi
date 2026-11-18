import { executar } from '../../../infra/persistencia/mysql.js';
import { RepositorioUsuario, RepositorioFuncionario, RepositorioEmpresa } from '../aplicacao/portas.js';

const COLUNAS_PUBLICAS =
  'id_usuario, nome, email, telefone, cep, endereco, numero, complemento, bairro, cidade, estado, dt_cadastro';

class RepositorioUsuarioMySQL extends RepositorioUsuario {
  async porEmail(email, ctx) {
    return await executar('SELECT * FROM USUARIO WHERE email = ?', [email], 'um', ctx);
  }

  async porId(idUsuario, ctx) {
    return await executar(`SELECT ${COLUNAS_PUBLICAS} FROM USUARIO WHERE id_usuario = ?`, [idUsuario], 'um', ctx);
  }

  // Consulta separada da pública: o hash só sai do banco quando a operação
  // precisa conferi-lo, nunca junto de uma leitura de perfil.
  async comSenhaPorId(idUsuario, ctx) {
    return await executar('SELECT id_usuario, senha FROM USUARIO WHERE id_usuario = ?', [idUsuario], 'um', ctx);
  }

  async criar(usuario, ctx) {
    const r = await executar(`
      INSERT INTO USUARIO (nome, email, senha, telefone, dt_cadastro)
      VALUES (?, ?, ?, ?, NOW())
    `, [usuario.nome, usuario.email, usuario.senha, usuario.telefone ?? null], 'escrita', ctx);
    return r.id;
  }

  async atualizar(idUsuario, usuario, ctx) {
    const r = await executar(
      'UPDATE USUARIO SET nome = COALESCE(?, nome), telefone = COALESCE(?, telefone) WHERE id_usuario = ?',
      [usuario.nome ?? null, usuario.telefone ?? null, idUsuario], 'escrita', ctx
    );
    return r.afetadas;
  }

  async atualizarSenha(idUsuario, hash, ctx) {
    const r = await executar('UPDATE USUARIO SET senha = ? WHERE id_usuario = ?', [hash, idUsuario], 'escrita', ctx);
    return r.afetadas;
  }
}

class RepositorioFuncionarioMySQL extends RepositorioFuncionario {
  // Vínculos que podem gerar login: funcionário ativo em restaurante ativo.
  // Desativar qualquer um dos dois tira o acesso sem apagar histórico.
  async vinculosAtivos(idUsuario, ctx) {
    return await executar(`
      SELECT f.id_funcionario, f.id_empresa, f.papel, e.nome AS nome_empresa
      FROM FUNCIONARIO f
      INNER JOIN EMPRESA e ON e.id_empresa = f.id_empresa
      WHERE f.id_usuario = ? AND f.ativo = 1 AND e.ativo = 1
      ORDER BY e.nome
    `, [idUsuario], 'todos', ctx);
  }

  async porEmpresa(idEmpresa, ctx) {
    return await executar(`
      SELECT f.id_funcionario, f.id_usuario, f.papel, f.ativo, f.dt_admissao,
             u.nome, u.email, u.telefone
      FROM FUNCIONARIO f
      INNER JOIN USUARIO u ON u.id_usuario = f.id_usuario
      WHERE f.id_empresa = ?
      ORDER BY f.ativo DESC, f.papel, u.nome
    `, [idEmpresa], 'todos', ctx);
  }

  async porId(idFuncionario, ctx) {
    return await executar(`
      SELECT f.id_funcionario, f.id_usuario, f.id_empresa, f.papel, f.ativo, f.dt_admissao,
             u.nome, u.email, u.telefone
      FROM FUNCIONARIO f
      INNER JOIN USUARIO u ON u.id_usuario = f.id_usuario
      WHERE f.id_funcionario = ?
    `, [idFuncionario], 'um', ctx);
  }

  async criar(funcionario, ctx) {
    const r = await executar(`
      INSERT INTO FUNCIONARIO (id_usuario, id_empresa, papel, ativo, dt_admissao)
      VALUES (?, ?, ?, 1, NOW())
    `, [funcionario.idUsuario, funcionario.idEmpresa, funcionario.papel], 'escrita', ctx);
    return r.id;
  }

  async atualizarPapel(idFuncionario, papel, ctx) {
    const r = await executar('UPDATE FUNCIONARIO SET papel = ? WHERE id_funcionario = ?',
      [papel, idFuncionario], 'escrita', ctx);
    return r.afetadas;
  }

  async atualizarAtivo(idFuncionario, ativo, ctx) {
    const r = await executar('UPDATE FUNCIONARIO SET ativo = ? WHERE id_funcionario = ?',
      [ativo ? 1 : 0, idFuncionario], 'escrita', ctx);
    return r.afetadas;
  }

  async contarGestoresAtivos(idEmpresa, ctx) {
    const linha = await executar(
      "SELECT COUNT(*) AS total FROM FUNCIONARIO WHERE id_empresa = ? AND papel = 'gestor' AND ativo = 1",
      [idEmpresa], 'um', ctx
    );
    return Number(linha?.total ?? 0);
  }

  /**
   * Vendas por funcionário no período.
   *
   * Usa a data da rodada, não a do fechamento da comanda: o trabalho do garçom
   * aconteceu no lançamento, e uma mesa aberta perto da meia-noite não deve
   * jogar o esforço dele para o dia seguinte.
   *
   * LEFT JOIN de propósito — quem não vendeu aparece com zero, que é
   * justamente a informação que o gestor procura.
   */
  async desempenho(idEmpresa, de, ate, ctx) {
    return await executar(`
      SELECT f.id_funcionario, f.papel, f.ativo, u.nome,
             COUNT(DISTINCT p.id_comanda) AS comandas,
             COUNT(p.id_pedido)           AS rodadas,
             COALESCE(SUM(p.vl_total), 0) AS vl_total
      FROM FUNCIONARIO f
      INNER JOIN USUARIO u ON u.id_usuario = f.id_usuario
      LEFT JOIN PEDIDO p
             ON p.id_funcionario = f.id_funcionario
            AND p.status <> 'cancelado'
            AND p.dt_pedido >= ? AND p.dt_pedido < ?
      WHERE f.id_empresa = ?
      GROUP BY f.id_funcionario, f.papel, f.ativo, u.nome
      ORDER BY vl_total DESC, u.nome
    `, [de, ate, idEmpresa], 'todos', ctx);
  }
}

class RepositorioEmpresaMySQL extends RepositorioEmpresa {
  async porId(idEmpresa, ctx) {
    return await executar('SELECT * FROM EMPRESA WHERE id_empresa = ?', [idEmpresa], 'um', ctx);
  }

  async atualizar(idEmpresa, empresa, ctx) {
    const r = await executar(`
      UPDATE EMPRESA SET nome = ?, icone = ?, taxa_entrega = ?, cep = ?, endereco = ?,
             numero = ?, complemento = ?, bairro = ?, cidade = ?, estado = ?, ativo = ?
      WHERE id_empresa = ?
    `, [
      empresa.nome, empresa.icone ?? null, empresa.taxaEntrega,
      empresa.cep ?? null, empresa.endereco ?? null, empresa.numero ?? null,
      empresa.complemento ?? null, empresa.bairro ?? null, empresa.cidade ?? null,
      empresa.estado ?? null, empresa.ativo, idEmpresa,
    ], 'escrita', ctx);
    return r.afetadas;
  }
}

export { RepositorioUsuarioMySQL, RepositorioFuncionarioMySQL, RepositorioEmpresaMySQL };
