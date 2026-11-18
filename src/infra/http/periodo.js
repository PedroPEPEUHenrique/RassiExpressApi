/**
 * Converte ?de=&ate= em um intervalo [início, fim) para as consultas.
 *
 * O fim é exclusivo e avança um dia: `ate=2026-11-14` precisa incluir tudo o
 * que aconteceu naquele dia, e `dt <= '2026-11-14'` deixaria de fora as vendas
 * a partir de 00:00:01 — ou seja, o dia inteiro. Com `dt < '2026-11-15'` a
 * borda fica correta sem depender de hora.
 *
 * Sem parâmetros, devolve o dia de hoje: é o recorte que o gestor abre o app
 * para ver.
 */
function resolverPeriodo({ de, ate } = {}) {
    const hoje = new Date();
    const iso = (d) => d.toISOString().slice(0, 10);

    const inicio = ehDataValida(de) ? de : iso(hoje);
    const fimInformado = ehDataValida(ate) ? ate : inicio;

    if (fimInformado < inicio) {
        throw { status: 400, mensagem: "A data final não pode ser anterior à inicial" };
    }

    const limite = new Date(`${fimInformado}T00:00:00Z`);
    limite.setUTCDate(limite.getUTCDate() + 1);

    return { de: `${inicio} 00:00:00`, ate: `${iso(limite)} 00:00:00`, rotulo: { de: inicio, ate: fimInformado } };
}

function ehDataValida(valor) {
    if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
    const d = new Date(`${valor}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === valor;
}

export { resolverPeriodo, ehDataValida };
