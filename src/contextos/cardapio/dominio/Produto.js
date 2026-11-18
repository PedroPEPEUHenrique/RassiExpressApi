import { Conflito, EntradaInvalida } from '../../../compartilhado/dominio/erros.js';

/**
 * Regras do cardápio.
 *
 * A distinção entre os dois estados é a decisão central do contexto:
 *
 *   ativo      = está no cardápio. Decisão rara; tirar some da lista do garçom.
 *   disponivel = tem hoje. "Acabou o filé" às 20h, volta na terça.
 *
 * Um campo só obrigaria o gestor a escolher entre vender o que não tem e
 * apagar do cadastro o que volta amanhã.
 */

function validarDadosDoProduto({ nome, valor, idProdutoCategoria }) {
    if (!nome) throw new EntradaInvalida('Nome é obrigatório');
    if (valor === undefined || valor === null) throw new EntradaInvalida('Valor é obrigatório');
    if (Number(valor) < 0) throw new EntradaInvalida('Valor não pode ser negativo');
    if (!idProdutoCategoria) throw new EntradaInvalida('Categoria é obrigatória');
}

/**
 * Produto fora do cardápio não tem disponibilidade a alternar: o estado que o
 * gestor quer mexer é outro, e deixar passar daria a impressão de que o item
 * voltou para a lista do garçom quando ele não voltou.
 */
function garantirPodeAlternarDisponibilidade(produto) {
    if (!produto.ativo) {
        throw new Conflito(`"${produto.nome}" está fora do cardápio. Reative-o antes.`);
    }
}

/**
 * Categoria com produtos não pode ser apagada.
 *
 * A exclusão é física e as chaves estrangeiras cascateiam:
 *   PRODUTO_CATEGORIA → PRODUTO → ITENS_PEDIDO
 *
 * Ou seja, apagar uma seção do cardápio apagaria os itens vendidos em
 * comandas já fechadas, deixando os totais históricos sem lastro. Um toque na
 * tela do gestor não pode ter esse alcance.
 */
function garantirCategoriaVazia(categoria, quantidadeDeProdutos) {
    if (quantidadeDeProdutos > 0) {
        throw new Conflito(
            `"${categoria.categoria}" ainda tem ${quantidadeDeProdutos} produto(s). Mova-os para outra categoria antes de excluir.`,
            { produtos: quantidadeDeProdutos }
        );
    }
}

/**
 * Agrupa produtos sob suas categorias.
 *
 * Produto cuja categoria sumiu cai num balde "Sem categoria" em vez de
 * desaparecer: não deveria acontecer (a FK cascateia), mas se acontecer é
 * melhor o gestor ver e consertar do que o item evaporar em silêncio.
 */
function agruparEmSecoes(categorias, produtos) {
    const porCategoria = new Map();
    for (const p of produtos) {
        if (!porCategoria.has(p.id_produto_categoria)) porCategoria.set(p.id_produto_categoria, []);
        porCategoria.get(p.id_produto_categoria).push(p);
    }

    const secoes = categorias.map((c) => ({ ...c, produtos: porCategoria.get(c.id_produto_categoria) ?? [] }));

    const conhecidas = new Set(categorias.map((c) => c.id_produto_categoria));
    const orfaos = produtos.filter((p) => !conhecidas.has(p.id_produto_categoria));

    return orfaos.length
        ? [...secoes, { id_produto_categoria: null, categoria: 'Sem categoria', ordem: 9999, produtos: orfaos }]
        : secoes;
}

export { validarDadosDoProduto, garantirPodeAlternarDisponibilidade, garantirCategoriaVazia, agruparEmSecoes };
