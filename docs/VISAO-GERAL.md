# Visão geral, requisitos e escopo

[Índice da documentação](README.md)

## Objetivo e contexto

FácilID / AcessoSênior é um protótipo escolar para estudar uma experiência de acesso compreensível para idosos e pessoas com baixo letramento digital. O responsável emite uma identidade digital assinada; o cidadão informa CPF, apresenta o cartão e confirma o acesso. Instruções faladas, mensagens claras e alternativas sem hardware permitem demonstrar o fluxo em sala.

O produto atual termina na sessão autenticada e na consulta do perfil. Não existe integração com órgãos públicos, cadastro civil ou prestação efetiva de serviços municipais. CPF é validado pelo formato de onze dígitos para permitir massa fictícia; isso não comprova sua existência ou titularidade.

## Atores

| Ator | Responsabilidade | Limite |
| --- | --- | --- |
| Cidadão | Apresentar cartão, informar CPF e confirmar PIN ou biometria habilitada; consultar/sair da sessão. | Não emite nem lista cartões administrativos. |
| Responsável | Emitir, consultar histórico, recuperar cartão ativo, bloquear e emitir segunda via. | Usa uma chave administrativa compartilhada; não há contas individuais de operador. |
| Desenvolvedor / mantenedor | Configurar ambiente, testar, preservar dados, revisar mudanças e evidências. | Acesso ao computador e aos segredos privados é separado do fluxo do cidadão. |
| Avaliador da demonstração | Observar o fluxo, seus resultados e as limitações declaradas. | Teste automatizado e apresentação web não certificam sensores. |

## Requisitos funcionais rastreáveis

Os identificadores abaixo servem à documentação; não são IDs de um sistema externo de tarefas.

| ID | Requisito implementado | Evidência principal |
| --- | --- | --- |
| RF-01 | Emissão administrativa com cadastro, assinatura desenhada e PIN; foto real autorizada ou demonstração explícita. | [EmissorScreen](../mobile/src/screens/EmissorScreen.tsx), [emissão](../backend/src/services/emissao.service.ts). |
| RF-02 | Assinar identidade v2 com ID de emissão único e verificar integridade/origem no servidor. | [Serviço RSA](../backend/src/services/assinatura.service.ts). |
| RF-03 | Ler NFC, QR ou JSON, com alternativa sem sensor. | [NFC](../mobile/src/services/nfc.service.ts), [QR](../mobile/src/components/LeitorQr.tsx), [parser](../mobile/src/services/identidade.ts). |
| RF-04 | Exigir segundo fator antes do JWT: PIN ou credencial do aparelho previamente cadastrada. | [Autenticação](../backend/src/routes/autenticacao.routes.ts), [biometria](../mobile/src/services/biometria.service.ts). |
| RF-05 | Manter sessão de 15 minutos, consultar perfil e encerrar acesso. | [JWT](../backend/src/services/auth.service.ts), [SucessoScreen](../mobile/src/screens/SucessoScreen.tsx). |
| RF-06 | Listar histórico, bloquear cartão e substituir emissões anteriores do mesmo CPF. | [Rotas administrativas](../backend/src/routes/emissao.routes.ts), [repositório SQL](../backend/src/repositories/mysql-usuarios.repository.ts). |
| RF-07 | Persistir cartões em MySQL do XAMPP, com modo JSON explicitamente opcional. | [Persistência](../backend/src/db/persistencia.ts). |
| RF-08 | Migrar dados antigos sem duplicar, reassinar ou sobrescrever estado divergente. | [Migração](../backend/src/db/migrar-json.ts). |
| RF-09 | Oferecer orientação falada, controles legíveis, feedback e recuperação de erros. | [UI](../mobile/src/components/Ui.tsx), [feedback](../mobile/src/services/feedback.ts), [áudio](../mobile/src/components/ControleAudio.tsx). |

## Requisitos de qualidade

