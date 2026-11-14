-- Migration 004 — disponibilidade do produto
--
-- PRODUTO.ativo já existia, mas responde a outra pergunta. São dois estados
-- diferentes, e confundi-los força o gestor a escolher entre vender o que não
-- tem ou apagar do cadastro o que volta amanhã:
--
--   ativo       = está no cardápio. Mexer nisso é decisão de cardápio, rara,
--                 e tirar daqui some com o item da lista do garçom.
--   disponivel  = tem hoje. "Acabou o filé" às 20h, volta na terça. É um
--                 toque, acontece toda noite, e o item continua no cardápio
--                 visível para a equipe, marcado como em falta.
--
-- Aplicar em banco existente:
--   docker exec -i foodexpress_db mysql -uroot -proot foodexpress < 004_disponibilidade.sql

USE foodexpress;

ALTER TABLE PRODUTO
    ADD COLUMN disponivel TINYINT(1) NOT NULL DEFAULT 1 AFTER ativo;

-- Atende a listagem do cardápio do garçom, que filtra pelos dois estados.
ALTER TABLE PRODUTO
    ADD KEY idx_produto_empresa_estado (id_empresa, ativo, disponivel);
