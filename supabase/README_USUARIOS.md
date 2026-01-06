# Gerenciamento de Usuários

Este documento descreve o sistema de gerenciamento de usuários implementado seguindo os princípios SOLID.

## Estrutura

### Migrations

1. **20240101000032_create_usuarios.sql**: Cria a tabela `usuarios` com campos:
   - `id`: UUID (FK para auth.users)
   - `nome`: Nome completo do usuário
   - `email`: Email do usuário
   - `permissao`: 'admin' ou 'usuario'
   - `ativo`: Boolean indicando se o usuário está ativo
   - `criado_em`, `atualizado_em`: Timestamps
   - `criado_por`: ID do admin que criou o usuário

2. **20240101000033_rls_usuarios.sql**: Políticas RLS:
   - Usuários podem ver apenas seus próprios dados
   - Admins podem ver, criar, atualizar e deletar todos os usuários

3. **20240101000034_create_first_admin.sql**: Documentação para criar o primeiro admin

### Edge Function

**criar-usuario**: Função que permite apenas admins criarem novos usuários:
- Valida se o usuário que faz a requisição é admin
- Cria usuário no auth.users
- Cria registro na tabela usuarios
- Retorna erro se algo falhar

### Domain Layer (SOLID)

**Interfaces**:
- `UsuarioRepository`: Contrato para operações CRUD de usuários
- `UsuarioApi`: Contrato para criação via Edge Function

**Use Cases**:
- `CriarUsuarioUseCase`: Validações e criação de usuário
- `ListarUsuariosUseCase`: Listagem de usuários
- `AtualizarUsuarioUseCase`: Atualização de usuário
- `DeletarUsuarioUseCase`: Exclusão de usuário
- `BuscarUsuarioPorIdUseCase`: Busca por ID

### Infrastructure Layer

**Repositories**:
- `SupabaseUsuarioRepository`: Implementação usando Supabase

**API**:
- `SupabaseUsuarioApi`: Implementação para chamar Edge Function

### Frontend

**Página**: `src/pages/Usuarios.tsx`
- Lista todos os usuários (apenas admins)
- Permite criar novos usuários
- Permite editar usuários existentes
- Permite deletar usuários
- Busca por nome ou email

**Hook**: `src/hooks/useUsuarios.ts`
- Gerencia estado e operações de usuários

## Como Usar

### 1. Aplicar Migrations

```bash
npx supabase db push
```

### 2. Criar Primeiro Admin

Como o cadastro padrão está desabilitado, você precisa criar o primeiro admin manualmente:

**Opção 1: Via Dashboard do Supabase**
1. Acesse o dashboard do Supabase
2. Vá em Authentication > Users
3. Clique em "Add User"
4. Preencha email e senha
5. Confirme o email automaticamente
6. No SQL Editor, execute:

```sql
INSERT INTO public.usuarios (id, nome, email, permissao, ativo)
SELECT id, 'Administrador', email, 'admin', true
FROM auth.users
WHERE email = 'seu-email@exemplo.com'
ON CONFLICT (id) DO NOTHING;
```

**Opção 2: Via SQL direto**
```sql
-- Criar usuário no auth.users (substitua os valores)
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'admin@exemplo.com',
  crypt('senha_segura', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW()
);

-- Inserir na tabela usuarios
INSERT INTO public.usuarios (id, nome, email, permissao, ativo)
SELECT id, 'Administrador', email, 'admin', true
FROM auth.users
WHERE email = 'admin@exemplo.com';
```

### 3. Deploy da Edge Function

```bash
npx supabase functions deploy criar-usuario
```

### 4. Configurar Variáveis de Ambiente

Certifique-se de que as seguintes variáveis estão configuradas:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

E na Edge Function:
- `SUPABASE_URL` (automático)
- `SUPABASE_SERVICE_ROLE_KEY` (automático)

### 5. Acessar Interface

1. Faça login com o usuário admin
2. Vá em Configurações
3. Clique em "Gerenciar Usuários"
4. Crie novos usuários através da interface

## Fluxo de Criação de Usuário

1. Admin acessa a página de usuários
2. Clica em "Novo Usuário"
3. Preenche dados (nome, email, senha, permissão)
4. Frontend chama `CriarUsuarioUseCase`
5. Use case valida dados e chama `SupabaseUsuarioApi`
6. API chama Edge Function `criar-usuario`
7. Edge Function:
   - Verifica se usuário atual é admin
   - Cria usuário no auth.users
   - Cria registro na tabela usuarios
   - Retorna sucesso ou erro
8. Frontend atualiza lista de usuários

## Segurança

- Apenas admins podem criar novos usuários
- RLS garante que usuários vejam apenas seus dados
- Admins veem todos os usuários
- Edge Function valida permissões antes de criar
- Senhas são armazenadas criptografadas no Supabase Auth

## Princípios SOLID Aplicados

- **SRP**: Cada use case tem uma única responsabilidade
- **OCP**: Fácil adicionar novos tipos de permissões sem modificar código existente
- **LSP**: Qualquer implementação de UsuarioRepository funciona
- **ISP**: Interfaces pequenas e específicas
- **DIP**: Domain não conhece infraestrutura, apenas interfaces

