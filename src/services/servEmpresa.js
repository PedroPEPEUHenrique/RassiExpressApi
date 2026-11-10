import repoEmpresa from "../repositories/repoEmpresa.js"

/**
 * Dados do restaurante onde a pessoa está operando.
 *
 * Listar(), ListarPorCategoria() e Criar()/Deletar() saíram do serviço:
 *   - listar todos os restaurantes e buscar por tipo de cozinha eram telas de
 *     descoberta do app de delivery, e num app interno só serviriam para
 *     vazar dado de concorrente;
 *   - cadastrar e excluir restaurante é operação de plataforma, não de
 *     gestor. Um gestor que criasse uma empresa ficaria sem vínculo nela, e a
 *     exclusão cascateia para pedidos e cardápio inteiros.
 * Hoje a criação do restaurante e do primeiro gestor é feita pelo seed.
 */
async function ListarPorId(idEmpresa) {
    const empresa = await repoEmpresa.ListarPorId(idEmpresa);
    if (!empresa) throw { status: 404, mensagem: "Restaurante não encontrado" };
    return empresa;
}

async function Atualizar(idEmpresa, empresa) {
    const atual = await ListarPorId(idEmpresa);

    // Campo ausente mantém o valor atual: o UPDATE do repositório reescreve a
    // linha e zeraria o que o app não enviou.
    const atualizado = {
        nome: empresa.nome ?? atual.nome,
        icone: empresa.icone ?? atual.icone,
        taxaEntrega: empresa.taxaEntrega ?? atual.taxa_entrega,
        cep: empresa.cep ?? atual.cep,
        endereco: empresa.endereco ?? atual.endereco,
        numero: empresa.numero ?? atual.numero,
        complemento: empresa.complemento ?? atual.complemento,
        bairro: empresa.bairro ?? atual.bairro,
        cidade: empresa.cidade ?? atual.cidade,
        estado: empresa.estado ?? atual.estado,
        ativo: empresa.ativo ?? atual.ativo,
    };

    const changes = await repoEmpresa.Atualizar(idEmpresa, atualizado);
    if (!changes) throw { status: 404, mensagem: "Restaurante não encontrado" };
    return { idEmpresa: Number(idEmpresa), ...atualizado };
}

export default { ListarPorId, Atualizar };
