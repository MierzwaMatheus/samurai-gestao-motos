# Supabase - Configuração e Deploy

Este diretório contém a configuração do Supabase para o projeto Samurai Gestão de Motos.

## Comandos Principais

⚠️ **IMPORTANTE**: Este projeto usa `npx` para executar comandos do Supabase CLI (não é necessário instalar globalmente).

### Comandos Mais Usados

```bash
# Iniciar Supabase localmente (desenvolvimento)
npx supabase start

# Aplicar migrations no banco remoto
npx supabase db push

# Fazer deploy da Edge Function
npx supabase functions deploy calcular-frete

# Parar Supabase local
npx supabase stop

# Verificar status
npx supabase status
```

## Estrutura

```
supabase/
├── functions/
│   └── calcular-frete/
│       ├── index.ts                          # Edge function para cálculo de frete
│       └── supabase.functions.config.json    # Configuração da função (auth: false)
├── migrations/
│   ├── 20240101000001_create_clientes.sql
│   ├── 20240101000002_create_motos.sql
│   ├── 20240101000003_create_entradas.sql
│   ├── 20240101000004_create_orcamentos.sql
│   ├── 20240101000005_create_fotos.sql
│   ├── 20240101000006_rls_clientes.sql
│   ├── 20240101000007_rls_motos.sql
│   ├── 20240101000008_rls_entradas.sql
│   ├── 20240101000009_rls_orcamentos.sql
│   ├── 20240101000010_rls_fotos.sql
│   ├── 20240101000011_set_user_id_trigger.sql
│   ├── 20240101000012_create_storage_bucket.sql
│   ├── 20240101000013_rls_storage_fotos.sql
│   ├── 20240101000014_fix_storage_rls.sql
│   ├── 20240101000015_update_entradas_campos.sql
│   ├── 20240101000016_add_fotos_status_jsonb.sql
│   ├── 20240101000017_add_numero_servicos_clientes.sql
│   ├── 20240101000018_create_tipos_servico.sql
│   ├── 20240101000019_create_entradas_tipos_servico.sql
│   ├── 20240101000020_rls_tipos_servico.sql
│   ├── 20240101000021_incrementar_servicos_ao_converter_orcamento.sql
│   ├── 20240101000022_set_tipos_servico_user_id_trigger.sql
│   ├── 20240101000023_create_configuracoes_frete.sql
│   └── 20240101000024_add_trigger_configuracoes_frete.sql
├── config.toml              # Configuração do Supabase CLI
└── README.md                # Este arquivo
```

## Pré-requisitos

