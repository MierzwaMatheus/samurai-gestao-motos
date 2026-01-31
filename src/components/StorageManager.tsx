import { useState, useEffect, useCallback } from "react";
import { StorageApi } from "@/domain/interfaces/StorageApi";
import { useStorageInfo } from "@/hooks/useStorageInfo";
import { useLimparStorage } from "@/hooks/useLimparStorage";
import { ConsultarEspacoStorageUseCase } from "@/domain/usecases/ConsultarEspacoStorageUseCase";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  HardDrive,
  Trash2,
  AlertTriangle,
  FileX,
  RefreshCw,
} from "lucide-react";

interface StorageManagerProps {
  storageApi: StorageApi;
  children: React.ReactNode;
}

export function StorageManager({ storageApi, children }: StorageManagerProps) {
  const [open, setOpen] = useState(false);
  const [dataInicio, setDataInicio] = useState<string>("");
  const [dataFim, setDataFim] = useState<string>("");

  const { info, loading, error, carregarInfo } = useStorageInfo(storageApi);
  const {
    preview,
    resultado,
    loadingPreview,
    loadingLimpeza,
    error: errorLimpeza,
    gerarPreview,
    limpar,
    limparPreview,
  } = useLimparStorage(storageApi);

  useEffect(() => {
    if (open) {
      carregarInfo();
    }
  }, [open, carregarInfo]);

  const handleGerarPreview = useCallback(() => {
    if (!dataInicio || !dataFim) return;
    gerarPreview(new Date(dataInicio), new Date(dataFim));
  }, [dataInicio, dataFim, gerarPreview]);

  const handleLimpar = useCallback(async () => {
    if (!dataInicio || !dataFim) return;
    await limpar(new Date(dataInicio), new Date(dataFim));
    await carregarInfo();
  }, [dataInicio, dataFim, limpar, carregarInfo]);

  const handleClose = useCallback(() => {
    setOpen(false);
    limparPreview();
    setDataInicio("");
    setDataFim("");
  }, [limparPreview]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HardDrive className="w-5 h-5" />
            Gerenciamento de Storage
          </DialogTitle>
          <DialogDescription>
            Visualize o espaço utilizado e limpe arquivos antigos para liberar
            espaço.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Espaço Utilizado */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-medium">Espaço Utilizado</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => carregarInfo()}
                disabled={loading}
                className="h-8 w-8 p-0"
              >
                <RefreshCw
                  className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
                />
              </Button>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {info && (
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {info.espacoUsadoFormatado} de {info.espacoTotalFormatado}
                  </span>
                  <span className="font-medium">
                    {info.percentualUsado.toFixed(1)}%
                  </span>
                </div>

                <div className="relative">
                  <Progress value={info.percentualUsado} className="h-3" />
                  <div
                    className={`absolute top-0 left-0 h-3 rounded-full transition-all ${info.corBarra}`}
                    style={{ width: `${info.percentualUsado}%` }}
                  />
                </div>

                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{info.totalArquivos} arquivo(s)</span>
                  <span>{info.espacoDisponivelFormatado} disponível</span>
                </div>

                {info.percentualUsado > 90 && (
                  <Alert variant="destructive" className="mt-3">
                    <AlertTriangle className="w-4 h-4" />
                    <AlertDescription>
                      Espaço quase esgotado! Considere limpar arquivos antigos.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            {!info && !error && !loading && (
              <div className="text-center py-4 text-muted-foreground">
                Clique em atualizar para carregar as informações
              </div>
            )}
          </div>

          {/* Limpeza de Arquivos */}
          <div className="space-y-3 border-t pt-6">
            <h3 className="font-medium flex items-center gap-2">
              <Trash2 className="w-4 h-4" />
              Limpar Arquivos por Período
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Data Início</label>
                <input
                  type="date"
                  value={dataInicio}
                  onChange={e => {
                    setDataInicio(e.target.value);
                    limparPreview();
                  }}
                  className="w-full px-3 py-2 border rounded-md text-sm"
                  max={new Date().toISOString().split("T")[0]}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Data Fim</label>
                <input
                  type="date"
                  value={dataFim}
                  onChange={e => {
                    setDataFim(e.target.value);
                    limparPreview();
                  }}
                  className="w-full px-3 py-2 border rounded-md text-sm"
                  max={new Date().toISOString().split("T")[0]}
                />
              </div>
            </div>

            <Button
              onClick={handleGerarPreview}
              disabled={!dataInicio || !dataFim || loadingPreview}
              variant="outline"
              className="w-full"
            >
              {loadingPreview ? (
                <RefreshCw className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <FileX className="w-4 h-4 mr-2" />
              )}
              Visualizar Arquivos
            </Button>

            {errorLimpeza && (
              <Alert variant="destructive">
                <AlertDescription>{errorLimpeza}</AlertDescription>
              </Alert>
            )}

            {preview && (
              <div className="space-y-3 p-4 border rounded-lg bg-muted/50">
                <div className="flex justify-between items-center">
                  <span className="font-medium">
                    {preview.quantidade} arquivo(s) encontrado(s)
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {preview.espacoTotalFormatado}
                  </span>
                </div>

                {preview.quantidade > 0 ? (
                  <>
                    <div className="max-h-40 overflow-y-auto space-y-1 text-sm">
                      {preview.arquivos.slice(0, 5).map((arquivo, index) => (
                        <div
                          key={index}
                          className="flex justify-between text-muted-foreground"
                        >
                          <span className="truncate max-w-[250px]">
                            {arquivo.nome}
                          </span>
                          <span>
                            {new Date(arquivo.dataCriacao).toLocaleDateString(
                              "pt-BR"
                            )}
                          </span>
                        </div>
                      ))}
                      {preview.arquivos.length > 5 && (
                        <div className="text-muted-foreground text-center py-1">
                          ... e mais {preview.arquivos.length - 5} arquivo(s)
                        </div>
                      )}
                    </div>

                    <Alert className="border-yellow-500/50 bg-yellow-500/10">
                      <AlertTriangle className="w-4 h-4 text-yellow-600" />
                      <AlertDescription className="text-yellow-800">
                        Esta ação não pode ser desfeita. Os arquivos serão
                        permanentemente deletados.
                      </AlertDescription>
                    </Alert>

                    <Button
                      onClick={handleLimpar}
                      disabled={loadingLimpeza}
                      variant="destructive"
                      className="w-full"
                    >
                      {loadingLimpeza ? (
                        <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <Trash2 className="w-4 h-4 mr-2" />
                      )}
                      Confirmar Limpeza
                    </Button>
                  </>
                ) : (
                  <div className="text-center py-4 text-muted-foreground">
                    Nenhum arquivo encontrado no período selecionado
                  </div>
                )}
              </div>
            )}

            {resultado && (
              <Alert className="border-green-500/50 bg-green-500/10">
                <AlertDescription className="text-green-800">
                  <strong>Limpeza concluída!</strong>
                  <br />
                  {resultado.arquivosDeletados} arquivo(s) deletado(s)
                  <br />
                  {ConsultarEspacoStorageUseCase.formatarTamanho(
                    resultado.espacoLiberadoBytes
                  )}{" "}
                  liberado(s)
                </AlertDescription>
              </Alert>
            )}
          </div>

          <div className="flex justify-end pt-4 border-t">
            <Button onClick={handleClose} variant="outline">
              Fechar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
