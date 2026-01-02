import { useState, useMemo } from "react";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import EntryTypeToggle from "@/components/EntryTypeToggle";
import { EntryType, DadosCadastro } from "@shared/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { ImagePlus, Truck, Search, MapPin } from "lucide-react";
import { toast } from "sonner";
import { ViaCepService } from "@/infrastructure/api/ViaCepService";
import { BuscarEnderecoPorCepUseCase } from "@/domain/usecases/BuscarEnderecoPorCepUseCase";
import { useBuscarCep } from "@/hooks/useBuscarCep";

export default function Cadastro() {
  // Inicialização das dependências seguindo DIP
  const cepService = useMemo(() => new ViaCepService(), []);
  const buscarCepUseCase = useMemo(
    () => new BuscarEnderecoPorCepUseCase(cepService),
    [cepService]
  );
  const { buscar, loading: loadingCep, error: errorCep, endereco: enderecoEncontrado } =
    useBuscarCep(buscarCepUseCase);

  const [tipo, setTipo] = useState<EntryType>("entrada");
  const [formData, setFormData] = useState<DadosCadastro>({
    tipo: "entrada",
    cliente: "",
    endereco: "",
    cep: "",
    moto: "",
    placa: "",
    descricao: "",
    fotos: [],
    frete: 0,
  });
  const [fotos, setFotos] = useState<string[]>([]);

  const handleTipoChange = (novoTipo: EntryType) => {
    setTipo(novoTipo);
    setFormData({ ...formData, tipo: novoTipo });
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleCepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cep = e.target.value.replace(/\D/g, "");
    // Formata CEP: 12345678 -> 12345-678
    const cepFormatado = cep.replace(/(\d{5})(\d{3})/, "$1-$2");
    setFormData({
      ...formData,
      cep: cepFormatado,
    });
  };

  const handleBuscarCep = async () => {
    if (!formData.cep || formData.cep.replace(/\D/g, "").length !== 8) {
      toast.error("Digite um CEP válido (8 dígitos)");
      return;
    }

    try {
      const endereco = await buscar(formData.cep.replace(/\D/g, ""));
      // Preenche o endereço automaticamente
      const enderecoFormatado = `${endereco.rua}, ${endereco.bairro}, ${endereco.cidade} - ${endereco.estado}`;
      setFormData({
        ...formData,
        endereco: enderecoFormatado,
        enderecoCompleto: endereco,
      });
      toast.success("Endereço encontrado!");
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : "Erro ao buscar CEP";
      toast.error(mensagem);
    }
  };

  const handleFotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        setFotos((prev) => [...prev, event.target?.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleCalcularFrete = async () => {
    if (!formData.endereco && !formData.enderecoCompleto) {
      toast.error("Busque um endereço por CEP ou digite um endereço para calcular o frete");
      return;
    }
    // Simulação de cálculo de frete
    // Em produção, isso usaria as coordenadas do enderecoCompleto para cálculo real
    const freteSimulado = Math.floor(Math.random() * 100) + 50;
    setFormData({ ...formData, frete: freteSimulado });
    toast.success(`Frete calculado: R$ ${freteSimulado.toFixed(2)}`);
  };

  const handleRegistrar = () => {
    if (!formData.cliente || !formData.moto) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    toast.success(`${tipo === "entrada" ? "Entrada" : "Orçamento"} registrado com sucesso!`);
    // Reset form
    setFormData({
      tipo: "entrada",
      cliente: "",
      endereco: "",
      cep: "",
      moto: "",
      placa: "",
      descricao: "",
      fotos: [],
      frete: 0,
    });
    setFotos([]);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header title="Cadastro" />

      <main className="pt-20 pb-32 px-6">
        <EntryTypeToggle value={tipo} onChange={handleTipoChange} />

        <div className="max-w-2xl mx-auto space-y-8">
          {/* Seção Cliente */}
          <div className="space-y-4">
            <Label htmlFor="cliente" className="text-xs uppercase tracking-widest">
              Nome do Cliente
            </Label>
            <Input
              id="cliente"
              name="cliente"
              placeholder="Ex: João Silva"
              value={formData.cliente}
              onChange={handleInputChange}
              className="bg-card border-foreground/10"
            />
          </div>

          {/* Seção Moto */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-4">
              <Label htmlFor="moto" className="text-xs uppercase tracking-widest">
                Modelo da Moto
              </Label>
              <Input
                id="moto"
                name="moto"
                placeholder="Ex: Honda CB 500X"
                value={formData.moto}
                onChange={handleInputChange}
                className="bg-card border-foreground/10"
              />
            </div>
            {tipo === "entrada" && (
              <div className="space-y-4">
                <Label htmlFor="placa" className="text-xs uppercase tracking-widest">
                  Placa
                </Label>
                <Input
                  id="placa"
                  name="placa"
                  placeholder="Ex: ABC-1234"
                  value={formData.placa}
                  onChange={handleInputChange}
                  className="bg-card border-foreground/10"
                />
              </div>
            )}
          </div>

          {/* Seção Endereço (apenas para Entrada) */}
          {tipo === "entrada" && (
            <div className="space-y-4">
              <Label className="text-xs uppercase tracking-widest">
                Endereço para Entrega
              </Label>

              {/* Campo CEP */}
              <div className="space-y-2">
                <Label htmlFor="cep" className="text-xs text-foreground/70">
                  CEP
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="cep"
                    name="cep"
                    placeholder="00000-000"
                    value={formData.cep}
                    onChange={handleCepChange}
                    maxLength={9}
                    className="bg-card border-foreground/10 flex-1"
                  />
                  <Button
                    onClick={handleBuscarCep}
                    variant="outline"
                    disabled={loadingCep || !formData.cep}
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
                      {enderecoEncontrado.coordenadas && (
                        <p className="font-sans text-xs text-foreground/40 mt-1">
                          📍 Coordenadas: {enderecoEncontrado.coordenadas.latitude}, {enderecoEncontrado.coordenadas.longitude}
                        </p>
                      )}
                    </div>
                  </div>
                </Card>
              )}

              {/* Campo Endereço Manual */}
              <div className="space-y-2">
                <Label htmlFor="endereco" className="text-xs text-foreground/70">
                  Endereço Completo (ou complemento)
                </Label>
                <Input
                  id="endereco"
                  name="endereco"
                  placeholder="Ex: Rua das Flores, 123 - Complemento"
                  value={formData.endereco}
                  onChange={handleInputChange}
                  className="bg-card border-foreground/10"
                />
              </div>

              {/* Botão Calcular Frete */}
              <div className="flex gap-2">
                <Button
                  onClick={handleCalcularFrete}
                  variant="outline"
                  className="flex-1"
                  disabled={!formData.endereco && !formData.enderecoCompleto}
                >
                  <Truck size={16} className="mr-2" />
                  Calcular Frete
                </Button>
              </div>

              {/* Frete Calculado */}
              {(formData.frete ?? 0) > 0 && (
                <Card className="bg-card border-accent/20 p-4">
                  <p className="font-sans text-sm text-foreground/60">Frete Estimado</p>
                  <p className="font-serif text-2xl text-accent">
                    R$ {(formData.frete ?? 0).toFixed(2)}
                  </p>
                </Card>
              )}
            </div>
          )}

          {/* Seção Descrição (apenas para Orçamento) */}
          {tipo === "orcamento" && (
            <div className="space-y-4">
              <Label htmlFor="descricao" className="text-xs uppercase tracking-widest">
                Descrição do Serviço
              </Label>
              <Textarea
                id="descricao"
                name="descricao"
                placeholder="Descreva o serviço de alinhamento..."
                value={formData.descricao}
                onChange={handleInputChange}
                className="bg-card border-foreground/10 min-h-24"
              />
            </div>
          )}

          {/* Seção Fotos */}
          <div className="space-y-4">
            <Label className="text-xs uppercase tracking-widest">Fotos da Moto</Label>
            <div className="border-2 border-dashed border-foreground/20 rounded-lg p-6 text-center">
              <label className="cursor-pointer flex flex-col items-center gap-2">
                <ImagePlus size={32} className="text-accent" />
                <span className="font-sans text-sm text-foreground/60">
                  Clique para adicionar fotos
                </span>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleFotoUpload}
                  className="hidden"
                />
              </label>
            </div>

            {/* Grid de Fotos */}
            {fotos.length > 0 && (
              <div className="grid grid-cols-2 gap-4">
                {fotos.map((foto, idx) => (
                  <div key={idx} className="relative overflow-hidden rounded-lg">
                    <img
                      src={foto}
                      alt={`Foto ${idx + 1}`}
                      className="w-full h-32 object-cover"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Botão de Ação */}
          <button
            onClick={handleRegistrar}
            className="btn-samurai mt-8"
          >
            Registrar na Samurai
          </button>
        </div>
      </main>

      <BottomNav active="cadastro" />
    </div>
  );
}
