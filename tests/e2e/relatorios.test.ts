/**
 * Testes E2E — Issue #4 / Ciclo 4/4
 *
 * Valida integração real dos relatórios contra Supabase local:
 *   - Seed idempotente popula >=100 entradas concluídas distribuídas em >=12 meses.
 *   - RPC `fn_relatorio_por_periodo` retorna >=100 linhas sem filtro.
 *   - Hook `useRelatorioExcel` agrega todas as 100+ rows (mesma RPC).
 *   - `vw_relatorio_excel` (17 colunas) tem payload maior que a RPC
 *     (11 colunas) — redução mensurável de payload quando usamos a RPC.
 *   - Hooks dos ciclos 1+2 retornam shapes válidos contra dados reais.
 */
import { execFileSync, execSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { supabaseAdmin } from "./setup";

// Mock do singleton do Supabase ANTES dos imports dos hooks. Como o
// client.ts lê `import.meta.env.VITE_SUPABASE_URL` em tempo de
// inicialização do módulo, sobrescrevemos o módulo para devolver o admin
// client (service role) — assim os hooks bypassam RLS no E2E e ainda
// usam o mesmo código de produção.
vi.mock("@/infrastructure/supabase/client", () => ({
  supabase: supabaseAdmin,
}));

const RPC_NAME = "fn_relatorio_por_periodo";
const MIN_ENTRADAS = 100;
const MIN_MESES_DISTRIBUIDOS = 12;
const RPC_COLUMNS = [
  "Data Entrada",
  "Data Saída",
  "Nome Cliente",
  "Telefone",
  "Modelo Moto",
  "Placa",
  "Forma Pagamento",
  "Status Pagamento",
  "Valor Serviço",
  "Frete",
  "Total",
] as const;
const VIEW_EXTRA_COLUMNS = [
  "Marca",
  "Ano",
  "Cilindrada",
  "Status Serviço",
  "Status Entrega",
  "Descrição",
] as const;

const REPO_ROOT = (() => {
  const porcelain = execSync("git worktree list --porcelain", { encoding: "utf8" });
  return (
    porcelain
      .split("\n")
      .find((l: string) => l.startsWith("worktree "))
      ?.replace(/^worktree\s+/, "")
      .trim() ?? process.cwd()
  );
})();
const WORKTREE_ROOT = (() => {
  const porcelain = execSync("git rev-parse --show-toplevel", { encoding: "utf8" });
  return porcelain.trim() || process.cwd();
})();
const SEED_PATH = (() => {
  const worktreeCandidate = path.resolve(WORKTREE_ROOT, "supabase/seed.sql");
  // Preferir o seed dentro do worktree (arquivos modificados pelo agente);
  // cair para o caminho do repo raiz se não existir.
  try {
    return worktreeCandidate;
  } catch {
    return path.resolve(REPO_ROOT, "supabase/seed.sql");
  }
})();
const DB_CONTAINER_NAME = `supabase_db_${path.basename(REPO_ROOT)}`;

async function loadSeedSql(): Promise<string> {
  return readFile(SEED_PATH, "utf8");
}

async function runSeedViaExec(): Promise<void> {
  const sql = await loadSeedSql();
  const cmd =
    `docker exec -i -e PGPASSWORD=postgres ${DB_CONTAINER_NAME} ` +
    `psql -U postgres -d postgres -v ON_ERROR_STOP=1`;

  // O PATH do subshell do Vitest pode não ter nvm nem `sg`. Carregamos
  // o nvm e envolvemos em `sg docker -c` para garantir o grupo docker.
  // Idêntico ao padrão do scripts/test-deno.sh.
  const wrapped = `[ -s "\$HOME/.nvm/nvm.sh" ] && . "\$HOME/.nvm/nvm.sh" >/dev/null 2>&1; nvm use 22 >/dev/null 2>&1; ${cmd}`;
  try {
    execFileSync("sg", ["docker", "-c", wrapped], {
      input: sql,
      stdio: ["pipe", "inherit", "inherit"],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Falha ao aplicar seed via docker exec (${DB_CONTAINER_NAME}):\n${message}`,
    );
  }
}

beforeAll(async () => {
  // Garante que o seed esteja aplicado (o arquivo supabase/seed.sql
  // é idempotente — pode ser re-executado).
  const { error: seedError } = await supabaseAdmin.rpc("exec_sql", {
    sql: await loadSeedSql(),
  });
  if (seedError) {
    await runSeedViaExec();
  }
});

afterAll(async () => {
  // Sem teardown destrutivo: o seed é idempotente e mantemos os dados
  // para debug local entre execuções.
});

describe("Issue #4 / Ciclo 4 — Seed do Supabase local", () => {
  it("popula >=100 entradas concluídas", async () => {
    const { count, error } = await supabaseAdmin
      .from("entradas")
      .select("id", { count: "exact", head: true })
      .eq("tipo", "entrada")
      .eq("status", "concluido");

    expect(error).toBeNull();
    expect(count ?? 0).toBeGreaterThanOrEqual(MIN_ENTRADAS);
  });

  it("distribui entradas concluídas por >=12 meses distintos", async () => {
    const { data, error } = await supabaseAdmin
      .from("entradas")
      .select("data_entrada, criado_em")
      .eq("tipo", "entrada")
      .eq("status", "concluido")
      .limit(2000);

    expect(error).toBeNull();
    const meses = new Set<string>();
    for (const row of data ?? []) {
      const raw = row.data_entrada ?? row.criado_em;
      if (!raw) continue;
      meses.add(raw.slice(0, 7)); // YYYY-MM
    }
    expect(meses.size).toBeGreaterThanOrEqual(MIN_MESES_DISTRIBUIDOS);
  });

  it("popula >=100 clientes fake e >=100 motos fake", async () => {
    const [{ count: clienteCount }, { count: motoCount }] = await Promise.all([
      supabaseAdmin.from("clientes").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("motos").select("id", { count: "exact", head: true }),
    ]);
    expect(clienteCount ?? 0).toBeGreaterThanOrEqual(MIN_ENTRADAS);
    expect(motoCount ?? 0).toBeGreaterThanOrEqual(MIN_ENTRADAS);
  });
});

describe("Issue #4 / Ciclo 4 — RPC fn_relatorio_por_periodo", () => {
  it("retorna >=100 linhas sem filtro de data", async () => {
    const { data, error } = await supabaseAdmin.rpc(RPC_NAME, {
      data_inicio: "1970-01-01T00:00:00Z",
      data_fim: "2099-12-31T23:59:59Z",
    });

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
    expect((data ?? []).length).toBeGreaterThanOrEqual(MIN_ENTRADAS);
  });

  it("respeita as 11 colunas esperadas (RelatorioExcelRow)", async () => {
    const { data, error } = await supabaseAdmin.rpc(RPC_NAME, {
      data_inicio: "1970-01-01T00:00:00Z",
      data_fim: "2099-12-31T23:59:59Z",
    });

    expect(error).toBeNull();
    const sample = (data ?? [])[0] as Record<string, unknown> | undefined;
    expect(sample).toBeDefined();
    for (const coluna of RPC_COLUMNS) {
      expect(Object.prototype.hasOwnProperty.call(sample, coluna)).toBe(true);
    }
  });

  it("filtra por período: janela restrita retorna subconjunto coerente", async () => {
    const todosResult = await supabaseAdmin.rpc(RPC_NAME, {
      data_inicio: "1970-01-01T00:00:00Z",
      data_fim: "2099-12-31T23:59:59Z",
    });
    const total = (todosResult.data ?? []).length;

    const { data: vazio, error: errVazio } = await supabaseAdmin.rpc(RPC_NAME, {
      data_inicio: "2000-01-01T00:00:00Z",
      data_fim: "2000-12-31T23:59:59Z",
    });
    expect(errVazio).toBeNull();
    expect(vazio?.length ?? 0).toBe(0);

    const { data: tudo, error: errTudo } = await supabaseAdmin.rpc(RPC_NAME, {
      data_inicio: "1970-01-01T00:00:00Z",
      data_fim: "2099-12-31T23:59:59Z",
    });
    expect(errTudo).toBeNull();
    expect(tudo?.length).toBe(total);
  });
});

describe("Issue #4 / Ciclo 4 — Hook useRelatorioExcel contra dados reais", () => {
  it("agrega todas as 100+ rows via RPC (sem usar a view)", async () => {
    const clientModule = await import("@/infrastructure/supabase/client");
    const supabase = clientModule.supabase;
    const fromSpy = vi.spyOn(supabase, "from");
    const rpcSpy = vi.spyOn(supabase, "rpc");

    const { useRelatorioExcel } = await import(
      "../../src/hooks/useRelatorioExcel"
    );
    const { result } = renderHook(() => useRelatorioExcel());
    await act(async () => {
      await result.current.fetchRelatorio();
    });

    // Comportamento de quantidade: 100+ rows.
    expect((result.current.data ?? []).length).toBeGreaterThanOrEqual(
      MIN_ENTRADAS,
    );

    // Shape da RPC: 11 colunas canônicas, sem as 6 colunas extras da view.
    const first = (result.current.data ?? [])[0] as
      | Record<string, unknown>
      | undefined;
    expect(first).toBeDefined();
    for (const col of RPC_COLUMNS) {
      expect(Object.prototype.hasOwnProperty.call(first, col)).toBe(true);
    }
    for (const col of VIEW_EXTRA_COLUMNS) {
      expect(Object.prototype.hasOwnProperty.call(first, col)).toBe(false);
    }

    // A RPC foi chamada com o nome correto.
    expect(rpcSpy).toHaveBeenCalled();
    const calledWithFn = rpcSpy.mock.calls.some(
      (args) => args[0] === RPC_NAME,
    );
    expect(calledWithFn).toBe(true);

    // E a view (from('vw_relatorio_excel')) NÃO foi consultada.
    const calledView = fromSpy.mock.calls.some(
      (args) => args[0] === "vw_relatorio_excel",
    );
    expect(calledView).toBe(false);
  });
});

describe("Issue #4 / Ciclo 4 — Redução de payload com select específico", () => {
  it("RPC com 11 colunas pesa menos que vw_relatorio_excel (17 colunas) para o mesmo dataset", async () => {
    const rpcResponse = await supabaseAdmin.rpc(RPC_NAME, {
      data_inicio: "1970-01-01T00:00:00Z",
      data_fim: "2099-12-31T23:59:59Z",
    });
    if (rpcResponse.error) {
      throw new Error(`RPC error: ${rpcResponse.error.message}`);
    }
    const rpcData = Array.isArray(rpcResponse.data) ? rpcResponse.data : [];
    const rpcPayload = JSON.stringify(rpcData);

    const viewResponse = await supabaseAdmin
      .from("vw_relatorio_excel")
      .select("*");
    if (viewResponse.error) {
      throw new Error(`view error: ${viewResponse.error.message}`);
    }
    const viewData = Array.isArray(viewResponse.data) ? viewResponse.data : [];
    const viewPayload = JSON.stringify(viewData);

    // View deve trazer as 6 colunas extras (Marca/Ano/Cilindrada/Status Serviço/Status Entrega/Descrição)
    const sample = viewData[0] as Record<string, unknown> | undefined;
    if (sample) {
      for (const coluna of VIEW_EXTRA_COLUMNS) {
        expect(Object.prototype.hasOwnProperty.call(sample, coluna)).toBe(true);
      }
    }

    expect(rpcData.length).toBeGreaterThanOrEqual(MIN_ENTRADAS);
    expect(viewData.length).toBeGreaterThanOrEqual(MIN_ENTRADAS);
    expect(rpcPayload.length).toBeGreaterThan(0);
    expect(viewPayload.length).toBeGreaterThan(rpcPayload.length);
    // Redução mensurável: view >= 1.2x o tamanho da RPC.
    expect(viewPayload.length / rpcPayload.length).toBeGreaterThanOrEqual(1.2);
  });
});

describe("Issue #4 / Ciclo 4 — Hooks dos ciclos 1+2 contra dados reais", () => {
  it("useFaturamentoMensal retorna séries com shape válido", async () => {
    const { useFaturamentoMensal } = await import(
      "../../src/hooks/useRelatorios"
    );
    const { result } = renderHook(() => useFaturamentoMensal("12m"));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const data = (result.current.data ?? []) as Array<{
      mes: string;
      total_entradas: number;
      faturamento_total: number;
    }>;
    expect(data.length).toBeGreaterThan(0);
    for (const row of data) {
      expect(typeof row.mes).toBe("string");
      expect(typeof row.total_entradas).toBe("number");
      expect(typeof row.faturamento_total).toBe("number");
    }
  });

  it("useStatusEntradas retorna status categóricos ordenados", async () => {
    const { useStatusEntradas } = await import("../../src/hooks/useRelatorios");
    const { result } = renderHook(() => useStatusEntradas());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const data = (result.current.data ?? []) as Array<{
      status: string;
      quantidade: number;
    }>;
    expect(data.length).toBeGreaterThan(0);
    for (let i = 1; i < data.length; i++) {
      expect(data[i - 1]!.quantidade).toBeGreaterThanOrEqual(
        data[i]!.quantidade,
      );
    }
  });

  it("useTopClientes respeita o limit informado", async () => {
    const { useTopClientes } = await import("../../src/hooks/useRelatorios");
    const { result } = renderHook(() => useTopClientes(5));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const data = (result.current.data ?? []) as Array<unknown>;
    expect(data.length).toBeLessThanOrEqual(5);
    expect(data.length).toBeGreaterThan(0);
  });

  it("useMetricasPerformance retorna totais globais não-nulos", async () => {
    const { useMetricasPerformance } = await import(
      "../../src/hooks/useRelatorios"
    );
    const { result } = renderHook(() => useMetricasPerformance());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const data = result.current.data as {
      total_entradas: number;
      faturamento_total: number;
    } | null;
    expect(data).not.toBeNull();
    expect(data!.total_entradas).toBeGreaterThanOrEqual(MIN_ENTRADAS);
    expect(data!.faturamento_total).toBeGreaterThan(0);
  });
});

// `fileURLToPath` import é mantido para compatibilidade com ambientes
// onde o setup reimporte os helpers; mantém o esbuild feliz em configs
// estritos.
void fileURLToPath;
