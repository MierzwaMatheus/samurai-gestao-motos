import { useMemo, useState } from "react";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
import {
  User,
  Phone,
  Mail,
  MapPin,
  Wrench,
  Search,
  Edit,
  Trash2,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { SupabaseClienteRepository } from "@/infrastructure/repositories/SupabaseClienteRepository";
import { useClientes } from "@/hooks/useClientes";
import { Cliente } from "@shared/types";

export default function Clientes() {
  const clienteRepo = useMemo(() => new SupabaseClienteRepository(), []);
  const { clientes, loading, error, recarregar, atualizarCliente, removerCliente } =
    useClientes(clienteRepo);

  const [busca, setBusca] = useState("");
  const [clienteEditando, setClienteEditando] = useState<Cliente | null>(null);
  const [mostrarDialogEditar, setMostrarDialogEditar] = useState(false);
  const [mostrarDialogDeletar, setMostrarDialogDeletar] = useState(false);
  const [clienteParaDeletar, setClienteParaDeletar] = useState<Cliente | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [deletando, setDeletando] = useState(false);

  const [formData, setFormData] = useState({
    nome: "",
    telefone: "",
    email: "",
    endereco: "",
    cep: "",
  });

  // Filtrar clientes pela busca
  const clientesFiltrados = useMemo(() => {
    if (!busca.trim()) return clientes;
    const buscaLower = busca.toLowerCase();
    return clientes.filter(
      (cliente) =>
        cliente.nome.toLowerCase().includes(buscaLower) ||
        cliente.telefone?.toLowerCase().includes(buscaLower) ||
        cliente.email?.toLowerCase().includes(buscaLower)
    );
  }, [clientes, busca]);

  const handleAbrirDialogEditar = (cliente: Cliente) => {
    setClienteEditando(cliente);
    setFormData({
      nome: cliente.nome,
      telefone: cliente.telefone || "",
      email: cliente.email || "",
      endereco: cliente.endereco || "",
      cep: cliente.cep || "",
    });
    setMostrarDialogEditar(true);
  };

  const handleFecharDialogEditar = () => {
    setMostrarDialogEditar(false);
    setClienteEditando(null);
    setFormData({
      nome: "",
      telefone: "",
      email: "",
      endereco: "",
      cep: "",
    });
  };

  const handleSalvarEdicao = async () => {
    if (!clienteEditando) return;

    if (!formData.nome.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    setSalvando(true);
    try {
      const clienteAtualizado = await clienteRepo.atualizar(clienteEditando.id, {
        nome: formData.nome,
        telefone: formData.telefone || undefined,
        email: formData.email || undefined,
        endereco: formData.endereco || undefined,
        cep: formData.cep?.replace(/\D/g, "") || undefined,
      });
      atualizarCliente(clienteEditando.id, clienteAtualizado);
      toast.success("Cliente atualizado com sucesso!");
      handleFecharDialogEditar();
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : "Erro ao atualizar cliente";
      toast.error(mensagem);
    } finally {
      setSalvando(false);
    }
  };

  const handleAbrirDialogDeletar = (cliente: Cliente) => {
    setClienteParaDeletar(cliente);
    setMostrarDialogDeletar(true);
  };

  const handleFecharDialogDeletar = () => {
    setMostrarDialogDeletar(false);
    setClienteParaDeletar(null);
  };

  const handleDeletar = async () => {
    if (!clienteParaDeletar) return;

    setDeletando(true);
    try {
      await clienteRepo.deletar(clienteParaDeletar.id);
      removerCliente(clienteParaDeletar.id);
      toast.success("Cliente deletado com sucesso!");
      handleFecharDialogDeletar();
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : "Erro ao deletar cliente";
      toast.error(mensagem);
    } finally {
      setDeletando(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background admin-background">
        <Header title="Clientes" />
        <main className="pt-20 pb-32 px-6">
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-accent" />
          </div>
        </main>
        <BottomNav active="clientes" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background admin-background">
        <Header title="Clientes" />
        <main className="pt-20 pb-32 px-6">
          <Card className="p-6 text-center">
            <p className="text-red-500">{error}</p>
            <Button onClick={recarregar} className="mt-4">
              Tentar novamente
            </Button>
          </Card>
        </main>
        <BottomNav active="clientes" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background admin-background">
      <Header title="Clientes" />

      <main className="pt-20 pb-32 px-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Barra de busca */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-foreground/40" size={18} />
            <Input
              placeholder="Buscar por nome, telefone ou email..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-10 bg-card border-foreground/10"
            />
          </div>

          {/* Lista de clientes */}
          {clientesFiltrados.length === 0 ? (
            <Card className="p-8 text-center">
              <User size={48} className="mx-auto mb-4 text-foreground/20" />
              <p className="text-foreground/60">
                {busca ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"}
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {clientesFiltrados.map((cliente) => (
                <Card key={cliente.id} className="bg-card border-foreground/10 p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="p-2 bg-accent/10 rounded-lg">
                        <User size={20} className="text-accent" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-sans text-base font-semibold text-foreground mb-1">
                          {cliente.nome}
                        </h3>
                        {cliente.numeroServicos > 0 && (
                          <div className="flex items-center gap-1 mb-2">
                            <Wrench size={14} className="text-accent" />
                            <span className="text-xs text-foreground/60">
                              {cliente.numeroServicos} serviço{cliente.numeroServicos !== 1 ? "s" : ""}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleAbrirDialogEditar(cliente)}
                        className="h-8 w-8 p-0"
                      >
                        <Edit size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleAbrirDialogDeletar(cliente)}
                        className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    {cliente.telefone && (
                      <div className="flex items-center gap-2 text-sm text-foreground/70">
                        <Phone size={14} />
                        <span>{cliente.telefone}</span>
                      </div>
                    )}
                    {cliente.email && (
                      <div className="flex items-center gap-2 text-sm text-foreground/70">
                        <Mail size={14} />
                        <span>{cliente.email}</span>
                      </div>
                    )}
                    {cliente.endereco && (
                      <div className="flex items-start gap-2 text-sm text-foreground/70">
                        <MapPin size={14} className="mt-0.5" />
                        <span className="flex-1">
                          {cliente.endereco}
                          {cliente.cep && (
                            <span className="text-xs text-foreground/50 ml-1">
                              ({cliente.cep})
                            </span>
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Dialog de edição */}
      <Dialog open={mostrarDialogEditar} onOpenChange={setMostrarDialogEditar}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Cliente</DialogTitle>
            <DialogDescription>
              Atualize as informações do cliente
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome *</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                className="bg-card border-foreground/10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="telefone">Telefone</Label>
              <Input
                id="telefone"
                value={formData.telefone}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, "");
                  const formatted = value.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
                  setFormData({ ...formData, telefone: formatted || value });
                }}
                className="bg-card border-foreground/10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="bg-card border-foreground/10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endereco">Endereço</Label>
              <Input
                id="endereco"
                value={formData.endereco}
                onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                className="bg-card border-foreground/10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cep">CEP</Label>
              <Input
                id="cep"
                value={formData.cep}
                onChange={(e) => {
                  const cep = e.target.value.replace(/\D/g, "");
                  const cepFormatado = cep.replace(/(\d{5})(\d{3})/, "$1-$2");
                  setFormData({ ...formData, cep: cepFormatado });
                }}
                maxLength={9}
                className="bg-card border-foreground/10"
              />
            </div>
            <div className="flex gap-2 justify-end pt-4">
              <Button
                variant="outline"
                onClick={handleFecharDialogEditar}
                disabled={salvando}
              >
                Cancelar
              </Button>
              <Button onClick={handleSalvarEdicao} disabled={salvando}>
                {salvando ? (
                  <>
                    <Loader2 size={16} className="mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  "Salvar"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmação de exclusão */}
      <AlertDialog open={mostrarDialogDeletar} onOpenChange={setMostrarDialogDeletar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja deletar o cliente "{clienteParaDeletar?.nome}"?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleFecharDialogDeletar} disabled={deletando}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletar}
              disabled={deletando}
              className="bg-red-500 hover:bg-red-600"
            >
              {deletando ? (
                <>
                  <Loader2 size={16} className="mr-2 animate-spin" />
                  Deletando...
                </>
              ) : (
                "Deletar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BottomNav active="clientes" />
    </div>
  );
}

