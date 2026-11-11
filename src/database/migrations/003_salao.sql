-- Migration 003 — salão: mesas, comandas e o refit de PEDIDO
--
-- Contexto: PEDIDO era a conta inteira do cliente de delivery. No salão a
-- conta é a COMANDA da mesa, e o pedido vira uma rodada dentro dela — o
-- garçom lança entradas, depois pratos, depois sobremesa, e tudo soma na
-- mesma conta até o fechamento.
--
--   COMANDA (a conta da mesa, aberta até fechar)
--     └─ PEDIDO (uma rodada enviada à cozinha)
--          └─ ITENS_PEDIDO
--
-- Aplicar em banco existente:
--   docker exec -i foodexpress_db mysql -uroot -proot foodexpress < 003_salao.sql

USE foodexpress;

-- ---------------------------------------------------------------------------
-- MESA
--
-- Não tem coluna de status. "Livre" ou "ocupada" é consequência de existir ou
-- não uma comanda aberta: guardar isso numa coluna cria um segundo lugar para
-- a mesma verdade, que diverge na primeira falha entre os dois UPDATEs.
-- A consulta deriva o estado com LEFT JOIN.
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- COMANDA
--
-- id_mesa_aberta é coluna gerada que vale id_mesa só enquanto a comanda está
-- aberta, e NULL depois. Como índice único no MySQL aceita vários NULL, isso
-- garante **uma única comanda aberta por mesa** e ao mesmo tempo permite o
-- histórico: a mesa 5 pode ter centenas de comandas fechadas.
-- É o mesmo recurso que USER_FAVORITO já usava para o id_produto nulo.
--
-- vl_total é sempre recalculado pelo servidor a partir de PRODUTO.valor; o
-- app nunca envia valor.
-- ---------------------------------------------------------------------------
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
    FOREIGN KEY (id_empresa)              REFERENCES EMPRESA(id_empresa)         ON DELETE CASCADE,
    FOREIGN KEY (id_mesa)                 REFERENCES MESA(id_mesa)               ON DELETE CASCADE,
    FOREIGN KEY (id_funcionario_abertura) REFERENCES FUNCIONARIO(id_funcionario),
    FOREIGN KEY (id_funcionario_fechamento) REFERENCES FUNCIONARIO(id_funcionario)
);

-- ---------------------------------------------------------------------------
-- PEDIDO vira "rodada"
--
-- id_usuario passa a aceitar NULL: não existe mais cliente com conta. Quem
-- lançou é id_funcionario.
--
-- id_local é o UUID gerado no aparelho do garçom, com índice único. É o que
-- torna o reenvio seguro: se o celular perder a resposta e repetir a rodada,
-- o segundo INSERT bate na unique e a API devolve a rodada que já existe, em
-- vez de mandar o prato duas vezes para a cozinha.
-- ---------------------------------------------------------------------------
ALTER TABLE PEDIDO
    ADD COLUMN id_comanda     INT NULL AFTER id_empresa,
    ADD COLUMN id_funcionario INT NULL AFTER id_comanda,
    ADD COLUMN tipo           ENUM('mesa', 'balcao', 'viagem', 'delivery') NOT NULL DEFAULT 'mesa' AFTER id_usuario,
    ADD COLUMN id_local       VARCHAR(36) NULL AFTER tipo,
    MODIFY COLUMN id_usuario  INT NULL,
    MODIFY COLUMN vl_taxa_entrega DECIMAL(10,2) NOT NULL DEFAULT 0,
    MODIFY COLUMN status      VARCHAR(30) NOT NULL DEFAULT 'enviado';

ALTER TABLE PEDIDO
    ADD UNIQUE KEY uk_pedido_id_local (id_local),
    ADD KEY idx_pedido_comanda (id_comanda),
    ADD KEY idx_pedido_cozinha (id_empresa, status, dt_pedido),
    ADD CONSTRAINT fk_pedido_comanda     FOREIGN KEY (id_comanda)     REFERENCES COMANDA(id_comanda) ON DELETE CASCADE,
    ADD CONSTRAINT fk_pedido_funcionario FOREIGN KEY (id_funcionario) REFERENCES FUNCIONARIO(id_funcionario);

-- O pedido antigo era de delivery e não pertence a comanda nenhuma. Sem isso,
-- a fila da cozinha abriria com lixo da base de testes.
UPDATE PEDIDO SET status = 'cancelado' WHERE id_comanda IS NULL;

-- Preço no momento da venda já vivia em vl_unitario; o nome do produto não.
-- Guardar o nome protege o histórico de um produto renomeado ou excluído.
ALTER TABLE ITENS_PEDIDO
    ADD COLUMN nome_produto VARCHAR(100) NULL AFTER id_produto;

UPDATE ITENS_PEDIDO ip
    INNER JOIN PRODUTO p ON p.id_produto = ip.id_produto
    SET ip.nome_produto = p.nome
    WHERE ip.nome_produto IS NULL;
