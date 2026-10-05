# Interdin

Aplicação de gerenciamento de perfis e permissões com Next.js, Tailwind CSS e Prisma.

## Configuração

Use Node.js 22.18 ou superior e PostgreSQL.

1. Execute `npm install` para instalar as dependências e sincronizar o lockfile.
2. Configure `DATABASE_URL` no arquivo `.env` com a conexão do PostgreSQL. Há um exemplo em `.env.example`.
3. Aplique o schema de [prisma/schema.prisma](./prisma/schema.prisma) ao banco e gere o Prisma Client usando o fluxo Prisma compatível com as versões definidas em `package.json`.
4. Execute `npm run dev` e acesse `http://localhost:3000`.

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

> As rotas de gerenciamento devem ser protegidas pela autenticação/autorização da aplicação antes de serem expostas em produção.
