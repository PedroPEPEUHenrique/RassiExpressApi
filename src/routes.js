import { Router } from "express";

const router = Router();

router.get('/teste', (req, res) => {
  res.status(401).json({mensagem: "Senha ou e-mail inválidos"});
})

export default router;