import repoRelatorio from "../repositories/repoRelatorio.js"
import repoFuncionario from "../repositories/repoFuncionario.js"

const LIMITE_MAIS_VENDIDOS = 10;

/**
 * Painel do gestor para um período.
 *
 * Uma chamada só: o gestor abre a tela para ver o dia, e cinco requisições em
 * sequência deixariam a tela montando aos pedaços. As consultas correm em
 * paralelo porque nenhuma depende da outra.
 */
async function Painel(idEmpresa, de, ate) {
    const [resumo, porDia, maisVendidos, porHora, canceladas, equipe] = await Promise.all([
        repoRelatorio.Resumo(idEmpresa, de, ate),
        repoRelatorio.PorDia(idEmpresa, de, ate),
        repoRelatorio.MaisVendidos(idEmpresa, de, ate, LIMITE_MAIS_VENDIDOS),
        repoRelatorio.PorHora(idEmpresa, de, ate),
        repoRelatorio.ComandasCanceladas(idEmpresa, de, ate),
        repoFuncionario.Desempenho(idEmpresa, de, ate),
    ]);

    return {
        resumo: {
            comandas: Number(resumo?.comandas ?? 0),
            faturamento: arredondar(resumo?.faturamento),
            ticketMedio: arredondar(resumo?.ticket_medio),
            rodadasCanceladas: canceladas,
        },
        porDia: porDia.map(d => ({
            dia: typeof d.dia === "string" ? d.dia : new Date(d.dia).toISOString().slice(0, 10),
            comandas: Number(d.comandas),
            faturamento: arredondar(d.faturamento),
        })),
        maisVendidos: maisVendidos.map(p => ({
            nome: p.nome_produto ?? "(sem nome)",
            quantidade: Number(p.quantidade),
            faturamento: arredondar(p.faturamento),
        })),
        porHora: porHora.map(h => ({
            hora: Number(h.hora),
            comandas: Number(h.comandas),
            faturamento: arredondar(h.faturamento),
        })),
        // Só quem vendeu algo entra no ranking da tela de relatórios; a lista
        // completa da equipe, com zeros, é assunto da tela de Equipe.
        equipe: equipe
            .filter(f => Number(f.vl_total) > 0)
            .map(f => ({
                idFuncionario: f.id_funcionario,
                nome: f.nome,
                papel: f.papel,
                comandas: Number(f.comandas),
                faturamento: arredondar(f.vl_total),
            })),
    };
}

// DECIMAL do MySQL chega como número por causa de decimalNumbers no pool, mas
// AVG e SUM podem trazer casas extras. Arredondar aqui mantém a API devolvendo
// centavos em vez de dízimas.
function arredondar(valor) {
    return Math.round(Number(valor ?? 0) * 100) / 100;
}

export default { Painel };
