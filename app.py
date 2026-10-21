import psycopg2, io, base64
from flask import Flask, render_template, request, url_for, redirect
import json

app = Flask(__name__)

def bd(sql, consulta=True):
    conn = psycopg2.connect(host='localhost', database='livros', user='postgres',password='12345')
    cur = conn.cursor()
    cur.execute(sql)
    if consulta:
        dados = cur.fetchall()
    else:
        conn.commit()
        dados = None
    cur.close()
    conn.close()
    return dados

@app.route('/')
def index():
    # Estatísticas do Acervo
    sql_qtd_livros = 'SELECT COUNT(*) FROM books.livro;'
    qtd_livros = bd(sql_qtd_livros)
    sql_qtd_sagas = 'SELECT COUNT(*) FROM books.saga;'
    sql_qtd_autores = 'SELECT COUNT(*) FROM books.autor;'
    qtd_sagas = bd(sql_qtd_sagas)
    qtd_autores = bd(sql_qtd_autores)

    return render_template('index.html',livros = qtd_livros[0][0], sagas=qtd_sagas[0][0],autores=qtd_autores[0][0])

@app.route('/login',methods=['GET','POST'])
def login():
    if request.method == 'POST':
        email = request.form['email']
        senha = request.form['senha']

        sql = f"select nome_usuario from adm.usuario where email='{email}' and senha='{senha}'"
        usuario = bd(sql)

        if usuario:
            return redirect(url_for('dashboard'))
        else:
            return render_template('login.html',erro='E-mail ou Senha Inválidos - Tente Novamente!')
    return render_template('login.html')


@app.route('/cadastro', methods=['GET', 'POST'])
def cadastro():
    if request.method == 'POST':
        nome = request.form['nome']
        email = request.form['email']
        senha = request.form['senha']
        cs = request.form['confirmar_senha']

        if senha != cs:
            return render_template('cadastro.html', mensagem='As Senhas devem ser Iguais!', tipo_mensagem='erro')
        
        sql_verifica = f"select email from adm.usuario where email='{email}'"
        existe = bd(sql_verifica)
        
        if existe:
            return render_template('cadastro.html', mensagem='Este E-Mail já foi Cadastrado!', tipo_mensagem='erro')
        
        # INSERT sem a coluna tipo
        sql_cadastro = f"insert into adm.usuario (nome_usuario, email, senha) values ('{nome}', '{email}', '{senha}')"
        bd(sql_cadastro, consulta=False)
        
        return render_template('cadastro.html', mensagem='Cadastro Realizado! Faça seu Login e Aproveite!', tipo_mensagem='sucesso')
    
    return render_template('cadastro.html')

@app.route('/dashboard')
def dashboard():
    sql_livros_aleatorios = '''
        SELECT l.titulo, a.nome 
        FROM books.livro l
        JOIN books.autor a ON l.autor_livro = a.aid
        ORDER BY RANDOM() 
        LIMIT 10;
    '''
    livros_aleatorios = bd(sql_livros_aleatorios)
    return render_template('dashboard.html',livros_aleatorios=livros_aleatorios)

@app.route('/buscar')
def buscar():
    termo = request.args.get('q', '')
    resultados = {}

    if termo:
        sql_livros = f"""select l.titulo, a.nome, l.lid
            from books.livro l join books.autor a
            on l.autor_livro = a.aid
            where l.titulo ilike '%{termo}%' """
        
        sql_sagas = f"""select s.titulo, a.nome, s.sid
            from books.saga s join books.autor a
            on s.autor = a.aid
            where s.titulo ilike '%{termo}%' """
        
        sql_autor = f"""select nome, a.aid
            from books.autor a 
            where a.nome ilike '%{termo}%' """

        resultados['livros'] = bd(sql_livros)
        resultados['sagas'] = bd(sql_sagas)
        resultados['autor'] = bd(sql_autor)

    return render_template('buscar.html',termo=termo, resultados=resultados)

@app.route('/livro/<int:id_livro>')
def detalhes_livro(id_livro):
    sql_livro = f"""
        SELECT l.titulo, a.nome, s.titulo, l.ordem_saga, l.lido, l.lid, a.aid, 
               COALESCE(s.sid, 0) as sid
        FROM books.livro l
        JOIN books.autor a ON l.autor_livro = a.aid
        LEFT JOIN books.saga s ON l.saga_livro = s.sid
        WHERE l.lid = {id_livro};
    """
    resultado = bd(sql_livro)
    livro = resultado[0] if resultado else None
    return render_template('detalhes_livro.html', livro=livro)


@app.route('/autor/<int:id_autor>')
def detalhes_autor(id_autor):
    sql_autor = f"SELECT nome FROM books.autor WHERE aid = {id_autor};"
    autor = bd(sql_autor)
    
    sql_livros = f"""
        SELECT l.lid, l.titulo, COALESCE(s.titulo, '') as saga
        FROM books.livro l
        LEFT JOIN books.saga s ON l.saga_livro = s.sid
        WHERE l.autor_livro = {id_autor}
        ORDER BY l.titulo;
    """
    livros = bd(sql_livros)
    
    return render_template('detalhes_autor.html', 
                         autor=autor[0][0] if autor else None, 
                         livros=livros if livros else [])


