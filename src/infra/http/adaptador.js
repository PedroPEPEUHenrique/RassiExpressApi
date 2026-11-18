/**
 * Adaptador entre Express e caso de uso.
 *
 * Substitui os doze controllers antigos por uma função só. Todo caso de uso
 * tem a mesma forma — `executar(entrada)` — então a tradução HTTP → entrada e
 * resultado → resposta é sempre a mesma, e repeti-la em cada recurso só
 * criava lugares para divergir.
 *
 * O `contexto` é o que importa em segurança: idEmpresa, idFuncionario e papel
 * saem SEMPRE do token, nunca do corpo ou da query. É estrutural — um caso de
 * uso não tem como receber empresa pelo corpo mesmo que alguém tente mandar.
 */
function adaptar(obterCaso, { status = 200, entrada } = {}) {
  return async (req, res, next) => {
    try {
      /**
       * Os nomes aqui são sufixados de propósito.
       *
       * Na primeira versão o contexto usava `idFuncionario` e `papel`, que
       * COLIDEM com dados legítimos: em PATCH /funcionarios/:idFuncionario/papel
       * o alvo vem da URL e o papel novo vem do corpo. Como o contexto é
       * aplicado por último, ele sobrescrevia os dois e o pedido chegava ao
       * caso de uso como "promover a mim mesmo a gestor" — a trava do último
       * gestor nunca disparava.
       *
       * Com nomes que nenhum parâmetro de rota ou campo de corpo usa, a
       * colisão deixa de ser possível. E o contexto continua vindo por
       * último, então `idEmpresa` jamais pode ser forjado pelo cliente.
       */
      const contexto = {
        idEmpresa: req.usuario?.idEmpresa,
        idFuncionarioAutor: req.usuario?.idFuncionario,
        idUsuarioAutenticado: req.usuario?.id,
      };

      // `entrada` monta o que vem do mundo externo (params, query, body).
      const dados = { ...(entrada ? entrada(req) : { ...req.body, ...req.params }), ...contexto };

      const resultado = await obterCaso().executar(dados);

      if (resultado === undefined) return res.status(204).send();
      res.status(status).json(resultado);
    } catch (erro) {
      next(erro);
    }
  };
}

export { adaptar };
