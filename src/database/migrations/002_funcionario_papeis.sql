-- Migration 002 — papéis e vínculo de funcionário
--
-- Contexto: até aqui USUARIO não tinha papel, e as rotas administrativas
-- exigiam apenas um token válido — qualquer usuário autenticado podia criar
-- empresa ou produto. Com o app virando gestão de restaurante, o acesso passa
-- a depender de dois dados que o token não carregava: em qual restaurante a
-- pessoa trabalha e com qual papel.
--
-- FUNCIONARIO é tabela separada de USUARIO de propósito: USUARIO é a
-- identidade (quem é, e-mail, senha) e FUNCIONARIO é o vínculo de trabalho.
-- Assim a mesma pessoa pode ser gestora de um restaurante e garçom de outro,
-- que é o que o modelo multi-loja exige.
--
-- O schema.sql já contempla esta tabela e só roda em banco novo
-- (docker-entrypoint-initdb.d). Aplique esta migration em bancos existentes:
--   docker exec -i foodexpress_db mysql -uroot -proot foodexpress < 002_funcionario_papeis.sql

USE foodexpress;

CREATE TABLE IF NOT EXISTS FUNCIONARIO (
    id_funcionario INT AUTO_INCREMENT PRIMARY KEY,
    id_usuario     INT NOT NULL,
    id_empresa     INT NOT NULL,
    papel          ENUM('gestor', 'garcom', 'cozinha') NOT NULL,
    ativo          TINYINT(1) NOT NULL DEFAULT 1,
    dt_admissao    DATETIME NOT NULL DEFAULT NOW(),
    -- Um vínculo por pessoa em cada restaurante: o papel é único por empresa,
    -- então promover alguém é um UPDATE, não uma segunda linha.
    UNIQUE KEY uk_funcionario_usuario_empresa (id_usuario, id_empresa),
    -- Atende a listagem de equipe por restaurante e papel (Fase 3).
    KEY idx_funcionario_empresa_papel (id_empresa, papel),
    FOREIGN KEY (id_usuario) REFERENCES USUARIO(id_usuario) ON DELETE CASCADE,
    FOREIGN KEY (id_empresa) REFERENCES EMPRESA(id_empresa) ON DELETE CASCADE
);
