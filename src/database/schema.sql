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

-- USUARIO é a identidade (quem é, e-mail, senha); FUNCIONARIO é o vínculo de
-- trabalho. A separação permite que a mesma pessoa seja gestora de um
-- restaurante e garçom de outro, como o modelo multi-loja exige.
CREATE TABLE IF NOT EXISTS FUNCIONARIO (
    id_funcionario INT AUTO_INCREMENT PRIMARY KEY,
    id_usuario     INT NOT NULL,
    id_empresa     INT NOT NULL,
    papel          ENUM('gestor', 'garcom', 'cozinha') NOT NULL,
    ativo          TINYINT(1) NOT NULL DEFAULT 1,
    dt_admissao    DATETIME NOT NULL DEFAULT NOW(),
    UNIQUE KEY uk_funcionario_usuario_empresa (id_usuario, id_empresa),
    KEY idx_funcionario_empresa_papel (id_empresa, papel),
    FOREIGN KEY (id_usuario) REFERENCES USUARIO(id_usuario) ON DELETE CASCADE,
    FOREIGN KEY (id_empresa) REFERENCES EMPRESA(id_empresa) ON DELETE CASCADE
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
    -- ativo = está no cardápio (decisão de cardápio, rara).
    -- disponivel = tem hoje ("acabou o filé", um toque, toda noite).
    -- Separados porque confundi-los obriga a escolher entre vender o que não
    -- tem e apagar do cadastro o que volta amanhã.
    ativo                TINYINT(1) NOT NULL DEFAULT 1,
    disponivel           TINYINT(1) NOT NULL DEFAULT 1,
    KEY idx_produto_empresa_estado (id_empresa, ativo, disponivel),
    FOREIGN KEY (id_empresa)           REFERENCES EMPRESA(id_empresa)                       ON DELETE CASCADE,
    FOREIGN KEY (id_produto_categoria) REFERENCES PRODUTO_CATEGORIA(id_produto_categoria)   ON DELETE CASCADE
);

-- MESA não guarda status: "livre" ou "ocupada" é consequência de existir uma
-- comanda aberta. Uma coluna de status seria um segundo lugar para a mesma
-- verdade, e divergiria na primeira falha entre os dois UPDATEs.
CREATE TABLE IF NOT EXISTS MESA (
    id_mesa    INT AUTO_INCREMENT PRIMARY KEY,
    id_empresa INT NOT NULL,
    numero     VARCHAR(10) NOT NULL,
    setor      VARCHAR(50),
    capacidade INT,
    ativo      TINYINT(1) NOT NULL DEFAULT 1,
    UNIQUE KEY uk_mesa_empresa_numero (id_empresa, numero),
    FOREIGN KEY (id_empresa) REFERENCES EMPRESA(id_empresa) ON DELETE CASCADE
);

-- A conta da mesa. id_mesa_aberta vale id_mesa só enquanto a comanda está
-- aberta e NULL depois; como índice único aceita vários NULL, isso garante uma
-- única comanda aberta por mesa sem impedir o histórico da mesma mesa.
CREATE TABLE IF NOT EXISTS COMANDA (
    id_comanda                INT AUTO_INCREMENT PRIMARY KEY,
    id_empresa                INT NOT NULL,
    id_mesa                   INT NOT NULL,
    id_funcionario_abertura   INT NOT NULL,
    id_funcionario_fechamento INT NULL,
    status                    ENUM('aberta', 'fechada', 'cancelada') NOT NULL DEFAULT 'aberta',
    vl_total                  DECIMAL(10,2) NOT NULL DEFAULT 0,
    observacao                TEXT,
    dt_abertura               DATETIME NOT NULL DEFAULT NOW(),
    dt_fechamento             DATETIME NULL,
    id_mesa_aberta            INT GENERATED ALWAYS AS (IF(status = 'aberta', id_mesa, NULL)) STORED,
    UNIQUE KEY uk_comanda_mesa_aberta (id_mesa_aberta),
    KEY idx_comanda_empresa_status (id_empresa, status),
    FOREIGN KEY (id_empresa)                REFERENCES EMPRESA(id_empresa) ON DELETE CASCADE,
    FOREIGN KEY (id_mesa)                   REFERENCES MESA(id_mesa)       ON DELETE CASCADE,
    FOREIGN KEY (id_funcionario_abertura)   REFERENCES FUNCIONARIO(id_funcionario),
    FOREIGN KEY (id_funcionario_fechamento) REFERENCES FUNCIONARIO(id_funcionario)
);

