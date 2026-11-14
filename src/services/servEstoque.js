import { withTransaction } from "../database/mysql.js"
import repoEstoque from "../repositories/repoEstoque.js"
import repoProduto from "../repositories/repoProduto.js"

const UNIDADES = ["kg", "g", "l", "ml", "un"];
const LIMITE_MOVIMENTOS = 50;

async function buscarInsumoDaEmpresa(idInsumo, idEmpresa, conn) {
    const insumo = await repoEstoque.ListarInsumoPorId(idInsumo, conn);
    if (!insumo || insumo.id_empresa !== Number(idEmpresa)) {
        throw { status: 404, mensagem: "Insumo não encontrado" };
    }
    return insumo;
}

async function Listar(idEmpresa) {
    const insumos = await repoEstoque.ListarInsumos(idEmpresa);
    return insumos.map(i => ({
        idInsumo: i.id_insumo,
        nome: i.nome,
        unidade: i.unidade,
        qtdAtual: Number(i.qtd_atual),
        qtdMinima: Number(i.qtd_minima),
        vlCustoMedio: Number(i.vl_custo_medio),
        repor: !!Number(i.repor),
    }));
}

async function Criar({ nome, unidade, qtdMinima, vlCustoMedio }, idEmpresa) {
    if (!nome?.trim()) throw { status: 400, mensagem: "O insumo precisa de um nome" };
    if (!UNIDADES.includes(unidade)) {
        throw { status: 400, mensagem: `Unidade inválida. Use uma de: ${UNIDADES.join(", ")}` };
    }
    try {
        const idInsumo = await repoEstoque.CriarInsumo({ idEmpresa, nome: nome.trim(), unidade, qtdMinima, vlCustoMedio });
        return await buscarInsumoDaEmpresa(idInsumo, idEmpresa);
    } catch (erro) {
        if (erro.code === "ER_DUP_ENTRY") {
            throw { status: 409, mensagem: `Já existe o insumo "${nome}" neste restaurante` };
        }
        throw erro;
    }
}

async function Atualizar(idInsumo, dados, idEmpresa) {
    const atual = await buscarInsumoDaEmpresa(idInsumo, idEmpresa);
    const unidade = dados.unidade ?? atual.unidade;
    if (!UNIDADES.includes(unidade)) {
        throw { status: 400, mensagem: `Unidade inválida. Use uma de: ${UNIDADES.join(", ")}` };
    }
    const changes = await repoEstoque.AtualizarInsumo(idInsumo, {
        nome: dados.nome ?? atual.nome,
        unidade,
        qtdMinima: dados.qtdMinima ?? atual.qtd_minima,
    });
    if (!changes) throw { status: 404, mensagem: "Insumo não encontrado" };
    return await buscarInsumoDaEmpresa(idInsumo, idEmpresa);
}

async function Desativar(idInsumo, idEmpresa) {
    await buscarInsumoDaEmpresa(idInsumo, idEmpresa);
    await repoEstoque.DesativarInsumo(idInsumo);
}

/**
 * Entrada, perda ou ajuste manual.
 *
 * Entrada recalcula o custo médio ponderado antes de somar o saldo — a ordem
 * importa, porque a média usa o saldo anterior. Perda e ajuste não mexem no
 * custo: a quantidade mudou, o que cada unidade custou não.
 */
async function Movimentar(idInsumo, { tipo, quantidade, vlUnitario, motivo }, idEmpresa, idFuncionario) {
    const insumo = await buscarInsumoDaEmpresa(idInsumo, idEmpresa);
    const qtd = Number(quantidade);

    if (!["entrada", "perda", "ajuste"].includes(tipo)) {
        throw { status: 400, mensagem: "Tipo deve ser entrada, perda ou ajuste" };
    }
    if (!Number.isFinite(qtd) || qtd <= 0) {
        throw { status: 400, mensagem: "A quantidade deve ser maior que zero" };
    }
    if (tipo === "entrada" && !(Number(vlUnitario) > 0)) {
        throw { status: 400, mensagem: "Informe o custo unitário da entrada" };
    }

    // 'ajuste' define o saldo, não soma: é a contagem física corrigindo o
    // sistema, e somar a diferença exigiria que o gestor calculasse de cabeça.
    const variacao = tipo === "entrada" ? qtd
        : tipo === "perda" ? -qtd
        : qtd - Number(insumo.qtd_atual);

    return await withTransaction(async (conn) => {
        if (tipo === "entrada") {
            await repoEstoque.AtualizarCustoMedio(idInsumo, qtd, Number(vlUnitario), conn);
        }
        await repoEstoque.AjustarSaldo(idInsumo, variacao, conn);
        await repoEstoque.CriarMovimento({
            idEmpresa, idInsumo, tipo,
            quantidade: Math.abs(variacao) || qtd,
            vlUnitario: tipo === "entrada" ? Number(vlUnitario) : Number(insumo.vl_custo_medio),
            idFuncionario, motivo,
        }, conn);
        return await repoEstoque.ListarInsumoPorId(idInsumo, conn);
    });
}

