import { MotoCompleta } from "@shared/types";

export function sortMotosEmAndamento(motos: MotoCompleta[]): MotoCompleta[] {
  return [...motos].sort((a, b) => {
    if (a.status === "alinhando" && b.status !== "alinhando") return -1;
    if (a.status !== "alinhando" && b.status === "alinhando") return 1;

    if (a.status === "pendente" && b.status === "pendente") {
      return a.progresso - b.progresso;
    }

    if (a.status === "alinhando" && b.status === "alinhando") {
      return a.progresso - b.progresso;
    }

    return 0;
  });
}

export function sortMotosConcluidas(motos: MotoCompleta[]): MotoCompleta[] {
  return [...motos].sort((a, b) => {
    const dataA = a.dataConclusao ? new Date(a.dataConclusao).getTime() : 0;
    const dataB = b.dataConclusao ? new Date(b.dataConclusao).getTime() : 0;

    return dataB - dataA;
  });
}
