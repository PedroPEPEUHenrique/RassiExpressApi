import repoProduto from "../repositories/repoProduto.js"

async function Listar() {
    return await repoProduto.Listar();
}

async function ListarPorEmpresa(idEmpresa) {
    return await repoProduto.ListarPorEmpresa(idEmpresa);
}

async function ListarPorCategoria(idProdutoCategoria) {
    return await repoProduto.ListarPorCategoria(idProdutoCategoria);
}

async function ListarPorId(idProduto) {
    const produto = await repoProduto.ListarPorId(idProduto);
    if (!produto) throw { status: 404, mensagem: "Produto não encontrado" };
    return produto;
}

async function Criar(produto) {
    if (!produto.nome) throw { status: 400, mensagem: "Nome é obrigatório" };
    if (produto.valor === undefined) throw { status: 400, mensagem: "Valor é obrigatório" };
    const idProduto = await repoProduto.Criar(produto);
    return { idProduto, ...produto };
}

async function Atualizar(idProduto, produto) {
    const changes = await repoProduto.Atualizar(idProduto, produto);
    if (!changes) throw { status: 404, mensagem: "Produto não encontrado" };
    return { idProduto, ...produto };
}

async function Deletar(idProduto) {
    const changes = await repoProduto.Deletar(idProduto);
    if (!changes) throw { status: 404, mensagem: "Produto não encontrado" };
}

export default { Listar, ListarPorEmpresa, ListarPorCategoria, ListarPorId, Criar, Atualizar, Deletar };
