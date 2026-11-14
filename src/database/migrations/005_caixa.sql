-- Migration 005 — caixa e movimentos financeiros
--
-- O app não processa pagamento: ele mostra o valor e registra que a venda
-- aconteceu. O caixa é o livro do turno — o que entrou, o que saiu, e quanto
-- deveria ter na gaveta no fim da noite.
--
-- Fonte dos movimentos:
--   venda          — automático ao fechar uma comanda. O total da mesa JÁ é o
--                    valor da venda; pedir que o gestor relance seria digitar
--                    duas vezes o mesmo número e divergir na primeira distração.
--   venda_externa  — manual. Delivery e balcão que não passam pelo salão.
--   despesa        — manual. Compra de insumo, conta, troco de emergência.
--   sangria        — manual. Retirada de dinheiro da gaveta.
--   suprimento     — manual. Entrada de troco.
--
-- Aplicar em banco existente:
--   docker exec -i foodexpress_db mysql -uroot -proot foodexpress < 005_caixa.sql

USE foodexpress;

-- id_empresa_aberto repete o mesmo recurso de COMANDA.id_mesa_aberta: vale o
-- id da empresa só enquanto o caixa está aberto e NULL depois. Como índice
-- único aceita vários NULL, garante UM caixa aberto por restaurante sem
-- impedir o histórico de turnos.
CREATE TABLE IF NOT EXISTS CAIXA (
    id_caixa                  INT AUTO_INCREMENT PRIMARY KEY,
    id_empresa                INT NOT NULL,
    id_funcionario_abertura   INT NOT NULL,
    id_funcionario_fechamento INT NULL,
    vl_abertura               DECIMAL(10,2) NOT NULL DEFAULT 0,
    -- O que foi contado na gaveta ao fechar. A diferença para o calculado é a
    -- quebra de caixa, e é justamente o número que o gestor quer ver.
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

-- valor é sempre positivo; o tipo decide o sinal. Guardar negativo tornaria
-- toda soma dependente de lembrar o sinal certo na hora de inserir.
CREATE TABLE IF NOT EXISTS MOVIMENTO_CAIXA (
    id_movimento   INT AUTO_INCREMENT PRIMARY KEY,
    id_caixa       INT NOT NULL,
    id_empresa     INT NOT NULL,
    id_funcionario INT NULL,
    tipo           ENUM('venda', 'venda_externa', 'despesa', 'sangria', 'suprimento') NOT NULL,
    descricao      VARCHAR(200),
    valor          DECIMAL(10,2) NOT NULL,
    -- Preenchido quando o movimento nasce do fechamento de uma comanda. O
    -- índice único impede que a mesma comanda entre duas vezes no caixa por
    -- um reenvio ou um clique duplo.
    id_comanda     INT NULL,
    dt_movimento   DATETIME NOT NULL DEFAULT NOW(),
    UNIQUE KEY uk_movimento_comanda (id_comanda),
    KEY idx_movimento_caixa (id_caixa, tipo),
    FOREIGN KEY (id_caixa)       REFERENCES CAIXA(id_caixa)             ON DELETE CASCADE,
    FOREIGN KEY (id_empresa)     REFERENCES EMPRESA(id_empresa)         ON DELETE CASCADE,
    FOREIGN KEY (id_funcionario) REFERENCES FUNCIONARIO(id_funcionario),
    FOREIGN KEY (id_comanda)     REFERENCES COMANDA(id_comanda)         ON DELETE SET NULL
);
