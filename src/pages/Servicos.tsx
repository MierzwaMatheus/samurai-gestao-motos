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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  const [tiposServicoFiltrados, setTiposServicoFiltrados] = useState<TipoServico[]>([]);
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

  // Estados para Alinhamento (Criar)
  const [novoTipoCategoria, setNovoTipoCategoria] = useState<"padrao" | "alinhamento">("padrao");
  const [novoTipoPrecoOficinaComOleo, setNovoTipoPrecoOficinaComOleo] = useState("");
  const [novoTipoPrecoOficinaSemOleo, setNovoTipoPrecoOficinaSemOleo] = useState("");
  const [novoTipoPrecoParticularComOleo, setNovoTipoPrecoParticularComOleo] = useState("");
  const [novoTipoPrecoParticularSemOleo, setNovoTipoPrecoParticularSemOleo] = useState("");

  // Estados para Alinhamento (Editar)
  const [editandoCategoria, setEditandoCategoria] = useState<"padrao" | "alinhamento">("padrao");
  const [editandoPrecoOficinaComOleo, setEditandoPrecoOficinaComOleo] = useState("");
  const [editandoPrecoOficinaSemOleo, setEditandoPrecoOficinaSemOleo] = useState("");
  const [editandoPrecoParticularComOleo, setEditandoPrecoParticularComOleo] = useState("");
  const [editandoPrecoParticularSemOleo, setEditandoPrecoParticularSemOleo] = useState("");

  // Buscar tipos de serviço (apenas uma vez no carregamento)
  const buscarTiposServico = useCallback(async () => {
    setLoading(true);
    try {
      const resultados = await listarTiposServicoUseCase.execute();
      setTiposServico(resultados);
    } catch (error) {
      console.error("Erro ao buscar tipos de serviço:", error);
      toast.error("Erro ao buscar tipos de serviço");
      setTiposServico([]);
    } finally {
      setLoading(false);
    }
  }, [listarTiposServicoUseCase]);

  // Filtrar tipos de serviço localmente
  useEffect(() => {
    if (!searchQuery.trim()) {
      setTiposServicoFiltrados(tiposServico);
    } else {
      const filtrados = tiposServico.filter(tipo =>
        tipo.nome.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setTiposServicoFiltrados(filtrados);
    }
  }, [searchQuery, tiposServico]);

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

    // Validações para Alinhamento
    let precosAlinhamento = undefined;
    if (novoTipoCategoria === "alinhamento") {
      const ofComOleo = parseFloat(novoTipoPrecoOficinaComOleo) || 0;
      const ofSemOleo = parseFloat(novoTipoPrecoOficinaSemOleo) || 0;
      const partComOleo = parseFloat(novoTipoPrecoParticularComOleo) || 0;
      const partSemOleo = parseFloat(novoTipoPrecoParticularSemOleo) || 0;

      if (ofComOleo < 0 || ofSemOleo < 0 || partComOleo < 0 || partSemOleo < 0) {
        toast.error("Os preços não podem ser negativos");
        return;
      }

      precosAlinhamento = {
        precoOficinaComOleo: ofComOleo,
        precoOficinaSemOleo: ofSemOleo,
        precoParticularComOleo: partComOleo,
        precoParticularSemOleo: partSemOleo,
      };
    } else {
      if (precoOficina < 0) {
        toast.error("Preço oficina não pode ser negativo");
        return;
      }
      if (precoParticular < 0) {
        toast.error("Preço particular não pode ser negativo");
        return;
      }
    }

    setCriando(true);
    try {
      await criarTipoServicoUseCase.execute(
        novoTipoNome.trim(),
        precoOficina,
        precoParticular,
        novoTipoCategoria,
        precosAlinhamento
      );
      toast.success("Tipo de serviço criado com sucesso!");
      setNovoTipoNome("");
      setNovoTipoPrecoOficina("");
      setNovoTipoPrecoParticular("");
      setNovoTipoCategoria("padrao");
      setNovoTipoPrecoOficinaComOleo("");
      setNovoTipoPrecoOficinaSemOleo("");
      setNovoTipoPrecoParticularComOleo("");
      setNovoTipoPrecoParticularSemOleo("");
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

    // Validações para Alinhamento
    const updates: any = {
      nome: editandoNome.trim(),
      categoria: editandoCategoria,
    };

    if (editandoCategoria === "alinhamento") {
      const ofComOleo = parseFloat(editandoPrecoOficinaComOleo) || 0;
      const ofSemOleo = parseFloat(editandoPrecoOficinaSemOleo) || 0;
      const partComOleo = parseFloat(editandoPrecoParticularComOleo) || 0;
      const partSemOleo = parseFloat(editandoPrecoParticularSemOleo) || 0;

      if (ofComOleo < 0 || ofSemOleo < 0 || partComOleo < 0 || partSemOleo < 0) {
        toast.error("Os preços não podem ser negativos");
        return;
      }

      updates.precoOficinaComOleo = ofComOleo;
      updates.precoOficinaSemOleo = ofSemOleo;
      updates.precoParticularComOleo = partComOleo;
      updates.precoParticularSemOleo = partSemOleo;
      // Zera os preços padrão para evitar confusão se mudar de categoria
      updates.precoOficina = 0;
      updates.precoParticular = 0;
    } else {
      if (precoOficina < 0) {
        toast.error("Preço oficina não pode ser negativo");
        return;
      }
      if (precoParticular < 0) {
        toast.error("Preço particular não pode ser negativo");
        return;
      }
      updates.precoOficina = precoOficina;
      updates.precoParticular = precoParticular;
    }

    setEditando(true);
    try {
      await atualizarTipoServicoUseCase.execute(tipoEditando.id, updates);
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
    setEditandoCategoria(tipo.categoria || "padrao");

    // Set padrao prices
    setEditandoPrecoOficina(tipo.precoOficina.toString());
    setEditandoPrecoParticular(tipo.precoParticular.toString());

    // Set alinhamento prices
    setEditandoPrecoOficinaComOleo(tipo.precoOficinaComOleo?.toString() || "");
    setEditandoPrecoOficinaSemOleo(tipo.precoOficinaSemOleo?.toString() || "");
    setEditandoPrecoParticularComOleo(tipo.precoParticularComOleo?.toString() || "");
    setEditandoPrecoParticularSemOleo(tipo.precoParticularSemOleo?.toString() || "");

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
                  <div className="mb-4">
                    <Label htmlFor="nome">Nome do Tipo de Serviço *</Label>
                    <Input
                      id="nome"
                      value={novoTipoNome}
                      onChange={(e) => setNovoTipoNome(e.target.value)}
                      placeholder="Ex: Revisão, Troca de óleo, etc."
                    />
                  </div>

                  <Tabs value={novoTipoCategoria} onValueChange={(v: any) => setNovoTipoCategoria(v)}>
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="padrao">Padrão</TabsTrigger>
                      <TabsTrigger value="alinhamento">Alinhamento</TabsTrigger>
                    </TabsList>

                    <TabsContent value="padrao" className="space-y-4 pt-4">
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
                    </TabsContent>

                    <TabsContent value="alinhamento" className="space-y-4 pt-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-3 p-3 border rounded-md">
                          <h4 className="font-semibold text-sm text-center border-b pb-2 mb-2">Preço Oficina</h4>
                          <div>
                            <Label htmlFor="of-com-oleo" className="text-xs">Com Óleo</Label>
                            <Input
                              id="of-com-oleo"
                              type="number"
                              step="0.01"
                              min="0"
                              value={novoTipoPrecoOficinaComOleo}
                              onChange={(e) => setNovoTipoPrecoOficinaComOleo(e.target.value)}
                              placeholder="0.00"
                            />
                          </div>
                          <div>
                            <Label htmlFor="of-sem-oleo" className="text-xs">Sem Óleo</Label>
                            <Input
                              id="of-sem-oleo"
                              type="number"
                              step="0.01"
                              min="0"
                              value={novoTipoPrecoOficinaSemOleo}
                              onChange={(e) => setNovoTipoPrecoOficinaSemOleo(e.target.value)}
                              placeholder="0.00"
                            />
                          </div>
                        </div>

                        <div className="space-y-3 p-3 border rounded-md">
                          <h4 className="font-semibold text-sm text-center border-b pb-2 mb-2">Preço Particular</h4>
                          <div>
                            <Label htmlFor="part-com-oleo" className="text-xs">Com Óleo</Label>
                            <Input
                              id="part-com-oleo"
                              type="number"
                              step="0.01"
                              min="0"
                              value={novoTipoPrecoParticularComOleo}
                              onChange={(e) => setNovoTipoPrecoParticularComOleo(e.target.value)}
                              placeholder="0.00"
                            />
                          </div>
                          <div>
                            <Label htmlFor="part-sem-oleo" className="text-xs">Sem Óleo</Label>
                            <Input
                              id="part-sem-oleo"
                              type="number"
                              step="0.01"
                              min="0"
                              value={novoTipoPrecoParticularSemOleo}
                              onChange={(e) => setNovoTipoPrecoParticularSemOleo(e.target.value)}
                              placeholder="0.00"
                            />
                          </div>
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>
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
          ) : tiposServicoFiltrados.length === 0 ? (
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
              {tiposServicoFiltrados.map((tipo) => (
                <Card key={tipo.id} className="p-4 bg-card border-foreground/10">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Wrench size={16} className="text-accent" />
                        <h3 className="font-semibold text-foreground">{tipo.nome}</h3>
                      </div>
                      <div className="text-sm text-foreground/60 mb-1 space-y-0.5">
                        {tipo.categoria === "alinhamento" ? (
                          <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                            <div className="border-r pr-2">
                              <p className="font-semibold text-foreground mb-1">Oficina</p>
                              <p>C/ Óleo: <span className="text-accent">R$ {tipo.precoOficinaComOleo?.toFixed(2)}</span></p>
                              <p>S/ Óleo: <span className="text-accent">R$ {tipo.precoOficinaSemOleo?.toFixed(2)}</span></p>
                            </div>
                            <div>
                              <p className="font-semibold text-foreground mb-1">Particular</p>
                              <p>C/ Óleo: <span className="text-accent">R$ {tipo.precoParticularComOleo?.toFixed(2)}</span></p>
                              <p>S/ Óleo: <span className="text-accent">R$ {tipo.precoParticularSemOleo?.toFixed(2)}</span></p>
                            </div>
                          </div>
                        ) : (
                          <>
                            <p>
                              Oficina: <span className="font-semibold text-accent">R$ {tipo.precoOficina.toFixed(2)}</span>
                            </p>
                            <p>
                              Particular: <span className="font-semibold text-accent">R$ {tipo.precoParticular.toFixed(2)}</span>
                            </p>
                          </>
                        )}
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
                <div className="mb-4">
                  <Label htmlFor="edit-nome">Nome do Tipo de Serviço *</Label>
                  <Input
                    id="edit-nome"
                    value={editandoNome}
                    onChange={(e) => setEditandoNome(e.target.value)}
                    placeholder="Ex: Revisão, Troca de óleo, etc."
                  />
                </div>

                <Tabs value={editandoCategoria} onValueChange={(v: any) => setEditandoCategoria(v)}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="padrao">Padrão</TabsTrigger>
                    <TabsTrigger value="alinhamento">Alinhamento</TabsTrigger>
                  </TabsList>

                  <TabsContent value="padrao" className="space-y-4 pt-4">
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
                  </TabsContent>

                  <TabsContent value="alinhamento" className="space-y-4 pt-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-3 p-3 border rounded-md">
                        <h4 className="font-semibold text-sm text-center border-b pb-2 mb-2">Preço Oficina</h4>
                        <div>
                          <Label htmlFor="edit-of-com-oleo" className="text-xs">Com Óleo</Label>
                          <Input
                            id="edit-of-com-oleo"
                            type="number"
                            step="0.01"
                            min="0"
                            value={editandoPrecoOficinaComOleo}
                            onChange={(e) => setEditandoPrecoOficinaComOleo(e.target.value)}
                            placeholder="0.00"
                          />
                        </div>
                        <div>
                          <Label htmlFor="edit-of-sem-oleo" className="text-xs">Sem Óleo</Label>
                          <Input
                            id="edit-of-sem-oleo"
                            type="number"
                            step="0.01"
                            min="0"
                            value={editandoPrecoOficinaSemOleo}
                            onChange={(e) => setEditandoPrecoOficinaSemOleo(e.target.value)}
                            placeholder="0.00"
                          />
                        </div>
                      </div>

                      <div className="space-y-3 p-3 border rounded-md">
                        <h4 className="font-semibold text-sm text-center border-b pb-2 mb-2">Preço Particular</h4>
                        <div>
                          <Label htmlFor="edit-part-com-oleo" className="text-xs">Com Óleo</Label>
                          <Input
                            id="edit-part-com-oleo"
                            type="number"
                            step="0.01"
                            min="0"
                            value={editandoPrecoParticularComOleo}
                            onChange={(e) => setEditandoPrecoParticularComOleo(e.target.value)}
                            placeholder="0.00"
                          />
                        </div>
                        <div>
                          <Label htmlFor="edit-part-sem-oleo" className="text-xs">Sem Óleo</Label>
                          <Input
                            id="edit-part-sem-oleo"
                            type="number"
                            step="0.01"
                            min="0"
                            value={editandoPrecoParticularSemOleo}
                            onChange={(e) => setEditandoPrecoParticularSemOleo(e.target.value)}
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
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

