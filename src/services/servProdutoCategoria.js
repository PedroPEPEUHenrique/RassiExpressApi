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

async function Deletar(idProdutoCategoria, idEmpresa) {
    await buscarDaEmpresa(idProdutoCategoria, idEmpresa);
    const changes = await repoProdutoCategoria.Deletar(idProdutoCategoria);
    if (!changes) throw { status: 404, mensagem: "Categoria de produto não encontrada" };
}

export default { ListarPorEmpresa, Criar, Atualizar, Deletar };
