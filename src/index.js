import 'dotenv/config';
import express from 'express'
import cors from "cors"
import router from './routes.js';
import errorHandler from './middleware/errorHandler.js';

const app = express()

app.use(express.json());
app.use(cors());
app.use(router);
app.use(errorHandler);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server is running on port: ${PORT}`)
})