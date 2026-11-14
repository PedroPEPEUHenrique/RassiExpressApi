import repoProdutoCategoria from "../repositories/repoProdutoCategoria.js"
import repoProduto from "../repositories/repoProduto.js"

/**
 * O cardápio inteiro, agrupado por categoria, numa requisição.
 *
 * A tela do gestor mostra categorias com seus produtos; pedir os produtos de
 * cada categoria separadamente seria uma ida à rede por seção, e o cardápio
 * é justamente a tela que ele abre e rola de ponta a ponta.
 *
 * Diferente da lista do garçom, inclui o que está em falta e o que saiu do
 * cardápio — sem isso o gestor não teria como trazer nada de volta.
 */
async function Listar(idEmpresa) {
    const [categorias, produtos] = await Promise.all([
        repoProdutoCategoria.ListarPorEmpresa(idEmpresa),
        repoProduto.ListarTodosPorEmpresa(idEmpresa),
    ]);

    const porCategoria = new Map();
    for (const p of produtos) {
        if (!porCategoria.has(p.id_produto_categoria)) porCategoria.set(p.id_produto_categoria, []);
        porCategoria.get(p.id_produto_categoria).push(p);
    }

    const secoes = categorias.map(c => ({
        ...c,
        produtos: porCategoria.get(c.id_produto_categoria) ?? [],
    }));

    // Produto cuja categoria foi apagada ficaria invisível e sem como voltar.
    // Não deveria acontecer (a FK cascateia), mas se acontecer é melhor o
    // gestor ver e poder consertar do que o item sumir em silêncio.
    const idsConhecidos = new Set(categorias.map(c => c.id_produto_categoria));
    const orfaos = produtos.filter(p => !idsConhecidos.has(p.id_produto_categoria));

    return orfaos.length
        ? [...secoes, { id_produto_categoria: null, categoria: "Sem categoria", ordem: 9999, produtos: orfaos }]
        : secoes;
}

export default { Listar };