1. **Conta no Supabase**: Crie uma conta em [https://supabase.com](https://supabase.com)
2. **Supabase CLI**: Instale o CLI do Supabase usando um dos métodos abaixo:

   **Opção 1: Homebrew (Linux/Mac)**
   ```bash
   brew install supabase/tap/supabase
   ```

   **Opção 2: Script de instalação (Linux/Mac)**
   ```bash
   curl -fsSL https://supabase.com/install.sh | sh
   ```

   **Opção 3: Binário direto (Linux)**
   ```bash
   # Baixar o binário
   wget https://github.com/supabase/cli/releases/latest/download/supabase_linux_amd64.deb
   # Instalar
   sudo dpkg -i supabase_linux_amd64.deb
   ```

   **Opção 4: Via npx (sem instalação global)**
   ```bash
   # Use npx para executar sem instalar globalmente
   npx supabase --version
   ```

   ⚠️ **NOTA**: Não use `npm install -g supabase` - não é suportado!

3. **OpenRouteService API Key**: Obtenha uma chave gratuita em [https://openrouteservice.org/dev/#/signup](https://openrouteservice.org/dev/#/signup)
   - A conta gratuita permite 2.000 requisições por dia
   - É suficiente para desenvolvimento e testes

## Configuração Inicial

### 1. Criar Projeto no Supabase

1. Acesse [https://app.supabase.com](https://app.supabase.com)
2. Clique em "New Project"
3. Preencha os dados:
   - **Name**: samurai-gestao-motos (ou o nome que preferir)
   - **Database Password**: Crie uma senha forte
   - **Region**: Escolha a região mais próxima (ex: South America - São Paulo)
4. Aguarde a criação do projeto (pode levar alguns minutos)

### 2. Obter Credenciais

Após criar o projeto, você precisará das seguintes informações:

1. **Project URL**: Encontre em Settings > API > Project URL
   - Formato: `https://xxxxx.supabase.co`

2. **Anon Key**: Encontre em Settings > API > Project API keys > anon public
   - Esta é a chave pública que pode ser exposta no frontend

3. **Service Role Key** (opcional, para operações administrativas):
   - Encontre em Settings > API > Project API keys > service_role
   - ⚠️ **NUNCA exponha esta chave no frontend!**

### 3. Configurar Variáveis de Ambiente

1. Copie o arquivo `env.example` para `.env` na raiz do projeto:
   ```bash
   cp env.example .env
   ```

2. Edite o arquivo `.env` e preencha com suas credenciais:
   ```env
   VITE_SUPABASE_URL=https://seu-projeto-id.supabase.co
   VITE_SUPABASE_ANON_KEY=sua-anon-key-aqui
   OPENROUTE_API_KEY=sua-openroute-api-key-aqui
   ```

### 4. Instalar/Usar Supabase CLI

⚠️ **IMPORTANTE**: O Supabase CLI **NÃO** pode ser instalado via `npm install -g`!

**Opção Recomendada: Usar via npx (sem instalação)**
```bash
# Todos os comandos usarão npx supabase ao invés de supabase
npx supabase --version
```

**Outras opções**: Veja [INSTALL.md](./INSTALL.md) para métodos de instalação.

### 5. Fazer Login no Supabase CLI

```bash
npx supabase login
```

Isso abrirá o navegador para autenticação.

### 6. Vincular Projeto Local ao Projeto Remoto

```bash
npx supabase link --project-ref seu-project-id
```

O `project-id` é a parte do URL antes de `.supabase.co`. Por exemplo, se sua URL é `https://abcdefghijklmnop.supabase.co`, o project-id é `abcdefghijklmnop`.

## Deploy da Edge Function

### 1. Configurar Secret da OpenRouteService

A edge function precisa da API key do OpenRouteService. Configure como secret no Supabase:

```bash
npx supabase secrets set OPENROUTE_API_KEY=sua-openroute-api-key-aqui
```

### 2. Fazer Deploy da Function

```bash
npx supabase functions deploy calcular-frete
```

### 3. Verificar Deploy

Após o deploy, você pode testar a function:

```bash
curl -X POST https://seu-projeto-id.supabase.co/functions/v1/calcular-frete \
  -H "Authorization: Bearer sua-anon-key" \
  -H "Content-Type: application/json" \
  -d '{"cepDestino": "06663490"}'
```

## Desenvolvimento Local

### Iniciar Supabase Local

```bash
npx supabase start
```

Isso iniciará todos os serviços do Supabase localmente (banco de dados, API, Edge Functions, etc.).

### Testar Edge Function Localmente

```bash
npx supabase functions serve calcular-frete
```

Isso iniciará a function localmente em `http://localhost:54321/functions/v1/calcular-frete`

### Parar Supabase Local

```bash
npx supabase stop
```

## Estrutura da Edge Function

A edge function `calcular-frete`:

1. Recebe um CEP de destino no body da requisição
2. Tenta buscar configurações do usuário no banco (CEP origem e valor por km)
3. Se não encontrar configurações, usa valores padrão (CEP: 06653010, Valor: R$ 2,00/km)
4. Busca coordenadas do CEP de origem via ViaCEP
5. Busca coordenadas do CEP de destino via ViaCEP
6. Usa OpenStreetMap Nominatim para geocodificar os endereços
7. Calcula distância usando OpenRouteService
8. Calcula valor do frete: `distância * valor_por_km`
9. Retorna JSON com distância, valor e CEPs

### Request Body

```json
{
  "cepDestino": "06663490"
}
```

### Response

```json
{
  "distanciaKm": 25.5,
  "valorFrete": 51.0,
  "cepOrigem": "24755110",
  "cepDestino": "06663490"
}
```

## Troubleshooting

### Erro: "OPENROUTE_API_KEY não configurada"

Certifique-se de que o secret foi configurado:
```bash
npx supabase secrets list
```

Se não aparecer, configure novamente:
```bash
npx supabase secrets set OPENROUTE_API_KEY=sua-key
```

### Erro de CORS

A edge function já inclui headers CORS. Se ainda houver problemas, verifique se:
- A URL do Supabase está correta no `.env`
- A anon key está correta

### Erro ao buscar coordenadas

- Verifique se o CEP é válido (8 dígitos)
- Verifique se a API do ViaCEP está respondendo
- Verifique se o OpenStreetMap Nominatim está acessível

## Banco de Dados

### Tabelas Criadas

O projeto possui as seguintes tabelas:

1. **clientes** - Armazena informações dos clientes
   - `id` (UUID, PK)
   - `nome` (TEXT, obrigatório)
   - `telefone` (TEXT, opcional)
   - `email` (TEXT, opcional)
   - `endereco` (TEXT, opcional)
   - `cep` (TEXT, opcional)
   - `user_id` (UUID, FK para auth.users)
   - `criado_em` (TIMESTAMPTZ)
   - `atualizado_em` (TIMESTAMPTZ)

2. **motos** - Armazena informações das motos dos clientes
   - `id` (UUID, PK)
   - `cliente_id` (UUID, FK para clientes)
   - `modelo` (TEXT, obrigatório)
   - `placa` (TEXT, opcional)
   - `user_id` (UUID, FK para auth.users)
   - `criado_em` (TIMESTAMPTZ)
   - `atualizado_em` (TIMESTAMPTZ)

3. **entradas** - Armazena entradas de motos na oficina
   - `id` (UUID, PK)
   - `tipo` (TEXT: 'entrada' ou 'orcamento')
   - `cliente_id` (UUID, FK para clientes)
   - `moto_id` (UUID, FK para motos)
   - `endereco` (TEXT, opcional)
   - `cep` (TEXT, opcional)
   - `frete` (DECIMAL, padrão 0)
   - `descricao` (TEXT, opcional)
   - `status` (TEXT: 'pendente', 'alinhando', 'concluido')
   - `progresso` (INTEGER, 0-100)
   - `user_id` (UUID, FK para auth.users)
   - `criado_em` (TIMESTAMPTZ)
   - `atualizado_em` (TIMESTAMPTZ)

4. **orcamentos** - Armazena informações detalhadas dos orçamentos
   - `id` (UUID, PK)
   - `entrada_id` (UUID, FK para entradas)
   - `valor` (DECIMAL, obrigatório)
   - `data_expiracao` (TIMESTAMPTZ, obrigatório)
   - `status` (TEXT: 'ativo', 'expirado', 'convertido')
   - `user_id` (UUID, FK para auth.users)
   - `criado_em` (TIMESTAMPTZ)
   - `atualizado_em` (TIMESTAMPTZ)

5. **fotos** - Armazena referências às fotos das motos
   - `id` (UUID, PK)
   - `entrada_id` (UUID, FK para entradas)
   - `url` (TEXT, obrigatório)
   - `tipo` (TEXT: 'moto', 'status', 'documento')
   - `user_id` (UUID, FK para auth.users)
   - `criado_em` (TIMESTAMPTZ)

6. **tipos_servico** - Armazena tipos de serviço disponíveis
   - `id` (UUID, PK)
   - `nome` (TEXT, obrigatório)
   - `quantidade_servicos` (INTEGER, padrão 0)
   - `user_id` (UUID, FK para auth.users)
   - `criado_em` (TIMESTAMPTZ)
   - `atualizado_em` (TIMESTAMPTZ)

7. **configuracoes_frete** - Armazena configurações de frete por usuário
   - `id` (UUID, PK)
   - `cep_origem` (TEXT, obrigatório) - CEP de origem para cálculo de frete
   - `valor_por_km` (NUMERIC, obrigatório, padrão 2.00) - Valor cobrado por km
   - `user_id` (UUID, FK para auth.users, UNIQUE) - Um registro por usuário
   - `criado_em` (TIMESTAMPTZ)
   - `atualizado_em` (TIMESTAMPTZ)

### Row Level Security (RLS)

Todas as tabelas possuem RLS habilitado com as seguintes políticas:

- **SELECT**: Usuários autenticados podem ver apenas seus próprios registros
- **INSERT**: Usuários autenticados podem inserir apenas seus próprios registros
- **UPDATE**: Usuários autenticados podem atualizar apenas seus próprios registros
- **DELETE**: Usuários autenticados podem deletar apenas seus próprios registros

Todas as políticas verificam que `auth.uid() = user_id` para garantir isolamento de dados entre usuários.

### Aplicar Migrations

Para aplicar as migrations no banco de dados remoto:

```bash
npx supabase db push
```

Para aplicar apenas localmente (desenvolvimento):

```bash
npx supabase migration up
```

## Autenticação

O projeto utiliza autenticação do Supabase Auth. Os usuários precisam:

1. Criar uma conta através da tela de login
2. Fazer login com email e senha
3. Todas as operações no banco são automaticamente filtradas pelo `user_id` através do RLS

A tela de login está disponível em `/login` e é protegida automaticamente - usuários não autenticados são redirecionados para ela.

## Recursos

- [Documentação Supabase](https://supabase.com/docs)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [OpenRouteService Docs](https://openrouteservice.org/dev/#/api-docs)
- [ViaCEP API](https://viacep.com.br/)

