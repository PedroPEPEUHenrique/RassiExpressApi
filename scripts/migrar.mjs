import 'dotenv/config';
import { migrar, status, adotar } from '../src/infra/persistencia/migrador.js';

/**
 * CLI das migrations.
 *
 *   npm run migrar             aplica o que falta
 *   npm run migrar:status      mostra o estado sem alterar nada
 *   npm run migrar:adotar      registra o estado de um banco feito à mão
 *   npm run migrar:verificar   prova que a sequência reproduz o banco atual
 */
const comando = process.argv[2] ?? 'aplicar';

try {
  if (comando === 'status') {
    const linhas = await status();
    for (const l of linhas) {
      const marca = l.alterada ? 'ALTERADA' : l.aplicada ? 'aplicada' : 'PENDENTE';
      console.log(`  ${marca.padEnd(9)} ${l.nome}`);
    }
    const pendentes = linhas.filter((l) => !l.aplicada).length;
    const alteradas = linhas.filter((l) => l.alterada).length;
    console.log(`\n${linhas.length} migration(s): ${linhas.length - pendentes} aplicada(s), ${pendentes} pendente(s).`);
    if (alteradas) {
      console.error(`${alteradas} migration(s) já aplicada(s) foram editadas — rode npm run migrar para ver o detalhe.`);
      process.exit(1);
    }
  } else if (comando === 'adotar') {
    const nomes = await adotar();
    console.log(`${nomes.length} migration(s) registradas como já aplicadas.`);
    console.log('O banco existia antes do runner; a estrutura atual dele vira o ponto de partida.');
  } else {
    await migrar();
  }
} catch (erro) {
  console.error('\n' + erro.message);
  process.exit(1);
}
