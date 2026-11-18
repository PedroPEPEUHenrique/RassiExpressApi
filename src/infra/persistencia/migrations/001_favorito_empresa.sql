-- Migration 001 — favoritos de empresa
--
-- Contexto: USER_FAVORITO exigia id_produto NOT NULL, mas o app favorita
-- restaurantes (empresas). Esta migration permite id_produto nulo e garante
-- unicidade por (usuário, empresa, produto) mesmo com o nulo.
--
-- O schema.sql já contempla essas mudanças e só roda em banco novo
-- (docker-entrypoint-initdb.d). Aplique esta migration em bancos existentes:
--   docker exec -i foodexpress_db mysql -uroot -proot foodexpress < 001_favorito_empresa.sql

USE foodexpress;

ALTER TABLE USER_FAVORITO
    MODIFY COLUMN id_produto INT NULL;

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
