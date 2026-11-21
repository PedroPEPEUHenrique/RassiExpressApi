-- Migration 007 — derruba o que restou do delivery
--
-- As rotas e o código destas tabelas saíram nas fases 0 e 1; as tabelas
-- ficaram. Esta migration fecha a conta:
--
--   USER_FAVORITO      cliente favoritava restaurante e prato
--   BANNER, DESTAQUE   vitrine do app de delivery
--   EMPRESA_CATEGORIA  ligava restaurante a tipo de cozinha
--   CATEGORIAS         os tipos de cozinha (BURGUER, PIZZA, ...)
--
-- Nenhuma é lida por nenhum caso de uso. Num sistema de gestão de salão, o
-- tipo de cozinha do restaurante não tem consumidor, e favorito de cliente
-- não existe como conceito: quem usa o app é a equipe.
--
-- A ordem importa: EMPRESA_CATEGORIA referencia CATEGORIAS, então sai antes.

DROP TABLE IF EXISTS DESTAQUE;
DROP TABLE IF EXISTS BANNER;
DROP TABLE IF EXISTS USER_FAVORITO;
DROP TABLE IF EXISTS EMPRESA_CATEGORIA;
DROP TABLE IF EXISTS CATEGORIAS;

-- PEDIDO.id_usuario sobrevive, nullable e sem uso novo: é o que mantém
-- legível um pedido de delivery antigo, caso exista algum no histórico.
-- Apagá-lo reescreveria o passado para economizar uma coluna.
