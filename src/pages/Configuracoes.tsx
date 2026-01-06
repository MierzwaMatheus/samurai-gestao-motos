import { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Search, MapPin, Save, Settings, Users } from "lucide-react";
import { toast } from "sonner";
import { ViaCepService } from "@/infrastructure/api/ViaCepService";
import { BuscarEnderecoPorCepUseCase } from "@/domain/usecases/BuscarEnderecoPorCepUseCase";
import { useBuscarCep } from "@/hooks/useBuscarCep";
import { SupabaseConfiguracaoFreteRepository } from "@/infrastructure/repositories/SupabaseConfiguracaoFreteRepository";
import { BuscarConfiguracaoFreteUseCase } from "@/domain/usecases/BuscarConfiguracaoFreteUseCase";
import { AtualizarConfiguracaoFreteUseCase } from "@/domain/usecases/AtualizarConfiguracaoFreteUseCase";
import { useConfiguracaoFrete } from "@/hooks/useConfiguracaoFrete";

export default function Configuracoes() {
  const [, setLocation] = useLocation();
  
  // Inicialização das dependências seguindo DIP
  const cepService = useMemo(() => new ViaCepService(), []);
  const buscarCepUseCase = useMemo(
    () => new BuscarEnderecoPorCepUseCase(cepService),
    [cepService]
  );
  const { buscar: buscarCep, loading: loadingCep, error: errorCep, endereco: enderecoEncontrado } =
    useBuscarCep(buscarCepUseCase);

  const configRepo = useMemo(() => new SupabaseConfiguracaoFreteRepository(), []);
  const buscarConfigUseCase = useMemo(
    () => new BuscarConfiguracaoFreteUseCase(configRepo),
    [configRepo]
  );
  const atualizarConfigUseCase = useMemo(
    () => new AtualizarConfiguracaoFreteUseCase(configRepo),
    [configRepo]
  );
  const {
    configuracao,
    atualizar: atualizarConfig,
    loading: loadingAtualizar,
    loadingBuscar,
    error: errorConfig,
  } = useConfiguracaoFrete(buscarConfigUseCase, atualizarConfigUseCase);

  const [cepOrigem, setCepOrigem] = useState("");
  const [valorPorKm, setValorPorKm] = useState<number>(2.0);

  // Carrega configuração existente quando disponível
  useEffect(() => {
    if (configuracao) {
      // Formata o CEP para exibição
      const cepFormatado = configuracao.cepOrigem.replace(/(\d{5})(\d{3})/, "$1-$2");
      setCepOrigem(cepFormatado);
      setValorPorKm(configuracao.valorPorKm);
    }
  }, [configuracao]);

  const handleCepOrigemChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cep = e.target.value.replace(/\D/g, "");
    const cepFormatado = cep.replace(/(\d{5})(\d{3})/, "$1-$2");
    setCepOrigem(cepFormatado);
  };

  const handleBuscarCepOrigem = async () => {
    const cepLimpo = cepOrigem.replace(/\D/g, "");
    
    if (!cepLimpo || cepLimpo.length !== 8) {
      toast.error("Digite um CEP válido (8 dígitos)");
      return;
    }

    try {
      await buscarCep(cepLimpo);
      toast.success("CEP encontrado!");
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : "Erro ao buscar CEP";
      toast.error(mensagem);
    }
  };

  const handleSalvar = async () => {
    const cepLimpo = cepOrigem.replace(/\D/g, "");
    
    if (!cepLimpo || cepLimpo.length !== 8) {
      toast.error("CEP de origem deve conter 8 dígitos");
      return;
    }

    if (valorPorKm <= 0) {
      toast.error("Valor por km deve ser maior que zero");
      return;
    }

    try {
      await atualizarConfig({
        cepOrigem: cepLimpo,
        valorPorKm,
      });
      toast.success("Configurações salvas com sucesso!");
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : "Erro ao salvar configurações";
      toast.error(mensagem);
    }
  };

  return (
    <div className="min-h-screen bg-background admin-background">
      <Header title="Configurações" />

      <main className="pt-20 pb-32 px-6">
        <div className="max-w-2xl mx-auto space-y-8">
          {/* Título da Seção */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Settings size={24} className="text-accent" />
              <h2 className="font-serif text-xl text-foreground">Configurações</h2>
            </div>
            <Button
              variant="outline"
              onClick={() => setLocation("/usuarios")}
              className="bg-card border-foreground/10"
            >
              <Users size={18} className="mr-2" />
              Gerenciar Usuários
            </Button>
          </div>
          
          {/* Seção Configurações de Frete */}
          <div className="flex items-center gap-3">
            <Settings size={20} className="text-accent" />
            <h3 className="font-serif text-lg text-foreground">Configurações de Frete</h3>
          </div>

          {/* Seção CEP de Origem */}
          <Card className="bg-card border-foreground/10 p-6 space-y-4">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-widest">
                CEP de Origem *
              </Label>
              <p className="text-xs text-foreground/60">
                CEP de onde os serviços serão realizados (oficina)
              </p>
            </div>

            {/* Busca de CEP */}
            <div className="space-y-2">
              <Label htmlFor="cep-origem" className="text-xs text-foreground/70">
                Buscar CEP
              </Label>
              <div className="flex gap-2">
                <Input
                  id="cep-origem"
                  placeholder="00000-000"
                  value={cepOrigem}
                  onChange={handleCepOrigemChange}
                  maxLength={9}
                  className="bg-card border-foreground/10 flex-1"
                />
                <Button
                  onClick={handleBuscarCepOrigem}
                  variant="outline"
                  disabled={loadingCep || !cepOrigem}
                  className="whitespace-nowrap"
                >
                  <Search size={16} className="mr-2" />
                  {loadingCep ? "Buscando..." : "Buscar"}
                </Button>
              </div>
              {errorCep && (
                <p className="text-xs text-red-500">{errorCep}</p>
              )}
            </div>

            {/* Endereço Encontrado */}
            {enderecoEncontrado && (
              <Card className="bg-card border-accent/20 p-4 space-y-2">
                <div className="flex items-start gap-2">
                  <MapPin size={16} className="text-accent mt-0.5" />
                  <div className="flex-1">
                    <p className="font-sans text-sm font-semibold text-foreground">
                      {enderecoEncontrado.rua}
                    </p>
                    <p className="font-sans text-xs text-foreground/60">
                      {enderecoEncontrado.bairro}, {enderecoEncontrado.cidade} - {enderecoEncontrado.estado}
                    </p>
                    <p className="font-sans text-xs text-foreground/50 mt-1">
                      CEP: {enderecoEncontrado.cep}
                    </p>
                  </div>
                </div>
              </Card>
            )}
          </Card>

          {/* Seção Valor por KM */}
          <Card className="bg-card border-foreground/10 p-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="valor-por-km" className="text-xs uppercase tracking-widest">
                Valor por KM *
              </Label>
              <p className="text-xs text-foreground/60">
                Valor cobrado por quilômetro rodado
              </p>
            </div>
            <div className="space-y-2">
              <Input
                id="valor-por-km"
                type="number"
                step="0.01"
                min="0.01"
                max="1000"
                placeholder="2.00"
                value={valorPorKm || ""}
                onChange={(e) => {
                  const value = parseFloat(e.target.value) || 0;
                  setValorPorKm(value);
                }}
                className="bg-card border-foreground/10"
              />
              <p className="text-xs text-foreground/50">
                Valor atual: R$ {valorPorKm.toFixed(2)} por km
              </p>
            </div>
          </Card>

          {/* Erro de Configuração */}
          {errorConfig && (
            <Card className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 p-4">
              <p className="text-sm text-red-600 dark:text-red-400">{errorConfig}</p>
            </Card>
          )}

          {/* Botão Salvar */}
          <Button
            onClick={handleSalvar}
            className="w-full btn-samurai"
            disabled={loadingAtualizar || loadingBuscar}
          >
            <Save size={16} className="mr-2" />
            {loadingAtualizar ? "Salvando..." : "Salvar Configurações"}
          </Button>

          {/* Informações da Configuração Atual */}
          {configuracao && (
            <Card className="bg-card border-accent/20 p-4">
              <p className="font-sans text-sm text-foreground/60 mb-2">
                Configuração Atual:
              </p>
              <p className="font-sans text-sm text-foreground">
                CEP Origem: {configuracao.cepOrigem}
              </p>
              <p className="font-sans text-sm text-foreground">
                Valor por KM: R$ {configuracao.valorPorKm.toFixed(2)}
              </p>
              <p className="font-sans text-xs text-foreground/50 mt-2">
                Última atualização: {new Date(configuracao.atualizadoEm).toLocaleString("pt-BR")}
              </p>
            </Card>
          )}
        </div>
      </main>

      <BottomNav active="cadastro" />
    </div>
  );
}