@app.route('/saga/<int:id_saga>')
def detalhes_saga(id_saga):
    sql_saga = f"SELECT titulo FROM books.saga WHERE sid = {id_saga};"
    saga = bd(sql_saga)
    
    sql_livros = f"""
        SELECT l.lid, l.titulo, a.nome, l.ordem_saga, l.lido
        FROM books.livro l
        JOIN books.autor a ON l.autor_livro = a.aid
        WHERE l.saga_livro = {id_saga}
        ORDER BY COALESCE(l.ordem_saga, 999);
    """
    livros = bd(sql_livros)
    
    return render_template('detalhes_saga.html', 
                         saga=saga[0][0] if saga else None,
                         id_saga=id_saga,
                         livros=livros if livros else [])


@app.route('/sortear',methods=['GET','POST'])
def sortear():
    livro_sorteado = None
    saga_nome = None

    if request.method == 'POST':
        sql_sortear = """
            select l.lid, l.titulo, a.nome, l.saga_livro, l.ordem_saga
            from books.livro l
            join books.autor a on l.autor_livro = a.aid
            where l.lido = False
            order by random()
            limit 1;
        """

        resultado = bd(sql_sortear)

        if resultado:
            livro = resultado[0]
            saga_id = livro[3]

            if saga_id:
                sql_primeiro_saga = f"""
                    select l.lid, l.titulo, a.nome, s.titulo
                    from books.livro l
                    join books.autor a on l.autor_livro = a.aid
                    join books.saga s on l.saga_livro = s.sid
                    where l.saga_livro = {saga_id}
                    and l.lido = FALSE
                    order by l.ordem_saga
                    limit 1;
                """

                primeiro_livro = bd(sql_primeiro_saga)

                if primeiro_livro:
                    livro_sorteado = primeiro_livro[0]
                    saga_nome = livro_sorteado[3]
                else:
                    return render_template(
                        'sortear.html',
                        erro='Você já leu todos os livros desta saga!'
                    )
            else:
                livro_sorteado = livro

            sql_historico = f"""
                INSERT INTO books.sorteios (livro_id)
                VALUES ({livro_sorteado[0]});
            """

            bd(sql_historico, consulta=False)

        else:
            return render_template(
                'sortear.html',
                erro='Parabéns! Você já leu todos os livros cadastrados!'
            )

    return render_template(
        'sortear.html',
        livro_sorteado=livro_sorteado,
        saga_nome=saga_nome
    )
    
@app.route('/marcar-lido', methods=['POST'])
def marcar_lido():
    id_livro = request.form.get('id_livro')
    redirect_to = request.form.get('redirect', 'sortear')
    sql_marcar = f"""update books.livro set lido = True where lid = {id_livro};"""
    bd(sql_marcar,consulta=False)

    if redirect_to == 'livro':
        return redirect(url_for('detalhes_livro', id_livro=id_livro))
    else:
        return redirect(url_for('sortear'))


@app.route('/desmarcar-lido', methods=['POST'])
def desmarcar_lido():
    id_livro = request.form.get('id_livro')
    redirect_to = request.form.get('redirect','livro')

    sql = f'update books.livro set lido = FALSE where lid = {id_livro};'
    bd(sql, consulta=False)

    return redirect(url_for('detalhes_livro',id_livro=id_livro))

@app.route('/marcar-saga-lida/<int:id_saga>',methods=['POST'])
def marcar_saga_lida(id_saga):
    sql = f'update books.livro set lido = True where saga_livro = {id_saga};'
    bd(sql,consulta=False)

    return redirect(url_for('detalhes_saga',id_saga=id_saga))


@app.route('/desmarcar-saga-lida/<int:id_saga>', methods=['POST'])
def desmarcar_saga_lida(id_saga):
    sql = f'update books.livro set lido = FALSE where saga_livro = {id_saga};'
    bd(sql, consulta=False)

    return redirect(url_for('detalhes_saga', id_saga=id_saga))


@app.route('/historico')
def historico():
    sql_historico = """
        SELECT h.livro_id, l.titulo, a.nome, s.titulo, l.lido
        FROM books.sorteios h
        JOIN books.livro l ON h.livro_id = l.lid
        JOIN books.autor a ON l.autor_livro = a.aid
        LEFT JOIN books.saga s ON l.saga_livro = s.sid;
    """
    historico = bd(sql_historico)
    
    return render_template('historico.html', historico=historico)


@app.route('/apagar-historico',methods=['POST'])
def apagar_historico():
    sql_apagar = """delete from books.sorteios;"""
    bd(sql_apagar,consulta=False)
    return redirect(url_for('historico'))

