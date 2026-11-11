import repoMesa from "../repositories/repoMesa.js"
import repoComanda from "../repositories/repoComanda.js"

async function buscarDaEmpresa(idMesa, idEmpresa) {
    const mesa = await repoMesa.ListarPorId(idMesa);
    if (!mesa || mesa.id_empresa !== Number(idEmpresa)) {
        throw { status: 404, mensagem: "Mesa não encontrada" };
    }
    return mesa;
}

/**
 * O mapa do salão: cada mesa com a comanda aberta, se houver.
 *
 * `ocupada` é derivado da existência da comanda, não lido de uma coluna — é a
 * razão de MESA não ter campo de status.
 */
async function ListarSalao(idEmpresa) {
    const mesas = await repoMesa.ListarComEstado(idEmpresa);
    return mesas.map(m => ({
        idMesa: m.id_mesa,
        numero: m.numero,
        setor: m.setor,
        capacidade: m.capacidade,
        ocupada: m.id_comanda !== null,
        idComanda: m.id_comanda,
        dtAbertura: m.dt_abertura,
        vlTotal: m.vl_total,
        nomeGarcom: m.nome_garcom,
    }));
}

async function Criar(mesa, idEmpresa) {
    try {
        const idMesa = await repoMesa.Criar({ ...mesa, idEmpresa });
        return { idMesa, ...mesa };
    } catch (erro) {
        if (erro.code === "ER_DUP_ENTRY") {
            throw { status: 409, mensagem: `Já existe a mesa ${mesa.numero} neste restaurante` };
        }
        throw erro;
    }
}

async function Atualizar(idMesa, mesa, idEmpresa) {
    const atual = await buscarDaEmpresa(idMesa, idEmpresa);
    const atualizado = {
        numero: mesa.numero ?? atual.numero,
        setor: mesa.setor ?? atual.setor,
        capacidade: mesa.capacidade ?? atual.capacidade,
    };
    try {
        const changes = await repoMesa.Atualizar(idMesa, atualizado);
        if (!changes) throw { status: 404, mensagem: "Mesa não encontrada" };
        return { idMesa: Number(idMesa), ...atualizado };
    } catch (erro) {
        if (erro.code === "ER_DUP_ENTRY") {
            throw { status: 409, mensagem: `Já existe a mesa ${atualizado.numero} neste restaurante` };
        }
        throw erro;
    }
}

/**
 * Remove a mesa do salão.
 *
 * Mesa com comanda aberta não sai: o salão perderia a conta de vista e ela
 * ficaria aberta para sempre, sem tela que a alcance.
 */
async function Desativar(idMesa, idEmpresa) {
    await buscarDaEmpresa(idMesa, idEmpresa);

    const aberta = await repoComanda.ListarAbertaPorMesa(idMesa);
    if (aberta) {
        throw { status: 409, mensagem: "Feche a comanda desta mesa antes de removê-la" };
    }

    const changes = await repoMesa.Desativar(idMesa);
    if (!changes) throw { status: 404, mensagem: "Mesa não encontrada" };
}

export default { ListarSalao, Criar, Atualizar, Desativar };
