import { Belt } from '../../components/Belt'

/** Lista vertical de faixas (Branca no topo, Preta embaixo) — a faixa em si
 * fica na horizontal (mesmo desenho do perfil/acompanhamento), só a lista
 * que empilha de cima pra baixo. Todas do mesmo tamanho; o número fica numa
 * coluna alinhada à direita, não no tamanho da faixa. */
export function GraficoFaixas({ dados }: { dados: { nome: string; quantidade: number }[] }) {
  return (
    <div className="flex flex-col gap-2">
      {dados.map((d) => (
        <div key={d.nome} className="flex items-center gap-3">
          <Belt nome={d.nome} tamanho="sm" />
          <span className="w-16 shrink-0 text-sm font-semibold text-chalk">{d.nome}</span>
          <span className="w-6 shrink-0 text-right text-sm font-bold tabular-nums text-chalk">
            {d.quantidade}
          </span>
        </div>
      ))}
    </div>
  )
}
