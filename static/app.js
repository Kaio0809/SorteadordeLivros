const DATA = { books: [], authors: [], series: [] };
const STORE_KEY = "meusLivrinhosStateV1";
let state = { read: {}, history: [], addedBooks: [] };
let lastDrawnId = null;
let toastTimer;

const app = document.getElementById("app");
const $ = (selector, root=document) => root.querySelector(selector);
const $$ = (selector, root=document) => [...root.querySelectorAll(selector)];
const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
const norm = value => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR").trim();

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
    state = {
      read: saved.read && typeof saved.read === "object" ? saved.read : {},
      history: Array.isArray(saved.history) ? saved.history : [],
      addedBooks: Array.isArray(saved.addedBooks) ? saved.addedBooks : []
    };
  } catch {
    state = { read: {}, history: [], addedBooks: [] };
  }
}
function saveState() {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}
function parseCSV(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i=0; i<text.length; i++) {
    const ch = text[i], next = text[i+1];
    if (ch === '"' && quoted && next === '"') { field += '"'; i++; }
    else if (ch === '"') quoted = !quoted;
    else if (ch === "," && !quoted) { row.push(field); field = ""; }
    else if ((ch === "\n" || ch === "\r") && !quoted) {
      if (ch === "\r" && next === "\n") i++;
      row.push(field);
      if (row.some(v => v.trim() !== "")) rows.push(row);
      row = []; field = "";
    } else field += ch;
  }
  if (field.length || row.length) { row.push(field); if (row.some(v => v.trim() !== "")) rows.push(row); }
  if (!rows.length) return [];
  const headers = rows.shift().map(v => v.trim().replace(/^\uFEFF/,""));
  return rows.map(values => Object.fromEntries(headers.map((h,i) => [h, (values[i] ?? "").trim()])));
}
async function loadCSV(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Não foi possível carregar ${path}`);
  return parseCSV(await response.text());
}
async function init() {
  loadState();
  try {
    const [books, authors, series, sorteios] = await Promise.all([
      loadCSV("./data/livros.csv"), loadCSV("./data/autores.csv"), loadCSV("./data/sagas.csv"), loadCSV('./data/sorteios.csv')
    ]);
    DATA.books = books.map(b => ({
      id: String(b.id || "").trim(),
      title: b.titulo || "",
      authorId: String(b.autor_id || "").trim(),
      seriesId: String(b.saga_id || "").trim(),
      order: b.ordem || "",
      initialRead: ["true","1","sim","yes"].includes(norm(b.lido))
    })).filter(b => b.id && b.title);
    DATA.authors = authors.map(a => ({id:String(a.id||"").trim(),name:a.nome||""})).filter(a=>a.id&&a.name);
    DATA.series = series.map(s => ({id:String(s.id||"").trim(),title:s.titulo||"",authorId:String(s.autor_id||"").trim()})).filter(s=>s.id&&s.title);
    if (!DATA.books.length) throw new Error("O arquivo data/livros.csv não contém livros.");
    render();
  } catch (error) {
    app.innerHTML = `<section class="panel"><div class="empty-state"><strong>Não consegui carregar os arquivos CSV.</strong><p>${esc(error.message)}</p><p>Publique a pasta data junto com index.html e static/.</p></div></section>`;
  }
}
function allBooks() {
  return [...DATA.books, ...state.addedBooks.map(b=>({...b, added:true}))];
}
function authorName(id) {
  const custom = state.addedBooks.find(b=>b.id===String(id));
  return DATA.authors.find(a=>a.id===String(id))?.name || custom?.author || "Autor desconhecido";
}
function seriesName(id) {
  return DATA.series.find(s=>s.id===String(id))?.title || "";
}
function bookById(id) { return allBooks().find(b=>String(b.id)===String(id)); }
function isRead(book) { return Boolean(state.read[book.id] ?? book.initialRead ?? false); }
function setRead(id, value) { state.read[id] = Boolean(value); saveState(); }
function totalRead() { return allBooks().filter(isRead).length; }
function percentRead() { const books=allBooks(); return books.length ? Math.round(totalRead()/books.length*100) : 0; }
function go(route) { location.hash = `/${route}`; }
function showToast(message) {
  const el=$("#toast"); el.textContent=message; el.classList.add("show");
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove("show"),2600);
}
function statusHTML(book) { return `<span class="status ${isRead(book)?"read":"unread"}">${isRead(book)?"✓ Lido":"○ Não lido"}</span>`; }
function bookRow(book, options={}) {
  const author = book.author || authorName(book.authorId);
  const saga = book.series || seriesName(book.seriesId);
  return `<article class="book-row">
    <div class="book-main">
      <a class="book-title" href="#/livro/${encodeURIComponent(book.id)}">${esc(book.title)}</a>
      <div class="book-meta">${esc(author)}${saga?` · ${esc(saga)}${book.order?` · Livro ${esc(book.order)}`:""}`:""}</div>
    </div>
    <div class="book-actions">${statusHTML(book)}
      ${options.showReadButton===false?"":`<button class="btn btn-small ${isRead(book)?"btn-outline":""}" data-action="toggle-read" data-id="${esc(book.id)}">${isRead(book)?"Desmarcar":"Marcar lido"}</button>`}
      ${options.hideDetails?"":`<a class="btn btn-small btn-outline" href="#/livro/${encodeURIComponent(book.id)}">Detalhes</a>`}
    </div>
  </article>`;
}
function render() {
  const route = location.hash.replace(/^#\/?/,"") || "inicio";
  const [page, id] = route.split("/");
  $$(".main-nav a").forEach(a=>a.classList.toggle("active",a.dataset.nav===page));
  $("#mainNav").classList.remove("open");
  $("#menuToggle").setAttribute("aria-expanded","false");
  if (page==="inicio") renderHome();
  else if (page==="sortear") renderDraw();
  else if (page==="buscar") renderSearch();
  else if (page==="acervo") renderLibrary();
  else if (page==="historico") renderHistory();
  else if (page==="livro") renderBook(id);
  else if (page==="autor") renderAuthor(id);
  else if (page==="saga") renderSeries(id);
  else renderHome();
}
function renderHome() {
  const books=allBooks(), unread=books.filter(b=>!isRead(b)).length;
  const recent=books.filter(isRead).slice(-4).reverse();
  app.innerHTML = `
    <section class="hero">
      <div class="eyebrow">Sua biblioteca, do seu jeito</div>
      <h1>Deixe a sorte escolher sua próxima aventura.</h1>
      <p>Organize seus livros, acompanhe o que já leu e descubra qual história vai te acompanhar agora. Um livro de cada vez.</p>
      <div class="hero-actions"><a class="btn btn-light" href="#/sortear">Sortear meu próximo livro ↗</a><a class="btn btn-outline" href="#/acervo">Explorar acervo</a></div>
    </section>
    <section class="stats-grid">
      <div class="stat-card"><div class="stat-label">Livros no acervo</div><div class="stat-value">${books.length}</div><div class="stat-note">Histórias para descobrir</div></div>
      <div class="stat-card"><div class="stat-label">Autores</div><div class="stat-value">${new Set(books.map(b=>b.authorId||b.author)).size}</div><div class="stat-note">Vozes diferentes</div></div>
      <div class="stat-card"><div class="stat-label">Sagas</div><div class="stat-value">${new Set(books.map(b=>b.seriesId||b.series).filter(Boolean)).size}</div><div class="stat-note">Universos para explorar</div></div>
      <div class="stat-card"><div class="stat-label">Já lidos</div><div class="stat-value">${totalRead()}</div><div class="stat-note">${percentRead()}% do seu acervo</div></div>
    </section>
    <div class="section-head"><div><h2>O que vamos ler hoje?</h2><p>Escolha por onde quer começar.</p></div></div>
    <section class="quick-grid">
      <a class="quick-card" href="#/sortear"><div class="quick-icon">✦</div><h3>Sortear livro</h3><p>Deixe o acaso escolher entre os títulos que você ainda não leu.</p><span class="btn btn-small">Fazer sorteio →</span></a>
      <a class="quick-card" href="#/buscar"><div class="quick-icon">⌕</div><h3>Buscar no acervo</h3><p>Encontre livros, autores ou sagas sem precisar procurar um por um.</p><span class="btn btn-small">Buscar →</span></a>
      <a class="quick-card" href="#/acervo"><div class="quick-icon">▤</div><h3>Meu acervo</h3><p>Veja seu catálogo, marque leituras e acompanhe suas estatísticas.</p><span class="btn btn-small">Ver biblioteca →</span></a>
    </section>
    <div class="section-head"><div><h2>Seu progresso</h2><p>Uma página de cada vez.</p></div><strong>${percentRead()}%</strong></div>
    <section class="panel"><div class="progress-track"><div class="progress-fill" style="width:${percentRead()}%"></div></div><div class="book-meta">${totalRead()} de ${books.length} livros marcados como lidos · ${unread} ainda esperando por você.</div></section>
    ${recent.length?`<div class="section-head"><div><h2>Leituras concluídas</h2><p>Livros que você já marcou como lidos.</p></div><a href="#/acervo" class="btn btn-small btn-outline">Ver todos</a></div><section class="book-list">${recent.map(b=>bookRow(b,{hideDetails:true})).join("")}</section>`:""}
  `;
}
function renderDraw() {
  app.innerHTML = `<div class="page-heading"><div class="eyebrow">Um pouco de acaso</div><h1>Sorteio de livros</h1><p>Não sabe o que ler? Deixe a sorte escolher entre os livros que ainda estão na sua lista.</p></div>
    <section class="panel sort-box"><div class="big-symbol">✦</div><h2>Qual será a próxima história?</h2><p>Se o livro sorteado fizer parte de uma saga, vamos priorizar o primeiro livro ainda não lido dessa sequência.</p><button class="btn" data-action="draw">Sortear livro</button><div id="drawResult"></div></section>`;
}
function drawBook() {
  const unread=allBooks().filter(b=>!isRead(b));
  if (!unread.length) { $("#drawResult").innerHTML=`<div class="inline-note">Você já marcou todos os livros como lidos. Adicione mais títulos ao acervo ou desmarque algum livro para sortear novamente.</div>`; return; }
  const candidate=unread[Math.floor(Math.random()*unread.length)];
  let chosen=candidate;
  if(candidate.seriesId) {
    const sagaUnread=unread.filter(b=>b.seriesId===candidate.seriesId);
    const ordered=sagaUnread.filter(b=>b.order!==""&&b.order!==null).sort((a,b)=>Number(a.order)-Number(b.order));
    if(ordered.length) chosen=ordered[0];
  }
  lastDrawnId=chosen.id;
  state.history.unshift({id:chosen.id,at:new Date().toISOString()});
  saveState();
  $("#drawResult").innerHTML=`<div class="result-book"><div class="eyebrow">Seu próximo livro</div><h3>${esc(chosen.title)}</h3><div class="author">${esc(chosen.author||authorName(chosen.authorId))}</div>${(chosen.series||seriesName(chosen.seriesId))?`<p class="book-meta">Saga: ${esc(chosen.series||seriesName(chosen.seriesId))}${chosen.order?` · ordem ${esc(chosen.order)}`:""}</p>`:""}<div class="hero-actions" style="justify-content:center;margin-top:20px"><a class="btn" href="#/livro/${encodeURIComponent(chosen.id)}">Ver detalhes</a><button class="btn btn-outline" data-action="toggle-read" data-id="${esc(chosen.id)}">Marcar como lido</button></div></div>`;
}
function renderSearch() {
  app.innerHTML=`<div class="page-heading"><div class="eyebrow">Encontre sua próxima leitura</div><h1>Buscar no acervo</h1><p>Pesquise por título, autor ou nome de saga.</p></div>
  <section class="panel"><div class="toolbar"><div class="search-wrap"><input id="searchInput" class="search-input" placeholder="Ex.: Harry Potter, Machado de Assis..." autocomplete="off"></div><select id="searchType" class="filter-select"><option value="all">Tudo</option><option value="book">Livros</option><option value="author">Autores</option><option value="series">Sagas</option></select></div><div id="searchResults" class="book-list"><div class="empty-state"><strong>O que você procura?</strong>Digite acima para ver os resultados.</div></div></section>`;
  $("#searchInput").addEventListener("input", updateSearch);
  $("#searchType").addEventListener("change", updateSearch);
}
function updateSearch() {
  const q=norm($("#searchInput").value), type=$("#searchType").value, result=$("#searchResults");
  if(!q){result.innerHTML=`<div class="empty-state"><strong>O que você procura?</strong>Digite acima para ver os resultados.</div>`;return;}
  const books=allBooks().filter(b=>type==="all"||type==="book").filter(b=>norm(b.title).includes(q)||norm(b.author||authorName(b.authorId)).includes(q)||norm(b.series||seriesName(b.seriesId)).includes(q));
  const authors=type==="book"?[]:DATA.authors.filter(a=>norm(a.name).includes(q));
  const series=type==="book"?[]:DATA.series.filter(s=>norm(s.title).includes(q));
  let html=books.map(b=>bookRow(b,{hideDetails:true})).join("");
  if(authors.length) html+=authors.map(a=>`<article class="book-row"><div class="book-main"><a class="book-title" href="#/autor/${encodeURIComponent(a.id)}">${esc(a.name)}</a><div class="book-meta">Autor · ${allBooks().filter(b=>b.authorId===a.id).length} livro(s)</div></div><a class="btn btn-small btn-outline" href="#/autor/${encodeURIComponent(a.id)}">Ver autor</a></article>`).join("");
  if(series.length) html+=series.map(s=>`<article class="book-row"><div class="book-main"><a class="book-title" href="#/saga/${encodeURIComponent(s.id)}">${esc(s.title)}</a><div class="book-meta">Saga · ${allBooks().filter(b=>b.seriesId===s.id).length} livro(s)</div></div><a class="btn btn-small btn-outline" href="#/saga/${encodeURIComponent(s.id)}">Ver saga</a></article>`).join("");
  result.innerHTML=html||`<div class="empty-state"><strong>Nenhum resultado encontrado</strong>Tente outro título, autor ou saga.</div>`;
}
function renderLibrary() {
  app.innerHTML=`<div class="page-heading"><div class="eyebrow">Tudo o que você quer ler</div><h1>Meu acervo</h1><p>Consulte seus livros, acompanhe o progresso e organize suas próximas leituras.</p></div>
  <section class="stats-grid"><div class="stat-card"><div class="stat-label">Total</div><div class="stat-value">${allBooks().length}</div></div><div class="stat-card"><div class="stat-label">Lidos</div><div class="stat-value">${totalRead()}</div></div><div class="stat-card"><div class="stat-label">Não lidos</div><div class="stat-value">${allBooks().length-totalRead()}</div></div><div class="stat-card"><div class="stat-label">Progresso</div><div class="stat-value">${percentRead()}%</div></div></section>
  <section class="panel"><div class="tabs"><button class="filter-btn active" data-filter="todos">Todos</button><button class="filter-btn" data-filter="lidos">Lidos</button><button class="filter-btn" data-filter="nao-lidos">Não lidos</button><button class="filter-btn" data-filter="estatisticas">Estatísticas</button><button class="filter-btn" data-filter="adicionar">+ Adicionar livro</button></div><div id="libraryContent"></div></section>`;
  $$(".filter-btn").forEach(btn=>btn.addEventListener("click",()=>{ $$(".filter-btn").forEach(b=>b.classList.toggle("active",b===btn)); renderLibraryTab(btn.dataset.filter); }));
  renderLibraryTab("todos");
}
function renderLibraryTab(filter) {
  const target=$("#libraryContent");
  if(filter==="adicionar"){target.innerHTML=addBookForm();return;}
  if(filter==="estatisticas"){target.innerHTML=statisticsHTML();return;}
  const books=allBooks().filter(b=>filter==="todos"||(filter==="lidos"&&isRead(b))||(filter==="nao-lidos"&&!isRead(b))).sort((a,b)=>a.title.localeCompare(b.title,"pt-BR"));
  target.innerHTML=books.length?`<div class="book-list">${books.map(b=>bookRow(b,{hideDetails:true})).join("")}</div>`:`<div class="empty-state"><strong>Nenhum livro por aqui.</strong>Quando houver títulos nessa categoria, eles aparecerão aqui.</div>`;
}
function statisticsHTML() {
  const books=allBooks(), totals=new Map();
  books.forEach(b=>{const name=b.author||authorName(b.authorId);if(!totals.has(name))totals.set(name,{all:0,read:0});const v=totals.get(name);v.all++;if(isRead(b))v.read++;});
  const authors=[...totals.entries()].map(([name,v])=>({name,...v,pct:Math.round(v.read/v.all*100)})).sort((a,b)=>b.pct-a.pct||b.read-a.read).slice(0,8);
  const sagas=new Map();
  books.forEach(b=>{const name=b.series||seriesName(b.seriesId)||"Sem saga";if(!sagas.has(name))sagas.set(name,{all:0,read:0});const v=sagas.get(name);v.all++;if(isRead(b))v.read++;});
  return `<div class="stats-columns"><div><h3>Progresso geral</h3><div class="progress-track"><div class="progress-fill" style="width:${percentRead()}%"></div></div><p class="book-meta">${totalRead()} de ${books.length} livros lidos (${percentRead()}%).</p><div class="rank-row"><div class="rank-head"><strong>Lidos</strong><span>${totalRead()}</span></div></div><div class="rank-row"><div class="rank-head"><strong>Não lidos</strong><span>${books.length-totalRead()}</span></div></div></div><div><h3>Progresso por autor</h3>${authors.map(a=>`<div class="rank-row"><div class="rank-head"><strong>${esc(a.name)}</strong><span>${a.read}/${a.all} · ${a.pct}%</span></div><div class="progress-track"><div class="progress-fill" style="width:${a.pct}%"></div></div></div>`).join("")}</div><div><h3>Progresso por saga</h3>${[...sagas.entries()].sort((a,b)=>(b[1].read/b[1].all)-(a[1].read/a[1].all)).map(([name,v])=>{const pct=Math.round(v.read/v.all*100);return `<div class="rank-row"><div class="rank-head"><strong>${esc(name)}</strong><span>${v.read}/${v.all} · ${pct}%</span></div><div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div></div>`}).join("")}</div></div>`;
}
function addBookForm() {
  return `<h3>Adicionar um livro</h3><p class="book-meta">Novos livros ficam salvos neste navegador. Para incluí-los no CSV publicado, edite também os arquivos da pasta data.</p><form id="addBookForm" class="form-grid"><div class="form-group full"><label for="newTitle">Título *</label><input class="field-input" id="newTitle" required maxlength="180"></div><div class="form-group"><label for="newAuthor">Autor *</label><input class="field-input" id="newAuthor" required maxlength="120"></div><div class="form-group"><label for="newSeries">Saga (opcional)</label><input class="field-input" id="newSeries" maxlength="120"></div><div class="form-group"><label for="newOrder">Ordem na saga (opcional)</label><input class="field-input" id="newOrder" type="number" min="1" step="1"></div><div class="form-group full"><button class="btn" type="submit">Salvar livro no navegador</button></div></form>`;
}
function renderHistory() {
  const entries=state.history.map((h,i)=>({...h,index:i,book:bookById(h.id)})).filter(h=>h.book);
  app.innerHTML=`<div class="page-heading"><div class="eyebrow">Suas escolhas</div><h1>Histórico de sorteios</h1><p>Veja os livros que a sorte já colocou no seu caminho.</p></div><section class="panel"><div class="section-head"><div><h2>${entries.length} sorteio(s)</h2><p>O histórico é guardado neste navegador.</p></div>${entries.length?`<button class="btn btn-danger btn-small" data-action="clear-history">Limpar histórico</button>`:""}</div>${entries.length?`<div class="table-wrap"><table><thead><tr><th>Livro</th><th>Autor</th><th>Saga</th><th>Status</th><th>Data</th></tr></thead><tbody>${entries.map(h=>`<tr><td><a class="book-title" href="#/livro/${encodeURIComponent(h.book.id)}">${esc(h.book.title)}</a></td><td>${esc(h.book.author||authorName(h.book.authorId))}</td><td>${esc(h.book.series||seriesName(h.book.seriesId)||"—")}</td><td>${isRead(h.book)?"Lido":"Pendente"}</td><td>${h.at?new Date(h.at).toLocaleString("pt-BR"):"—"}</td></tr>`).join("")}</tbody></table></div>`:`<div class="empty-state"><strong>Seu histórico está vazio.</strong>Faça seu primeiro sorteio e ele aparecerá aqui.<p><a class="btn" href="#/sortear">Sortear agora</a></p></div>`}</section>`;
}
function renderBook(id) {
  const b=bookById(decodeURIComponent(id||""));
  if(!b){app.innerHTML=notFound("Livro");return;}
  const author=b.author||authorName(b.authorId), series=b.series||seriesName(b.seriesId);
  app.innerHTML=`<div class="page-heading"><div class="eyebrow">Detalhes da obra</div><h1>${esc(b.title)}</h1><p>Informações e status da sua leitura.</p></div><section class="panel"><div class="details-grid"><div class="detail-item"><span>Autor</span><strong>${esc(author)}</strong>${b.authorId?`<p><a class="btn btn-small btn-outline" href="#/autor/${encodeURIComponent(b.authorId)}">Ver autor</a></p>`:""}</div><div class="detail-item"><span>Saga</span><strong>${esc(series||"Não pertence a uma saga")}</strong>${b.seriesId?`<p><a class="btn btn-small btn-outline" href="#/saga/${encodeURIComponent(b.seriesId)}">Ver saga</a></p>`:""}</div><div class="detail-item"><span>Ordem na saga</span><strong>${esc(b.order||"Não informada")}</strong></div><div class="detail-item"><span>Status de leitura</span>${statusHTML(b)}</div></div><div class="toolbar"><button class="btn" data-action="toggle-read" data-id="${esc(b.id)}">${isRead(b)?"Desmarcar como lido":"Marcar como lido"}</button><a class="btn btn-outline" href="#/acervo">Voltar ao acervo</a></div></section>`;
}
function renderAuthor(id) {
  const author=DATA.authors.find(a=>a.id===decodeURIComponent(id))||state.addedBooks.find(b=>b.id===decodeURIComponent(id));
  const books=allBooks().filter(b=>b.authorId===decodeURIComponent(id)||b.authorId===String(id)||b.author===author?.name).sort((a,b)=>a.title.localeCompare(b.title,"pt-BR"));
  if(!author){app.innerHTML=notFound("Autor");return;}
  app.innerHTML=`<div class="page-heading"><div class="eyebrow">Autor(a)</div><h1>${esc(author.name||author.author)}</h1><p>${books.length} livro(s) no acervo.</p></div><section class="book-list">${books.map(b=>bookRow(b,{hideDetails:true})).join("")||`<div class="panel empty-state"><strong>Nenhum livro encontrado.</strong></div>`}</section>`;
}
function renderSeries(id) {
  const saga=DATA.series.find(s=>s.id===decodeURIComponent(id));
  const books=allBooks().filter(b=>b.seriesId===decodeURIComponent(id)||b.seriesId===String(id)||b.series===saga?.title).sort((a,b)=>Number(a.order||999)-Number(b.order||999));
  if(!saga){app.innerHTML=notFound("Saga");return;}
  app.innerHTML=`<div class="page-heading"><div class="eyebrow">Saga literária</div><h1>${esc(saga.title)}</h1><p>${books.length} livro(s) nesta saga.</p></div><section class="panel"><div class="toolbar"><button class="btn btn-small" data-action="mark-series" data-id="${esc(id)}" data-value="true">Marcar todos como lidos</button><button class="btn btn-small btn-danger" data-action="mark-series" data-id="${esc(id)}" data-value="false">Desmarcar todos</button></div><div class="book-list">${books.map(b=>bookRow(b,{hideDetails:true})).join("")||`<div class="empty-state"><strong>Nenhum livro nesta saga.</strong></div>`}</div></section>`;
}
function notFound(type) { return `<section class="panel empty-state"><strong>${esc(type)} não encontrado(a).</strong><p>Talvez o item não esteja no CSV atual.</p><a class="btn" href="#/acervo">Voltar ao acervo</a></section>`; }
function handleAction(event) {
  const btn=event.target.closest("[data-action]");
  if(!btn) return;
  const action=btn.dataset.action, id=btn.dataset.id;
  if(action==="draw"){drawBook();return;}
  if(action==="toggle-read"){
    const b=bookById(id); if(!b)return;
    setRead(id,!isRead(b));
    render();
    showToast(isRead(bookById(id))?"Livro marcado como lido.":"Leitura desmarcada.");
  }
  if(action==="clear-history"){
    if(confirm("Tem certeza de que deseja apagar todo o histórico de sorteios?")){state.history=[];saveState();render();showToast("Histórico apagado.");}
  }
  if(action==="mark-series"){
    const value=btn.dataset.value==="true";
    allBooks().filter(b=>b.seriesId===id||b.seriesId===String(id)).forEach(b=>state.read[b.id]=value);
    saveState();render();showToast(value?"Saga marcada como lida.":"Leitura da saga desmarcada.");
  }
}
function handleSubmit(event) {
  if(event.target.id!=="addBookForm")return;
  event.preventDefault();
  const title=$("#newTitle").value.trim(), author=$("#newAuthor").value.trim(), series=$("#newSeries").value.trim(), order=$("#newOrder").value.trim();
  if(!title||!author)return;
  const id=`local-${Date.now()}`;
  state.addedBooks.push({id,title,author,authorId:"",series,seriesId:"",order,initialRead:false});
  if(series){
    const existing=DATA.series.find(s=>norm(s.title)===norm(series));
    if(existing) state.addedBooks[state.addedBooks.length-1].seriesId=existing.id;
  }
  const b=state.addedBooks[state.addedBooks.length-1];
  const existingAuthor=DATA.authors.find(a=>norm(a.name)===norm(author));
  if(existingAuthor)b.authorId=existingAuthor.id;
  saveState();render();showToast("Livro adicionado neste navegador.");
}
window.addEventListener("hashchange",render);
document.addEventListener("click",handleAction);
document.addEventListener("submit",handleSubmit);
$("#menuToggle").addEventListener("click",()=>{const open=$("#mainNav").classList.toggle("open");$("#menuToggle").setAttribute("aria-expanded",String(open));});
init();
