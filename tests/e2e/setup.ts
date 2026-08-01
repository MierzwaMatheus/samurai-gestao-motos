/**
 * Setup E2E — carrega env do Supabase local via `supabase status --output json`
 * e expõe um cliente @supabase/supabase-js autenticado com a service role
 * (necessária para popular dados fake e ler RPCs sem RLS).
 *
 * Pré-requisito: Supabase local rodando (`pnpm sup:start`).
 */
import { execFileSync, execSync } from "node:child_process";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * `supabase status` precisa enxergar o container certo, que tem o nome
 * derivado do diretório do projeto Supabase (não do worktree). Quando o
 * shell não tem o grupo `docker` ativo (típico em subshells), envolvemos
 * a chamada em `sg docker -c` para ativá-lo on-demand.
 */
function readSupabaseStatus(): Record<string, string> {
  // O nome do container do Supabase vem do diretório onde o `supabase
  // start` foi rodado. Para garantir que `supabase status` aponte para o
  // stack certo, identificamos o worktree raiz (o primeiro listado por
  // `git worktree list --porcelain`) e executamos o comando lá.
  const porcelain = execSync("git worktree list --porcelain", {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  const firstWorktree = porcelain.split("\n").find((line) =>
    line.startsWith("worktree "),
  );
  const projectDir = firstWorktree
    ? firstWorktree.replace(/^worktree\s+/, "").trim()
    : process.cwd();
  const command = `cd ${JSON.stringify(projectDir)} && supabase status --output json`;

  const wrapInDockerGroup = (): boolean => {
    try {
      return !execSync("groups", { stdio: ["ignore", "pipe", "ignore"] })
        .toString()
        .match(/\bdocker\b/);
    } catch {
      return true;
    }
  };

  const run = (): string => {
    if (wrapInDockerGroup()) {
      return execSync(
        `sg docker -c "[ -s \\"\\$HOME/.nvm/nvm.sh\\" ] && . \\"\\$HOME/.nvm/nvm.sh\\" >/dev/null 2>&1; nvm use 22 >/dev/null 2>&1; ${command}"`,
        { encoding: "utf8" },
      );
    }
    return execFileSync("supabase", ["status", "--output", "json"], {
      encoding: "utf8",
      cwd: projectDir,
    });
  };

  try {
    return JSON.parse(run()) as Record<string, string>;
  } catch (err) {
    throw new Error(
      `Não foi possível ler 'supabase status'. O stack local está rodando?\n${String(err)}`,
    );
  }
}

const STATUS_JSON = readSupabaseStatus();

const url = STATUS_JSON["API_URL"];
const serviceKey = STATUS_JSON["SERVICE_ROLE_KEY"];

if (!url || !serviceKey) {
  throw new Error(
    "supabase status não retornou API_URL/SERVICE_ROLE_KEY. Reinicie o stack.",
  );
}

process.env.SUPABASE_URL = url;
process.env.SUPABASE_ANON_KEY = STATUS_JSON["ANON_KEY"] ?? "";
process.env.SUPABASE_SERVICE_ROLE_KEY = serviceKey;
process.env.VITE_SUPABASE_URL = url;
process.env.VITE_SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

export const SUPABASE_URL: string = url;
export const SUPABASE_SERVICE_ROLE_KEY: string = serviceKey;

/** Cliente com service role — bypassa RLS, usado em setup/teardown do E2E. */
export const supabaseAdmin: SupabaseClient = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** Usuário fixo para satisfazer FKs que apontam para `auth.users.id`/`public.usuarios.id`. */
export const SEED_USER_ID = "00000000-0000-0000-0000-000000000001";
export const SEED_USER_EMAIL = "seed+e2e@samurai.local";
