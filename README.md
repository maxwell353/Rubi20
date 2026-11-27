# Rubi20

Aplicativo mobile de Tormenta20 para Android e iOS, com uma paleta roxa e uma ilustração original do Rubi da Virtude. A mesma arte é usada no ícone de builds nativas.

## Ficha de Arton

A Home e a barra inferior dão acesso a Personagens, Campanhas, Regras da casa e Conta. Em Personagens, configure nome, raça, classe, origem, divindade, nível e atributos. Toque em um personagem para abrir a ficha e use o lápis para editá-lo. Campanhas e Regras da casa têm registros locais pesquisáveis.

Dentro da ficha, a barra inferior abre Home, Combate, Habilidades, Magias e Inventário. Perícias, Condições, Parceiros e Informações ficam na Home da ficha. Use o lápis para escolher uma foto da galeria, que fica salva no aparelho e substitui o rubi na ficha do personagem.

Os dados ficam no armazenamento local do aplicativo. Em Perícias, preencha **Nível e atributos** e toque em cada perícia para ajustar seu atributo, treino e outros bônus. O total e a rolagem usam os valores da ficha automática Jogo do Ano. Parâmetros de magias, valores em tibares e carga máxima são preenchidos manualmente. A carga atual soma os espaços dos itens multiplicados pelas quantidades.

Em **Combate**, configure PV, PM, Defesa e deslocamento. Os dados e ataques ficam na mesma aba. Cadastre os custos em PV e PM em **Habilidades**, escolha uma habilidade em Combate e toque em **Usar** para debitar os dois valores. Ao usar uma magia com custo configurado, o app desconta seus PM.

## Rodar no celular

Você precisa do Docker Desktop em execução, com contêineres Linux, e de um celular na mesma rede local do computador. Na raiz do projeto, execute:

```sh
docker compose up --build
```

O Compose inicia PostgreSQL, Django e Expo. Aguarde o Metro apresentar o QR code.

1. **Android** — instale o [Expo Go para o SDK 58](https://expo.dev/go?sdkVersion=58&platform=android&device=true) e leia o QR code pelo Expo Go.
2. **iPhone** — use um Expo Go compatível com o SDK 58. Em outro terminal, rode `docker compose exec mobile npx expo login --no-browser` e entre com a mesma conta usada no Expo Go. Depois, leia o QR code pela Câmera. O login padrão pelo navegador tenta retornar para uma porta temporária do contêiner. O modo `--no-browser` faz o login no terminal.

O arquivo local `.env` foi configurado para o IPv4 atual deste computador. Em outro computador ou se o IP mudar, use o [modelo de configuração](.env.example) e preencha `EXPO_LAN_IP` com o IPv4 da interface de rede ativa. No Windows, consulte `ipconfig`. Após alterar o valor, execute novamente o comando de subida. O Metro usa a porta TCP 8081 na rede local. Se o QR code não aparecer, use o endereço `exp://IP_DO_COMPUTADOR:8081` no Android ou abra-o pelo QR code correspondente no iPhone. Se houver bloqueio de conexão, verifique o acesso à porta 8081 no firewall da rede privada.

Durante o teste, o aplicativo é aberto dentro do Expo Go. O ícone na tela inicial do sistema aparece ao instalar uma build própria do Rubi20.

## Serviços

- `mobile/` contém a tela inicial em React Native, Expo e TypeScript.
- `backend/` contém Django 5.2 LTS em Python 3.13. O contêiner aplica as migrações ao iniciar.
- PostgreSQL 17 guarda os dados em um volume do Docker. O endpoint [de verificação da API](http://127.0.0.1:8000/api/health/) verifica a conexão com o banco e retorna `{"status":"ok"}` quando disponível. A tela inicial abre independentemente da API.

Para parar o ambiente, use `docker compose down`. Para verificar os tipos do aplicativo com os serviços em execução, use `docker compose exec mobile npm run typecheck`.

## Referência visual

O ícone interpreta os Rubis da Virtude mencionados no trecho sobre Sszzaas do Livro Básico de Tormenta20. A arte usa uma gema carmesim, um círculo dourado alusivo ao Panteão e um fundo violeta. [Tormenta20, edição Jogo do Ano](https://jamboeditora.com.br/wp-content/uploads/2024/12/Tormenta20-Edicao-Jogo-do-Ano-v1.3.pdf)
