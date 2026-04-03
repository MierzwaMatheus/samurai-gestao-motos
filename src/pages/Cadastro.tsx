import { useState, useMemo, useEffect } from "react";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import EntryTypeToggle from "@/components/EntryTypeToggle";
import {
  EntryType,
  DadosCadastro,
  Cliente,
  ServicoSelecionado,
  ServicoPersonalizadoInput,
} from "@shared/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { ImagePlus, Truck, Search, MapPin, Store } from "lucide-react";
import { toast } from "sonner";
import { ClienteSearch } from "@/components/ClienteSearch";
import { GerenciarServicos } from "@/components/GerenciarServicos";
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
import { SupabaseTipoServicoRepository } from "@/infrastructure/repositories/SupabaseTipoServicoRepository";
import { SupabaseServicoPersonalizadoRepository } from "@/infrastructure/repositories/SupabaseServicoPersonalizadoRepository";
import { useCriarEntrada } from "@/hooks/useCriarEntrada";
import { useAtualizarEntrada } from "@/hooks/useAtualizarEntrada";
import { SupabaseStorageApi } from "@/infrastructure/storage/SupabaseStorageApi";
import { SupabaseFotoRepository } from "@/infrastructure/repositories/SupabaseFotoRepository";
import { useUploadFoto } from "@/hooks/useUploadFoto";
import { SupabaseHistoricoRepository } from "@/infrastructure/repositories/SupabaseHistoricoRepository";

