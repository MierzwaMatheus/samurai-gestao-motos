import { useState, useEffect, useMemo, useCallback } from "react";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import { TipoServico } from "@shared/types";
import { TipoServicoRepository } from "@/domain/interfaces/TipoServicoRepository";
import { CriarTipoServicoUseCase } from "@/domain/usecases/CriarTipoServicoUseCase";
import { ListarTiposServicoUseCase } from "@/domain/usecases/ListarTiposServicoUseCase";
import { AtualizarTipoServicoUseCase } from "@/domain/usecases/AtualizarTipoServicoUseCase";
import { DeletarTipoServicoUseCase } from "@/domain/usecases/DeletarTipoServicoUseCase";
import { SupabaseTipoServicoRepository } from "@/infrastructure/repositories/SupabaseTipoServicoRepository";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card } from "@/components/ui/card";
import { Plus, Edit, Trash2, Wrench, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function Servicos() {
  // Inicialização das dependências seguindo DIP
  const tipoServicoRepo = useMemo(() => new SupabaseTipoServicoRepository(), []);
  const criarTipoServicoUseCase = useMemo(
    () => new CriarTipoServicoUseCase(tipoServicoRepo),
    [tipoServicoRepo]
  );
  const listarTiposServicoUseCase = useMemo(
    () => new ListarTiposServicoUseCase(tipoServicoRepo),
    [tipoServicoRepo]
  );
  const atualizarTipoServicoUseCase = useMemo(
    () => new AtualizarTipoServicoUseCase(tipoServicoRepo),
    [tipoServicoRepo]
  );
  const deletarTipoServicoUseCase = useMemo(
    () => new DeletarTipoServicoUseCase(tipoServicoRepo),
    [tipoServicoRepo]
  );

  const [tiposServico, setTiposServico] = useState<TipoServico[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogCriarOpen, setDialogCriarOpen] = useState(false);
  const [dialogEditarOpen, setDialogEditarOpen] = useState(false);
  const [dialogDeletarOpen, setDialogDeletarOpen] = useState(false);
  const [tipoEditando, setTipoEditando] = useState<TipoServico | null>(null);
  const [tipoDeletando, setTipoDeletando] = useState<TipoServico | null>(null);
  const [novoTipoNome, setNovoTipoNome] = useState("");
  const [novoTipoPrecoOficina, setNovoTipoPrecoOficina] = useState("");
  const [novoTipoPrecoParticular, setNovoTipoPrecoParticular] = useState("");
  const [editandoNome, setEditandoNome] = useState("");
  const [editandoPrecoOficina, setEditandoPrecoOficina] = useState("");
  const [editandoPrecoParticular, setEditandoPrecoParticular] = useState("");
  const [criando, setCriando] = useState(false);
  const [editando, setEditando] = useState(false);
  const [deletando, setDeletando] = useState(false);

  // Buscar tipos de serviço
  const buscarTiposServico = useCallback(async () => {
    setLoading(true);
    try {
      const resultados = await listarTiposServicoUseCase.execute(
        searchQuery.trim() || undefined
      );
      setTiposServico(resultados);
    } catch (error) {
      console.error("Erro ao buscar tipos de serviço:", error);
      toast.error("Erro ao buscar tipos de serviço");
      setTiposServico([]);
    } finally {
      setLoading(false);
    }
  }, [listarTiposServicoUseCase, searchQuery]);

  useEffect(() => {
    buscarTiposServico();
  }, [buscarTiposServico]);

  const handleCriarTipoServico = async () => {
    if (!novoTipoNome.trim()) {
      toast.error("Nome do tipo de serviço é obrigatório");
      return;
    }

    const precoOficina = parseFloat(novoTipoPrecoOficina) || 0;
    const precoParticular = parseFloat(novoTipoPrecoParticular) || 0;
    if (precoOficina < 0) {
      toast.error("Preço oficina não pode ser negativo");
      return;
    }
    if (precoParticular < 0) {
      toast.error("Preço particular não pode ser negativo");
      return;
    }

    setCriando(true);
    try {
      await criarTipoServicoUseCase.execute(novoTipoNome.trim(), precoOficina, precoParticular);
      toast.success("Tipo de serviço criado com sucesso!");
      setNovoTipoNome("");
      setNovoTipoPrecoOficina("");
      setNovoTipoPrecoParticular("");
      setDialogCriarOpen(false);
      buscarTiposServico();
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : "Erro ao criar tipo de serviço";
      toast.error(mensagem);
    } finally {
      setCriando(false);
    }
  };

  const handleEditarTipoServico = async () => {
    if (!tipoEditando) return;
    if (!editandoNome.trim()) {
      toast.error("Nome do tipo de serviço é obrigatório");
      return;
    }

    const precoOficina = parseFloat(editandoPrecoOficina) || 0;
    const precoParticular = parseFloat(editandoPrecoParticular) || 0;
    if (precoOficina < 0) {
      toast.error("Preço oficina não pode ser negativo");
      return;
    }
    if (precoParticular < 0) {
      toast.error("Preço particular não pode ser negativo");
      return;
    }

    setEditando(true);
    try {
      await atualizarTipoServicoUseCase.execute(tipoEditando.id, {
        nome: editandoNome.trim(),
        precoOficina: precoOficina,
        precoParticular: precoParticular,
      });
      toast.success("Tipo de serviço atualizado com sucesso!");
      setDialogEditarOpen(false);
      setTipoEditando(null);
      buscarTiposServico();
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : "Erro ao atualizar tipo de serviço";
      toast.error(mensagem);
    } finally {
      setEditando(false);
    }
  };

  const handleAbrirDialogEditar = (tipo: TipoServico) => {
    setTipoEditando(tipo);
    setEditandoNome(tipo.nome);
    setEditandoPrecoOficina(tipo.precoOficina.toString());
    setEditandoPrecoParticular(tipo.precoParticular.toString());
    setDialogEditarOpen(true);
  };

  const handleAbrirDialogDeletar = (tipo: TipoServico) => {
    setTipoDeletando(tipo);
    setDialogDeletarOpen(true);
  };

  const handleDeletarTipoServico = async () => {
    if (!tipoDeletando) return;

    setDeletando(true);
    try {
      await deletarTipoServicoUseCase.execute(tipoDeletando.id);
      toast.success("Tipo de serviço deletado com sucesso!");
      setDialogDeletarOpen(false);
      setTipoDeletando(null);
      buscarTiposServico();
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : "Erro ao deletar tipo de serviço";
      toast.error(mensagem);
    } finally {
      setDeletando(false);
    }
  };

  return (
    <div className="min-h-screen bg-background admin-background">
      <Header title="Serviços" />

      <main className="pt-20 pb-32 px-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Cabeçalho com busca e botão criar */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex-1 w-full sm:max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-foreground/40" size={16} />
                <Input
                  placeholder="Buscar tipos de serviço..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-card border-foreground/10"
                />
              </div>
            </div>
            <Dialog open={dialogCriarOpen} onOpenChange={setDialogCriarOpen}>
              <DialogTrigger asChild>
                <Button className="w-full sm:w-auto">
                  <Plus size={16} className="mr-2" />
                  Novo Tipo de Serviço
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Criar Novo Tipo de Serviço</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="nome">Nome do Tipo de Serviço *</Label>
                    <Input
                      id="nome"
                      value={novoTipoNome}
                      onChange={(e) => setNovoTipoNome(e.target.value)}
                      placeholder="Ex: Revisão, Troca de óleo, etc."
                    />
                  </div>
                  <div>
                    <Label htmlFor="preco-oficina">Preço Oficina (R$) *</Label>
                    <Input
                      id="preco-oficina"
                      type="number"
                      step="0.01"
                      min="0"
                      value={novoTipoPrecoOficina}
                      onChange={(e) => setNovoTipoPrecoOficina(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <Label htmlFor="preco-particular">Preço Particular (R$) *</Label>
                    <Input
                      id="preco-particular"
                      type="number"
                      step="0.01"
                      min="0"
                      value={novoTipoPrecoParticular}
                      onChange={(e) => setNovoTipoPrecoParticular(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <Button
                    onClick={handleCriarTipoServico}
                    disabled={criando || !novoTipoNome.trim()}
                    className="w-full"
                  >
                    {criando ? "Criando..." : "Criar"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Lista de tipos de serviço */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-accent" />
            </div>
          ) : tiposServico.length === 0 ? (
            <Card className="p-12 text-center">
              <Wrench className="mx-auto mb-4 text-foreground/40" size={48} />
              <p className="text-foreground/60">
                {searchQuery
                  ? "Nenhum tipo de serviço encontrado com essa busca."
                  : "Nenhum tipo de serviço cadastrado ainda."}
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {tiposServico.map((tipo) => (
                <Card key={tipo.id} className="p-4 bg-card border-foreground/10">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Wrench size={16} className="text-accent" />
                        <h3 className="font-semibold text-foreground">{tipo.nome}</h3>
                      </div>
                      <div className="text-sm text-foreground/60 mb-1 space-y-0.5">
                        <p>
                          Oficina: <span className="font-semibold text-accent">R$ {tipo.precoOficina.toFixed(2)}</span>
                        </p>
                        <p>
                          Particular: <span className="font-semibold text-accent">R$ {tipo.precoParticular.toFixed(2)}</span>
                        </p>
                      </div>
                      {tipo.quantidadeServicos !== undefined && (
                        <p className="text-xs text-foreground/40">
                          {tipo.quantidadeServicos} serviço(s) realizado(s)
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleAbrirDialogEditar(tipo)}
                      >
                        <Edit size={16} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleAbrirDialogDeletar(tipo)}
                        className="text-red-500 hover:text-red-600 hover:bg-red-50"
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Dialog para editar tipo de serviço */}
          <Dialog open={dialogEditarOpen} onOpenChange={setDialogEditarOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Editar Tipo de Serviço</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="edit-nome">Nome do Tipo de Serviço *</Label>
                  <Input
                    id="edit-nome"
                    value={editandoNome}
                    onChange={(e) => setEditandoNome(e.target.value)}
                    placeholder="Ex: Revisão, Troca de óleo, etc."
                  />
                </div>
                <div>
                  <Label htmlFor="edit-preco-oficina">Preço Oficina (R$) *</Label>
                  <Input
                    id="edit-preco-oficina"
                    type="number"
                    step="0.01"
                    min="0"
                    value={editandoPrecoOficina}
                    onChange={(e) => setEditandoPrecoOficina(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-preco-particular">Preço Particular (R$) *</Label>
                  <Input
                    id="edit-preco-particular"
                    type="number"
                    step="0.01"
                    min="0"
                    value={editandoPrecoParticular}
                    onChange={(e) => setEditandoPrecoParticular(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <Button
                  onClick={handleEditarTipoServico}
                  disabled={editando || !editandoNome.trim()}
                  className="w-full"
                >
                  {editando ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Dialog de confirmação para deletar */}
          <AlertDialog open={dialogDeletarOpen} onOpenChange={setDialogDeletarOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja deletar o tipo de serviço "{tipoDeletando?.nome}"?
                  Esta ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deletando}>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeletarTipoServico}
                  disabled={deletando}
                  className="bg-red-500 hover:bg-red-600"
                >
                  {deletando ? "Deletando..." : "Deletar"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </main>

      <BottomNav active="servicos" />
    </div>
  );
}

