import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/infrastructure/supabase/client";
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Loader2 } from 'lucide-react';

interface HistoricoItem {
    id: string;
    acao: string;
    detalhes: any;
    criado_em: string;
    user_id: string;
    usuario?: {
        nome: string;
    };
}

interface HistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    entidadeId: string;
    entidadeTipo: 'entrada' | 'orcamento';
}

export function HistoryModal({ isOpen, onClose, entidadeId, entidadeTipo }: HistoryModalProps) {
    const [historico, setHistorico] = useState<HistoricoItem[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen && entidadeId) {
            fetchHistorico();
        }
    }, [isOpen, entidadeId]);

    const fetchHistorico = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('historico_atividades')
                .select(`
          *,
          usuario:usuarios(nome)
        `)
                .eq('entidade_id', entidadeId)
                .eq('entidade_tipo', entidadeTipo)
                .order('criado_em', { ascending: false });

            if (error) throw error;
            setHistorico(data || []);
        } catch (error) {
            console.error('Erro ao buscar histórico:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatarAcao = (acao: string) => {
        switch (acao) {
            case 'entrada_criada': return 'Entrada criada';
            case 'orcamento_criado': return 'Orçamento criado';
            case 'status_alterado': return 'Status alterado';
            case 'progresso_alterado': return 'Progresso atualizado';
            case 'orcamento_detalhe_criado': return 'Detalhes do orçamento criados';
            case 'orcamento_status_alterado': return 'Status do orçamento alterado';
            case 'foto_adicionada': return 'Foto adicionada';
            default: return acao.replace(/_/g, ' ');
        }
    };

    const formatarDetalhes = (item: HistoricoItem) => {
        const { acao, detalhes } = item;
        if (!detalhes || Object.keys(detalhes).length === 0) return null;

        if (acao === 'status_alterado' || acao === 'orcamento_status_alterado') {
            return (
                <span className="text-sm text-gray-500">
                    De: <span className="font-medium">{detalhes.de}</span> para: <span className="font-medium">{detalhes.para}</span>
                </span>
            );
        }

        if (acao === 'progresso_alterado') {
            return (
                <span className="text-sm text-gray-500">
                    De: <span className="font-medium">{detalhes.de}%</span> para: <span className="font-medium">{detalhes.para}%</span>
                </span>
            );
        }

        if (acao === 'foto_adicionada') {
            return (
                <span className="text-sm text-gray-500">
                    Tipo: <span className="font-medium">{detalhes.tipo}</span>
                </span>
            );
        }

        return <pre className="text-xs text-gray-500 mt-1">{JSON.stringify(detalhes, null, 2)}</pre>;
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Histórico de Atividades</DialogTitle>
                </DialogHeader>

                <ScrollArea className="h-[400px] pr-4">
                    {loading ? (
                        <div className="flex justify-center items-center h-full">
                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                    ) : historico.length === 0 ? (
                        <div className="text-center text-gray-500 py-8">
                            Nenhuma atividade registrada.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {historico.map((item) => (
                                <div key={item.id} className="flex flex-col border-b pb-3 last:border-0">
                                    <div className="flex justify-between items-start">
                                        <span className="font-semibold text-sm">{formatarAcao(item.acao)}</span>
                                        <span className="text-xs text-gray-400">
                                            {format(new Date(item.criado_em), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                                        </span>
                                    </div>

                                    {formatarDetalhes(item)}

                                    <div className="mt-1 text-xs text-gray-400 flex items-center gap-1">
                                        <span>Por:</span>
                                        <span className="font-medium text-gray-600">
                                            {item.usuario?.nome || 'Sistema/Desconhecido'}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}
