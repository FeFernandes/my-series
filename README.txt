MY SERIES 3.2 - WINDOWS

O QUE ESTA INCLUIDO
- Biblioteca pessoal de series e episodios (TVmaze)
- Painel com progresso geral
- Favoritos e filtro de favoritas
- Temporadas recolhidas por padrao; abra somente a que quiser
- Marcar episodio, temporada ou serie inteira como assistida
- Calendario mensal de atividade com dias destacados e lista dos episodios marcados como assistidos (nao e calendario de estreias)
- Estimativa de horas assistidas com base na duracao informada pela TVmaze; repeticoes registradas contam novamente
- Registro historico das marcacoes: desmarcar um episodio nao apaga as datas anteriores do calendario
- Filtro por genero na pagina Minha biblioteca
- Atualizacao manual de uma serie ou de toda a biblioteca
- Atualizacao de nome, sinopse, imagem, estreia, status, generos e dados dos episodios
- Verificacao automatica de novos episodios enquanto o aplicativo estiver aberto
- Avisos simples dentro do proprio aplicativo
- Interface adaptada para computador e celular na mesma rede Wi-Fi
- Banco SQLite local
- Inicializacao, encerramento e backup por arquivos BAT

INICIAR
1. Extraia a pasta my-series.
2. Execute INICIAR.bat com duplo clique.
3. Na primeira execucao, o Windows preparara as dependencias. Isso pode levar alguns minutos.
4. Nas proximas vezes, o aplicativo abre sem reinstalar tudo.
5. Acesse http://localhost:5173 no computador.
6. Para acessar pelo celular, conecte-o ao mesmo Wi-Fi e use http://IP-DO-COMPUTADOR:5173.

PARAR
- Execute PARAR.bat com duplo clique.
- Ele encerra somente os processos iniciados pelo My Series.
- O banco de dados e o historico permanecem salvos.

BACKUP DO HISTORICO
1. Execute PARAR.bat para fechar o aplicativo.
2. Execute BACKUP.bat.
3. O backup sera criado na pasta backups, com data e hora no nome.
4. Copie periodicamente a pasta backups para outro local, pendrive ou nuvem.

DADOS E ATUALIZACAO
- O banco fica em backend\instance\my_series.db. A versao 3.2 cria automaticamente as novas tabelas/colunas sem apagar as tabelas antigas.
- A pasta backend\instance nao e incluida neste ZIP para nao substituir seus dados.
- Ao atualizar uma instalacao existente, extraia os arquivos por cima da pasta atual, mantendo a pasta backend\instance.
- NUNCA apague backend\instance se quiser preservar sua biblioteca e historico.
- Antes de atualizar, feche o aplicativo e faca um backup.
- A sincronizacao atualiza os metadados da serie e os episodios pelo ID do TVmaze.
- Quando um episodio ja existente recebe nome ou data corrigidos na API, esses dados sao atualizados. A marcacao de assistido e a data em que voce marcou como assistido sao preservadas.
- Episodios novos sao adicionados sem apagar o historico anterior. Episodios removidos do catalogo externo nao sao apagados automaticamente do banco local.
- Se a TVmaze nao tiver uma data confirmada, o aplicativo nao consegue adivinhar; a data sera atualizada quando o catalogo fornecer uma informacao nova.
- O aplicativo nao inicia junto com o Windows. So funciona quando voce executa INICIAR.bat.
- A verificacao automatica ocorre enquanto o aplicativo esta aberto: primeira verificacao apos 5 minutos e depois, no maximo, a cada 6 horas.
- Os avisos aparecem dentro do aplicativo. Nao ha notificacoes push em segundo plano.

REQUISITOS
- Windows 10 ou 11
- Python 3.11 ou superior (Add Python to PATH)
- Node.js LTS
- Internet para instalar as dependencias na primeira execucao e consultar o catalogo TVmaze

OBSERVACOES
- Nao usa Docker.
- Nao usa AniList, mangas ou animes.
- GitHub Pages nao hospeda o backend Flask nem o banco SQLite; pode ser avaliado futuramente apenas para a interface.
- O computador precisa permanecer ligado e o aplicativo aberto para verificacoes automaticas.
