import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { execute, pool } from './mysql.js';

// Dois restaurantes de propósito: é o que permite testar o isolamento entre
// empresas. Logando como gestor do Cantina e pedindo /produtos/empresa/2, a
// API deve responder 403 — se responder 200, escopoEmpresa está furado.
const restaurantes = [
  {
    nome: 'Cantina do Rassi',
    endereco: 'Av. T-63', bairro: 'Setor Bueno', cidade: 'Goiânia', estado: 'GO',
    cardapio: [
      {
        categoria: 'Pratos principais', ordem: 1,
        produtos: [
          { nome: 'Filé à parmegiana', descricao: 'Acompanha arroz e fritas', valor: 62.0 },
          { nome: 'Picanha na chapa',  descricao: 'Serve duas pessoas',       valor: 98.0 },
          { nome: 'Risoto de camarão', descricao: 'Arroz arbóreo e camarão',  valor: 74.0 },
        ],
      },
      {
        categoria: 'Entradas', ordem: 2,
        produtos: [
          { nome: 'Bruschetta', descricao: 'Quatro fatias',       valor: 28.0 },
          { nome: 'Bolinho de bacalhau', descricao: 'Seis unidades', valor: 42.0 },
        ],
      },
      {
        categoria: 'Bebidas', ordem: 3,
        produtos: [
          { nome: 'Água mineral 500ml', descricao: 'Com ou sem gás', valor: 6.0 },
          { nome: 'Refrigerante lata',  descricao: '350ml',          valor: 8.0 },
          { nome: 'Suco natural',       descricao: 'Laranja ou abacaxi', valor: 14.0 },
        ],
      },
    ],
  },
  {
    nome: 'Esquina Mineira',
    endereco: 'Rua 9', bairro: 'Setor Oeste', cidade: 'Goiânia', estado: 'GO',
    cardapio: [
      {
        categoria: 'Pratos principais', ordem: 1,
        produtos: [
          { nome: 'Feijoada completa', descricao: 'Sábados e domingos', valor: 58.0 },
          { nome: 'Frango com quiabo', descricao: 'Acompanha angu',     valor: 49.0 },
        ],
      },
    ],
  },
];

// O índice aponta para a posição em `restaurantes`. A senha é a mesma nos três
// porque é dado de desenvolvimento; em produção cada um define a sua.
const equipe = [
  { nome: 'Ana Gestora',   email: 'gestor@rassi.com',   senha: 'gestor123',  papel: 'gestor',  restaurante: 0 },
  { nome: 'Bruno Garçom',  email: 'garcom@rassi.com',   senha: 'garcom123',  papel: 'garcom',  restaurante: 0 },
  { nome: 'Carla Cozinha', email: 'cozinha@rassi.com',  senha: 'cozinha123', papel: 'cozinha', restaurante: 0 },
  { nome: 'Davi Gestor',   email: 'gestor2@rassi.com',  senha: 'gestor123',  papel: 'gestor',  restaurante: 1 },
];

