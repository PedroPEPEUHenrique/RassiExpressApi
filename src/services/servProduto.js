import repoProduto from "../repositories/repoProduto.js"
import repoProdutoCategoria from "../repositories/repoProdutoCategoria.js"

/**
 * Carrega o produto e confirma que ele pertence ao restaurante do token.
 *
 * Sem esta checagem, id de produto é sequencial e adivinhável: bastaria
 * incrementar o número na URL para ler, alterar ou apagar item do cardápio de
 * outro restaurante. O 404 (em vez de 403) é deliberado — não confirma a
 * existência do produto para quem não é dono dele.
 */
async function buscarDaEmpresa(idProduto, idEmpresa) {
    const produto = await repoProduto.ListarPorId(idProduto);
    if (!produto || produto.id_empresa !== Number(idEmpresa)) {
        throw { status: 404, mensagem: "Produto não encontrado" };
    }
    return produto;
}

async function garantirCategoriaDaEmpresa(idProdutoCategoria, idEmpresa) {
    const categoria = await repoProdutoCategoria.ListarPorId(idProdutoCategoria);
    if (!categoria || categoria.id_empresa !== Number(idEmpresa)) {
        throw { status: 404, mensagem: "Categoria de produto não encontrada" };
    }
    return categoria;
}

async function ListarPorEmpresa(idEmpresa) {
    return await repoProduto.ListarPorEmpresa(idEmpresa);
}

async function ListarPorCategoria(idProdutoCategoria, idEmpresa) {
    await garantirCategoriaDaEmpresa(idProdutoCategoria, idEmpresa);
    return await repoProduto.ListarPorCategoria(idProdutoCategoria);
}

async function ListarPorId(idProduto, idEmpresa) {
    return await buscarDaEmpresa(idProduto, idEmpresa);
}

async function Criar(produto, idEmpresa) {
    if (!produto.nome) throw { status: 400, mensagem: "Nome é obrigatório" };
    if (produto.valor === undefined) throw { status: 400, mensagem: "Valor é obrigatório" };
    if (!produto.idProdutoCategoria) throw { status: 400, mensagem: "Categoria é obrigatória" };

    await garantirCategoriaDaEmpresa(produto.idProdutoCategoria, idEmpresa);

    // idEmpresa vem do token, não do corpo: era por aqui que um gestor podia
    // cadastrar produto no cardápio de outro restaurante.
    const idProduto = await repoProduto.Criar({ ...produto, idEmpresa });
    return { idProduto, ...produto, idEmpresa };
}

async function Atualizar(idProduto, produto, idEmpresa) {
    const atual = await buscarDaEmpresa(idProduto, idEmpresa);

    if (produto.idProdutoCategoria) {
        await garantirCategoriaDaEmpresa(produto.idProdutoCategoria, idEmpresa);
    }

    // Campo ausente mantém o valor atual: o PUT do repositório sobrescreve a
    // linha inteira e apagaria o que o app não enviou.
    const atualizado = {
        idProdutoCategoria: produto.idProdutoCategoria ?? atual.id_produto_categoria,
        nome: produto.nome ?? atual.nome,
        descricao: produto.descricao ?? atual.descricao,
        icone: produto.icone ?? atual.icone,
        valor: produto.valor ?? atual.valor,
        ativo: produto.ativo ?? atual.ativo,
    };

    const changes = await repoProduto.Atualizar(idProduto, atualizado);
    if (!changes) throw { status: 404, mensagem: "Produto não encontrado" };
    return { idProduto: Number(idProduto), ...atualizado };
}

async function Deletar(idProduto, idEmpresa) {
    await buscarDaEmpresa(idProduto, idEmpresa);
    const changes = await repoProduto.Deletar(idProduto);
    if (!changes) throw { status: 404, mensagem: "Produto não encontrado" };
}

export default { ListarPorEmpresa, ListarPorCategoria, ListarPorId, Criar, Atualizar, Deletar };
