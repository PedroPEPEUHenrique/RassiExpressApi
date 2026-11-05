import 'dotenv/config';
import express from 'express'
import cors from "cors"
import router from './routes.js';
import errorHandler from './middleware/errorHandler.js';

// Falha no boot, não na primeira requisição: sem JWT_SECRET o jwt.sign/verify
// quebraria apenas no login, com erro 500 difícil de diagnosticar.
if (!process.env.JWT_SECRET) {
  console.error("JWT_SECRET não definido. Copie .env.example para .env e defina uma chave secreta.");
  process.exit(1);
}

const app = express()

app.use(express.json());
app.use(cors());
app.use(router);

// Rota inexistente também responde no formato de erro padrão da API.
app.use((req, res, next) => next({ status: 404, mensagem: "Rota não encontrada" }));
app.use(errorHandler);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server is running on port: ${PORT}`)
})
