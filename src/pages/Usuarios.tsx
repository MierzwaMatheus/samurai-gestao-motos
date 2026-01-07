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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  User,
  Mail,
  Shield,
  Search,
  Plus,
  Edit,
  Trash2,
  Loader2,
  UserCheck,
  UserX,
} from "lucide-react";
import { toast } from "sonner";
import { Usuario, CriarUsuarioInput, AtualizarUsuarioInput } from "@shared/types";
import { SupabaseUsuarioRepository } from "@/infrastructure/repositories/SupabaseUsuarioRepository";
import { SupabaseUsuarioApi } from "@/infrastructure/api/SupabaseUsuarioApi";
import { CriarUsuarioUseCase } from "@/domain/usecases/CriarUsuarioUseCase";
import { useUsuarios } from "@/hooks/useUsuarios";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";

export default function Usuarios() {
  const { user: currentUser } = useAuth();
  
  // Inicialização das dependências seguindo DIP
  const usuarioRepo = useMemo(() => new SupabaseUsuarioRepository(), []);
  const usuarioApi = useMemo(() => new SupabaseUsuarioApi(), []);
  const criarUsuarioUseCase = useMemo(
    () => new CriarUsuarioUseCase(usuarioApi),
    [usuarioApi]
  );
  
  const { usuarios, loading, recarregar, atualizarUsuario, deletarUsuario } = useUsuarios(usuarioRepo);
  
  const [busca, setBusca] = useState("");
  const [mostrarDialogCriar, setMostrarDialogCriar] = useState(false);
  const [mostrarDialogEditar, setMostrarDialogEditar] = useState(false);
  const [mostrarDialogDeletar, setMostrarDialogDeletar] = useState(false);
  const [usuarioEditando, setUsuarioEditando] = useState<Usuario | null>(null);
  const [usuarioParaDeletar, setUsuarioParaDeletar] = useState<Usuario | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [deletando, setDeletando] = useState(false);

  const [formDataCriar, setFormDataCriar] = useState<CriarUsuarioInput>({
    email: "",
    senha: "",
    nome: "",
    permissao: "usuario",
  });

  const [formDataEditar, setFormDataEditar] = useState<AtualizarUsuarioInput>({
    nome: "",
    permissao: "usuario",
    ativo: true,
  });

  // Filtrar usuários pela busca
  const usuariosFiltrados = useMemo(() => {
    if (!busca.trim()) return usuarios;
    const buscaLower = busca.toLowerCase();
    return usuarios.filter(
      (usuario) =>
        usuario.nome.toLowerCase().includes(buscaLower) ||
        usuario.email.toLowerCase().includes(buscaLower)
    );
  }, [usuarios, busca]);

  // Verificar se usuário atual é admin (aguarda carregar usuários)
  const usuarioAtual = usuarios.find((u) => u.id === currentUser?.id);
  const isAdmin = usuarioAtual?.permissao === "admin";
  
  // Se ainda está carregando, não mostra nada ainda
  if (loading && usuarios.length === 0) {
    return (
      <div className="min-h-screen bg-background admin-background">
        <Header title="Usuários" />
        <main className="pt-20 pb-32 px-6">
          <Card className="bg-card border-foreground/10 p-12">
            <div className="flex flex-col items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-accent mb-4" />
              <p className="text-sm text-foreground/60">Carregando...</p>
            </div>
          </Card>
        </main>
        <BottomNav active="configuracoes" />
      </div>
    );
  }

  const handleAbrirDialogCriar = () => {
    setFormDataCriar({
      email: "",
      senha: "",
      nome: "",
      permissao: "usuario",
    });
    setMostrarDialogCriar(true);
  };

  const handleFecharDialogCriar = () => {
    setMostrarDialogCriar(false);
    setFormDataCriar({
      email: "",
      senha: "",
      nome: "",
      permissao: "usuario",
    });
  };

  const handleCriarUsuario = async () => {
    if (!formDataCriar.email || !formDataCriar.senha || !formDataCriar.nome) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    setSalvando(true);
    try {
      await criarUsuarioUseCase.execute(formDataCriar);
      toast.success("Usuário criado com sucesso!");
      handleFecharDialogCriar();
      await recarregar();
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : "Erro ao criar usuário";
      toast.error(mensagem);
    } finally {
      setSalvando(false);
    }
  };

  const handleAbrirDialogEditar = (usuario: Usuario) => {
    setUsuarioEditando(usuario);
    setFormDataEditar({
      nome: usuario.nome,
      permissao: usuario.permissao,
      ativo: usuario.ativo,
    });
    setMostrarDialogEditar(true);
  };

  const handleFecharDialogEditar = () => {
    setMostrarDialogEditar(false);
    setUsuarioEditando(null);
    setFormDataEditar({
      nome: "",
      permissao: "usuario",
      ativo: true,
    });
  };

  const handleSalvarEdicao = async () => {
    if (!usuarioEditando) return;
    if (!formDataEditar.nome?.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    setSalvando(true);
    try {
      await atualizarUsuario(usuarioEditando.id, formDataEditar);
      toast.success("Usuário atualizado com sucesso!");
      handleFecharDialogEditar();
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : "Erro ao atualizar usuário";
      toast.error(mensagem);
    } finally {
      setSalvando(false);
    }
  };

  const handleAbrirDialogDeletar = (usuario: Usuario) => {
    setUsuarioParaDeletar(usuario);
    setMostrarDialogDeletar(true);
  };

  const handleFecharDialogDeletar = () => {
    setMostrarDialogDeletar(false);
    setUsuarioParaDeletar(null);
  };

  const handleDeletarUsuario = async () => {
    if (!usuarioParaDeletar) return;

    setDeletando(true);
    try {
      await deletarUsuario(usuarioParaDeletar.id);
      toast.success("Usuário deletado com sucesso!");
      handleFecharDialogDeletar();
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : "Erro ao deletar usuário";
      toast.error(mensagem);
    } finally {
      setDeletando(false);
    }
  };

  // Se não for admin, não mostrar a página
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background admin-background">
        <Header title="Usuários" />
        <main className="pt-20 pb-32 px-6">
          <Card className="bg-card border-foreground/10 p-6">
            <div className="text-center">
              <Shield size={48} className="mx-auto mb-4 text-foreground/40" />
              <h2 className="font-serif text-xl text-foreground mb-2">
                Acesso Restrito
              </h2>
              <p className="text-sm text-foreground/60">
                Apenas administradores podem gerenciar usuários.
              </p>
            </div>
          </Card>
        </main>
        <BottomNav active="configuracoes" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background admin-background">
      <Header title="Usuários" />

      <main className="pt-20 pb-32 px-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Barra de busca e botão criar */}
          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <div className="relative w-full sm:w-[calc(100%-160px)]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-foreground/40" size={18} />
              <Input
                placeholder="Buscar por nome ou email..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="pl-10 bg-card border-foreground/10 h-11 w-full"
              />
            </div>
            <Button
              onClick={handleAbrirDialogCriar}
              className="btn-samurai h-11 w-full sm:w-auto sm:min-w-[140px]"
            >
              <Plus size={18} className="mr-2 shrink-0" />
              <span className="hidden sm:inline">Novo Usuário</span>
              <span className="sm:hidden">Novo</span>
            </Button>
          </div>

          {/* Lista de usuários */}
          {loading ? (
            <Card className="bg-card border-foreground/10 p-12">
              <div className="flex flex-col items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-accent mb-4" />
                <p className="text-sm text-foreground/60">Carregando usuários...</p>
              </div>
            </Card>
          ) : usuariosFiltrados.length === 0 ? (
            <Card className="bg-card border-foreground/10 p-12">
              <div className="text-center">
                <User size={48} className="mx-auto mb-4 text-foreground/40" />
                <p className="text-sm text-foreground/60">
                  {busca ? "Nenhum usuário encontrado" : "Nenhum usuário cadastrado"}
                </p>
              </div>
            </Card>
          ) : (
            <div className="space-y-3">
              {usuariosFiltrados.map((usuario) => (
                <Card key={usuario.id} className="bg-card border-foreground/10 p-4">
                  <div className="flex items-start gap-3 sm:gap-4">
                    {/* Avatar/Ícone de Status */}
                    <div className="shrink-0 p-2.5 bg-accent/10 rounded-lg">
                      {usuario.ativo ? (
                        <UserCheck size={20} className="text-accent" />
                      ) : (
                        <UserX size={20} className="text-foreground/40" />
                      )}
                    </div>

                    {/* Informações do Usuário */}
                    <div className="flex-1 min-w-0 space-y-2">
                      {/* Nome e Badges */}
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-foreground text-sm sm:text-base truncate">
                          {usuario.nome}
                        </h3>
                        <Badge
                          variant={usuario.permissao === "admin" ? "default" : "secondary"}
                          className="text-xs shrink-0"
                        >
                          {usuario.permissao === "admin" ? "Admin" : "Usuário"}
                        </Badge>
                        {!usuario.ativo && (
                          <Badge variant="outline" className="text-xs shrink-0">
                            Inativo
                          </Badge>
                        )}
                      </div>

                      {/* Email */}
                      <div className="flex items-center gap-1.5 text-xs sm:text-sm text-foreground/60">
                        <Mail size={12} className="shrink-0" />
                        <span className="truncate">{usuario.email}</span>
                      </div>

                      {/* Ações - Mobile */}
                      <div className="flex gap-2 pt-1 sm:hidden">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAbrirDialogEditar(usuario)}
                          className="flex-1 h-9 text-xs"
                        >
                          <Edit size={14} className="mr-1.5 shrink-0" />
                          <span className="truncate">Editar</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAbrirDialogDeletar(usuario)}
                          className="flex-1 h-9 text-xs text-red-500 hover:text-red-600 border-red-200 hover:border-red-300"
                        >
                          <Trash2 size={14} className="mr-1.5 shrink-0" />
                          <span className="truncate">Excluir</span>
                        </Button>
                      </div>
                    </div>

                    {/* Ações - Desktop */}
                    <div className="hidden sm:flex items-center gap-2 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleAbrirDialogEditar(usuario)}
                        className="h-9"
                        title="Editar usuário"
                      >
                        <Edit size={16} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleAbrirDialogDeletar(usuario)}
                        className="h-9 text-red-500 hover:text-red-600"
                        title="Excluir usuário"
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Dialog Criar Usuário */}
      <Dialog open={mostrarDialogCriar} onOpenChange={setMostrarDialogCriar}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Criar Novo Usuário</DialogTitle>
            <DialogDescription>
              Preencha os dados para criar um novo usuário no sistema.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="nome-criar">Nome *</Label>
              <Input
                id="nome-criar"
                value={formDataCriar.nome}
                onChange={(e) =>
                  setFormDataCriar({ ...formDataCriar, nome: e.target.value })
                }
                placeholder="Nome completo"
                className="bg-card border-foreground/10 h-11"
              />
            </div>
            <div>
              <Label htmlFor="email-criar">Email *</Label>
              <Input
                id="email-criar"
                type="email"
                value={formDataCriar.email}
                onChange={(e) =>
                  setFormDataCriar({ ...formDataCriar, email: e.target.value })
                }
                placeholder="usuario@exemplo.com"
                className="bg-card border-foreground/10 h-11"
              />
            </div>
            <div>
              <Label htmlFor="senha-criar">Senha *</Label>
              <Input
                id="senha-criar"
                type="password"
                value={formDataCriar.senha}
                onChange={(e) =>
                  setFormDataCriar({ ...formDataCriar, senha: e.target.value })
                }
                placeholder="Mínimo 6 caracteres"
                className="bg-card border-foreground/10 h-11"
              />
            </div>
            <div>
              <Label htmlFor="permissao-criar">Permissão *</Label>
              <Select
                value={formDataCriar.permissao}
                onValueChange={(value: "admin" | "usuario") =>
                  setFormDataCriar({ ...formDataCriar, permissao: value })
                }
              >
                <SelectTrigger className="bg-card border-foreground/10 h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="usuario">Usuário</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button
                variant="outline"
                onClick={handleFecharDialogCriar}
                className="flex-1 h-11"
                disabled={salvando}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleCriarUsuario}
                className="flex-1 btn-samurai h-11"
                disabled={salvando}
              >
                {salvando ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin shrink-0" />
                    <span className="truncate">Criando...</span>
                  </>
                ) : (
                  "Criar"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Editar Usuário */}
      <Dialog open={mostrarDialogEditar} onOpenChange={setMostrarDialogEditar}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
            <DialogDescription>
              Atualize as informações do usuário.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="nome-editar">Nome *</Label>
              <Input
                id="nome-editar"
                value={formDataEditar.nome}
                onChange={(e) =>
                  setFormDataEditar({ ...formDataEditar, nome: e.target.value })
                }
                placeholder="Nome completo"
                className="bg-card border-foreground/10 h-11"
              />
            </div>
            <div>
              <Label htmlFor="permissao-editar">Permissão *</Label>
              <Select
                value={formDataEditar.permissao}
                onValueChange={(value: "admin" | "usuario") =>
                  setFormDataEditar({ ...formDataEditar, permissao: value })
                }
              >
                <SelectTrigger className="bg-card border-foreground/10 h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="usuario">Usuário</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="ativo-editar">Status</Label>
              <Select
                value={formDataEditar.ativo ? "ativo" : "inativo"}
                onValueChange={(value) =>
                  setFormDataEditar({ ...formDataEditar, ativo: value === "ativo" })
                }
              >
                <SelectTrigger className="bg-card border-foreground/10 h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button
                variant="outline"
                onClick={handleFecharDialogEditar}
                className="flex-1 h-11"
                disabled={salvando}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSalvarEdicao}
                className="flex-1 btn-samurai h-11"
                disabled={salvando}
              >
                {salvando ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin shrink-0" />
                    <span className="truncate">Salvando...</span>
                  </>
                ) : (
                  "Salvar"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Deletar Usuário */}
      <AlertDialog open={mostrarDialogDeletar} onOpenChange={setMostrarDialogDeletar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja deletar o usuário{" "}
              <strong>{usuarioParaDeletar?.nome}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleFecharDialogDeletar} disabled={deletando}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletarUsuario}
              disabled={deletando}
              className="bg-red-500 hover:bg-red-600"
            >
              {deletando ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deletando...
                </>
              ) : (
                "Deletar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BottomNav active="usuarios" />
    </div>
  );
}