-- Uma rodada lançada pelo garçom e enviada à cozinha, não a conta inteira.
-- id_local é o UUID gerado no aparelho: com índice único, o reenvio de uma
-- rodada cuja resposta se perdeu devolve a que já existe em vez de duplicar
-- o prato na cozinha.
CREATE TABLE IF NOT EXISTS PEDIDO (
    id_pedido       INT AUTO_INCREMENT PRIMARY KEY,
    id_empresa      INT NOT NULL,
    id_comanda      INT NULL,
    id_funcionario  INT NULL,
    id_usuario      INT NULL,
    tipo            ENUM('mesa', 'balcao', 'viagem', 'delivery') NOT NULL DEFAULT 'mesa',
    id_local        VARCHAR(36) NULL,
    vl_subtotal     DECIMAL(10,2) NOT NULL,
    vl_taxa_entrega DECIMAL(10,2) NOT NULL DEFAULT 0,
    vl_total        DECIMAL(10,2) NOT NULL,
    dt_pedido       DATETIME NOT NULL DEFAULT NOW(),
    status          VARCHAR(30) NOT NULL DEFAULT 'enviado',
    UNIQUE KEY uk_pedido_id_local (id_local),
    KEY idx_pedido_comanda (id_comanda),
    KEY idx_pedido_cozinha (id_empresa, status, dt_pedido),
    FOREIGN KEY (id_empresa)     REFERENCES EMPRESA(id_empresa)         ON DELETE CASCADE,
    FOREIGN KEY (id_comanda)     REFERENCES COMANDA(id_comanda)         ON DELETE CASCADE,
    FOREIGN KEY (id_funcionario) REFERENCES FUNCIONARIO(id_funcionario),
    FOREIGN KEY (id_usuario)     REFERENCES USUARIO(id_usuario)         ON DELETE SET NULL
);

