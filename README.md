# Interdin

Aplicação de gerenciamento de perfis e permissões com Next.js, Tailwind CSS e Prisma.

## Configuração

Use Node.js 22.18 ou superior e PostgreSQL.

1. Execute `npm install` para instalar as dependências e sincronizar o lockfile.
2. Configure `DATABASE_URL` no arquivo `.env` com a conexão do PostgreSQL. Há um exemplo em `.env.example`.
3. Aplique o schema de [prisma/schema.prisma](./prisma/schema.prisma) ao banco e gere o Prisma Client usando o fluxo Prisma compatível com as versões definidas em `package.json`.
4. Execute `npm run dev` e acesse `http://localhost:3000`.

O catálogo inicial de módulos e recursos é criado de forma idempotente na primeira consulta à API.

## API

- `GET /api/perfis`: lista perfis, usuários vinculados, módulos e recursos.
- `POST /api/perfis`: cria um perfil com suas permissões.
- `PATCH /api/perfis/:id`: atualiza dados e permissões do perfil.
- `DELETE /api/perfis/:id`: exclui um perfil; usuários vinculados ficam sem perfil.

> As rotas de gerenciamento devem ser protegidas pela autenticação/autorização da aplicação antes de serem expostas em produção.
