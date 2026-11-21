-- NOTA (acrescentada ao criar o runner de migrations)
--
-- Esta migration NUNCA foi aplicada com sucesso. O banco de produção não tem
-- id_produto_key nem uk_favorito; ela falhava em silêncio e ninguém soube,
-- porque até então nada registrava o que havia rodado.
--
-- A causa: o MySQL recusa adicionar coluna gerada STORED quando a coluna-base
-- tem chave estrangeira em cascata. É a mesma restrição que depois apareceu em
-- COMANDA e CAIXA.
--
-- Foi corrigida aqui para que a sequência 000..00N consiga reconstruir o banco
-- do zero — a FK sai antes e volta sem cascata. Na prática isto só roda em
-- banco novo: a 007 derruba USER_FAVORITO logo em seguida, porque favoritos
-- são resto do delivery.

-- Migration 001 — favoritos de empresa
--
-- Contexto: USER_FAVORITO exigia id_produto NOT NULL, mas o app favorita
-- restaurantes (empresas). Esta migration permite id_produto nulo e garante
-- unicidade por (usuário, empresa, produto) mesmo com o nulo.
--
-- O schema.sql já contempla essas mudanças e só roda em banco novo
-- (docker-entrypoint-initdb.d). Aplique esta migration em bancos existentes:
--   docker exec -i foodexpress_db mysql -uroot -proot foodexpress < 001_favorito_empresa.sql

ALTER TABLE USER_FAVORITO
    MODIFY COLUMN id_produto INT NULL;

-- A FK em cascata impede a coluna gerada; sai aqui e volta no fim.
ALTER TABLE USER_FAVORITO
    DROP FOREIGN KEY USER_FAVORITO_ibfk_3;

ALTER TABLE USER_FAVORITO
    ADD COLUMN id_produto_key INT GENERATED ALWAYS AS (IFNULL(id_produto, 0)) STORED AFTER id_produto;

-- Remove duplicatas pré-existentes antes de criar o índice único.
DELETE f1 FROM USER_FAVORITO f1
INNER JOIN USER_FAVORITO f2
    ON f1.id_usuario = f2.id_usuario
   AND f1.id_empresa = f2.id_empresa
   AND f1.id_produto_key = f2.id_produto_key
   AND f1.id_favorito > f2.id_favorito;

ALTER TABLE USER_FAVORITO
    ADD UNIQUE KEY uk_favorito (id_usuario, id_empresa, id_produto_key);

-- Sem ON DELETE CASCADE: id_produto agora é base de coluna gerada.
ALTER TABLE USER_FAVORITO
    ADD CONSTRAINT USER_FAVORITO_ibfk_3 FOREIGN KEY (id_produto) REFERENCES PRODUTO(id_produto);