-- nome_produto congela o nome no momento da venda, como vl_unitario já fazia
-- com o preço: renomear ou excluir um produto não reescreve o histórico.
CREATE TABLE IF NOT EXISTS ITENS_PEDIDO (
    id_itens_pedido INT AUTO_INCREMENT PRIMARY KEY,
    id_pedido       INT NOT NULL,
    id_produto      INT NOT NULL,
    nome_produto    VARCHAR(100) NULL,
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
CREATE TABLE IF NOT EXISTS USER_FAVORITO (
    id_favorito    INT AUTO_INCREMENT PRIMARY KEY,
    id_usuario     INT NOT NULL,
    id_empresa     INT NOT NULL,
    id_produto     INT NULL,
    id_produto_key INT GENERATED ALWAYS AS (IFNULL(id_produto, 0)) STORED,
    dt_favoritado  DATETIME NOT NULL DEFAULT NOW(),
    UNIQUE KEY uk_favorito (id_usuario, id_empresa, id_produto_key),
    FOREIGN KEY (id_usuario) REFERENCES USUARIO(id_usuario) ON DELETE CASCADE,
    FOREIGN KEY (id_empresa) REFERENCES EMPRESA(id_empresa) ON DELETE CASCADE,
    FOREIGN KEY (id_produto) REFERENCES PRODUTO(id_produto) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------------
-- Caixa (Fase 4) — o livro do turno.
--
-- id_empresa_aberto repete o recurso de COMANDA.id_mesa_aberta: vale o id da
-- empresa só enquanto aberto e NULL depois, garantindo UM caixa aberto por
-- restaurante sem impedir o histórico de turnos.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS CAIXA (
    id_caixa                  INT AUTO_INCREMENT PRIMARY KEY,
    id_empresa                INT NOT NULL,
    id_funcionario_abertura   INT NOT NULL,
    id_funcionario_fechamento INT NULL,
    vl_abertura               DECIMAL(10,2) NOT NULL DEFAULT 0,
    vl_informado              DECIMAL(10,2) NULL,
    observacao                TEXT,
    status                    ENUM('aberto', 'fechado') NOT NULL DEFAULT 'aberto',
    dt_abertura               DATETIME NOT NULL DEFAULT NOW(),
    dt_fechamento             DATETIME NULL,
    id_empresa_aberto         INT GENERATED ALWAYS AS (IF(status = 'aberto', id_empresa, NULL)) STORED,
    UNIQUE KEY uk_caixa_empresa_aberto (id_empresa_aberto),
    KEY idx_caixa_empresa_data (id_empresa, dt_abertura),
    FOREIGN KEY (id_empresa)                REFERENCES EMPRESA(id_empresa) ON DELETE CASCADE,
    FOREIGN KEY (id_funcionario_abertura)   REFERENCES FUNCIONARIO(id_funcionario),
    FOREIGN KEY (id_funcionario_fechamento) REFERENCES FUNCIONARIO(id_funcionario)
);

-- valor é sempre positivo; o tipo decide o sinal. O índice único em id_comanda
-- impede que a mesma venda entre duas vezes no turno.
CREATE TABLE IF NOT EXISTS MOVIMENTO_CAIXA (
    id_movimento   INT AUTO_INCREMENT PRIMARY KEY,
    id_caixa       INT NOT NULL,
    id_empresa     INT NOT NULL,
    id_funcionario INT NULL,
    tipo           ENUM('venda', 'venda_externa', 'despesa', 'sangria', 'suprimento') NOT NULL,
    descricao      VARCHAR(200),
    valor          DECIMAL(10,2) NOT NULL,
    id_comanda     INT NULL,
    dt_movimento   DATETIME NOT NULL DEFAULT NOW(),
    UNIQUE KEY uk_movimento_comanda (id_comanda),
    KEY idx_movimento_caixa (id_caixa, tipo),
    FOREIGN KEY (id_caixa)       REFERENCES CAIXA(id_caixa)     ON DELETE CASCADE,
    FOREIGN KEY (id_empresa)     REFERENCES EMPRESA(id_empresa) ON DELETE CASCADE,
    FOREIGN KEY (id_funcionario) REFERENCES FUNCIONARIO(id_funcionario),
    FOREIGN KEY (id_comanda)     REFERENCES COMANDA(id_comanda) ON DELETE SET NULL
);

-- ---------------------------------------------------------------------------
-- Estoque (Fase 5).
--
-- A ficha técnica é OPCIONAL: produto sem ficha não movimenta estoque, e o
-- restaurante usa o sistema normalmente enquanto cadastra as receitas aos
-- poucos.
--
-- qtd_atual é saldo acumulado em vez de soma dos movimentos a cada leitura: a
-- tela é lida muito mais do que escrita. MOVIMENTO_ESTOQUE continua sendo a
-- verdade auditável, e a coluna só muda na mesma transação do movimento.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS INSUMO (
    id_insumo      INT AUTO_INCREMENT PRIMARY KEY,
    id_empresa     INT NOT NULL,
    nome           VARCHAR(100) NOT NULL,
    unidade        ENUM('kg', 'g', 'l', 'ml', 'un') NOT NULL,
    qtd_atual      DECIMAL(12,3) NOT NULL DEFAULT 0,
    qtd_minima     DECIMAL(12,3) NOT NULL DEFAULT 0,
    -- Quatro casas: insumo é comprado em quilo e consumido em grama, e duas
    -- casas zerariam o custo unitário de tempero.
    vl_custo_medio DECIMAL(12,4) NOT NULL DEFAULT 0,
    ativo          TINYINT(1) NOT NULL DEFAULT 1,
    UNIQUE KEY uk_insumo_empresa_nome (id_empresa, nome),
    FOREIGN KEY (id_empresa) REFERENCES EMPRESA(id_empresa) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS FICHA_TECNICA (
    id_ficha   INT AUTO_INCREMENT PRIMARY KEY,
    id_produto INT NOT NULL,
    id_insumo  INT NOT NULL,
    quantidade DECIMAL(12,3) NOT NULL,
    UNIQUE KEY uk_ficha_produto_insumo (id_produto, id_insumo),
    FOREIGN KEY (id_produto) REFERENCES PRODUTO(id_produto) ON DELETE CASCADE,
    FOREIGN KEY (id_insumo)  REFERENCES INSUMO(id_insumo)   ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS MOVIMENTO_ESTOQUE (
    id_movimento   INT AUTO_INCREMENT PRIMARY KEY,
    id_empresa     INT NOT NULL,
    id_insumo      INT NOT NULL,
    tipo           ENUM('entrada', 'saida_venda', 'perda', 'ajuste') NOT NULL,
    quantidade     DECIMAL(12,3) NOT NULL,
    vl_unitario    DECIMAL(12,4) NULL,
    id_pedido      INT NULL,
    id_funcionario INT NULL,
    motivo         VARCHAR(200),
    dt_movimento   DATETIME NOT NULL DEFAULT NOW(),
    KEY idx_mov_estoque_insumo (id_insumo, dt_movimento),
    KEY idx_mov_estoque_empresa (id_empresa, tipo, dt_movimento),
    FOREIGN KEY (id_empresa)     REFERENCES EMPRESA(id_empresa) ON DELETE CASCADE,
    FOREIGN KEY (id_insumo)      REFERENCES INSUMO(id_insumo)   ON DELETE CASCADE,
    FOREIGN KEY (id_pedido)      REFERENCES PEDIDO(id_pedido)   ON DELETE SET NULL,
    FOREIGN KEY (id_funcionario) REFERENCES FUNCIONARIO(id_funcionario)
);
