import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Hasher, EmissorDeToken } from '../../contextos/acesso/aplicacao/portas.js';
import { NaoAutenticado } from '../../compartilhado/dominio/erros.js';

const SALT_ROUNDS = 10;

/**
 * Adaptadores de segurança.
 *
 * O caso de uso de login depende das portas Hasher e EmissorDeToken, não de
 * bcrypt e jsonwebtoken. Trocar o algoritmo de hash ou migrar de JWT para
 * sessão opaca é substituir estas duas classes no container — nenhuma regra
 * muda.
 */

class HasherBcrypt extends Hasher {
  async gerar(senha) { return await bcrypt.hash(senha, SALT_ROUNDS); }
  async conferir(senha, hash) { return await bcrypt.compare(senha, hash); }
}

class EmissorDeTokenJWT extends EmissorDeToken {
  constructor({ segredo, expiraEm }) {
    super();
    this.segredo = segredo;
    this.expiraEm = expiraEm ?? '7d';
  }

  emitir(conteudo) {
    return jwt.sign(conteudo, this.segredo, { expiresIn: this.expiraEm });
  }

  ler(token) {
    try {
      return jwt.verify(token, this.segredo);
    } catch {
      throw new NaoAutenticado('Token inválido ou expirado');
    }
  }
}

export { HasherBcrypt, EmissorDeTokenJWT };
