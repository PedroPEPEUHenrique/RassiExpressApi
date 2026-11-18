import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Guarda automática da regra de dependência.
 *
 * Clean Architecture só vale enquanto a seta aponta para dentro, e nada no
 * JavaScript impede alguém de importar o driver do MySQL dentro de uma regra
 * de negócio. Este script é o que transforma a convenção em verificação:
 * roda em `npm run arquitetura` e falha o processo se a seta inverter.
 *
 * Só olha declarações de import de verdade — a primeira versão usava grep e
 * acusou a palavra "infra/" dentro de um comentário.
 */

// fileURLToPath, não `.pathname`: o caminho deste projeto tem acento, e a URL
// devolve "Área" como "%C3%81rea", que o sistema de arquivos não encontra.
const RAIZ = fileURLToPath(new URL('../src', import.meta.url));
const FRAMEWORKS = ['express', 'mysql2', 'bcryptjs', 'jsonwebtoken', 'joi', 'cors', 'express-rate-limit'];

const REGRAS = [
    {
        nome: 'Domínio não conhece framework',
        alvo: (c) => /[\\/]dominio[\\/]/.test(c),
        proibido: (imp) => FRAMEWORKS.includes(imp),
    },
    {
        nome: 'Domínio não conhece aplicação nem infraestrutura',
        alvo: (c) => /[\\/]dominio[\\/]/.test(c),
        proibido: (imp) => /(^|\/)(aplicacao|infra|main)\//.test(imp),
    },
    {
        nome: 'Aplicação não conhece framework',
        alvo: (c) => /[\\/]aplicacao[\\/]/.test(c),
        proibido: (imp) => FRAMEWORKS.includes(imp),
    },
    {
        nome: 'Aplicação não conhece infraestrutura',
        alvo: (c) => /[\\/]aplicacao[\\/]/.test(c),
        proibido: (imp) => /(^|\/)(infra|main)\//.test(imp),
    },
    {
        nome: 'Contexto não alcança o interior de outro contexto',
        alvo: (c) => /contextos[\\/]/.test(c) && !/[\\/]main[\\/]/.test(c),
        proibido: (imp, caminho) => {
            const m = imp.match(/contextos\/([a-z]+)\/(dominio|infra)\//);
            if (!m) return false;
            // Importar o próprio interior é legítimo.
            return !caminho.includes(`contextos${sep()}${m[1]}${sep()}`);
        },
    },
];

function sep() { return process.platform === 'win32' ? '\\' : '/'; }

function arquivos(dir) {
    return readdirSync(dir).flatMap((nome) => {
        const caminho = join(dir, nome);
        if (statSync(caminho).isDirectory()) return arquivos(caminho);
        return caminho.endsWith('.js') ? [caminho] : [];
    });
}

/** Extrai só os especificadores de import — comentários não contam. */
function importsDe(codigo) {
    const semComentarios = codigo
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:])\/\/.*$/gm, '$1');
    return [...semComentarios.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
}

const violacoes = [];
for (const caminho of arquivos(RAIZ)) {
    const codigo = readFileSync(caminho, 'utf8');
    for (const imp of importsDe(codigo)) {
        for (const regra of REGRAS) {
            if (regra.alvo(caminho) && regra.proibido(imp, caminho)) {
                violacoes.push({ regra: regra.nome, arquivo: relative(RAIZ, caminho), imp });
            }
        }
    }
}

for (const regra of REGRAS) {
    const falhas = violacoes.filter((v) => v.regra === regra.nome);
    console.log(`${falhas.length ? 'FALHOU' : 'PASSOU'}  ${regra.nome}`);
    for (const f of falhas) console.log(`        ${f.arquivo} -> ${f.imp}`);
}

console.log(violacoes.length
    ? `\n${violacoes.length} violação(ões) da regra de dependência.`
    : '\nRegra de dependência respeitada em todo o projeto.');
process.exit(violacoes.length ? 1 : 0);
