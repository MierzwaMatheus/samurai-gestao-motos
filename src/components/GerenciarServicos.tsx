import { useState, useEffect, useMemo } from "react";
import { TipoServico, ServicoSelecionado, ServicoPersonalizadoInput } from "@shared/types";
import { TipoServicoRepository } from "@/domain/interfaces/TipoServicoRepository";
import { CriarTipoServicoUseCase } from "@/domain/usecases/CriarTipoServicoUseCase";
import { ListarTiposServicoUseCase } from "@/domain/usecases/ListarTiposServicoUseCase";
import { AtualizarTipoServicoUseCase } from "@/domain/usecases/AtualizarTipoServicoUseCase";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, Check, Plus, X, Wrench, Edit, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";

interface GerenciarServicosProps {
  tipoServicoRepo: TipoServicoRepository;
  servicos: ServicoSelecionado[];
  servicosPersonalizados: ServicoPersonalizadoInput[];
  onServicosChange: (servicos: ServicoSelecionado[]) => void;
  onServicosPersonalizadosChange: (servicos: ServicoPersonalizadoInput[]) => void;
  disabled?: boolean;
}

export function GerenciarServicos({
  tipoServicoRepo,
  servicos,
  servicosPersonalizados,
  onServicosChange,
  onServicosPersonalizadosChange,
  disabled = false,
}: GerenciarServicosProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [tiposServico, setTiposServico] = useState<TipoServico[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogCriarOpen, setDialogCriarOpen] = useState(false);
  const [dialogEditarOpen, setDialogEditarOpen] = useState(false);
  const [tipoEditando, setTipoEditando] = useState<TipoServico | null>(null);
  const [novoTipoNome, setNovoTipoNome] = useState("");
  const [novoTipoValor, setNovoTipoValor] = useState("");
  const [editandoNome, setEditandoNome] = useState("");
  const [editandoValor, setEditandoValor] = useState("");
  const [criando, setCriando] = useState(false);
  const [editando, setEditando] = useState(false);
  const [dialogQuantidadeOpen, setDialogQuantidadeOpen] = useState(false);
  const [tipoParaQuantidade, setTipoParaQuantidade] = useState<TipoServico | null>(null);
  const [quantidadeInput, setQuantidadeInput] = useState("1");
  const [dialogPersonalizadoOpen, setDialogPersonalizadoOpen] = useState(false);
  const [servicoPersonalizadoNome, setServicoPersonalizadoNome] = useState("");
  const [servicoPersonalizadoValor, setServicoPersonalizadoValor] = useState("");
  const [servicoPersonalizadoQuantidade, setServicoPersonalizadoQuantidade] = useState("1");

  // Inicializar use cases
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

  // Buscar tipos de serviço quando o popover abre ou quando a busca muda
  useEffect(() => {
    if (!open) return;

    const buscarTiposServico = async () => {
      setLoading(true);
      try {
        const resultados = await listarTiposServicoUseCase.execute(
          searchQuery.trim() || undefined
        );
        setTiposServico(resultados);
      } catch (error) {
        console.error("Erro ao buscar tipos de serviço:", error);
        setTiposServico([]);
      } finally {
        setLoading(false);
      }
    };

    const timeoutId = setTimeout(buscarTiposServico, 300);
    return () => clearTimeout(timeoutId);
  }, [open, searchQuery, listarTiposServicoUseCase]);

  const handleCriarTipoServico = async () => {
    if (!novoTipoNome.trim()) {
      toast.error("Nome do tipo de serviço é obrigatório");
      return;
    }

    const valor = parseFloat(novoTipoValor) || 0;
    if (valor < 0) {
      toast.error("Valor não pode ser negativo");
      return;
    }

    setCriando(true);
    try {
      await criarTipoServicoUseCase.execute(novoTipoNome.trim(), valor);
      toast.success("Tipo de serviço criado com sucesso!");
      setNovoTipoNome("");
      setNovoTipoValor("");
      setDialogCriarOpen(false);
      
      // Atualizar lista
      const resultados = await listarTiposServicoUseCase.execute();
      setTiposServico(resultados);
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

    const valor = parseFloat(editandoValor) || 0;
    if (valor < 0) {
      toast.error("Valor não pode ser negativo");
      return;
    }

    setEditando(true);
    try {
      await atualizarTipoServicoUseCase.execute(tipoEditando.id, {
        nome: editandoNome.trim(),
        valor: valor,
      });
      toast.success("Tipo de serviço atualizado com sucesso!");
      setDialogEditarOpen(false);
      setTipoEditando(null);
      
      // Atualizar lista
      const resultados = await listarTiposServicoUseCase.execute();
      setTiposServico(resultados);
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : "Erro ao atualizar tipo de serviço";
      toast.error(mensagem);
    } finally {
      setEditando(false);
    }
  };

  const handleAbrirDialogQuantidade = (tipo: TipoServico) => {
    setTipoParaQuantidade(tipo);
    const servicoExistente = servicos.find((s) => s.tipoServicoId === tipo.id);
    setQuantidadeInput(servicoExistente?.quantidade.toString() || "1");
    setDialogQuantidadeOpen(true);
  };

  const handleConfirmarQuantidade = () => {
    if (!tipoParaQuantidade) return;

    const quantidade = parseInt(quantidadeInput) || 1;
    if (quantidade < 1) {
      toast.error("Quantidade deve ser pelo menos 1");
      return;
    }

    const servicoExistente = servicos.find((s) => s.tipoServicoId === tipoParaQuantidade.id);
    if (servicoExistente) {
      // Atualizar quantidade
      onServicosChange(
        servicos.map((s) =>
          s.tipoServicoId === tipoParaQuantidade.id ? { ...s, quantidade } : s
        )
      );
    } else {
      // Adicionar novo serviço
      onServicosChange([...servicos, { tipoServicoId: tipoParaQuantidade.id, quantidade }]);
    }

    setDialogQuantidadeOpen(false);
    setTipoParaQuantidade(null);
    setQuantidadeInput("1");
  };

  const handleRemoverServico = (tipoServicoId: string) => {
    onServicosChange(servicos.filter((s) => s.tipoServicoId !== tipoServicoId));
  };

  const handleAbrirDialogEditar = (tipo: TipoServico) => {
    setTipoEditando(tipo);
    setEditandoNome(tipo.nome);
    setEditandoValor(tipo.valor.toString());
    setDialogEditarOpen(true);
  };

  const handleAdicionarServicoPersonalizado = () => {
    if (!servicoPersonalizadoNome.trim()) {
      toast.error("Nome do serviço é obrigatório");
      return;
    }

    const valor = parseFloat(servicoPersonalizadoValor) || 0;
    if (valor < 0) {
      toast.error("Valor não pode ser negativo");
      return;
    }

    const quantidade = parseInt(servicoPersonalizadoQuantidade) || 1;
    if (quantidade < 1) {
      toast.error("Quantidade deve ser pelo menos 1");
      return;
    }

    onServicosPersonalizadosChange([
      ...servicosPersonalizados,
      {
        nome: servicoPersonalizadoNome.trim(),
        valor: valor,
        quantidade: quantidade,
      },
    ]);

    setServicoPersonalizadoNome("");
    setServicoPersonalizadoValor("");
    setServicoPersonalizadoQuantidade("1");
    setDialogPersonalizadoOpen(false);
  };

  const handleRemoverServicoPersonalizado = (index: number) => {
    onServicosPersonalizadosChange(servicosPersonalizados.filter((_, i) => i !== index));
  };

  // Buscar tipos selecionados com dados completos
  const [tiposSelecionadosCompletos, setTiposSelecionadosCompletos] = useState<(TipoServico & { quantidade: number })[]>([]);

  useEffect(() => {
    const buscarTipos = async () => {
      if (servicos.length === 0) {
        setTiposSelecionadosCompletos([]);
        return;
      }

      const tipos = await Promise.all(
        servicos.map(async (servico) => {
          const tipo = await tipoServicoRepo.buscarPorId(servico.tipoServicoId);
          return tipo ? { ...tipo, quantidade: servico.quantidade } : null;
        })
      );

      setTiposSelecionadosCompletos(
        tipos.filter((t): t is TipoServico & { quantidade: number } => t !== null)
      );
    };

    buscarTipos();
  }, [servicos, tipoServicoRepo]);

  // Calcular valor total
  const valorTotal = useMemo(() => {
    const valorTipos = tiposSelecionadosCompletos.reduce(
      (acc, tipo) => acc + tipo.valor * tipo.quantidade,
      0
    );
    const valorPersonalizados = servicosPersonalizados.reduce(
      (acc, servico) => acc + servico.valor * servico.quantidade,
      0
    );
    return valorTipos + valorPersonalizados;
  }, [tiposSelecionadosCompletos, servicosPersonalizados]);

  // Expor valor total para o componente pai via callback (opcional)
  useEffect(() => {
    // O valor total é calculado e exibido no próprio componente
    // Se necessário, podemos adicionar um callback aqui
  }, [valorTotal]);

  return (
    <div className="space-y-4">
      {/* Botão para buscar/adicionar tipos de serviço */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between bg-card border-foreground/10"
            disabled={disabled}
          >
            <div className="flex items-center gap-2">
              <Search size={16} />
              <span className="text-sm">Buscar tipos de serviço...</span>
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          <Command>
            <div className="flex items-center border-b">
              <CommandInput
                placeholder="Buscar tipos de serviço..."
                value={searchQuery}
                onValueChange={setSearchQuery}
                className="flex-1"
              />
              <Dialog open={dialogCriarOpen} onOpenChange={setDialogCriarOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="m-1 h-8 w-8 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                  >
                    <Plus size={16} />
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
                      <Label htmlFor="valor">Valor (R$) *</Label>
                      <Input
                        id="valor"
                        type="number"
                        step="0.01"
                        min="0"
                        value={novoTipoValor}
                        onChange={(e) => setNovoTipoValor(e.target.value)}
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
            <CommandList>
              <CommandEmpty>
                {loading ? "Buscando..." : "Nenhum tipo de serviço encontrado."}
              </CommandEmpty>
              <CommandGroup>
                {tiposServico.map((tipo) => {
                  const isSelected = servicos.some((s) => s.tipoServicoId === tipo.id);
                  return (
                    <CommandItem
                      key={tipo.id}
                      value={tipo.nome}
                      onSelect={() => {
                        handleAbrirDialogQuantidade(tipo);
                        setOpen(false);
                      }}
                      className={cn(
                        // Estados selecionado e hover com melhor contraste
                        "data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground",
                        "data-[selected=true]:font-semibold",
                        "hover:bg-accent/70 hover:text-accent-foreground",
                        "transition-colors duration-150",
                        // Garantir contraste mesmo quando não selecionado
                        isSelected && "bg-accent text-accent-foreground font-semibold"
                      )}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          isSelected ? "opacity-100 text-accent-foreground" : "opacity-0"
                        )}
                      />
                      <div className="flex-1">
                        <div className={cn(
                          "font-medium",
                          isSelected && "text-accent-foreground"
                        )}>
                          {tipo.nome}
                        </div>
                        <div className={cn(
                          "text-xs",
                          isSelected ? "text-accent-foreground/80" : "text-foreground/60"
                        )}>
                          R$ {tipo.valor.toFixed(2)}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 hover:bg-accent-foreground/20"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAbrirDialogEditar(tipo);
                          setOpen(false);
                        }}
                      >
                        <Edit size={12} className={cn(
                          isSelected && "text-accent-foreground"
                        )} />
                      </Button>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

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
              <Label htmlFor="edit-valor">Valor (R$) *</Label>
              <Input
                id="edit-valor"
                type="number"
                step="0.01"
                min="0"
                value={editandoValor}
                onChange={(e) => setEditandoValor(e.target.value)}
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

      {/* Dialog para quantidade */}
      <Dialog open={dialogQuantidadeOpen} onOpenChange={setDialogQuantidadeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Quantidade - {tipoParaQuantidade?.nome}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="quantidade">Quantidade *</Label>
              <Input
                id="quantidade"
                type="number"
                min="1"
                value={quantidadeInput}
                onChange={(e) => setQuantidadeInput(e.target.value)}
                placeholder="1"
              />
            </div>
            {tipoParaQuantidade && (
              <div className="p-3 bg-foreground/5 rounded-lg">
                <p className="text-sm text-foreground/60">Valor unitário: R$ {tipoParaQuantidade.valor.toFixed(2)}</p>
                <p className="text-sm font-semibold">
                  Total: R$ {(tipoParaQuantidade.valor * (parseInt(quantidadeInput) || 1)).toFixed(2)}
                </p>
              </div>
            )}
            <Button
              onClick={handleConfirmarQuantidade}
              className="w-full"
            >
              Confirmar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Serviços selecionados */}
      {tiposSelecionadosCompletos.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs text-foreground/70">Serviços Selecionados</Label>
          <div className="space-y-2">
            {tiposSelecionadosCompletos.map((tipo) => (
              <Card key={tipo.id} className="p-3 bg-card border-foreground/10">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Wrench size={14} className="text-accent" />
                      <span className="font-medium text-sm">{tipo.nome}</span>
                    </div>
                    <div className="text-xs text-foreground/60 mt-1">
                      {tipo.quantidade}x R$ {tipo.valor.toFixed(2)} = R$ {(tipo.valor * tipo.quantidade).toFixed(2)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleAbrirDialogQuantidade(tipo)}
                      disabled={disabled}
                    >
                      <Edit size={14} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoverServico(tipo.id)}
                      disabled={disabled}
                    >
                      <X size={14} />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Botão para adicionar serviço personalizado */}
      <Dialog open={dialogPersonalizadoOpen} onOpenChange={setDialogPersonalizadoOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            className="w-full bg-card border-foreground/10"
            disabled={disabled}
          >
            <Plus size={16} className="mr-2" />
            Adicionar Serviço Personalizado
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Serviço Personalizado</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="personalizado-nome">Nome do Serviço *</Label>
              <Input
                id="personalizado-nome"
                value={servicoPersonalizadoNome}
                onChange={(e) => setServicoPersonalizadoNome(e.target.value)}
                placeholder="Ex: Serviço especial..."
              />
            </div>
            <div>
              <Label htmlFor="personalizado-valor">Valor (R$) *</Label>
              <Input
                id="personalizado-valor"
                type="number"
                step="0.01"
                min="0"
                value={servicoPersonalizadoValor}
                onChange={(e) => setServicoPersonalizadoValor(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label htmlFor="personalizado-quantidade">Quantidade *</Label>
              <Input
                id="personalizado-quantidade"
                type="number"
                min="1"
                value={servicoPersonalizadoQuantidade}
                onChange={(e) => setServicoPersonalizadoQuantidade(e.target.value)}
                placeholder="1"
              />
            </div>
            <Button
              onClick={handleAdicionarServicoPersonalizado}
              disabled={!servicoPersonalizadoNome.trim()}
              className="w-full"
            >
              Adicionar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Serviços personalizados */}
      {servicosPersonalizados.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs text-foreground/70">Serviços Personalizados</Label>
          <div className="space-y-2">
            {servicosPersonalizados.map((servico, index) => (
              <Card key={index} className="p-3 bg-card border-foreground/10">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Wrench size={14} className="text-accent" />
                      <span className="font-medium text-sm">{servico.nome}</span>
                      <Badge variant="outline" className="text-xs">Personalizado</Badge>
                    </div>
                    <div className="text-xs text-foreground/60 mt-1">
                      {servico.quantidade}x R$ {servico.valor.toFixed(2)} = R$ {(servico.valor * servico.quantidade).toFixed(2)}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoverServicoPersonalizado(index)}
                    disabled={disabled}
                  >
                    <X size={14} />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

