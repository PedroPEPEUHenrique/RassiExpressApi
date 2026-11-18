/**
 * Script de uso único: converte senhas gravadas em texto puro para hash bcrypt.
 *
 * Antes da adoção do bcrypt as senhas eram salvas como texto puro, e o seed não
 * apaga a tabela USUARIO — então contas antigas continuariam em texto puro e
 * não conseguiriam mais fazer login. Registros já hasheados são ignorados
 * (o prefixo "$2" identifica um hash bcrypt), o que torna o script idempotente.
 *
 * Uso: node src/database/hashSenhasExistentes.js
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { execute, pool } from './mysql.js';

const SALT_ROUNDS = 10;

async function migrarSenhas() {
    const usuarios = await execute('SELECT id_usuario, email, senha FROM USUARIO', []);

    let convertidos = 0;
    let ignorados = 0;

    for (const usuario of usuarios) {
        if (usuario.senha?.startsWith('$2')) {
            ignorados++;
            continue;
        }
        const senhaHash = await bcrypt.hash(usuario.senha, SALT_ROUNDS);
        await execute('UPDATE USUARIO SET senha = ? WHERE id_usuario = ?', [senhaHash, usuario.id_usuario]);
        console.log(`  convertido: ${usuario.email}`);
        convertidos++;
    }

    console.log(`\n${convertidos} senha(s) convertida(s), ${ignorados} já em bcrypt.`);
    await pool.end();
}

migrarSenhas().catch((e) => { console.error(e); process.exit(1); });
