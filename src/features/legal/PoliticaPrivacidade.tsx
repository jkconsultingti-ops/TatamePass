import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '../../components/Card'
import { Stamp } from '../../components/Stamp'

export function PoliticaPrivacidade() {
  return (
    <div className="min-h-svh bg-ink px-6 py-12">
      <div className="mx-auto max-w-2xl">
        <Link to="/login">
          <Stamp className="h-10 w-10 text-hanko" />
        </Link>

        <Card className="mt-6 flex flex-col gap-6 p-8">
          <div>
            <h1 className="font-display text-2xl font-semibold text-chalk">Política de Privacidade</h1>
            <p className="mt-1 font-mono text-xs text-rope">Última atualização: julho de 2026</p>
          </div>

          <Secao titulo="Quem trata os seus dados">
            <p>
              Esta política se aplica ao TatamePass, sistema de controle de presença, graduação e
              exame médico usado por academias de jiu-jitsu e artes marciais. Cada academia
              cadastrada é responsável pelos dados dos seus próprios alunos — o TatamePass isola
              tecnicamente os dados de cada academia (cada registro pertence a uma única academia
              e nenhuma outra academia tem acesso a ele).
            </p>
          </Secao>

          <Secao titulo="Encarregado pelo tratamento de dados (DPO)">
            <p>
              Dúvidas, pedidos de acesso, correção ou exclusão de dados podem ser direcionados ao
              professor/administrador da sua academia — é ele quem tem acesso aos dados dos alunos
              da própria academia dentro do sistema.
            </p>
          </Secao>

          <Secao titulo="Quais dados coletamos e para quê">
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <b>Identificação e contato</b> (nome, e-mail ou telefone de login): para criar seu
                acesso, autenticar você e controlar sua presença nas aulas.
              </li>
              <li>
                <b>Campos de perfil configuráveis</b>: cada academia pode configurar campos
                adicionais de cadastro (ex: data de nascimento, endereço, contato de emergência,
                tipo sanguíneo, documentos) — o conjunto exato de campos e se são obrigatórios
                varia conforme o que a sua academia configurou. Campos marcados como dado de saúde
                são tratados como dado sensível nos termos do art. 5º, II da LGPD.
              </li>
              <li>
                <b>Exame médico</b> (status, data de emissão, validade, atestado enviado): usado
                para controle da validade do exame exigido para a prática do esporte, com
                aprovação exclusiva do professor da sua academia.
              </li>
              <li>
                <b>Histórico de presença e graduação</b>: check-ins nas aulas e faixas/graus
                concedidos, para acompanhar sua evolução no jiu-jitsu.
              </li>
              <li>
                <b>Foto de perfil</b>: opcional, exibida só dentro do sistema para professores e
                colegas de turma da mesma academia.
              </li>
            </ul>
          </Secao>

          <Secao titulo="Base legal">
            <p>
              O tratamento se baseia no <b>consentimento</b> do titular, dado no momento do
              cadastro na academia, conforme art. 7º, I e art. 11, I da LGPD. O consentimento pode
              ser revogado a qualquer momento, mediante contato com o professor/administrador da
              sua academia — a revogação pode significar o encerramento do seu acesso ao sistema,
              já que os dados são necessários para o controle de presença e graduação.
            </p>
          </Secao>

          <Secao titulo="Com quem os dados são compartilhados">
            <p>
              Os dados ficam armazenados na infraestrutura da{' '}
              <a
                href="https://supabase.com"
                target="_blank"
                rel="noreferrer"
                className="text-hanko underline"
              >
                Supabase
              </a>{' '}
              (provedor de banco de dados e hospedagem) e não são vendidos, cedidos ou
              compartilhados com terceiros para fins comerciais ou de marketing. Cada academia só
              enxerga os dados dos seus próprios alunos.
            </p>
          </Secao>

          <Secao titulo="Por quanto tempo guardamos seus dados">
            <p>
              Os dados ficam armazenados enquanto você for aluno ou professor de uma academia no
              sistema, ou até que você solicite a exclusão pelo contato do professor/administrador
              da sua academia. Não há exclusão automática por prazo — a exclusão é sempre feita
              mediante pedido.
            </p>
          </Secao>

          <Secao titulo="Seus direitos">
            <p>
              Como titular dos dados, você tem direito a, pelo contato do professor/administrador
              da sua academia:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Confirmar se tratamos seus dados e acessar quais dados temos;</li>
              <li>Corrigir dados incompletos, inexatos ou desatualizados;</li>
              <li>Solicitar a exclusão dos dados tratados com base no seu consentimento;</li>
              <li>Revogar o consentimento a qualquer momento;</li>
              <li>Solicitar a portabilidade dos seus dados para outro sistema.</li>
            </ul>
          </Secao>

          <Secao titulo="Segurança">
            <p>
              O acesso aos dados é protegido por controle de permissões por papel e por academia
              (aluno só acessa os próprios dados; professor acessa apenas os dados dos alunos da
              própria academia — nunca de outra academia cadastrada no sistema), conexão
              criptografada (HTTPS) e autenticação por senha. Documentos enviados (como atestados
              médicos) ficam em armazenamento privado, não público.
            </p>
          </Secao>

          <Secao titulo="Alterações desta política">
            <p>
              Esta política pode ser atualizada conforme o sistema evolui. Mudanças significativas
              serão comunicadas aos usuários pelos canais de contato cadastrados.
            </p>
          </Secao>
        </Card>
      </div>
    </div>
  )
}

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 font-mono text-sm uppercase tracking-wide text-hanko">{titulo}</h2>
      <div className="text-sm leading-relaxed text-rope">{children}</div>
    </section>
  )
}
