-- Migration 006 — estoque: insumos, ficha técnica e movimentação
--
-- Baixa automática de estoque é o módulo com pior relação esforço/retorno no
-- início: exige cadastrar a receita de cada prato antes de dar qualquer
-- resposta. Por isso vem por último, e por isso a ficha técnica é OPCIONAL —
-- produto sem ficha simplesmente não movimenta estoque, e o resto do sistema
-- continua funcionando igual.
--
-- Aplicar em banco existente:
--   docker exec -i foodexpress_db mysql -uroot -proot foodexpress < 006_estoque.sql

USE foodexpress;

-- qtd_atual é mantido como saldo corrente em vez de somado dos movimentos a
-- cada consulta: a tela de estoque é lida muito mais vezes do que escrita, e
-- somar o histórico inteiro a cada abertura ficaria mais lento a cada mês.
-- MOVIMENTO_ESTOQUE continua sendo a verdade auditável; esta coluna é o
-- acumulado, e só muda dentro da mesma transação do movimento.
CREATE TABLE IF NOT EXISTS INSUMO (
    id_insumo      INT AUTO_INCREMENT PRIMARY KEY,
    id_empresa     INT NOT NULL,
    nome           VARCHAR(100) NOT NULL,
    unidade        ENUM('kg', 'g', 'l', 'ml', 'un') NOT NULL,
    qtd_atual      DECIMAL(12,3) NOT NULL DEFAULT 0,
    -- Abaixo disto o insumo aparece como "repor". Zero desliga o alerta.
    qtd_minima     DECIMAL(12,3) NOT NULL DEFAULT 0,
    -- Quatro casas: insumo costuma ser comprado em quilo e consumido em grama,
    -- e duas casas zerariam o custo unitário de tempero.
    vl_custo_medio DECIMAL(12,4) NOT NULL DEFAULT 0,
    ativo          TINYINT(1) NOT NULL DEFAULT 1,
    UNIQUE KEY uk_insumo_empresa_nome (id_empresa, nome),
    FOREIGN KEY (id_empresa) REFERENCES EMPRESA(id_empresa) ON DELETE CASCADE
);

-- Quanto de cada insumo sai por unidade vendida do produto.
CREATE TABLE IF NOT EXISTS FICHA_TECNICA (
    id_ficha   INT AUTO_INCREMENT PRIMARY KEY,
    id_produto INT NOT NULL,
    id_insumo  INT NOT NULL,
    quantidade DECIMAL(12,3) NOT NULL,
    UNIQUE KEY uk_ficha_produto_insumo (id_produto, id_insumo),
    FOREIGN KEY (id_produto) REFERENCES PRODUTO(id_produto) ON DELETE CASCADE,
    FOREIGN KEY (id_insumo)  REFERENCES INSUMO(id_insumo)   ON DELETE CASCADE
);

-- quantidade é sempre positiva; o tipo decide o sinal, como em
-- MOVIMENTO_CAIXA. Guardar negativo tornaria toda soma dependente de lembrar
-- o sinal certo na inserção.
CREATE TABLE IF NOT EXISTS MOVIMENTO_ESTOQUE (
    id_movimento   INT AUTO_INCREMENT PRIMARY KEY,
    id_empresa     INT NOT NULL,
    id_insumo      INT NOT NULL,
    tipo           ENUM('entrada', 'saida_venda', 'perda', 'ajuste') NOT NULL,
    quantidade     DECIMAL(12,3) NOT NULL,
    vl_unitario    DECIMAL(12,4) NULL,
    -- Liga a baixa à rodada que a causou, para auditar de onde saiu o consumo.
    id_pedido      INT NULL,
    id_funcionario INT NULL,
    motivo         VARCHAR(200),
    dt_movimento   DATETIME NOT NULL DEFAULT NOW(),
    KEY idx_mov_estoque_insumo (id_insumo, dt_movimento),
    KEY idx_mov_estoque_empresa (id_empresa, tipo, dt_movimento),
    FOREIGN KEY (id_empresa)     REFERENCES EMPRESA(id_empresa)         ON DELETE CASCADE,
    FOREIGN KEY (id_insumo)      REFERENCES INSUMO(id_insumo)           ON DELETE CASCADE,
    FOREIGN KEY (id_pedido)      REFERENCES PEDIDO(id_pedido)           ON DELETE SET NULL,
    FOREIGN KEY (id_funcionario) REFERENCES FUNCIONARIO(id_funcionario)
);
