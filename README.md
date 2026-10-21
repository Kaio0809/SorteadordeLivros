# Meus Livrinhos — versão para GitHub Pages

Esta versão não usa Flask, Python, PostgreSQL, Render ou pgAdmin. O GitHub Pages publica os arquivos estáticos e o navegador executa o JavaScript.

## Publicar

1. Baixe e extraia este ZIP.
2. Abra o repositório `Kaio0809/SorteadordeLivros` no GitHub.
3. Envie os arquivos e pastas desta versão para a raiz do repositório. O `index.html` precisa ficar na raiz.
4. No repositório, entre em **Settings → Pages**.
5. Em **Build and deployment**, escolha **Deploy from a branch**.
6. Selecione a branch `main` e a pasta `/ (root)`, depois salve.
7. Aguarde o GitHub publicar o site. O endereço esperado é `https://kaio0809.github.io/SorteadordeLivros/`.

## Arquivos CSV

- `data/livros.csv`: `id,titulo,autor_id,saga_id,ordem,lido`
- `data/autores.csv`: `id,nome`
- `data/sagas.csv`: `id,titulo,autor_id`

Os CSVs deste pacote incluem uma pequena biblioteca de exemplo para o site funcionar imediatamente. **O repositório original não continha exportação dos dados do PostgreSQL**, então esses exemplos não são o acervo antigo. Substitua as linhas de exemplo pelos seus dados reais, mantendo os cabeçalhos e os IDs relacionados entre os arquivos.

Use UTF-8 e separe os campos por vírgula. Se um campo tiver vírgula dentro do texto, coloque o campo entre aspas duplas. `lido` aceita `true` ou `false`.

## O que funciona

- Página inicial e contadores do acervo.
- Sorteio de livro ainda não lido.
- Busca por título, autor e saga.
- Acervo com filtros e estatísticas.
- Detalhes de livro, autor e saga.
- Marcar/desmarcar livro e saga como lidos.
- Histórico de sorteios e opção para limpar o histórico.
- Adicionar livros pela interface.

## Limites desta versão estática

- O progresso de leitura, histórico e livros adicionados pela interface ficam no `localStorage` do navegador usado. Não são compartilhados entre dispositivos ou pessoas.
- A interface não altera os CSVs publicados no GitHub. Para tornar um livro adicionado permanente para todos, edite `data/livros.csv` (e, quando necessário, `autores.csv` ou `sagas.csv`) e publique os arquivos atualizados.
- Login/cadastro foram removidos porque autenticação segura não pode ser implementada apenas no front-end.
- Para carregar os CSVs com `fetch`, abra o site pelo GitHub Pages ou por um servidor local; abrir `index.html` diretamente pelo explorador de arquivos pode bloquear a leitura dos CSVs.

## Testar no computador

Se tiver Python instalado, abra o terminal dentro da pasta extraída e execute:

```bash
python -m http.server 8000
```

Depois acesse `http://localhost:8000`.