@app.route('/acervo')
def acervo():
    sql_acervo = """
        SELECT l.lid, l.titulo, a.nome, s.titulo, l.lido, a.aid, s.sid
        FROM books.livro l
        JOIN books.autor a ON l.autor_livro = a.aid
        LEFT JOIN books.saga s ON l.saga_livro = s.sid
        ORDER BY l.titulo ASC;
    """
    livros = bd(sql_acervo)
    
    total_livros = len(livros) if livros else 0
    lidos = sum(1 for livro in livros if livro[4]) if livros else 0
    nao_lidos = total_livros - lidos
    percentual_lidos = round((lidos / total_livros * 100), 1) if total_livros > 0 else 0
    
    sql_autor_mais_lido = """
        SELECT a.nome, 
               COUNT(CASE WHEN l.lido = True THEN 1 END) as lidos_autor,
               COUNT(*) as total_autor,
               ROUND(COUNT(CASE WHEN l.lido = True THEN 1 END) * 100.0 / COUNT(*), 2) as percentual
        FROM books.livro l
        JOIN books.autor a ON l.autor_livro = a.aid
        GROUP BY a.aid, a.nome
        HAVING COUNT(CASE WHEN l.lido = True THEN 1 END) > 0
        ORDER BY percentual DESC
        LIMIT 5;
    """
    autores_mais_lidos = bd(sql_autor_mais_lido)
    
    sql_stats_sagas = """
        SELECT 
            COALESCE(s.titulo, 'Sem Saga') as saga,
            COUNT(*) as total_livros,
            SUM(CASE WHEN l.lido = True THEN 1 ELSE 0 END) as lidos_saga,
            ROUND(SUM(CASE WHEN l.lido = True THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as percentual
        FROM books.livro l
        LEFT JOIN books.saga s ON l.saga_livro = s.sid
        GROUP BY COALESCE(s.titulo, 'Sem Saga')
        ORDER BY percentual DESC;
    """
    stats_sagas = bd(sql_stats_sagas)
    
    return render_template('acervo.html', 
                         livros=livros,
                         total=total_livros,
                         lidos=lidos,
                         nao_lidos=nao_lidos,
                         percentual_lidos=percentual_lidos,
                         autores_mais_lidos=autores_mais_lidos,
                         stats_sagas=stats_sagas)

@app.route('/inserir-livro', methods=['POST'])
def inserir_livro():
    titulo = request.form.get('titulo')
    nome_autor = request.form.get('autor')
    nome_saga = request.form.get('saga')
    ordem_saga = request.form.get('ordem_saga')
    
    if not titulo or not nome_autor:
        return "Título e Autor são obrigatórios!", 400
    
    # 1. Verificar ou criar o autor
    sql_busca_autor = f"SELECT aid FROM books.autor WHERE nome ILIKE '%{nome_autor}%' LIMIT 1;"
    autor_existente = bd(sql_busca_autor)
    
    if autor_existente:
        autor_id = autor_existente[0][0]
    else:
        # Criar novo autor
        sql_criar_autor = f"INSERT INTO books.autor (nome) VALUES ('{nome_autor}') RETURNING aid;"
        novo_autor = bd(sql_criar_autor, consulta=True)
        autor_id = novo_autor[0][0] if novo_autor else None
    
    # 2. Verificar ou criar a saga
    saga_id = None
    if nome_saga and nome_saga.strip():
        sql_busca_saga = f"SELECT sid FROM books.saga WHERE titulo ILIKE '%{nome_saga}%' LIMIT 1;"
        saga_existente = bd(sql_busca_saga)
        
        if saga_existente:
            saga_id = saga_existente[0][0]


        else:
            # Criar nova saga
            sql_criar_saga = f"INSERT INTO books.saga (titulo,autor) VALUES ('{nome_saga},{autor_id}') RETURNING sid;"
            nova_saga = bd(sql_criar_saga, consulta=True)
            saga_id = nova_saga[0][0] if nova_saga else None
    
    # 3. Inserir o livro
    if ordem_saga and ordem_saga.strip():
        ordem = int(ordem_saga)
    else:
        ordem = None
    
    sql_inserir_livro = f"""
        INSERT INTO books.livro (titulo, autor_livro, saga_livro, ordem_saga, lido)
        VALUES ('{titulo}', {autor_id}, {saga_id if saga_id else 'NULL'}, {ordem if ordem else 'NULL'}, False)
    """
    
    bd(sql_inserir_livro, consulta=False)
    
    return redirect(url_for('acervo'))


@app.route('/buscar-autores')
def buscar_autores():
    termo = request.args.get('q', '')
    sql = f"SELECT nome, aid FROM books.autor WHERE nome ILIKE '%{termo}%' LIMIT 5;"
    autores = bd(sql)
    return {'autores': [{'nome': a[0], 'id': a[1]} for a in autores] if autores else []}

@app.route('/buscar-sagas')
def buscar_sagas():
    termo = request.args.get('q', '')
    sql = f"SELECT titulo, sid FROM books.saga WHERE titulo ILIKE '%{termo}%' LIMIT 5;"
    sagas = bd(sql)
    return {'sagas': [{'nome': s[0], 'id': s[1]} for s in sagas] if sagas else []}

if __name__ == '__main__':
    app.run(debug=True)