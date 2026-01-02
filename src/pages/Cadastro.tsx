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
import { SupabaseFreteApi } from "@/infrastructure/api/SupabaseFreteApi";
import { CalcularFreteUseCase } from "@/domain/usecases/CalcularFreteUseCase";
import { useCalcularFrete } from "@/hooks/useCalcularFrete";
import { SupabaseClienteRepository } from "@/infrastructure/repositories/SupabaseClienteRepository";
import { SupabaseMotoRepository } from "@/infrastructure/repositories/SupabaseMotoRepository";
import { SupabaseEntradaRepository } from "@/infrastructure/repositories/SupabaseEntradaRepository";
import { SupabaseOrcamentoRepository } from "@/infrastructure/repositories/SupabaseOrcamentoRepository";
import { useCriarEntrada } from "@/hooks/useCriarEntrada";
import { SupabaseStorageApi } from "@/infrastructure/storage/SupabaseStorageApi";
import { SupabaseFotoRepository } from "@/infrastructure/repositories/SupabaseFotoRepository";
import { useUploadFoto } from "@/hooks/useUploadFoto";

export default function Cadastro() {
  // Inicialização das dependências seguindo DIP
  const cepService = useMemo(() => new ViaCepService(), []);
  const buscarCepUseCase = useMemo(
    () => new BuscarEnderecoPorCepUseCase(cepService),
    [cepService]
  );
  const { buscar, loading: loadingCep, error: errorCep, endereco: enderecoEncontrado } =
    useBuscarCep(buscarCepUseCase);

  const freteApi = useMemo(() => new SupabaseFreteApi(), []);
  const calcularFreteUseCase = useMemo(
    () => new CalcularFreteUseCase(freteApi),
    [freteApi]
  );
  const { calcular: calcularFrete, loading: loadingFrete, error: errorFrete } =
    useCalcularFrete(calcularFreteUseCase);

  // Repositórios para criar entrada
  const clienteRepo = useMemo(() => new SupabaseClienteRepository(), []);
  const motoRepo = useMemo(() => new SupabaseMotoRepository(), []);
  const entradaRepo = useMemo(() => new SupabaseEntradaRepository(), []);
  const orcamentoRepo = useMemo(() => new SupabaseOrcamentoRepository(), []);
  const { criar: criarEntrada, loading: loadingCriar } = useCriarEntrada(
    clienteRepo,
    motoRepo,
    entradaRepo,
    orcamentoRepo
  );

  // Storage para upload de fotos
  const storageApi = useMemo(() => new SupabaseStorageApi(), []);
  const fotoRepo = useMemo(() => new SupabaseFotoRepository(), []);
  const { upload: uploadFoto, loading: loadingUpload } = useUploadFoto(storageApi, fotoRepo);

  const [tipo, setTipo] = useState<EntryType>("entrada");
  const [formData, setFormData] = useState<DadosCadastro>({
    tipo: "entrada",
    cliente: "",
    telefone: "",
    endereco: "",
    cep: "",
    moto: "",
    placa: "",
    finalNumeroQuadro: "",
    valorCobrado: undefined,
    descricao: "",
    observacoes: "",
    fotos: [],
    frete: 0,
    dataOrcamento: undefined,
    dataEntrada: undefined,
    dataEntrega: undefined,
  });
  const [fotos, setFotos] = useState<string[]>([]); // URLs para preview
  const [fotosArquivos, setFotosArquivos] = useState<File[]>([]); // Arquivos reais para upload

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
    
    // Valida tamanho (5MB por arquivo)
    const maxSize = 5 * 1024 * 1024;
    const arquivosValidos = files.filter((file) => {
      if (file.size > maxSize) {
        toast.error(`Arquivo ${file.name} muito grande. Tamanho máximo: 5MB.`);
        return false;
      }
      return true;
    });

    // Adiciona arquivos
    setFotosArquivos((prev) => [...prev, ...arquivosValidos]);
    
    // Cria preview
    arquivosValidos.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        setFotos((prev) => [...prev, event.target?.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleCalcularFrete = async () => {
    // Precisa ter CEP para calcular frete (obrigatório para orçamento)
    const cepDestino = formData.cep?.replace(/\D/g, "");
    if (!cepDestino || cepDestino.length !== 8) {
      toast.error("Busque um endereço por CEP primeiro para calcular o frete");
      return;
    }

    try {
      const resultado = await calcularFrete(cepDestino);
      // Frete ida e volta = dobra o valor
      const freteIdaVolta = resultado.valorFrete * 2;
      setFormData({ ...formData, frete: freteIdaVolta });
      toast.success(
        `Frete calculado (ida e volta): R$ ${freteIdaVolta.toFixed(2)} (${resultado.distanciaKm.toFixed(2)} km)`
      );
    } catch (err) {
      const mensagem =
        err instanceof Error ? err.message : "Erro ao calcular frete";
      toast.error(mensagem);
    }
  };

  const handleRegistrar = async () => {
    // Validações
    if (!formData.cliente || !formData.moto || !formData.telefone || !formData.valorCobrado) {
      toast.error("Preencha todos os campos obrigatórios (*)");
      return;
    }

    if (tipo === "orcamento") {
      if (!formData.descricao) {
        toast.error("Descrição é obrigatória para orçamentos");
        return;
      }
      if (!formData.cep || formData.cep.replace(/\D/g, "").length !== 8) {
        toast.error("CEP é obrigatório para orçamentos (para cálculo de frete)");
        return;
      }
    }

    try {
      // 1. Criar entrada
      const { entradaId } = await criarEntrada({
        ...formData,
        fotos: fotos,
      });

      // 2. Fazer upload das fotos
      if (fotosArquivos.length > 0) {
        toast.info("Fazendo upload das fotos...");
        const resultados = await Promise.allSettled(
          fotosArquivos.map((file) => uploadFoto(file, entradaId, "moto"))
        );
        
        // Verifica se houve erros
        const erros = resultados.filter((r) => r.status === "rejected");
        if (erros.length > 0) {
          console.error("Erros no upload de fotos:", erros);
          toast.error(`${erros.length} foto(s) falharam no upload`);
        }
        
        const sucessos = resultados.filter((r) => r.status === "fulfilled");
        if (sucessos.length > 0) {
          console.log(`${sucessos.length} foto(s) salvas com sucesso na tabela`);
        }
      }

      toast.success(`${tipo === "entrada" ? "Entrada" : "Orçamento"} registrado com sucesso!`);
      
      // Reset form
      setFormData({
        tipo: "entrada",
        cliente: "",
        telefone: "",
        endereco: "",
        cep: "",
        moto: "",
        placa: "",
        finalNumeroQuadro: "",
        valorCobrado: undefined,
        descricao: "",
        observacoes: "",
        fotos: [],
        frete: 0,
        dataOrcamento: undefined,
        dataEntrada: undefined,
        dataEntrega: undefined,
      });
      setFotos([]);
      setFotosArquivos([]);
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : "Erro ao registrar";
      toast.error(mensagem);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header title="Cadastro" />

      <main className="pt-20 pb-32 px-6">
        <EntryTypeToggle value={tipo} onChange={handleTipoChange} />

        <div className="max-w-2xl mx-auto space-y-8">
          {/* Seção Cliente */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cliente" className="text-xs uppercase tracking-widest">
                Nome do Cliente *
              </Label>
              <Input
                id="cliente"
                name="cliente"
                placeholder="Ex: João Silva"
                value={formData.cliente}
                onChange={handleInputChange}
                className="bg-card border-foreground/10"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="telefone" className="text-xs uppercase tracking-widest">
                Telefone *
              </Label>
              <Input
                id="telefone"
                name="telefone"
                type="tel"
                placeholder="(11) 99999-9999"
                value={formData.telefone}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, "");
                  const formatted = value.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
                  setFormData({ ...formData, telefone: formatted || value });
                }}
                className="bg-card border-foreground/10"
                required
              />
            </div>
          </div>

          {/* Seção Moto */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="moto" className="text-xs uppercase tracking-widest">
                Modelo da Moto *
              </Label>
              <Input
                id="moto"
                name="moto"
                placeholder="Ex: Honda CB 500X"
                value={formData.moto}
                onChange={handleInputChange}
                className="bg-card border-foreground/10"
                required
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="placa" className="text-xs text-foreground/70">
                  Placa
                </Label>
                <Input
                  id="placa"
                  name="placa"
                  placeholder="Ex: ABC-1234"
                  value={formData.placa || ""}
                  onChange={handleInputChange}
                  className="bg-card border-foreground/10"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="finalNumeroQuadro" className="text-xs text-foreground/70">
                  Final Nº Quadro
                </Label>
                <Input
                  id="finalNumeroQuadro"
                  name="finalNumeroQuadro"
                  placeholder="Últimos dígitos do chassi"
                  value={formData.finalNumeroQuadro || ""}
                  onChange={handleInputChange}
                  className="bg-card border-foreground/10"
                />
              </div>
            </div>
          </div>

          {/* Seção Endereço (obrigatório para Orçamento, opcional para Entrada) */}
          {(tipo === "entrada" || tipo === "orcamento") && (
            <div className="space-y-4">
              <Label className="text-xs uppercase tracking-widest">
                Endereço para Entrega {tipo === "orcamento" && "*"}
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
                  disabled={loadingFrete || !formData.cep || formData.cep.replace(/\D/g, "").length !== 8}
                >
                  <Truck size={16} className="mr-2" />
                  {loadingFrete ? "Calculando..." : "Calcular Frete"}
                </Button>
              </div>
              {errorFrete && (
                <p className="text-xs text-red-500">{errorFrete}</p>
              )}

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

          {/* Seção Valor Cobrado */}
          <div className="space-y-2">
            <Label htmlFor="valorCobrado" className="text-xs uppercase tracking-widest">
              Valor Cobrado *
            </Label>
            <Input
              id="valorCobrado"
              name="valorCobrado"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={formData.valorCobrado || ""}
              onChange={(e) => {
                const value = parseFloat(e.target.value) || undefined;
                setFormData({ ...formData, valorCobrado: value });
              }}
              className="bg-card border-foreground/10"
              required
            />
          </div>

          {/* Seção Descrição/Observações */}
          <div className="space-y-4">
            {tipo === "orcamento" && (
              <div className="space-y-2">
                <Label htmlFor="descricao" className="text-xs uppercase tracking-widest">
                  Descrição do Serviço *
                </Label>
                <Textarea
                  id="descricao"
                  name="descricao"
                  placeholder="Descreva o serviço de alinhamento..."
                  value={formData.descricao || ""}
                  onChange={handleInputChange}
                  className="bg-card border-foreground/10 min-h-24"
                  required
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="observacoes" className="text-xs uppercase tracking-widest">
                Detalhes ou Observações
              </Label>
              <Textarea
                id="observacoes"
                name="observacoes"
                placeholder="Observações adicionais..."
                value={formData.observacoes || ""}
                onChange={handleInputChange}
                className="bg-card border-foreground/10 min-h-24"
              />
            </div>
          </div>

          {/* Seção Datas */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {tipo === "orcamento" && (
              <div className="space-y-2">
                <Label htmlFor="dataOrcamento" className="text-xs uppercase tracking-widest">
                  Data Orçamento
                </Label>
                <Input
                  id="dataOrcamento"
                  name="dataOrcamento"
                  type="date"
                  value={formData.dataOrcamento ? new Date(formData.dataOrcamento).toISOString().split('T')[0] : ""}
                  onChange={(e) => {
                    const date = e.target.value ? new Date(e.target.value) : undefined;
                    setFormData({ ...formData, dataOrcamento: date });
                  }}
                  className="bg-card border-foreground/10"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="dataEntrada" className="text-xs uppercase tracking-widest">
                Data Entrada
              </Label>
              <Input
                id="dataEntrada"
                name="dataEntrada"
                type="date"
                value={formData.dataEntrada ? new Date(formData.dataEntrada).toISOString().split('T')[0] : ""}
                onChange={(e) => {
                  const date = e.target.value ? new Date(e.target.value) : undefined;
                  setFormData({ ...formData, dataEntrada: date });
                }}
                className="bg-card border-foreground/10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dataEntrega" className="text-xs uppercase tracking-widest">
                Data Entrega
              </Label>
              <Input
                id="dataEntrega"
                name="dataEntrega"
                type="date"
                value={formData.dataEntrega ? new Date(formData.dataEntrega).toISOString().split('T')[0] : ""}
                onChange={(e) => {
                  const date = e.target.value ? new Date(e.target.value) : undefined;
                  setFormData({ ...formData, dataEntrega: date });
                }}
                className="bg-card border-foreground/10"
              />
            </div>
          </div>

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
            disabled={loadingCriar || loadingUpload}
          >
            {loadingCriar || loadingUpload
              ? loadingCriar
                ? "Registrando..."
                : "Fazendo upload das fotos..."
              : "Registrar na Samurai"}
          </button>
        </div>
      </main>

      <BottomNav active="cadastro" />
    </div>
  );
}
