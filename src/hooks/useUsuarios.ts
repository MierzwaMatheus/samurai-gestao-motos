import { useState, useEffect, useMemo } from "react";
import { UsuarioRepository } from "@/domain/interfaces/UsuarioRepository";
import { Usuario, AtualizarUsuarioInput } from "@shared/types";
import { ListarUsuariosUseCase } from "@/domain/usecases/ListarUsuariosUseCase";
import { AtualizarUsuarioUseCase } from "@/domain/usecases/AtualizarUsuarioUseCase";
import { DeletarUsuarioUseCase } from "@/domain/usecases/DeletarUsuarioUseCase";

export function useUsuarios(usuarioRepo: UsuarioRepository) {
  const listarUsuariosUseCase = useMemo(
    () => new ListarUsuariosUseCase(usuarioRepo),
    [usuarioRepo]
  );
  const atualizarUsuarioUseCase = useMemo(
    () => new AtualizarUsuarioUseCase(usuarioRepo),
    [usuarioRepo]
  );
  const deletarUsuarioUseCase = useMemo(
    () => new DeletarUsuarioUseCase(usuarioRepo),
    [usuarioRepo]
  );

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const carregarUsuarios = async () => {
    setLoading(true);
    setError(null);
    try {
      const lista = await listarUsuariosUseCase.execute();
      setUsuarios(lista);
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : "Erro ao carregar usuários";
      setError(mensagem);
    } finally {
      setLoading(false);
    }
  };

  const atualizarUsuario = async (id: string, dados: AtualizarUsuarioInput) => {
    try {
      const usuarioAtualizado = await atualizarUsuarioUseCase.execute(id, dados);
      setUsuarios((prev) =>
        prev.map((u) => (u.id === id ? usuarioAtualizado : u))
      );
      return usuarioAtualizado;
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : "Erro ao atualizar usuário";
      throw new Error(mensagem);
    }
  };

  const deletarUsuario = async (id: string) => {
    try {
      await deletarUsuarioUseCase.execute(id);
      setUsuarios((prev) => prev.filter((u) => u.id !== id));
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : "Erro ao deletar usuário";
      throw new Error(mensagem);
    }
  };

  useEffect(() => {
    carregarUsuarios();
  }, []);

  return {
    usuarios,
    loading,
    error,
    recarregar: carregarUsuarios,
    atualizarUsuario,
    deletarUsuario,
  };
}