export default function Cadastro() {
  // Inicialização das dependências seguindo DIP
  const cepService = useMemo(() => new ViaCepService(), []);
  const buscarCepUseCase = useMemo(
    () => new BuscarEnderecoPorCepUseCase(cepService),
    [cepService]
  );
  const {
    buscar,
    loading: loadingCep,
    error: errorCep,
    endereco: enderecoEncontrado,
  } = useBuscarCep(buscarCepUseCase);

  const freteApi = useMemo(() => new SupabaseFreteApi(), []);
  const calcularFreteUseCase = useMemo(
    () => new CalcularFreteUseCase(freteApi),
    [freteApi]
  );
  const {
    calcular: calcularFrete,
    loading: loadingFrete,
    error: errorFrete,
  } = useCalcularFrete(calcularFreteUseCase);

  // Repositórios para criar entrada
  const clienteRepo = useMemo(() => new SupabaseClienteRepository(), []);
  const motoRepo = useMemo(() => new SupabaseMotoRepository(), []);
  const entradaRepo = useMemo(() => new SupabaseEntradaRepository(), []);
  const orcamentoRepo = useMemo(() => new SupabaseOrcamentoRepository(), []);
  const tipoServicoRepo = useMemo(
    () => new SupabaseTipoServicoRepository(),
    []
  );
  const servicoPersonalizadoRepo = useMemo(
    () => new SupabaseServicoPersonalizadoRepository(),
    []
  );
  const { criar: criarEntrada, loading: loadingCriar } = useCriarEntrada(
    clienteRepo,
    motoRepo,
    entradaRepo,
    orcamentoRepo,
    tipoServicoRepo,
    servicoPersonalizadoRepo
  );

  const [modoEdicao, setModoEdicao] = useState(false);
  const [entradaIdEdicao, setEntradaIdEdicao] = useState<string | undefined>(
    undefined
  );

  // Storage para upload de fotos
  const storageApi = useMemo(() => new SupabaseStorageApi(), []);
  const fotoRepo = useMemo(() => new SupabaseFotoRepository(), []);
  const historicoRepo = useMemo(() => new SupabaseHistoricoRepository(), []);

  const { atualizar: atualizarEntrada, loading: loadingAtualizar } =
    useAtualizarEntrada(
      clienteRepo,
      motoRepo,
      entradaRepo,
      orcamentoRepo,
      tipoServicoRepo,
      servicoPersonalizadoRepo,
      historicoRepo
    );
  const { upload: uploadFoto, loading: loadingUpload } = useUploadFoto(
    storageApi,
    fotoRepo
  );

  const [tipo, setTipo] = useState<EntryType>("entrada");
  const [usarClienteExistente, setUsarClienteExistente] = useState(false);
  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(
    null
  );
  const [tipoPreco, setTipoPreco] = useState<"oficina" | "particular">(
    "oficina"
  );
  const [servicos, setServicos] = useState<ServicoSelecionado[]>([]);
  const [servicosPersonalizados, setServicosPersonalizados] = useState<
    ServicoPersonalizadoInput[]
  >([]);
  const [valorTotalCalculado, setValorTotalCalculado] = useState<number>(0);
  const [formData, setFormData] = useState<DadosCadastro>({
    tipo: "entrada",
    cliente: "",
    telefone: "",
    endereco: "",
    cep: "",
    moto: "",
    marca: "",
    ano: "",
    cilindrada: "",
    placa: "",
    finalNumeroQuadro: "",
    valorCobrado: undefined,
    descricao: "",
    observacoes: "",
    fotos: [],
    frete: 0,
    isRetirada: false,
    dataOrcamento: undefined,
    dataEntrada: undefined,
    dataEntrega: undefined,
    servicos: [],
    servicosPersonalizados: [],
  });
  const [isRetirada, setIsRetirada] = useState(false);
  const [fotos, setFotos] = useState<string[]>([]); // URLs para preview
  const [fotosArquivos, setFotosArquivos] = useState<File[]>([]); // Arquivos reais para upload

  // Efeito para calcular data de entrega automaticamente quando data de entrada é alterada
  useEffect(() => {
    if (formData.dataEntrada) {
      // Calcula data de entrega: 2 semanas (14 dias) após a data de entrada
      const dataEntregaCalculada = new Date(formData.dataEntrada);
      dataEntregaCalculada.setDate(dataEntregaCalculada.getDate() + 14);

      // Só atualiza se a data de entrega atual for diferente da calculada
      // Isso evita loops infinitos e atualizações desnecessárias
      const dataEntregaAtual = formData.dataEntrega;
      if (
        !dataEntregaAtual ||
        dataEntregaAtual.getTime() !== dataEntregaCalculada.getTime()
      ) {
        setFormData(prev => ({
          ...prev,
          dataEntrega: dataEntregaCalculada,
        }));
      }
    } else {
      // Se não há data de entrada, limpa a data de entrega apenas se ela existir
      if (formData.dataEntrega) {
        setFormData(prev => ({
          ...prev,
          dataEntrega: undefined,
        }));
      }
    }
  }, [formData.dataEntrada]);

  // Efeito para calcular valor total baseado nos serviços
  useEffect(() => {
    const calcularValorTotal = async () => {
      let total = 0;

      // Calcular valor dos tipos de serviço
      if (servicos.length > 0) {
        const tiposIds = servicos.map(s => s.tipoServicoId);
        const tipos = await Promise.all(
          tiposIds.map(id => tipoServicoRepo.buscarPorId(id))
        );

        tipos.forEach((tipo, index) => {
          if (tipo) {
            let preco = 0;
            if (tipo.categoria === "alinhamento") {
              // Para alinhamento, verifica se tem ou não óleo
              if (servicos[index].comOleo) {
                preco =
                  tipoPreco === "particular"
                    ? (tipo.precoParticularComOleo ?? tipo.precoParticular)
                    : (tipo.precoOficinaComOleo ?? tipo.precoOficina);
              } else {
                preco =
                  tipoPreco === "particular"
                    ? (tipo.precoParticularSemOleo ?? tipo.precoParticular)
                    : (tipo.precoOficinaSemOleo ?? tipo.precoOficina);
              }
            } else {
              // Para outros serviços, usa o preço padrão
              preco =
                tipoPreco === "particular"
                  ? tipo.precoParticular
                  : tipo.precoOficina;
            }
            total += preco * servicos[index].quantidade;
          }
        });
      }

      // Calcular valor dos serviços personalizados
      servicosPersonalizados.forEach(servico => {
        total += servico.valor * servico.quantidade;
      });

      setValorTotalCalculado(total);
      setFormData(prev => ({ ...prev, valorCobrado: total }));
    };

    calcularValorTotal();
  }, [servicos, servicosPersonalizados, tipoServicoRepo, tipoPreco]);

  // Efeito para preencher formulário com dados do orçamento quando disponível
  useEffect(() => {
    const dadosSalvos = sessionStorage.getItem("dadosOrcamentoParaOS");
    if (dadosSalvos) {
      try {
        const dadosParsed = JSON.parse(dadosSalvos);

        // Converte strings de data para Date objects (JSON.stringify converte Date para string ISO)
        // Campos opcionais só são preenchidos se tiverem valores
        const dadosCadastro: DadosCadastro = {
          // Campos obrigatórios
          tipo: dadosParsed.tipo || "entrada",
          entradaId: dadosParsed.entradaId,
          cliente: dadosParsed.cliente || "",
          clienteId: dadosParsed.clienteId,
          moto: dadosParsed.moto || "",
          marca: dadosParsed.marca || "",
          ano: dadosParsed.ano || "",
          cilindrada: dadosParsed.cilindrada || "",
          valorCobrado: dadosParsed.valorCobrado,
          tipoPreco: dadosParsed.tipoPreco || "oficina",
          // Campos opcionais - só preenche se tiverem valores
          telefone:
            dadosParsed.telefone && dadosParsed.telefone.trim() !== ""
              ? dadosParsed.telefone
              : "",
          endereco:
            dadosParsed.endereco && dadosParsed.endereco.trim() !== ""
              ? dadosParsed.endereco
              : "",
          cep:
            dadosParsed.cep && dadosParsed.cep.trim() !== ""
              ? dadosParsed.cep
              : "",
          placa:
            dadosParsed.placa && dadosParsed.placa.trim() !== ""
              ? dadosParsed.placa
              : "",
          finalNumeroQuadro:
            dadosParsed.finalNumeroQuadro &&
            dadosParsed.finalNumeroQuadro.trim() !== ""
              ? dadosParsed.finalNumeroQuadro
              : "",
          descricao:
            dadosParsed.descricao && dadosParsed.descricao.trim() !== ""
              ? dadosParsed.descricao
              : "",
          observacoes: "", // NÃO preenche observações/detalhes
          fotos:
            dadosParsed.fotos &&
            Array.isArray(dadosParsed.fotos) &&
            dadosParsed.fotos.length > 0
              ? dadosParsed.fotos
              : [],
          frete: dadosParsed.isRetirada ? null : dadosParsed.frete || 0,
          isRetirada: dadosParsed.isRetirada || false,
          dataOrcamento: dadosParsed.dataOrcamento
            ? dadosParsed.dataOrcamento instanceof Date
              ? dadosParsed.dataOrcamento
              : new Date(dadosParsed.dataOrcamento)
            : undefined,
          dataEntrada: dadosParsed.dataEntrada
            ? dadosParsed.dataEntrada instanceof Date
              ? dadosParsed.dataEntrada
              : new Date(dadosParsed.dataEntrada)
            : undefined,
          dataEntrega: dadosParsed.dataEntrega
            ? dadosParsed.dataEntrega instanceof Date
              ? dadosParsed.dataEntrega
              : new Date(dadosParsed.dataEntrega)
            : undefined,
          servicos:
            dadosParsed.servicos &&
            Array.isArray(dadosParsed.servicos) &&
            dadosParsed.servicos.length > 0
              ? dadosParsed.servicos
              : dadosParsed.tiposServico &&
                  Array.isArray(dadosParsed.tiposServico) &&
                  dadosParsed.tiposServico.length > 0
                ? dadosParsed.tiposServico.map((id: string) => ({
                    tipoServicoId: id,
                    quantidade: 1,
                  }))
                : [],
          servicosPersonalizados:
            dadosParsed.servicosPersonalizados &&
            Array.isArray(dadosParsed.servicosPersonalizados) &&
            dadosParsed.servicosPersonalizados.length > 0
              ? dadosParsed.servicosPersonalizados
              : [],
        };

        // Se há entradaId, ativa modo de edição
        if (dadosParsed.entradaId) {
          setModoEdicao(true);
          setEntradaIdEdicao(dadosParsed.entradaId);
        }

        // Preenche o formulário com os dados
        setFormData(dadosCadastro);
        setTipo(dadosCadastro.tipo);
        setIsRetirada(dadosCadastro.isRetirada || false);

        // Carrega o tipoPreco se existir nos dados
        if (dadosCadastro.tipoPreco) {
          setTipoPreco(dadosCadastro.tipoPreco);
        }

        // Se há clienteId, ativa o modo de cliente existente
        if (dadosCadastro.clienteId) {
          setUsarClienteExistente(true);
          // Busca o cliente para preencher o clienteSelecionado
          clienteRepo
            .buscarPorId(dadosCadastro.clienteId)
            .then(cliente => {
              if (cliente) {
                setClienteSelecionado(cliente);
              }
            })
            .catch(err => {
              console.error("Erro ao buscar cliente:", err);
            });
        }

        // Preenche serviços selecionados
        if (dadosCadastro.servicos && dadosCadastro.servicos.length > 0) {
          setServicos(dadosCadastro.servicos);
        }

        if (
          dadosCadastro.servicosPersonalizados &&
          dadosCadastro.servicosPersonalizados.length > 0
        ) {
          setServicosPersonalizados(dadosCadastro.servicosPersonalizados);
        }

        // Preenche fotos (URLs para preview)
        if (dadosCadastro.fotos && dadosCadastro.fotos.length > 0) {
          setFotos(dadosCadastro.fotos);
        }

        // Remove os dados do sessionStorage após usar
        sessionStorage.removeItem("dadosOrcamentoParaOS");

        toast.success("Formulário preenchido com dados do orçamento!");
      } catch (err) {
        console.error("Erro ao processar dados do orçamento:", err);
        sessionStorage.removeItem("dadosOrcamentoParaOS");
        toast.error("Erro ao carregar dados do orçamento");
      }
    }
  }, [clienteRepo]);

  const handleTipoChange = (novoTipo: EntryType) => {
    setTipo(novoTipo);
    setFormData({ ...formData, tipo: novoTipo });
  };

  const handleClienteSelecionado = (cliente: Cliente | null) => {
    setClienteSelecionado(cliente);
    if (cliente) {
      setFormData({
        ...formData,
        cliente: cliente.nome,
        clienteId: cliente.id,
        telefone: cliente.telefone || "",
        endereco: cliente.endereco || "",
        cep: cliente.cep || "",
      });
    } else {
      setFormData({
        ...formData,
        cliente: "",
        clienteId: undefined,
        telefone: "",
        endereco: "",
        cep: "",
      });
    }
  };

  const handleToggleClienteExistente = (checked: boolean) => {
    setUsarClienteExistente(checked);
    if (!checked) {
      // Limpar seleção quando desativar
      setClienteSelecionado(null);
      setFormData({
        ...formData,
        cliente: "",
        clienteId: undefined,
        telefone: "",
        endereco: "",
        cep: "",
      });
    }
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
      const mensagem =
        err instanceof Error ? err.message : "Erro ao buscar CEP";
      toast.error(mensagem);
    }
  };

  const handleFotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);

    // Valida tamanho (5MB por arquivo)
    const maxSize = 5 * 1024 * 1024;
    const arquivosValidos = files.filter(file => {
      if (file.size > maxSize) {
        toast.error(`Arquivo ${file.name} muito grande. Tamanho máximo: 5MB.`);
        return false;
      }
      return true;
    });

    // Adiciona arquivos
    setFotosArquivos(prev => [...prev, ...arquivosValidos]);

    // Cria preview
    arquivosValidos.forEach(file => {
      const reader = new FileReader();
      reader.onload = event => {
        setFotos(prev => [...prev, event.target?.result as string]);
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
      // Frete ida e volta = quadruplica o valor
      const freteIdaVolta = resultado.valorFrete * 4;
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
    if (usarClienteExistente && !clienteSelecionado) {
      toast.error("Selecione um cliente existente");
      return;
    }

    if (!usarClienteExistente && (!formData.cliente || !formData.telefone)) {
      toast.error("Preencha todos os campos obrigatórios (*)");
      return;
    }

    if (!formData.moto) {
      toast.error("Preencha todos os campos obrigatórios (*)");
      return;
    }

    // Validar que há pelo menos um serviço ou serviço personalizado
    if (servicos.length === 0 && servicosPersonalizados.length === 0) {
      toast.error("Adicione pelo menos um serviço");
      return;
    }

    if (tipo === "orcamento" && !isRetirada) {
      if (!formData.cep || formData.cep.replace(/\D/g, "").length !== 8) {
        toast.error("CEP é obrigatório para orçamentos com frete");
        return;
      }
    }

    try {
      // 1. Preparar dados para envio
      const dadosParaEnviar: DadosCadastro = {
        ...formData,
        frete: isRetirada ? null : formData.frete || 0,
        isRetirada,
        fotos: fotos,
        servicos: servicos,
        servicosPersonalizados: servicosPersonalizados,
      };

      // Verifica se é modo de edição ou criação
      if (modoEdicao && entradaIdEdicao) {
        // Atualizar entrada existente
        await atualizarEntrada(entradaIdEdicao, dadosParaEnviar);

        // Upload de novas fotos (se houver)
        if (fotosArquivos.length > 0) {
          toast.info("Fazendo upload das novas fotos...");
          const resultados = await Promise.allSettled(
            fotosArquivos.map(file => uploadFoto(file, entradaIdEdicao, "moto"))
          );

          const erros = resultados.filter(r => r.status === "rejected");
          if (erros.length > 0) {
            console.error("Erros no upload de fotos:", erros);
            toast.error(`${erros.length} foto(s) falharam no upload`);
          }

          const sucessos = resultados.filter(r => r.status === "fulfilled");
          if (sucessos.length > 0) {
            toast.success(`${sucessos.length} foto(s) salva(s) com sucesso`);
          }
        }

        toast.success("Entrada atualizada com sucesso!");
      } else {
        // Criar nova entrada
        const { entradaId } = await criarEntrada(dadosParaEnviar);

        // 2. Fazer upload das fotos
        if (fotosArquivos.length > 0) {
          toast.info("Fazendo upload das fotos...");
          const resultados = await Promise.allSettled(
            fotosArquivos.map(file => uploadFoto(file, entradaId, "moto"))
          );

          // Verifica se houve erros
          const erros = resultados.filter(r => r.status === "rejected");
          if (erros.length > 0) {
            console.error("Erros no upload de fotos:", erros);
            toast.error(`${erros.length} foto(s) falharam no upload`);
          }

          const sucessos = resultados.filter(r => r.status === "fulfilled");
          if (sucessos.length > 0) {
            console.log(
              `${sucessos.length} foto(s) salvas com sucesso na tabela`
            );
          }
        }

        toast.success(
          `${tipo === "entrada" ? "Entrada" : "Orçamento"} registrado com sucesso!`
        );
      }

      // Reset form
      setFormData({
        tipo: "entrada",
        cliente: "",
        clienteId: undefined,
        telefone: "",
        endereco: "",
        cep: "",
        moto: "",
        marca: "",
        ano: "",
        cilindrada: "",
        placa: "",
        finalNumeroQuadro: "",
        valorCobrado: undefined,
        descricao: "",
        observacoes: "",
        fotos: [],
        frete: 0,
        isRetirada: false,
        dataOrcamento: undefined,
        dataEntrada: undefined,
        dataEntrega: undefined,
        servicos: [],
        servicosPersonalizados: [],
      });
      setFotos([]);
      setFotosArquivos([]);
      setClienteSelecionado(null);
      setUsarClienteExistente(false);
      setServicos([]);
      setServicosPersonalizados([]);
      setValorTotalCalculado(0);
      setIsRetirada(false);
      setModoEdicao(false);
      setEntradaIdEdicao(undefined);
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : "Erro ao registrar";
      toast.error(mensagem);
    }
  };

  return (
    <div className="min-h-screen bg-background admin-background">
      <Header title="Cadastro" />

      <main className="pt-20 pb-32 px-6">
        <EntryTypeToggle value={tipo} onChange={handleTipoChange} />

        <div className="max-w-2xl mx-auto space-y-8">
          {/* Seção Cliente */}
          <div className="space-y-4">
            {/* Toggle para usar cliente existente */}
            <div className="flex items-center justify-between p-4 bg-card border border-foreground/10 rounded-lg">
              <div className="space-y-0.5">
                <Label
                  htmlFor="usar-cliente-existente"
                  className="text-sm font-medium"
                >
                  Usar cliente existente
                </Label>
                <p className="text-xs text-foreground/60">
                  Buscar e selecionar um cliente já cadastrado
                </p>
              </div>
              <Switch
                id="usar-cliente-existente"
                checked={usarClienteExistente}
                onCheckedChange={handleToggleClienteExistente}
              />
            </div>

            {usarClienteExistente ? (
              /* Busca de cliente existente */
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-widest">
                    Buscar Cliente *
                  </Label>
                  <ClienteSearch
                    clienteRepo={clienteRepo}
                    value={clienteSelecionado}
                    onSelect={handleClienteSelecionado}
                  />
                </div>
              </div>
            ) : (
              /* Campos de cadastro de novo cliente */
              <>
                <div className="space-y-2">
                  <Label
                    htmlFor="cliente"
                    className="text-xs uppercase tracking-widest"
                  >
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
                  <Label
                    htmlFor="telefone"
                    className="text-xs uppercase tracking-widest"
                  >
                    Telefone *
                  </Label>
                  <Input
                    id="telefone"
                    name="telefone"
                    type="tel"
                    placeholder="(11) 99999-9999"
                    value={formData.telefone}
                    onChange={e => {
                      const value = e.target.value.replace(/\D/g, "");
                      const formatted = value.replace(
                        /(\d{2})(\d{5})(\d{4})/,
                        "($1) $2-$3"
                      );
                      setFormData({
                        ...formData,
                        telefone: formatted || value,
                      });
                    }}
                    className="bg-card border-foreground/10"
                    required
                  />
                </div>
              </>
            )}
          </div>

          {/* Seção Moto */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label
                htmlFor="moto"
                className="text-xs uppercase tracking-widest"
              >
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
                <Label htmlFor="marca" className="text-xs text-foreground/70">
                  Marca
                </Label>
                <Input
                  id="marca"
                  name="marca"
                  placeholder="Ex: Honda"
                  value={formData.marca || ""}
                  onChange={handleInputChange}
                  className="bg-card border-foreground/10"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ano" className="text-xs text-foreground/70">
                  Ano
                </Label>
                <Input
                  id="ano"
                  name="ano"
                  placeholder="Ex: 2022"
                  value={formData.ano || ""}
                  onChange={handleInputChange}
                  className="bg-card border-foreground/10"
                />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="cilindrada"
                  className="text-xs text-foreground/70"
                >
                  Cilindrada
                </Label>
                <Input
                  id="cilindrada"
                  name="cilindrada"
                  placeholder="Ex: 500cc"
                  value={formData.cilindrada || ""}
                  onChange={handleInputChange}
                  className="bg-card border-foreground/10"
                />
              </div>
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
                <Label
                  htmlFor="finalNumeroQuadro"
                  className="text-xs text-foreground/70"
                >
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

          {/* Toggle Tipo de Preço */}
          <div className="p-4 bg-card border border-foreground/10 rounded-lg space-y-4">
            <div className="space-y-1">
              <Label htmlFor="tipo-preco" className="text-sm font-medium">
                Tipo de Preço
              </Label>
              <p className="text-xs text-foreground/60">
                Selecione se é serviço de oficina ou particular
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 w-full">
              <Button
                variant={tipoPreco === "oficina" ? "default" : "outline"}
                size="sm"
                className="w-full"
                onClick={() => {
                  setTipoPreco("oficina");
                  setFormData({ ...formData, tipoPreco: "oficina" });
                }}
              >
                Oficina
              </Button>
              <Button
                variant={tipoPreco === "particular" ? "default" : "outline"}
                size="sm"
                className="w-full"
                onClick={() => {
                  setTipoPreco("particular");
                  setFormData({ ...formData, tipoPreco: "particular" });
                }}
              >
                Particular
              </Button>
            </div>
          </div>

          {/* Seção Serviços */}
          <div className="space-y-4">
            <Label className="text-xs uppercase tracking-widest">
              Serviços *
            </Label>
            <GerenciarServicos
              tipoServicoRepo={tipoServicoRepo}
              servicos={servicos}
              servicosPersonalizados={servicosPersonalizados}
              tipoPreco={tipoPreco}
              onServicosChange={novosServicos => {
                setServicos(novosServicos);
                setFormData({ ...formData, servicos: novosServicos });
              }}
              onServicosPersonalizadosChange={novosPersonalizados => {
                setServicosPersonalizados(novosPersonalizados);
                setFormData({
                  ...formData,
                  servicosPersonalizados: novosPersonalizados,
                });
              }}
            />
          </div>

          {/* Seção Endereço (obrigatório para Orçamento, opcional para Entrada) */}
          {(tipo === "entrada" || tipo === "orcamento") && (
            <div className="space-y-4">
              <Label className="text-xs uppercase tracking-widest">
                Endereço para Entrega{" "}
                {tipo === "orcamento" && !isRetirada && "*"}
              </Label>

              {/* Toggle Frete/Retirada */}
              <div className="p-4 bg-card border border-foreground/10 rounded-lg space-y-4">
                <div className="space-y-1">
                  <Label className="text-sm font-medium">Tipo de Entrega</Label>
                  <p className="text-xs text-foreground/60">
                    Selecione se o cliente retira na loja ou precisa de frete
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 w-full">
                  <Button
                    variant={!isRetirada ? "default" : "outline"}
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      setIsRetirada(false);
                      setFormData({
                        ...formData,
                        isRetirada: false,
                        frete: formData.frete || 0,
                      });
                    }}
                  >
                    <Truck size={16} className="mr-2" />
                    Frete
                  </Button>
                  <Button
                    variant={isRetirada ? "default" : "outline"}
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      setIsRetirada(true);
                      setFormData({
                        ...formData,
                        cep: "",
                        endereco: "",
                        enderecoCompleto: undefined,
                        isRetirada: true,
                        frete: null,
                      });
                    }}
                  >
                    <Store size={16} className="mr-2" />
                    Retirada
                  </Button>
                </div>
              </div>

              {/* Campos de CEP e Endereço - só aparecem quando NÃO é retirada */}
              {!isRetirada && (
                <>
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
                            {enderecoEncontrado.bairro},{" "}
                            {enderecoEncontrado.cidade} -{" "}
                            {enderecoEncontrado.estado}
                          </p>
                          <p className="font-sans text-xs text-foreground/50 mt-1">
                            CEP: {enderecoEncontrado.cep}
                          </p>
                          {enderecoEncontrado.coordenadas && (
                            <p className="font-sans text-xs text-foreground/40 mt-1">
                              📍 Coordenadas:{" "}
                              {enderecoEncontrado.coordenadas.latitude},{" "}
                              {enderecoEncontrado.coordenadas.longitude}
                            </p>
                          )}
                        </div>
                      </div>
                    </Card>
                  )}

                  {/* Campo Endereço Manual */}
                  <div className="space-y-2">
                    <Label
                      htmlFor="endereco"
                      className="text-xs text-foreground/70"
                    >
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
                      disabled={
                        loadingFrete ||
                        !formData.cep ||
                        formData.cep.replace(/\D/g, "").length !== 8
                      }
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
                      <p className="font-sans text-sm text-foreground/60">
                        Frete Estimado
                      </p>
                      <p className="font-serif text-2xl text-accent">
                        R$ {(formData.frete ?? 0).toFixed(2)}
                      </p>
                    </Card>
                  )}
                </>
              )}
            </div>
          )}

          {/* Seção Valor Cobrado (Calculado) */}
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-widest">
              Valor Cobrado (Calculado)
            </Label>
            <Card className="p-4 bg-accent/10 border-accent/20 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-sans text-sm text-foreground/60">
                  Valor dos serviços
                </span>
                <span className="font-serif text-lg">
                  R$ {valorTotalCalculado.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-sans text-sm text-foreground/60">
                  {isRetirada ? "Retirada" : "Frete"}
                </span>
                <span className="font-serif text-lg">
                  {isRetirada
                    ? "Grátis"
                    : `R$ ${(formData.frete ?? 0).toFixed(2)}`}
                </span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-accent/20">
                <span className="font-sans text-sm font-medium text-foreground">
                  Total
                </span>
                <span className="font-serif text-2xl font-bold text-accent">
                  R${" "}
                  {(
                    valorTotalCalculado +
                    (isRetirada ? 0 : (formData.frete ?? 0))
                  ).toFixed(2)}
                </span>
              </div>
            </Card>
            <p className="text-xs text-foreground/40">
              O valor é calculado automaticamente com base nos serviços
              selecionados
            </p>
          </div>

          {/* Seção Descrição/Observações */}
          <div className="space-y-4">
            {tipo === "orcamento" && (
              <div className="space-y-2">
                <Label
                  htmlFor="descricao"
                  className="text-xs uppercase tracking-widest"
                >
                  Descrição do Serviço
                </Label>
                <Textarea
                  id="descricao"
                  name="descricao"
                  placeholder="Descreva o serviço de alinhamento..."
                  value={formData.descricao || ""}
                  onChange={handleInputChange}
                  className="bg-card border-foreground/10 min-h-24"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label
                htmlFor="observacoes"
                className="text-xs uppercase tracking-widest"
              >
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
                <Label
                  htmlFor="dataOrcamento"
                  className="text-xs uppercase tracking-widest"
                >
                  Data Orçamento
                </Label>
                <Input
                  id="dataOrcamento"
                  name="dataOrcamento"
                  type="date"
                  value={
                    formData.dataOrcamento
                      ? new Date(formData.dataOrcamento)
                          .toISOString()
                          .split("T")[0]
                      : ""
                  }
                  onChange={e => {
                    const date = e.target.value
                      ? new Date(e.target.value)
                      : undefined;
                    setFormData({ ...formData, dataOrcamento: date });
                  }}
                  className="bg-card border-foreground/10"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label
                htmlFor="dataEntrada"
                className="text-xs uppercase tracking-widest"
              >
                Data Entrada
              </Label>
              <Input
                id="dataEntrada"
                name="dataEntrada"
                type="date"
                value={
                  formData.dataEntrada
                    ? new Date(formData.dataEntrada).toISOString().split("T")[0]
                    : ""
                }
                onChange={e => {
                  const date = e.target.value
                    ? new Date(e.target.value)
                    : undefined;
                  setFormData({ ...formData, dataEntrada: date });
                }}
                className="bg-card border-foreground/10"
              />
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="dataEntrega"
                className="text-xs uppercase tracking-widest"
              >
                Previsão Entrega
              </Label>
              <Input
                id="dataEntrega"
                name="dataEntrega"
                type="date"
                value={
                  formData.dataEntrega
                    ? new Date(formData.dataEntrega).toISOString().split("T")[0]
                    : ""
                }
                readOnly
                disabled
                className="bg-card border-foreground/10 opacity-60 cursor-not-allowed"
                title="Data de entrega calculada automaticamente (2 semanas após a data de entrada)"
              />
            </div>
          </div>

          {/* Seção Fotos */}
          <div className="space-y-4">
            <Label className="text-xs uppercase tracking-widest">
              Fotos da Moto
            </Label>
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
                  <div
                    key={idx}
                    className="relative overflow-hidden rounded-lg"
                  >
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
