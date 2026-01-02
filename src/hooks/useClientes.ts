import { useState, useEffect, useMemo } from "react";
import { ClienteRepository } from "@/domain/interfaces/ClienteRepository";
import { Cliente } from "@shared/types";

export function useClientes(clienteRepo: ClienteRepository) {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const carregar = async () => {
    setLoading(true);
    setError(null);
    try {
      const dados = await clienteRepo.listar();
      setClientes(dados);
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : "Erro ao carregar clientes";
      setError(mensagem);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const atualizarCliente = (clienteId: string, atualizacoes: Partial<Cliente>) => {
    setClientes((prevClientes) =>
      prevClientes.map((cliente) =>
        cliente.id === clienteId ? { ...cliente, ...atualizacoes } : cliente
      )
    );
  };

  const removerCliente = (clienteId: string) => {
    setClientes((prevClientes) =>
      prevClientes.filter((cliente) => cliente.id !== clienteId)
    );
  };

  return { clientes, loading, error, recarregar: carregar, atualizarCliente, removerCliente };
}

