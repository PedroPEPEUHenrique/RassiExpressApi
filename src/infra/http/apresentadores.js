/**
 * Apresentadores: linha do banco -> contrato da API.
 *
 * Esta é a fronteira. Acima daqui o sistema fala a língua do banco
 * (`id_pedido`, `vl_total`); daqui para fora fala a do contrato
 * (`idPedido`, `vlTotal`), que é o que o app importa como tipo.
 *
 * Antes, a linha crua vazava para o cliente e cada service do app reconvertia
 * à mão — 38 linhas de tradução espalhadas, que ninguém verificava. Renomear
 * uma coluna quebrava o aplicativo em silêncio.
 *
 * Tudo aqui é função pura de objeto para objeto. Os nomes do contrato estão
 * em contrato/api.ts.
 */

const numero = (v) => (v === null || v === undefined ? null : Number(v));
const booleano = (v) => !!Number(v);
const lista = (fn) => (linhas) => (linhas ?? []).map(fn);

// ---------------------------------------------------------------------------
// Acesso
// ---------------------------------------------------------------------------

function usuario(u) {
    if (!u) return null;
    return {
        idUsuario: u.id_usuario,
        nome: u.nome,
        email: u.email,
        telefone: u.telefone ?? null,
    };
}

function login(r) {
    return {
        token: r.token,
        usuario: usuario(r.usuario),
        papel: r.papel,
        empresa: r.empresa,
    };
}

function funcionario(f) {
    return {
        idFuncionario: f.id_funcionario,
        idUsuario: f.id_usuario,
        nome: f.nome,
        email: f.email,
        telefone: f.telefone ?? null,
        papel: f.papel,
        ativo: booleano(f.ativo),
        dtAdmissao: f.dt_admissao,
    };
}

function desempenho(d) {
    return {
        idFuncionario: d.id_funcionario,
        nome: d.nome,
        papel: d.papel,
        ativo: booleano(d.ativo),
        comandas: Number(d.comandas),
        rodadas: Number(d.rodadas),
        vlTotal: Number(d.vl_total),
        vlTicketMedio: Number(d.vl_ticket_medio),
    };
}

function restaurante(e) {
    return {
        idEmpresa: e.id_empresa ?? e.idEmpresa,
        nome: e.nome,
        icone: e.icone ?? null,
        cep: e.cep ?? null,
        endereco: e.endereco ?? null,
        numero: e.numero ?? null,
        complemento: e.complemento ?? null,
        bairro: e.bairro ?? null,
        cidade: e.cidade ?? null,
        estado: e.estado ?? null,
        ativo: booleano(e.ativo),
    };
}

// ---------------------------------------------------------------------------
// Cardápio
// ---------------------------------------------------------------------------

function produto(p) {
    return {
        idProduto: p.id_produto,
        idProdutoCategoria: p.id_produto_categoria,
        nome: p.nome,
        descricao: p.descricao ?? '',
        valor: Number(p.valor),
        icone: p.icone ?? undefined,
        ativo: booleano(p.ativo),
        // Banco sem a migration 004 não tem a coluna: ausente significa "tem",
        // porque sem ela não existe conceito de falta.
        disponivel: p.disponivel === undefined ? true : booleano(p.disponivel),
    };
}

function categoria(c) {
    return {
        idProdutoCategoria: c.id_produto_categoria,
        categoria: c.categoria,
        ordem: Number(c.ordem ?? 0),
    };
}

function secaoCardapio(s) {
    return { ...categoria(s), produtos: (s.produtos ?? []).map(produto) };
}

// ---------------------------------------------------------------------------
// Salão
// ---------------------------------------------------------------------------

function itemRodada(i) {
    return {
        idItensPedido: i.id_itens_pedido,
        idProduto: i.id_produto,
        nomeProduto: i.nome_produto ?? '',
        observacao: i.observacao ?? null,
        quantidade: Number(i.quantidade),
        vlUnitario: Number(i.vl_unitario),
        vlTotal: Number(i.vl_total),
    };
}

function rodada(p) {
    return {
        idPedido: p.id_pedido,
        idComanda: p.id_comanda ?? null,
        status: p.status,
        dtPedido: p.dt_pedido,
        vlTotal: Number(p.vl_total ?? 0),
        numeroMesa: p.numero_mesa ?? null,
        nomeGarcom: p.nome_garcom ?? null,
        itens: (p.itens ?? []).map(itemRodada),
    };
}

function comandaResumo(c) {
    return {
        idComanda: c.id_comanda,
        idMesa: c.id_mesa,
        numeroMesa: c.numero_mesa ?? '',
        setor: c.setor ?? null,
        status: c.status,
        vlTotal: Number(c.vl_total ?? 0),
        dtAbertura: c.dt_abertura,
        nomeGarcom: c.nome_garcom ?? null,
    };
}

function comanda(c) {
    return {
        ...comandaResumo(c),
        dtFechamento: c.dt_fechamento ?? null,
        rodadas: (c.rodadas ?? []).map(rodada),
    };
}

// ---------------------------------------------------------------------------
// Financeiro
// ---------------------------------------------------------------------------

function movimentoCaixa(m) {
    return {
        idMovimento: m.id_movimento,
        tipo: m.tipo,
        descricao: m.descricao ?? '',
        valor: Number(m.valor),
        numeroMesa: m.numero_mesa ?? null,
        nomeFuncionario: m.nome_funcionario ?? null,
        dtMovimento: m.dt_movimento,
    };
}

function caixa(c) {
    if (!c) return null; // sem turno aberto a rota devolve null de propósito
    return {
        idCaixa: c.id_caixa,
        status: c.status,
        dtAbertura: c.dt_abertura,
        dtFechamento: c.dt_fechamento ?? null,
        nomeAbertura: c.nome_abertura ?? null,
        // O resumo já sai do domínio no formato do contrato.
        resumo: c.resumo,
        movimentos: (c.movimentos ?? []).map(movimentoCaixa),
    };
}

// ---------------------------------------------------------------------------
// Estoque
// ---------------------------------------------------------------------------

function movimentoEstoque(m) {
    return {
        idMovimento: m.id_movimento,
        tipo: m.tipo,
        quantidade: Number(m.quantidade),
        vlUnitario: numero(m.vl_unitario),
        idPedido: m.id_pedido ?? null,
        nomeFuncionario: m.nome_funcionario ?? null,
        motivo: m.motivo ?? null,
        dtMovimento: m.dt_movimento,
    };
}

/**
 * Passa adiante sem tocar.
 *
 * Para os casos de uso que já produzem a forma do contrato — o mapa do salão,
 * a lista de insumos, a ficha técnica, o painel. Ali a conversão é derivação
 * de regra (uma mesa está "ocupada" porque existe comanda aberta), não
 * renomeação, então pertence à aplicação e não a esta camada.
 */
const comoEsta = (x) => x;

export default {
    login, usuario, funcionario, desempenho: lista(desempenho), restaurante,
    produto, produtos: lista(produto), categoria, categorias: lista(categoria),
    cardapio: lista(secaoCardapio),
    comanda, comandas: lista(comandaResumo),
    rodada, rodadas: lista(rodada),
    caixa, caixas: lista(caixa),
    movimentosEstoque: lista(movimentoEstoque),
    comoEsta,
};
