# Instalação e configuração

[Índice](README.md) · [Operação e problemas comuns](OPERACAO-E-MANUTENCAO.md)

## Ambiente e pré-requisitos

Este guia usa Windows/PowerShell, a raiz do repositório e XAMPP local. A integração foi exercitada com MariaDB 10.4.32 distribuído pelo XAMPP. Node.js 22.13+ é necessário; a validação anterior usou Node 24. Não há dependência de PHP para executar a aplicação.

| Componente | Finalidade |
| --- | --- |
| Node.js + npm | Backend, Expo e ferramentas de desenvolvimento. |
| XAMPP — MySQL | Banco de cartões. Iniciar no painel antes da API. |
| Navegador | Demonstração web; câmera exige localhost/HTTPS e permissão. |
| XAMPP — Apache | Opcional: acesso ao phpMyAdmin; não inicia a API Node. |
| Android Studio/SDK/JDK/ADB | Somente para preparar/compilar/testar cliente Android. Não necessários para a demonstração web. |

## Primeira instalação

Se já possui a pasta, abra-a no VS Code. Para uma cópia nova, clone [o repositório](https://github.com/marcoszhp/facilId). Não coloque o projeto em `htdocs` como condição de execução: os serviços Node e MySQL têm processos próprios.

1. Inicie **MySQL** no XAMPP e confira a porta configurada.
2. Abra um terminal na raiz do FácilID. Instale as dependências e crie a configuração sem sobrescrever uma existente:

```powershell
npm install
if (!(Test-Path -LiteralPath backend/.env)) {
  Copy-Item -LiteralPath backend/.env.example -Destination backend/.env
}
```

3. Edite `backend/.env` localmente. O modelo usa banco `facilid`, host de loopback e credenciais de desenvolvimento do XAMPP. Se sua instalação tem senha, informe-a somente nesse arquivo privado.
4. Prepare/verifique o banco:

```powershell
npm run db:setup
npm run db:check
```

5. **Apenas se existir uma base JSON anterior**, com a API parada, importe-a:

```powershell
npm run db:migrate
```

Não use esse comando como sincronização diária. Ele recusa destino divergente; v1 vira histórico e precisa de nova emissão. Consulte [migração](BANCO-DE-DADOS.md).

6. Prepare os arquivos privados:

```powershell
npm run setup
```

Esse comando reutiliza as chaves existentes, prepara administração/coletas e só cria exemplos novos se `DEMO_PIN` estiver explicitamente configurado. Não há PIN padrão. Prefira emitir pela interface durante a demonstração. O segredo JWT é criado ao iniciar a API quando não houver configuração correspondente.

## Iniciar e encerrar

No primeiro terminal:

```powershell
npm run dev
```

No segundo terminal, também na raiz:

```powershell
npm run web
```

| Endereço padrão | Uso |
| --- | --- |
| `http://localhost:8081` | Aplicação web. |
| `http://127.0.0.1:3000/health` | Disponibilidade da persistência. |
| `http://127.0.0.1:3000/docs` | Swagger interativo. |
| `http://127.0.0.1:3000/openapi.json` | Contrato da API em execução. |
| `http://localhost/phpmyadmin` | Ferramenta opcional do XAMPP, com Apache iniciado. |

Interrompa os terminais com Ctrl+C. Pare o MySQL no painel somente depois de encerrar a API. Não repita instalação, preparo ou migração para cada sessão de uso.

Para conferir sem cadastrar nada:

```powershell
Invoke-RestMethod http://127.0.0.1:3000/health
```

Resposta esperada: `status` igual a `ok`. A porta 3000 deve estar livre antes de iniciar outra API; execute apenas uma instância para a mesma base e pasta privada.

## Variáveis de ambiente

Fonte: [config.ts](../backend/src/config.ts), [mysql.ts](../backend/src/db/mysql.ts), [server.ts](../backend/src/server.ts), [app.ts](../backend/src/app.ts) e [App.tsx](../mobile/App.tsx). Variáveis já existentes no terminal prevalecem sobre `backend/.env`; reinicie o processo ao alterá-las.

| Variável | Padrão / regra | Observação |
| --- | --- | --- |
| `DB_CLIENT` | `mysql`; alternativa `json` | Escolha explícita, sem fallback automático. |
| `DB_HOST` | `127.0.0.1` | MySQL acessado pelo backend, não pelo app. |
| `DB_PORT` | `3306`, inteiro 1–65535 | Pode diferir da porta do painel local. |
| `DB_NAME` | `facilid` | Até 64 letras/números/sublinhado, começando com letra. |
| `DB_USER` | `root` no modelo local | Para outro ambiente, definir usuário apropriado e privilégios limitados. |
| `DB_PASSWORD` | Conforme instalação local | Privada; não versionar, não colocar na URL pública. |
| `DATA_DIR` | `.local`, relativo a `backend/` | Contém chaves, coletas e JSON opcional; exige preservação em backup. |
| `HOST` | `127.0.0.1` | Endereço de escuta da API. |
| `PORT` | `3000` | Porta da API Node. |
| `CORS_ORIGIN` | localhost/127.0.0.1 na porta 8081 | Lista de origens completas separadas por vírgula, sem espaços extras. |
| `ADMIN_TOKEN` | Arquivo privado gerado quando ausente | Se informado, mínimo 32 caracteres; apenas para responsável. |
| `JWT_SECRET` | Arquivo privado gerado quando ausente | Se informado, mínimo 32 caracteres; não compartilhar com frontend. |
| `DEMO_PIN` | Ausente | Opcional, seis números; seed artificial. Retirar após preparo. |
| `EXPO_PUBLIC_API_URL` | Android emulador: 10.0.2.2:3000; web: localhost:3000 | Variável **pública** do frontend; nunca receber segredo. |

`backend/.env` não configura automaticamente o frontend. Passe sua variável pública no terminal do Expo ou use **Ajustar conexão** na interface. O ajuste de URL da tela fica em memória e descarta operações/cartão preparado da conexão anterior.

## Portas alternativas e rede local

Se o Expo usar 8082, inclua a origem correspondente em `CORS_ORIGIN` antes de reiniciar a API. Por exemplo, para aceitar os dois endereços locais do preview nessa porta:

```dotenv
CORS_ORIGIN=http://localhost:8082,http://127.0.0.1:8082
```

O valor não tem barra final. CORS regula navegadores, não substitui autorização. A porta do MySQL não deve ser usada no campo **Endereço do serviço**, que espera a API HTTP.

Em Android conectado por USB, execute `adb reverse tcp:3000 tcp:3000` e configure a API como `http://127.0.0.1:3000`. O emulador Android usa `http://10.0.2.2:3000`. Por Wi-Fi, é necessário que o backend escute uma interface acessível (`HOST=0.0.0.0`), que o app use o IP do computador e que o firewall permita a porta da API na rede escolhida. Mantenha o banco no loopback. HTTP em rede local não cifra o tráfego; exposição externa exige outra preparação.

## Dev Client e hardware

As dependências nativas e `newArchEnabled:false` estão em [app.json](../mobile/app.json). NFC Manager 3.17.2 usa a arquitetura legada nesta configuração. Alterações em plugins/permissões/bibliotecas nativas exigem recompilar o cliente, não apenas recarregar JavaScript.

```powershell
npm run android:prepare -w mobile
npm run android -w mobile
```

Após ter um Dev Client compatível instalado, `npm run mobile` inicia o bundler. Expo Go não valida NFC e o conjunto nativo atual. A preparação Android anterior foi concluída, mas build/sensores físicos permanecem pendentes; veja [qualidade](TESTES-E-QUALIDADE.md). Compilação local para iOS depende de ambiente macOS/Xcode e não foi validada neste Windows.

NFC precisa de tag NDEF pronta, gravável e com capacidade efetiva suficiente. O aplicativo não prepara aplicações/chaves DESFire. NTAG213/215 não comportam o JSON RSA atual e NTAG216 não garante todo cadastro aceito. Detalhes e roteiro estão no [manual](MANUAL-DO-USUARIO.md) e no [README do projeto](../README.md).

## Modo JSON opcional e instalação reprodutível

Para demonstração explicitamente sem XAMPP, configure `DB_CLIENT=json`, execute `npm run setup` e inicie a API. Não execute comandos de preparo SQL nesse caminho. O modo JSON abre outra base; não sincroniza cartões emitidos anteriormente no MySQL.

Em cópia limpa com lockfile preservado, `npm ci` pode ser usado em vez de `npm install`. Não apague o lockfile para resolver alertas de dependências. O projeto já declara aprovações dos scripts `@scarf/scarf` e `esbuild`; `npm install-scripts ls` permite revisar no npm que oferece esse recurso. `npm install-scripts approve` exige o nome do pacote. Atualizações de dependências são trabalho separado, com revisão de compatibilidade e testes.

[Continuar: manual de uso](MANUAL-DO-USUARIO.md)
