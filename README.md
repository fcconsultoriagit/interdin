# Interdin

Aplicação de gerenciamento de perfis e permissões com Next.js, Tailwind CSS e Prisma.

## Configuração

Use Node.js 22.18 ou superior e PostgreSQL.

1. Execute `npm install` para instalar as dependências e sincronizar o lockfile.
2. Configure `DATABASE_URL` no arquivo `.env` com a conexão do PostgreSQL. Há um exemplo em `.env.example`.
3. Configure `AUTH_SECRET` com um segredo aleatório de pelo menos 32 caracteres. Gere um valor com `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"` e mantenha-o privado.
4. Aplique o schema de [prisma/schema.prisma](./prisma/schema.prisma) ao banco e gere o Prisma Client usando o fluxo Prisma compatível com as versões definidas em `package.json`.
5. Execute `npm run dev` e acesse `http://localhost:3000/login`.

O login local autentica usuários ativos da tabela `usuarios` por e-mail e senha. A sessão é assinada no servidor e mantida em cookie HTTP-only por oito horas. Para o primeiro acesso, associe um usuário confiável a um perfil e marque esse perfil como administrador total (`administradorTotal = true`) no banco. Após a migração, faça isso apenas para uma conta controlada pela equipe de administração; administradores totais podem então conceder esse nível pelo gerenciamento de perfis. Um perfil sem essa flag também é reconhecido como administrador total se possuir todas as cinco ações para todos os recursos.

Para provisionar o administrador master de setup, execute `npm run setup:admin` com `ADMIN_SETUP_PASSWORD` definido apenas no ambiente do processo. O script cria um `AUTH_SECRET` aleatório no `.env` se ainda não houver um, localiza ou cria `fdscosta@tjba.jus.br`, associa-o ao perfil `Administrador` e concede as cinco ações a todos os recursos do catálogo. A senha temporária não fica gravada no repositório.

As rotas de páginas verificam `visualizar`, os itens de navegação verificam `verMenu` e os endpoints protegidos de `/api/usuarios`, `/api/perfis`, `/api/unidades` e `/api/cargos` verificam a ação correspondente antes de executar consultas. Usuários que não sejam administradores totais também não podem conceder permissões, atribuir perfis com ações que não possuem ou modificar contas/perfis com privilégios superiores.

O catálogo inicial de módulos e recursos é criado de forma idempotente na primeira consulta à API.
O catálogo RBAC está organizado em Visão Geral, Tarefas, Operações e Análises e Configurações. Ao sincronizar o catálogo, permissões de recursos existentes que mudaram de módulo são transferidas para os novos registros.

O menu inclui `/painel`, `/tarefas/minhas`, `/tarefas`, `/tarefas/kanban`, `/tarefas/colaboracoes`, `/relatorios` e `/configuracoes`. As rotas de tarefas, painel, relatórios e configurações estão disponíveis como estruturas de tela, mas ainda não possuem fluxos funcionais ou persistência. O badge de tarefas atribuídas não é exibido enquanto não existir uma fonte real de tarefas vinculada ao usuário.

## API

- `GET /api/perfis`: lista perfis, usuários vinculados, módulos e recursos.
- `POST /api/perfis`: cria um perfil com suas permissões.
- `PATCH /api/perfis/:id`: atualiza dados e permissões do perfil.
- `DELETE /api/perfis/:id`: exclui um perfil; usuários vinculados ficam sem perfil.
- A gestão de perfis e permissões está disponível em `/perfis` (a rota inicial `/` continua compatível).
- `GET /api/unidades`: lista unidades com a quantidade de usuários vinculados.
- `POST /api/unidades`: cadastra unidade com nome e sigla.
- `PATCH /api/unidades/:id`: edita nome/sigla e altera o status com `{ "ativo": false }`.
- `GET /api/cargos`: lista cargos com a quantidade de usuários vinculados.
- `POST /api/cargos`: cadastra cargo com nome.
- `PATCH /api/cargos/:id`: edita o nome e altera o status com `{ "ativo": false }`.

As telas de gestão estão disponíveis em `/unidades` e `/cargos`.

- `GET /api/usuarios`: lista usuários com unidade, cargo, perfil e permissões. Aceita `busca` (ou `search`/`q`), `unidadeId`, `cargoId`, `perfilId` e `status=ativo|inativo`.
- `POST /api/usuarios`: cadastra usuário com nome, e-mail e senha; vínculos de unidade, cargo e perfil são opcionais.
- `PUT`/`PATCH /api/usuarios/:id`: atualiza os dados do usuário e seus vínculos; senha vazia mantém a senha atual.
- `DELETE /api/usuarios/:id`: desativa o usuário sem remover o registro.

A gestão de usuários está disponível em `/usuarios`.

- `POST /api/auth/login`: autentica com `{ "email": "...", "senha": "..." }` e inicia a sessão HTTP-only.
- `POST /api/auth/logout`: encerra a sessão.

As rotas de gerenciamento e páginas institucionais exigem sessão e autorização RBAC. Para o primeiro acesso, provisione um usuário ativo com senha bcrypt e associe-o a um perfil com permissões totais; não há cadastro público de contas.
