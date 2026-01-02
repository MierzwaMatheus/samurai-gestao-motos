import { useState, useEffect, useMemo } from "react";
import { TipoServico } from "@shared/types";
import { TipoServicoRepository } from "@/domain/interfaces/TipoServicoRepository";
import { CriarTipoServicoUseCase } from "@/domain/usecases/CriarTipoServicoUseCase";
import { ListarTiposServicoUseCase } from "@/domain/usecases/ListarTiposServicoUseCase";
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
import { Search, Check, Plus, X, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface TipoServicoSearchProps {
  tipoServicoRepo: TipoServicoRepository;
  value?: string[]; // IDs dos tipos de serviço selecionados
  onSelect: (tiposServicoIds: string[]) => void;
  disabled?: boolean;
}

export function TipoServicoSearch({
  tipoServicoRepo,
  value = [],
  onSelect,
  disabled = false,
}: TipoServicoSearchProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [tiposServico, setTiposServico] = useState<TipoServico[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [novoTipoNome, setNovoTipoNome] = useState("");
  const [criando, setCriando] = useState(false);

  // Inicializar use cases
  const criarTipoServicoUseCase = useMemo(
    () => new CriarTipoServicoUseCase(tipoServicoRepo),
    [tipoServicoRepo]
  );
  const listarTiposServicoUseCase = useMemo(
    () => new ListarTiposServicoUseCase(tipoServicoRepo),
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

    const timeoutId = setTimeout(buscarTiposServico, 300); // Debounce de 300ms
    return () => clearTimeout(timeoutId);
  }, [open, searchQuery, listarTiposServicoUseCase]);

  const handleToggleTipoServico = (tipoServicoId: string) => {
    const isSelected = value.includes(tipoServicoId);
    if (isSelected) {
      onSelect(value.filter((id) => id !== tipoServicoId));
    } else {
      onSelect([...value, tipoServicoId]);
    }
  };

  const handleCriarTipoServico = async () => {
    if (!novoTipoNome.trim()) {
      toast.error("Nome do tipo de serviço é obrigatório");
      return;
    }

    setCriando(true);
    try {
      const novo = await criarTipoServicoUseCase.execute(novoTipoNome.trim());
      toast.success("Tipo de serviço criado com sucesso!");
      setNovoTipoNome("");
      setDialogOpen(false);
      
      // Adicionar o novo tipo à seleção
      onSelect([...value, novo.id]);
      
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

  const tiposSelecionados = tiposServico.filter((t) => value.includes(t.id));

  return (
    <div className="space-y-4">
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
              <span className="text-sm">
                {value.length > 0
                  ? `${value.length} tipo${value.length !== 1 ? "s" : ""} selecionado${value.length !== 1 ? "s" : ""}`
                  : "Buscar tipos de serviço..."}
              </span>
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
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
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
                      <Label htmlFor="nome">Nome do Tipo de Serviço</Label>
                      <Input
                        id="nome"
                        value={novoTipoNome}
                        onChange={(e) => setNovoTipoNome(e.target.value)}
                        placeholder="Ex: Revisão, Troca de óleo, etc."
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !criando) {
                            handleCriarTipoServico();
                          }
                        }}
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
                  const isSelected = value.includes(tipo.id);
                  return (
                    <CommandItem
                      key={tipo.id}
                      value={tipo.nome}
                      onSelect={() => {
                        handleToggleTipoServico(tipo.id);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          isSelected ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="flex-1">
                        <div className="font-medium">{tipo.nome}</div>
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Badges com tipos selecionados */}
      {tiposSelecionados.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tiposSelecionados.map((tipo) => (
            <Badge
              key={tipo.id}
              variant="secondary"
              className="flex items-center gap-1"
            >
              <Wrench size={12} />
              {tipo.nome}
              <button
                onClick={() => handleToggleTipoServico(tipo.id)}
                className="ml-1 hover:bg-accent rounded-full p-0.5"
                disabled={disabled}
              >
                <X size={12} />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

