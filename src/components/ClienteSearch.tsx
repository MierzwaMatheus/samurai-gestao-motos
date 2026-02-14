import { useState, useEffect } from "react";
import { Cliente } from "@shared/types";
import { ClienteRepository } from "@/domain/interfaces/ClienteRepository";
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
import { Card } from "@/components/ui/card";
import { Search, Check, User, Phone, MapPin, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

interface ClienteSearchProps {
  clienteRepo: ClienteRepository;
  value?: Cliente | null;
  onSelect: (cliente: Cliente | null) => void;
  disabled?: boolean;
}

export function ClienteSearch({
  clienteRepo,
  value,
  onSelect,
  disabled = false,
}: ClienteSearchProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(false);

  // Buscar clientes quando o popover abre ou quando a busca muda
  useEffect(() => {
    if (!open) return;

    const buscarClientes = async () => {
      setLoading(true);
      try {
        let resultados: Cliente[];
        console.log("[ClienteSearch] Buscando com query:", searchQuery);
        if (searchQuery.trim()) {
          resultados = await clienteRepo.buscarPorNomeOuTelefone(searchQuery);
          console.log("[ClienteSearch] Resultados da busca:", resultados);
        } else {
          resultados = await clienteRepo.listar();
          console.log("[ClienteSearch] Listando todos os clientes:", resultados);
        }
        // Remover duplicatas baseado em nome + telefone
        const vistos = new Set<string>();
        const resultadosUnicos = resultados.filter((c) => {
          const chave = `${c.nome}|${c.telefone || ''}`;
          if (vistos.has(chave)) return false;
          vistos.add(chave);
          return true;
        });
        console.log("[ClienteSearch] Após remover duplicatas:", resultadosUnicos);
        setClientes(resultadosUnicos);
      } catch (error) {
        console.error("Erro ao buscar clientes:", error);
        setClientes([]);
      } finally {
        setLoading(false);
      }
    };

    const timeoutId = setTimeout(buscarClientes, 300); // Debounce de 300ms
    return () => clearTimeout(timeoutId);
  }, [open, searchQuery, clienteRepo]);

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
                {value ? value.nome : "Buscar cliente..."}
              </span>
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          <Command>
            <CommandInput
              placeholder="Buscar por nome ou telefone..."
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
            <CommandList>
              <CommandEmpty>
                {loading ? "Buscando..." : "Nenhum cliente encontrado."}
              </CommandEmpty>
              <CommandGroup>
                {clientes.map((cliente) => (
                  <CommandItem
                    key={cliente.id}
                    value={`${cliente.nome} ${cliente.telefone || ''}`}
                    onSelect={() => {
                      onSelect(cliente);
                      setOpen(false);
                      setSearchQuery("");
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value?.id === cliente.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex-1">
                      <div className="font-medium">{cliente.nome}</div>
                      {cliente.telefone && (
                        <div className="text-xs text-foreground/60">
                          {cliente.telefone}
                        </div>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Card com informações do cliente selecionado */}
      {value && (
        <Card className="bg-card border-accent/20 p-4 space-y-3">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-accent/10 rounded-lg">
              <User size={20} className="text-accent" />
            </div>
            <div className="flex-1 space-y-2">
              <div>
                <h3 className="font-sans text-base font-semibold text-foreground">
                  {value.nome}
                </h3>
                {value.numeroServicos > 0 && (
                  <div className="flex items-center gap-1 mt-1">
                    <Wrench size={14} className="text-accent" />
                    <span className="text-xs text-foreground/60">
                      {value.numeroServicos} serviço{value.numeroServicos !== 1 ? "s" : ""} realizado{value.numeroServicos !== 1 ? "s" : ""}
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                {value.telefone && (
                  <div className="flex items-center gap-2 text-sm text-foreground/70">
                    <Phone size={14} />
                    <span>{value.telefone}</span>
                  </div>
                )}
                {value.email && (
                  <div className="flex items-center gap-2 text-sm text-foreground/70">
                    <span>@</span>
                    <span>{value.email}</span>
                  </div>
                )}
                {value.endereco && (
                  <div className="flex items-start gap-2 text-sm text-foreground/70">
                    <MapPin size={14} className="mt-0.5" />
                    <span>{value.endereco}</span>
                    {value.cep && (
                      <span className="text-xs text-foreground/50">
                        ({value.cep})
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => onSelect(null)}
            className="w-full text-xs"
          >
            Limpar seleção
          </Button>
        </Card>
      )}
    </div>
  );
}

