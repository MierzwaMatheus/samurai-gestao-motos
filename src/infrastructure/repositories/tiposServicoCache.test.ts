import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/infrastructure/supabase/client", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

import { supabase } from "@/infrastructure/supabase/client";
import {
  tiposServicoCache,
  tiposServicoByIdsCached,
} from "@/infrastructure/repositories/tiposServicoCache";

const mockedFrom = vi.mocked(supabase.from);

const buildRow = (id: string) => ({
  id,
  nome: `Tipo ${id}`,
  preco_oficina: "100.00",
  preco_particular: "150.00",
  categoria: "padrao",
  preco_oficina_com_oleo: null,
  preco_oficina_sem_oleo: null,
  preco_particular_com_oleo: null,
  preco_particular_sem_oleo: null,
  quantidade_servicos: 1,
  criado_em: "2025-01-01T00:00:00Z",
  atualizado_em: "2025-01-01T00:00:00Z",
  valor: null,
});

describe("tiposServicoCache — singleton dedupe do issue #17", () => {
  beforeEach(() => {
    tiposServicoCache._clear();
    vi.clearAllMocks();
  });

  it("getByIds particiona found vs missing; 2ª chamada só usa missing", async () => {
    const inFn = vi
      .fn()
      .mockResolvedValueOnce({ data: [buildRow("a"), buildRow("b")], error: null })
      .mockResolvedValueOnce({ data: [buildRow("c")], error: null });
    const select = vi.fn().mockReturnValue({ in: inFn });
    mockedFrom.mockReturnValue({ select } as never);

    // 1ª chamada: ambos a,b são missing → 1 query
    const r1 = await tiposServicoByIdsCached(["a", "b"]);
    expect(r1.data).toHaveLength(2);
    expect(inFn).toHaveBeenCalledTimes(1);
    expect(inFn).toHaveBeenNthCalledWith(1, "id", ["a", "b"]);

    // 2ª chamada: a,b cacheados, c é missing → 1 query SÓ com c
    const r2 = await tiposServicoByIdsCached(["a", "b", "c"]);
    expect(r2.data).toHaveLength(3);
    expect(inFn).toHaveBeenCalledTimes(2);
    expect(inFn).toHaveBeenNthCalledWith(2, "id", ["c"]);
  });

  it("lista vazia retorna sem chamar Supabase", async () => {
    const select = vi.fn();
    mockedFrom.mockReturnValue({ select } as never);

    const r = await tiposServicoByIdsCached([]);
    expect(r.data).toEqual([]);
    expect(select).not.toHaveBeenCalled();
  });

  it("retorna error se Supabase falhar", async () => {
    const inFn = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "boom" },
    });
    const select = vi.fn().mockReturnValue({ in: inFn });
    mockedFrom.mockReturnValue({ select } as never);

    const r = await tiposServicoByIdsCached(["a"]);
    expect(r.data).toEqual([]);
    expect(r.error).toEqual({ message: "boom" });
  });
});
