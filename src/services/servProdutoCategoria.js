import repoProdutoCategoria from "../repositories/repoProdutoCategoria.js"

async function ListarPorEmpresa(idEmpresa) {
    return await repoProdutoCategoria.ListarPorEmpresa(idEmpresa);
}

async function Criar(produtoCategoria) {
    if (!produtoCategoria.categoria) throw { status: 400, mensagem: "Categoria é obrigatória" };
    const idProdutoCategoria = await repoProdutoCategoria.Criar(produtoCategoria);
    return { idProdutoCategoria, ...produtoCategoria };
}

async function Atualizar(idProdutoCategoria, produtoCategoria) {
    const changes = await repoProdutoCategoria.Atualizar(idProdutoCategoria, produtoCategoria);
    if (!changes) throw { status: 404, mensagem: "Categoria de produto não encontrada" };
    return { idProdutoCategoria, ...produtoCategoria };
}

async function Deletar(idProdutoCategoria) {
    const changes = await repoProdutoCategoria.Deletar(idProdutoCategoria);
    if (!changes) throw { status: 404, mensagem: "Categoria de produto não encontrada" };
}

export default { ListarPorEmpresa, Criar, Atualizar, Deletar };
