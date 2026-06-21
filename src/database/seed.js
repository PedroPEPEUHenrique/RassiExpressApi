import 'dotenv/config';
import { execute, pool } from './mysql.js';

const categorias = [
  { nome: 'BURGUER', emoji: '🍔', ordem: 1 },
  { nome: 'PIZZA',   emoji: '🍕', ordem: 2 },
  { nome: 'FRITAS',  emoji: '🍟', ordem: 3 },
  { nome: 'DOCES',   emoji: '🍬', ordem: 4 },
  { nome: 'SORVETE', emoji: '🍦', ordem: 5 },
];

const empresas = [
  {
    nome: 'Suxi Kei Maboka', icone: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=400',
    taxaEntrega: 8.0, endereco: 'Av. T4', bairro: 'Serrinha', cidade: 'Goiânia', estado: 'GO',
    categorias: [],
    produtoCategoria: 'Sushis',
    produtos: [
      { nome: 'Combo Sushi 20 peças', descricao: 'Variedade de sushis frescos', valor: 59.9, icone: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=300' },
      { nome: 'Temaki Salmão',        descricao: 'Temaki recheado de salmão',   valor: 24.9, icone: 'https://images.unsplash.com/photo-1617196034183-421b4040ed20?w=300' },
      { nome: 'Uramaki Especial',     descricao: '8 peças com cream cheese',    valor: 32.9, icone: 'https://images.unsplash.com/photo-1617196034234-ac2ef8ccd7d1?w=300' },
    ],
  },
  {
    nome: 'Comida da Mamãe Gansa', icone: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400',
    taxaEntrega: 6.0, endereco: 'Av. T63', bairro: 'Setor Bueno', cidade: 'Goiânia', estado: 'GO',
    categorias: [],
    produtoCategoria: 'Pratos',
    produtos: [
      { nome: 'Prato do Dia',  descricao: 'Arroz, feijão, bife e salada', valor: 28.9, icone: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=300' },
      { nome: 'Frango Assado', descricao: 'Frango temperado na hora',     valor: 34.9, icone: 'https://images.unsplash.com/photo-1598103442097-8b74394b95c3?w=300' },
    ],
  },
  {
    nome: 'Chicorito', icone: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=400',
    taxaEntrega: 7.0, endereco: 'Avenida 110', bairro: 'Morada do Sol', cidade: 'Goiânia', estado: 'GO',
    categorias: [],
    produtoCategoria: 'Mexicanos',
    produtos: [
      { nome: 'Burrito Frango', descricao: 'Tortilla recheada com frango',  valor: 29.9, icone: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=300' },
      { nome: 'Nachos Especial', descricao: 'Com guacamole e cheddar',      valor: 22.9, icone: 'https://images.unsplash.com/photo-1513456852971-30c0b8199d4d?w=300' },
    ],
  },
  {
    nome: 'Subway', icone: 'https://images.unsplash.com/photo-1509722747041-616f39b57569?w=400',
    taxaEntrega: 5.0, endereco: 'Av. Rio Verde', bairro: 'Vera Cruz', cidade: 'Goiânia', estado: 'GO',
    categorias: [],
    produtoCategoria: 'Subs',
    produtos: [
      { nome: 'Footlong 30 cm',   descricao: 'Sub de 30 no preço de 15', valor: 22.9, icone: 'https://images.unsplash.com/photo-1509722747041-616f39b57569?w=300' },
      { nome: 'Dobro de Queijo',  descricao: 'Sub com dobro de queijo',  valor: 26.9, icone: 'https://images.unsplash.com/photo-1509722747041-616f39b57569?w=300' },
      { nome: '2 por 27,90',      descricao: '2 subs clássicos',         valor: 27.9, icone: 'https://images.unsplash.com/photo-1509722747041-616f39b57569?w=300' },
    ],
  },
  {
    nome: "McDonald's", icone: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400',
    taxaEntrega: 4.0, endereco: 'Av. Rio Verde', bairro: 'Jardim Américas', cidade: 'Goiânia', estado: 'GO',
    categorias: ['BURGUER', 'FRITAS', 'SORVETE'],
    produtoCategoria: 'Lanches',
    produtos: [
      { nome: 'Big Mac',        descricao: 'O clássico hambúrguer duplo', valor: 29.9, icone: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=300' },
      { nome: 'McFritas Grande', descricao: 'Batata frita crocante',      valor: 12.9, icone: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=300' },
      { nome: 'McFlurry Oreo',  descricao: 'Sorvete com pedaços de Oreo', valor: 14.9, icone: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=300' },
    ],
  },
  {
    nome: 'Burger King', icone: 'https://images.unsplash.com/photo-1561758033-d89a9ad46330?w=400',
    taxaEntrega: 4.0, endereco: 'Av. Olinda', bairro: 'Jardim Goiás', cidade: 'Goiânia', estado: 'GO',
    categorias: ['BURGUER', 'FRITAS'],
    produtoCategoria: 'Lanches',
    produtos: [
      { nome: 'Whopper',      descricao: 'O famoso hambúrguer grelhado', valor: 32.9, icone: 'https://images.unsplash.com/photo-1586816001966-79b736744398?w=300' },
      { nome: 'Onion Rings',  descricao: 'Anéis de cebola crocantes',   valor: 14.9, icone: 'https://images.unsplash.com/photo-1624806992066-5ffcf7ca186b?w=300' },
    ],
  },
];

async function seed() {
  console.log('Limpando dados anteriores...');
  await execute('SET FOREIGN_KEY_CHECKS = 0', []);
  for (const t of ['ITENS_PEDIDO','PEDIDO','USER_FAVORITO','DESTAQUE','BANNER','PRODUTO','PRODUTO_CATEGORIA','EMPRESA_CATEGORIA','EMPRESA','CATEGORIAS']) {
    await execute(`DELETE FROM ${t}`, []);
    await execute(`ALTER TABLE ${t} AUTO_INCREMENT = 1`, []);
  }
  await execute('SET FOREIGN_KEY_CHECKS = 1', []);

  console.log('Inserindo categorias...');
  const catIds = {};
  for (const c of categorias) {
    const r = await execute('INSERT INTO CATEGORIAS (nome, emoji, ordem) VALUES (?, ?, ?)', [c.nome, c.emoji, c.ordem], 'run');
    catIds[c.nome] = r.lastID;
  }

  console.log('Inserindo empresas, produtos e vínculos...');
  for (const emp of empresas) {
    const r = await execute(
      'INSERT INTO EMPRESA (nome, icone, taxa_entrega, endereco, bairro, cidade, estado, ativo, dt_cadastro) VALUES (?, ?, ?, ?, ?, ?, ?, 1, NOW())',
      [emp.nome, emp.icone, emp.taxaEntrega, emp.endereco ?? null, emp.bairro ?? null, emp.cidade ?? null, emp.estado ?? null],
      'run'
    );
    const idEmpresa = r.lastID;

    for (const nomecat of emp.categorias) {
      if (catIds[nomecat]) {
        await execute('INSERT INTO EMPRESA_CATEGORIA (id_empresa, id_categoria) VALUES (?, ?)', [idEmpresa, catIds[nomecat]]);
      }
    }

    const pc = await execute(
      'INSERT INTO PRODUTO_CATEGORIA (id_empresa, categoria, ordem) VALUES (?, ?, 1)',
      [idEmpresa, emp.produtoCategoria],
      'run'
    );
    const idCategoria = pc.lastID;

    for (const p of emp.produtos) {
      await execute(
        'INSERT INTO PRODUTO (id_empresa, id_produto_categoria, nome, descricao, icone, valor, ativo) VALUES (?, ?, ?, ?, ?, ?, 1)',
        [idEmpresa, idCategoria, p.nome, p.descricao ?? null, p.icone ?? null, p.valor]
      );
    }
  }

  console.log('Seed concluído!');
  await pool.end();
}

seed().catch((e) => { console.error(e); process.exit(1); });