async function seed() {
  console.log('Limpando dados anteriores...');
  await execute('SET FOREIGN_KEY_CHECKS = 0', []);
  for (const t of ['MOVIMENTO_ESTOQUE', 'FICHA_TECNICA', 'INSUMO', 'MOVIMENTO_CAIXA', 'CAIXA',
                   'ITENS_PEDIDO', 'PEDIDO', 'COMANDA', 'MESA', 'USER_FAVORITO', 'DESTAQUE',
                   'BANNER', 'FUNCIONARIO', 'PRODUTO', 'PRODUTO_CATEGORIA', 'EMPRESA_CATEGORIA',
                   'EMPRESA', 'CATEGORIAS']) {
    await execute(`DELETE FROM ${t}`, []);
    await execute(`ALTER TABLE ${t} AUTO_INCREMENT = 1`, []);
  }
  await execute('SET FOREIGN_KEY_CHECKS = 1', []);

  console.log('Inserindo restaurantes e cardápios...');
  const idsRestaurante = [];
  for (const r of restaurantes) {
    const emp = await execute(
      `INSERT INTO EMPRESA (nome, icone, taxa_entrega, endereco, bairro, cidade, estado, ativo, dt_cadastro)
       VALUES (?, NULL, 0, ?, ?, ?, ?, 1, NOW())`,
      [r.nome, r.endereco, r.bairro, r.cidade, r.estado],
      'run'
    );
    const idEmpresa = emp.lastID;
    idsRestaurante.push(idEmpresa);

    for (const cat of r.cardapio) {
      const pc = await execute(
        'INSERT INTO PRODUTO_CATEGORIA (id_empresa, categoria, ordem) VALUES (?, ?, ?)',
        [idEmpresa, cat.categoria, cat.ordem],
        'run'
      );
      for (const p of cat.produtos) {
        await execute(
          `INSERT INTO PRODUTO (id_empresa, id_produto_categoria, nome, descricao, icone, valor, ativo)
           VALUES (?, ?, ?, ?, NULL, ?, 1)`,
          [idEmpresa, pc.lastID, p.nome, p.descricao, p.valor]
        );
      }
    }
  }

  // USUARIO não entra na limpeza acima para não derrubar contas reais de
  // teste, então a inserção é idempotente pela chave única do e-mail. O
  // id_usuario vem de um SELECT porque insertId não é confiável depois de um
  // ON DUPLICATE KEY que caiu no caminho do update.
  console.log('Inserindo equipe...');
  for (const f of equipe) {
    const senhaHash = await bcrypt.hash(f.senha, 10);
    await execute(
      `INSERT INTO USUARIO (nome, email, senha, cidade, estado, dt_cadastro)
       VALUES (?, ?, ?, 'Goiânia', 'GO', NOW())
       ON DUPLICATE KEY UPDATE nome = VALUES(nome), senha = VALUES(senha)`,
      [f.nome, f.email, senhaHash]
    );
    const usuario = await execute('SELECT id_usuario FROM USUARIO WHERE email = ?', [f.email], 'get');
    await execute(
      'INSERT INTO FUNCIONARIO (id_usuario, id_empresa, papel, ativo, dt_admissao) VALUES (?, ?, ?, 1, NOW())',
      [usuario.id_usuario, idsRestaurante[f.restaurante], f.papel]
    );
  }

  // Salão do primeiro restaurante: 8 mesas no salão e 2 na varanda. O segundo
  // fica com 3, o bastante para checar que um restaurante não enxerga a mesa
  // do outro.
  console.log('Montando o salão...');
  const salao = [
    { restaurante: 0, mesas: [...Array(8)].map((_, i) => ({ numero: String(i + 1), setor: 'Salão', capacidade: i < 4 ? 2 : 4 })) },
    { restaurante: 0, mesas: [{ numero: '9', setor: 'Varanda', capacidade: 6 }, { numero: '10', setor: 'Varanda', capacidade: 6 }] },
    { restaurante: 1, mesas: [...Array(3)].map((_, i) => ({ numero: String(i + 1), setor: 'Salão', capacidade: 4 })) },
  ];
  let totalMesas = 0;
  for (const grupo of salao) {
    for (const m of grupo.mesas) {
      await execute(
        'INSERT INTO MESA (id_empresa, numero, setor, capacidade, ativo) VALUES (?, ?, ?, ?, 1)',
        [idsRestaurante[grupo.restaurante], m.numero, m.setor, m.capacidade]
      );
      totalMesas++;
    }
  }

  // Um item em falta já de saída, para a diferença entre "fora do cardápio" e
  // "acabou hoje" ficar visível no primeiro login do gestor.
  await execute(
    'UPDATE PRODUTO SET disponivel = 0 WHERE nome = ? AND id_empresa = ?',
    ['Risoto de camarão', idsRestaurante[0]]
  );

  console.log(`\nSeed concluído. ${totalMesas} mesas criadas.`);
  console.log('Logins de teste:');
  for (const f of equipe) {
    console.log(`  ${f.papel.padEnd(8)} ${f.email.padEnd(20)} ${f.senha.padEnd(11)} → ${restaurantes[f.restaurante].nome}`);
  }
  await pool.end();
}

seed().catch((e) => { console.error(e); process.exit(1); });
