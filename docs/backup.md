# Backup e restauração do banco

O histórico de vendas é o dado insubstituível deste sistema. Tudo mais se
refaz: cardápio se redigita, equipe se recadastra, mesas se recriam. As
vendas, não.

Este documento é o procedimento. Se você chegou aqui porque o banco se
perdeu, vá direto para [Restaurar de verdade](#restaurar-de-verdade).

---

## Os comandos

```bash
npm run backup              # cria um backup e descarta os vencidos
npm run backup:listar       # o que existe guardado
npm run backup:verificar    # restaura o mais recente e compara com o banco
npm run backup:podar        # só descarta os vencidos
```

Os arquivos vão para `backups/`, comprimidos, com a data no nome:
`foodexpress-2026-11-25T00-50-54-054.sql.gz`. A pasta está no `.gitignore` e
tem de continuar: **o dump contém os hashes de senha da equipe e as vendas
inteiras**. Num repositório remoto isso é vazamento, e apagar depois não
resolve — fica no histórico do git.

## Verificar não é opcional

```bash
npm run backup:verificar
```

Um dump que ninguém nunca restaurou não é backup: é um arquivo que se presume
bom. Este comando cria um banco descartável (`foodexpress_restauracao`),
despeja o backup dentro e compara com o banco que está rodando — colunas,
índices e contagem de linhas tabela por tabela. No fim, apaga o descartável.
O banco em uso não é tocado em momento nenhum.

Ele reprova quando:

- o arquivo não descomprime, ou não termina com a marca `-- Dump completed`
  (dump truncado por disco cheio ou processo morto no meio — o caso mais
  perigoso, porque o arquivo *parece* bom);
- alguma tabela não veio no backup;
- alguma tabela tem linhas no banco e nenhuma no backup.

Diferença de contagem, por si, **não** reprova: o restaurante continuou
vendendo depois do dump, e isso é esperado. O comando mostra a diferença para
você conferir se faz sentido.

Para exigir igualdade exata, `npm run backup:verificar -- --agora` tira um
backup novo e compara contra ele. É o modo sem margem, usado pelo CI.

## Restaurar de verdade

Primeiro confira o que você tem:

```bash
npm run backup:listar
```

**Ensaie antes.** Restaurar num banco de lado não tem risco e mostra o que
você vai receber:

```bash
npm run backup:restaurar -- foodexpress-2026-11-25T00-50-54-054.sql.gz --banco=foodexpress_ensaio
```

Confirmado que o conteúdo é o esperado, aí sim em cima do banco em uso:

```bash
npm run backup:restaurar -- foodexpress-2026-11-25T00-50-54-054.sql.gz --banco=foodexpress --confirmar
```

O `--confirmar` é obrigatório nesse caso porque **o dump começa com DROP
TABLE**: restaurar apaga o que estiver lá. Sem a trava, um nome de banco
digitado errado destruiria dados bons.

Depois da restauração, confira o estado das migrations:

```bash
npm run migrar:status
```

O backup carrega a tabela `schema_migrations` junto, então o banco volta
sabendo em que ponto do histórico está. Se aparecer alguma pendente, é porque
o backup é anterior a uma migration — rode `npm run migrar`.

## Agendar

O comando existe; nada o chama sozinho. Backup que depende de alguém lembrar
não é backup.

### Na máquina de quem desenvolve (Windows)

```powershell
schtasks /create /tn "Backup FoodExpress" /tr "cmd /c cd /d \"C:\Users\Pichau\OneDrive\Área de Trabalho\ExpressFood\RassiExpressApi\" && npm run backup" /sc daily /st 03:00
```

Conferir e remover:

```powershell
schtasks /query /tn "Backup FoodExpress"
schtasks /delete /tn "Backup FoodExpress" /f
```

### No servidor (Linux)

```cron
# Backup diário às 3h, com o log num lugar que se possa consultar depois.
0 3 * * * cd /opt/rassi-api && /usr/bin/npm run backup >> /var/log/rassi-backup.log 2>&1

# Uma vez por semana, provar que o backup presta.
0 4 * * 0 cd /opt/rassi-api && /usr/bin/npm run backup:verificar >> /var/log/rassi-backup.log 2>&1
```

A segunda linha é a que costuma faltar nas instalações que perdem dados: o
backup rodava todo dia e ninguém nunca tentou restaurar.

## Configuração

No `.env`:

| Variável | Padrão | Para que serve |
|---|---|---|
| `BACKUP_DIR` | `backups/` no projeto | Onde guardar. Aponte para fora do projeto se a pasta estiver sincronizada em nuvem e você não quiser os dumps lá. |
| `BACKUP_MANTER_DIAS` | `14` | Idade máxima antes de descartar. |
| `BACKUP_MANTER_MINIMO` | `3` | Quantos nunca descartar, por velhos que sejam. Protege quem ficou um mês sem rodar o sistema. |
| `BACKUP_VIA_DOCKER` | detecta | `1` força usar o `mysqldump` de dentro do container. |
| `BACKUP_CONTAINER` | `foodexpress_db` | Nome do container, quando via Docker. |

O script procura o `mysqldump` no PATH do host e, não achando, usa o de
dentro do container. Rodando dentro do container, o servidor está em
`127.0.0.1:3306` — e não na porta publicada que o `.env` descreve, que é a
visão do host.

## O que isto não resolve

**Cópia fora da máquina.** Se `backups/` estiver no mesmo disco do banco, uma
falha de disco leva os dois. Hoje a pasta fica dentro do OneDrive, o que dá
uma cópia remota de brinde — mas isso é efeito colateral do lugar onde o
projeto está, não uma decisão de arquitetura, e põe hash de senha e vendas
num serviço de terceiro. Decida conscientemente: ou assuma o OneDrive como o
destino remoto, ou aponte `BACKUP_DIR` para fora dele e combine uma cópia
remota de propósito.

**Ponto no tempo.** Restaura-se o estado do último backup; o que entrou entre
ele e a falha se perde. Para zerar essa janela seria preciso binlog e
restauração incremental, o que não existe aqui.

**Aviso de falha.** Se o backup agendado parar de rodar, nada avisa. Com o
cron acima, o log existe mas ninguém o lê. O `backup:listar` mostra a idade
do mais recente — vale olhar de vez em quando até haver monitoramento.
