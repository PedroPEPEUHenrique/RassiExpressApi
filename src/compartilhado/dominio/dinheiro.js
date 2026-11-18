/**
 * Aritmética de dinheiro e de quantidade.
 *
 * Centralizado porque o arredondamento espalhado foi fonte real de divergência:
 * a soma das rodadas tinha de bater com o total da comanda ao centavo, e o
 * DECIMAL(10,2) do banco trunca o que chegar com mais casas.
 *
 * Domínio puro — nenhum import.
 */

/** Centavos. Para valores monetários. */
function emCentavos(valor) {
    return Math.round(Number(valor ?? 0) * 100) / 100;
}

/** Milésimos. Para quantidade de insumo, que o banco guarda em DECIMAL(12,3). */
function emMilesimos(valor) {
    return Math.round(Number(valor ?? 0) * 1000) / 1000;
}

/** Soma monetária de uma lista, arredondando só no fim. */
function somar(valores) {
    return emCentavos(valores.reduce((s, v) => s + Number(v ?? 0), 0));
}

/**
 * Divisão que devolve zero em vez de NaN ou Infinity.
 *
 * Ticket médio de quem não atendeu ninguém é zero, não "indefinido" — e um
 * NaN vazando para a tela quebraria o relatório inteiro.
 */
function media(total, quantidade) {
    const n = Number(quantidade ?? 0);
    return n > 0 ? emCentavos(Number(total ?? 0) / n) : 0;
}

export { emCentavos, emMilesimos, somar, media };
