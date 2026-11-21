-- Migration 000 — schema base
--
-- O estado do banco antes da virada para gestão de restaurante: o catálogo de
-- delivery original. Extraído do histórico (commit 7374c66) para que as
-- migrations passem a construir um banco DO ZERO.
--
-- Antes desta migration existir, schema.sql era a única forma de criar um
-- banco novo e as migrations só serviam a bancos existentes — duas descrições
-- da mesma estrutura, mantidas em sincronia à mão. Elas já divergiram uma vez
-- (o ON DELETE CASCADE que o MySQL recusa em coluna-base de coluna gerada
-- precisou ser corrigido nos dois lugares).
--
-- Agora a sequência 000..006 é a única fonte da verdade, e schema.sql deixou
-- de existir.
--
-- As tabelas BANNER, DESTAQUE, USER_FAVORITO e CATEGORIAS são herança do
-- delivery: seguem aqui porque o histórico precisa ser reproduzível, e a
-- migration que as derruba é um passo futuro, não uma reescrita do passado.

CREATE TABLE IF NOT EXISTS USUARIO (
    id_usuario   INT AUTO_INCREMENT PRIMARY KEY,
    nome         VARCHAR(100) NOT NULL,
    email        VARCHAR(100) NOT NULL UNIQUE,
    senha        VARCHAR(255) NOT NULL,
    telefone     VARCHAR(20),
    cep          VARCHAR(10),
    endereco     VARCHAR(200),
    numero       VARCHAR(20),
    complemento  VARCHAR(100),
    bairro       VARCHAR(100),
    cidade       VARCHAR(100),
    estado       VARCHAR(2),
    dt_cadastro  DATETIME NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS CATEGORIAS (
    id_categoria INT AUTO_INCREMENT PRIMARY KEY,
    nome         VARCHAR(100) NOT NULL,
    emoji        VARCHAR(10),
    ordem        INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS EMPRESA (
    id_empresa    INT AUTO_INCREMENT PRIMARY KEY,
    nome          VARCHAR(100) NOT NULL,
    icone         VARCHAR(255),
    taxa_entrega  DECIMAL(10,2) NOT NULL DEFAULT 0,
    cep           VARCHAR(10),
    endereco      VARCHAR(200),
    numero        VARCHAR(20),
    complemento   VARCHAR(100),
    bairro        VARCHAR(100),
    cidade        VARCHAR(100),
    estado        VARCHAR(2),
    ativo         TINYINT(1) NOT NULL DEFAULT 1,
    dt_cadastro   DATETIME NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS EMPRESA_CATEGORIA (
    id_empresa   INT NOT NULL,
    id_categoria INT NOT NULL,
    PRIMARY KEY (id_empresa, id_categoria),
    FOREIGN KEY (id_empresa)   REFERENCES EMPRESA(id_empresa)     ON DELETE CASCADE,
    FOREIGN KEY (id_categoria) REFERENCES CATEGORIAS(id_categoria) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS PRODUTO_CATEGORIA (
    id_produto_categoria INT AUTO_INCREMENT PRIMARY KEY,
    id_empresa           INT NOT NULL,
    categoria            VARCHAR(100) NOT NULL,
    ordem                INT NOT NULL DEFAULT 0,
    FOREIGN KEY (id_empresa) REFERENCES EMPRESA(id_empresa) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS PRODUTO (
    id_produto           INT AUTO_INCREMENT PRIMARY KEY,
    id_empresa           INT NOT NULL,
    id_produto_categoria INT NOT NULL,
    nome                 VARCHAR(100) NOT NULL,
    descricao            TEXT,
    icone                VARCHAR(255),
    valor                DECIMAL(10,2) NOT NULL,
    ativo                TINYINT(1) NOT NULL DEFAULT 1,
    FOREIGN KEY (id_empresa)           REFERENCES EMPRESA(id_empresa)                       ON DELETE CASCADE,
    FOREIGN KEY (id_produto_categoria) REFERENCES PRODUTO_CATEGORIA(id_produto_categoria)   ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS PEDIDO (
    id_pedido       INT AUTO_INCREMENT PRIMARY KEY,
    id_empresa      INT NOT NULL,
    id_usuario      INT NOT NULL,
    vl_subtotal     DECIMAL(10,2) NOT NULL,
    vl_taxa_entrega DECIMAL(10,2) NOT NULL,
    vl_total        DECIMAL(10,2) NOT NULL,
    dt_pedido       DATETIME NOT NULL DEFAULT NOW(),
    status          VARCHAR(50) NOT NULL DEFAULT 'pendente',
    FOREIGN KEY (id_empresa) REFERENCES EMPRESA(id_empresa) ON DELETE CASCADE,
    FOREIGN KEY (id_usuario) REFERENCES USUARIO(id_usuario) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ITENS_PEDIDO (
    id_itens_pedido INT AUTO_INCREMENT PRIMARY KEY,
    id_pedido       INT NOT NULL,
    id_produto      INT NOT NULL,
    observacao      TEXT,
    quantidade      INT NOT NULL,
    vl_unitario     DECIMAL(10,2) NOT NULL,
    vl_total        DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (id_pedido)  REFERENCES PEDIDO(id_pedido)   ON DELETE CASCADE,
    FOREIGN KEY (id_produto) REFERENCES PRODUTO(id_produto) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS BANNER (
    id_banner  INT AUTO_INCREMENT PRIMARY KEY,
    id_empresa INT NOT NULL,
    ativo      TINYINT(1) NOT NULL DEFAULT 1,
    ordem      INT NOT NULL DEFAULT 0,
    FOREIGN KEY (id_empresa) REFERENCES EMPRESA(id_empresa) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS DESTAQUE (
    id_destaque INT AUTO_INCREMENT PRIMARY KEY,
    id_empresa  INT NOT NULL,
    id_produto  INT NOT NULL,
    ordem       INT NOT NULL DEFAULT 0,
    FOREIGN KEY (id_empresa) REFERENCES EMPRESA(id_empresa) ON DELETE CASCADE,
    FOREIGN KEY (id_produto) REFERENCES PRODUTO(id_produto) ON DELETE CASCADE
);

-- id_produto nulo = o usuário favoritou a empresa inteira, não um produto específico.
-- A coluna gerada id_produto_key existe para viabilizar a UNIQUE KEY: no MySQL um
-- índice único permite múltiplos NULL, o que deixaria passar favoritos duplicados.
-- Sem a coluna gerada id_produto_key e sem uk_favorito: quem os adiciona é a
-- migration 001. O arquivo de onde esta base foi extraída já trazia os dois,
-- porque schema.sql era atualizado junto com cada migration em vez de
-- descrever o estado anterior a elas — a duplicação que motivou este runner.
--
-- A diferença não é cosmética: criar a tabela com a coluna gerada E a chave
-- estrangeira em cascata sobre a coluna-base é recusado pelo MySQL. Só
-- funciona na ordem histórica, com o ALTER da 001 vindo depois.
CREATE TABLE IF NOT EXISTS USER_FAVORITO (
    id_favorito   INT AUTO_INCREMENT PRIMARY KEY,
    id_usuario    INT NOT NULL,
    id_empresa    INT NOT NULL,
    id_produto    INT NOT NULL,
    dt_favoritado DATETIME NOT NULL DEFAULT NOW(),
    FOREIGN KEY (id_usuario) REFERENCES USUARIO(id_usuario) ON DELETE CASCADE,
    FOREIGN KEY (id_empresa) REFERENCES EMPRESA(id_empresa) ON DELETE CASCADE,
    FOREIGN KEY (id_produto) REFERENCES PRODUTO(id_produto) ON DELETE CASCADE
);