| Tema | Compromisso implementado | Limitação |
| --- | --- | --- |
| Simplicidade | Três etapas de entrada; configurações e opções extras separadas do fluxo principal. | Usabilidade ainda precisa de avaliação estruturada com público-alvo. |
| Acessibilidade | Rótulos, avisos anunciáveis, contraste/legibilidade e voz interrompível. | Não há certificação formal de conformidade WCAG. |
| Confidencialidade | Administração autorizada, mídia sem rota pública, coletas cifradas e fatores armazenados com hash. | SQL contém identidade sem cifra de aplicação; acesso à pasta inteira alcança chave e cifra. |
| Integridade | RSA, validação Zod, transações e apenas um cartão ativo por CPF. | Banco e arquivos não compartilham uma transação distribuída. |
| Confiabilidade | Erros sanitizados, correlação, cancelamento e verificação de disponibilidade. | Sem alta disponibilidade; backend único; sem SLA medido. |
| Manutenibilidade | Workspaces, interfaces de repositório, testes isolados e cache de contexto. | Não há pipeline CI ou lint configurado no escopo documentado. |

## Matriz de plataforma

| Recurso | Navegador | Dev Client nativo |
| --- | --- | --- |
| Demonstração JSON + PIN | Disponível | Disponível |
| Leitura de QR / foto | Depende de câmera, permissão e contexto seguro | Depende de câmera e permissão |
| Desenho da assinatura | Mouse/toque | Toque |
| NFC real | Não implementado | Integração presente; requer aparelho/tag e validação física |
| Credencial protegida por biometria | PIN como alternativa | Integração SecureStore/LocalAuthentication; validação física pendente |
| Voz e feedback | APIs do navegador | Bibliotecas nativas; depende do sistema |

Expo Go não valida o conjunto nativo deste projeto. A build web não substitui build e testes Android/iOS. Os recursos nativos dependem da versão e configuração documentadas em [instalação](INSTALACAO-E-CONFIGURACAO.md).

## Fronteiras da demonstração

Foto, desenho, autenticação biométrica do sistema operacional e assinatura RSA são mecanismos distintos. A foto é capturada e vinculada por hash; o desenho registra traços; o sistema operacional protege uma credencial do aparelho; RSA assina o conteúdo emitido pelo servidor. Nenhum desses passos, isoladamente ou em conjunto neste protótipo, certifica identidade civil.

O cartão pode ser copiado. Sua assinatura protege contra alteração sem a chave privada, mas não torna cada cópia única. Mesmo usando chip com funções criptográficas, o fluxo NDEF atual não ativa essas funções. O segundo fator e a revogação no servidor complementam o cartão, sem eliminar todos os riscos.

## Evolução proposta, sem implementação nesta edição

| Etapa | Possível evolução | Condição de aceite antes de anunciar disponibilidade |
| --- | --- | --- |
| Próxima validação | Usabilidade com idosos, sensores e build Android completa. | Roteiro executado, ambiente/aparelhos registrados, resultados e falhas reproduzíveis. |
| Propósito funcional | Agendamentos e solicitações municipais fictícias. | Escopo simples, rotas protegidas e estado persistido; identificação clara de simulação. |
| Operação ampliada | Administradores individuais, auditoria, retenção/exclusão e recuperação. | Política definida, testes de abuso e restauração, direitos de acesso revisados. |
| Uso real | Infraestrutura, proteção de dados e avaliação independente. | Requisitos específicos, análise técnica/jurídica aplicável, testes e responsáveis definidos. |

Reconhecimento facial, prova de vida e sensores externos ficam fora da demonstração atual. Adicioná-los exige outro projeto de integração/avaliação; não podem ser simulados como se fossem validação real.

## Glossário

| Termo | Significado neste projeto |
| --- | --- |
| Cartão / Chip | Objeto JSON com identidade v2 e assinatura RSA; pode circular por NFC/QR/texto. |
| Emissão | Criação de um cartão com UUID novo; independe do suporte físico. |
| Segunda via | Nova emissão do mesmo CPF, tornando anteriores substituídos. |
| Coleta | Foto, SVG gerado e metadados/fatores privados ligados à emissão. |
| Desafio | Referência temporária de uma tentativa de confirmação; não concede acesso. |
| Sessão | JWT e perfil entregues após fator válido; consultáveis enquanto cartão estiver ativo. |
| Legado | Cartão antigo preservado como histórico, sem migração automática para credencial atual. |

[Próximo: instalação e configuração](INSTALACAO-E-CONFIGURACAO.md)
