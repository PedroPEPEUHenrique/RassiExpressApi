import { Router } from "express";
import controllerCategoria from "./controllers/controlCategoria.js"

const router = Router();

router.get('/teste', (req, res) => {
  res.status(200).json({mensagem: "Senha ou e-mail inválidos"});
})

router.get("/categorias", controllerCategoria.Listar)

export default router;