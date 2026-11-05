import repoUserFavorito from "../repositories/repoUserFavorito.js"

async function ListarPorUsuario(idUsuario) {
    return await repoUserFavorito.ListarPorUsuario(idUsuario);
}

async function Criar(favorito) {
    if (!favorito.idUsuario) throw { status: 400, mensagem: "Usuário é obrigatório" };
    if (!favorito.idEmpresa) throw { status: 400, mensagem: "Empresa é obrigatória" };

    const idProduto = favorito.idProduto ?? null;

    // Favoritar é idempotente: repetir a ação devolve o favorito já existente.
    const existente = await repoUserFavorito.BuscarExistente(
        favorito.idUsuario, favorito.idEmpresa, idProduto
    );
    if (existente) return existente;

    const idFavorito = await repoUserFavorito.Criar({ ...favorito, idProduto });
    return await repoUserFavorito.ListarPorId(idFavorito);
}

async function Deletar(idFavorito, idUsuario) {
    const favorito = await repoUserFavorito.ListarPorId(idFavorito);
    if (!favorito) throw { status: 404, mensagem: "Favorito não encontrado" };
    if (favorito.id_usuario !== Number(idUsuario)) {
        throw { status: 403, mensagem: "Acesso negado a favorito de outro usuário" };
    }
    await repoUserFavorito.Deletar(idFavorito);
}

export default { ListarPorUsuario, Criar, Deletar };