/**
 * Baixa o estoque de uma rodada enviada à cozinha.
 *
 * Chamado de dentro da transação que grava a rodada, com a mesma conexão.
 *
 * Duas decisões importantes:
 *
 * 1. **Produto sem ficha técnica não movimenta nada.** A ficha é opcional por
 *    desenho: um restaurante que ainda não cadastrou receitas usa o sistema
 *    normalmente, e cadastra as fichas aos poucos. Exigir ficha completa
 *    travaria o salão por causa de um cadastro de retaguarda.
 *
 * 2. **Saldo negativo não bloqueia a venda.** O prato já foi pedido pelo
 *    cliente e a cozinha vai prepará-lo de qualquer jeito; recusar a rodada
 *    porque o sistema acha que acabou a farinha pararia o restaurante por um
 *    erro de cadastro. O saldo fica negativo e aparece na tela como sinal de
 *    que a contagem está errada — que é a informação útil.
 */
async function BaixarPorRodada(itens, idPedido, idEmpresa, idFuncionario, conn) {
    const idsProduto = [...new Set(itens.map(i => Number(i.idProduto)))];
    const fichas = await repoEstoque.ListarFichasDeProdutos(idsProduto, conn);
    if (!fichas.length) return { baixas: 0, custo: 0 };

    const porProduto = new Map();
    for (const f of fichas) {
        if (!porProduto.has(f.id_produto)) porProduto.set(f.id_produto, []);
        porProduto.get(f.id_produto).push(f);
    }

    // Soma o consumo por insumo antes de gravar: dois pratos da mesma rodada
    // que usam o mesmo insumo viram um movimento só, em vez de dois.
    const consumo = new Map();
    for (const item of itens) {
        const ficha = porProduto.get(Number(item.idProduto));
        if (!ficha) continue;
        for (const linha of ficha) {
            const total = Number(linha.quantidade) * Number(item.quantidade);
            const atual = consumo.get(linha.id_insumo) ?? { quantidade: 0, custo: Number(linha.vl_custo_medio) };
            atual.quantidade += total;
            consumo.set(linha.id_insumo, atual);
        }
    }

    let custo = 0;
    for (const [idInsumo, dados] of consumo) {
        const qtd = Math.round(dados.quantidade * 1000) / 1000;
        await repoEstoque.AjustarSaldo(idInsumo, -qtd, conn);
        await repoEstoque.CriarMovimento({
            idEmpresa, idInsumo, tipo: "saida_venda",
            quantidade: qtd, vlUnitario: dados.custo,
            idPedido, idFuncionario, motivo: null,
        }, conn);
        custo += qtd * dados.custo;
    }

    return { baixas: consumo.size, custo: Math.round(custo * 10000) / 10000 };
}

// ---------------------------------------------------------------------------
// Ficha técnica
// ---------------------------------------------------------------------------

async function buscarProdutoDaEmpresa(idProduto, idEmpresa) {
    const produto = await repoProduto.ListarPorId(idProduto);
    if (!produto || produto.id_empresa !== Number(idEmpresa)) {
        throw { status: 404, mensagem: "Produto não encontrado" };
    }
    return produto;
}

async function ObterFicha(idProduto, idEmpresa) {
    const produto = await buscarProdutoDaEmpresa(idProduto, idEmpresa);
    const itens = await repoEstoque.ListarFicha(idProduto);

    const custo = itens.reduce((s, i) => s + Number(i.quantidade) * Number(i.vl_custo_medio), 0);
    const preco = Number(produto.valor);

    return {
        idProduto: produto.id_produto,
        nome: produto.nome,
        valor: preco,
        itens: itens.map(i => ({
            idInsumo: i.id_insumo,
            nome: i.nome,
            unidade: i.unidade,
            quantidade: Number(i.quantidade),
            vlCustoMedio: Number(i.vl_custo_medio),
            vlCusto: Math.round(Number(i.quantidade) * Number(i.vl_custo_medio) * 100) / 100,
        })),
        vlCusto: Math.round(custo * 100) / 100,
        // Margem só faz sentido com ficha cadastrada: sem ela o custo é zero e
        // a margem apareceria como 100%, que é mentira e não "sem dados".
        vlMargem: itens.length ? Math.round((preco - custo) * 100) / 100 : null,
        percMargem: itens.length && preco > 0
            ? Math.round(((preco - custo) / preco) * 1000) / 10
            : null,
    };
}

async function SalvarFicha(idProduto, itens, idEmpresa) {
    await buscarProdutoDaEmpresa(idProduto, idEmpresa);
    if (!Array.isArray(itens)) throw { status: 400, mensagem: "Informe os itens da ficha" };

    for (const item of itens) {
        await buscarInsumoDaEmpresa(item.idInsumo, idEmpresa);
        if (!(Number(item.quantidade) > 0)) {
            throw { status: 400, mensagem: "A quantidade de cada insumo deve ser maior que zero" };
        }
    }

    return await withTransaction(async (conn) => {
        for (const item of itens) {
            await repoEstoque.SalvarItemFicha({
                idProduto, idInsumo: item.idInsumo, quantidade: item.quantidade,
            }, conn);
        }
        return true;
    });
}

async function RemoverDaFicha(idProduto, idInsumo, idEmpresa) {
    await buscarProdutoDaEmpresa(idProduto, idEmpresa);
    const changes = await repoEstoque.RemoverItemFicha(idProduto, idInsumo);
    if (!changes) throw { status: 404, mensagem: "Insumo não está na ficha deste produto" };
}

async function Movimentos(idInsumo, idEmpresa) {
    await buscarInsumoDaEmpresa(idInsumo, idEmpresa);
    return await repoEstoque.ListarMovimentos(idInsumo, LIMITE_MOVIMENTOS);
}

export default {
    Listar, Criar, Atualizar, Desativar, Movimentar, Movimentos,
    BaixarPorRodada, ObterFicha, SalvarFicha, RemoverDaFicha, UNIDADES,
};
