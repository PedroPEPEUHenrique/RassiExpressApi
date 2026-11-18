import { CasoDeUso } from '../../../compartilhado/aplicacao/CasoDeUso.js';
import { Conflito, NaoEncontrado } from '../../../compartilhado/dominio/erros.js';

async function mesaDaEmpresa(repoMesa, idMesa, idEmpresa) {
    const mesa = await repoMesa.porId(idMesa);
    if (!mesa || mesa.id_empresa !== Number(idEmpresa)) throw new NaoEncontrado('Mesa não encontrada');
    return mesa;
}

class VerSalao extends CasoDeUso {
    constructor({ repoMesa }) { super(); this.repoMesa = repoMesa; }

    /**
     * O mapa do salão: cada mesa com a comanda aberta, se houver.
     *
     * `ocupada` é derivado da existência da comanda, não lido de uma coluna —
     * é a razão de MESA não ter campo de status. Guardar isso criaria um
     * segundo lugar para a mesma verdade, que diverge na primeira falha entre
     * os dois UPDATEs.
     */
    async executar({ idEmpresa }) {
        const mesas = await this.repoMesa.listarComEstado(idEmpresa);
        return mesas.map((m) => ({
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
}

class CriarMesa extends CasoDeUso {
    constructor({ repoMesa }) { super(); this.repoMesa = repoMesa; }
    async executar({ numero, setor, capacidade, idEmpresa }) {
        try {
            const idMesa = await this.repoMesa.criar({ idEmpresa, numero, setor, capacidade });
            return { idMesa, numero, setor, capacidade };
        } catch (erro) {
            if (erro.duplicado) throw new Conflito(`Já existe a mesa ${numero} neste restaurante`);
            throw erro;
        }
    }
}

class AtualizarMesa extends CasoDeUso {
    constructor({ repoMesa }) { super(); this.repoMesa = repoMesa; }
    async executar({ idMesa, numero, setor, capacidade, idEmpresa }) {
        const atual = await mesaDaEmpresa(this.repoMesa, idMesa, idEmpresa);
        // Campo ausente mantém o valor atual: o UPDATE reescreve a linha e
        // apagaria o que o app não enviou.
        const atualizado = {
            numero: numero ?? atual.numero,
            setor: setor ?? atual.setor,
            capacidade: capacidade ?? atual.capacidade,
        };
        try {
            const mudou = await this.repoMesa.atualizar(idMesa, atualizado);
            if (!mudou) throw new NaoEncontrado('Mesa não encontrada');
            return { idMesa: Number(idMesa), ...atualizado };
        } catch (erro) {
            if (erro.duplicado) throw new Conflito(`Já existe a mesa ${atualizado.numero} neste restaurante`);
            throw erro;
        }
    }
}

class DesativarMesa extends CasoDeUso {
    constructor({ repoMesa, repoComanda }) { super(); this.repoMesa = repoMesa; this.repoComanda = repoComanda; }

    /**
     * Mesa com comanda aberta não sai: o salão perderia a conta de vista e ela
     * ficaria aberta para sempre, sem tela que a alcance.
     */
    async executar({ idMesa, idEmpresa }) {
        await mesaDaEmpresa(this.repoMesa, idMesa, idEmpresa);
        const aberta = await this.repoComanda.abertaPorMesa(idMesa);
        if (aberta) throw new Conflito('Feche a comanda desta mesa antes de removê-la');

        const mudou = await this.repoMesa.desativar(idMesa);
        if (!mudou) throw new NaoEncontrado('Mesa não encontrada');
    }
}

export { VerSalao, CriarMesa, AtualizarMesa, DesativarMesa };
