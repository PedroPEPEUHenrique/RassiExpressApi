CREATE DATABASE IF NOT EXISTS foodexpress CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE foodexpress;

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
