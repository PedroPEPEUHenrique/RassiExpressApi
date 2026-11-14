import repoProdutoCategoria from "../repositories/repoProdutoCategoria.js"

// Mesma razão de servProduto: id sequencial é adivinhável, então toda operação
// por id confirma antes que a categoria é do restaurante do token.
async function buscarDaEmpresa(idProdutoCategoria, idEmpresa) {
    const categoria = await repoProdutoCategoria.ListarPorId(idProdutoCategoria);
    if (!categoria || categoria.id_empresa !== Number(idEmpresa)) {
        throw { status: 404, mensagem: "Categoria de produto não encontrada" };
    }
    return categoria;
}

async function ListarPorEmpresa(idEmpresa) {
    return await repoProdutoCategoria.ListarPorEmpresa(idEmpresa);
}

async function Criar(produtoCategoria, idEmpresa) {
    if (!produtoCategoria.categoria) throw { status: 400, mensagem: "Categoria é obrigatória" };

    // idEmpresa do token, não do corpo da requisição.
    const idProdutoCategoria = await repoProdutoCategoria.Criar({ ...produtoCategoria, idEmpresa });
    return { idProdutoCategoria, ...produtoCategoria, idEmpresa };
}

async function Atualizar(idProdutoCategoria, produtoCategoria, idEmpresa) {
    const atual = await buscarDaEmpresa(idProdutoCategoria, idEmpresa);

    const atualizado = {
        categoria: produtoCategoria.categoria ?? atual.categoria,
        ordem: produtoCategoria.ordem ?? atual.ordem,
    };

    const changes = await repoProdutoCategoria.Atualizar(idProdutoCategoria, atualizado);
    if (!changes) throw { status: 404, mensagem: "Categoria de produto não encontrada" };
    return { idProdutoCategoria: Number(idProdutoCategoria), ...atualizado };
}

/**
 * Apaga a categoria — e só se ela estiver vazia.
 *
 * A exclusão é física, e as chaves estrangeiras cascateiam:
 *   PRODUTO_CATEGORIA → PRODUTO → ITENS_PEDIDO
 *
 * Ou seja, apagar uma seção do cardápio apagaria os itens vendidos em
 * comandas já fechadas, deixando os totais históricos sem lastro e
 * destruindo a base dos relatórios. Um toque na tela do gestor não pode ter
 * esse alcance, então a categoria com produtos é recusada: ele move ou
 * desativa os itens antes, de forma consciente.
 */
async function Deletar(idProdutoCategoria, idEmpresa) {
    const categoria = await buscarDaEmpresa(idProdutoCategoria, idEmpresa);

    const produtos = await repoProdutoCategoria.ContarProdutos(idProdutoCategoria);
    if (produtos > 0) {
        throw {
            status: 409,
            mensagem: `"${categoria.categoria}" ainda tem ${produtos} produto(s). Mova-os para outra categoria antes de excluir.`,
            dados: { produtos },
        };
    }

    const changes = await repoProdutoCategoria.Deletar(idProdutoCategoria);
    if (!changes) throw { status: 404, mensagem: "Categoria de produto não encontrada" };
}

export default { ListarPorEmpresa, Criar, Atualizar, Deletar };
