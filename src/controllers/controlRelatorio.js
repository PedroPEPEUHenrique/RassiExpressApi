import servRelatorio from "../services/servRelatorio.js";
import asyncHandler from "../middleware/asyncHandler.js";
import { resolverPeriodo } from "../utils/periodo.js";

const Painel = asyncHandler(async (req, res) => {
    const periodo = resolverPeriodo(req.query);
    const painel = await servRelatorio.Painel(req.usuario.idEmpresa, periodo.de, periodo.ate);
    res.status(200).json({ periodo: periodo.rotulo, ...painel });
});

export default { Painel };
