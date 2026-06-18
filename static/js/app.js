// ─── NAVEGAÇÃO ────────────────────────────────────────────────────────────────
document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    const page = link.dataset.page;
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    link.classList.add('active');
    document.getElementById('page-' + page).classList.add('active');
    if (page === 'dashboard') carregarDashboard();
    if (page === 'processos') carregarProcessosAgrupados();
    if (page === 'analises') carregarAnalises();
  });
});

// ─── TOAST ────────────────────────────────────────────────────────────────────
function toast(msg, tipo = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show ' + tipo;
  setTimeout(() => t.classList.remove('show'), 4000);
}

// ─── LOADING ──────────────────────────────────────────────────────────────────
function showLoading(msg = 'Processando...') {
  let el = document.getElementById('loading-overlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'loading-overlay';
    el.className = 'loading-overlay';
    el.innerHTML = `<div class="loading-box"><div class="big-spinner"></div><p>${msg}</p></div>`;
    document.body.appendChild(el);
  } else {
    el.querySelector('p').textContent = msg;
    el.style.display = 'flex';
  }
}
function hideLoading() {
  const el = document.getElementById('loading-overlay');
  if (el) el.style.display = 'none';
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function taxaBar(taxa) {
  const cls = taxa >= 60 ? 'alta' : taxa >= 35 ? 'media' : 'baixa';
  return `<div class="taxa-bar-wrap">
    <div class="taxa-bar"><div class="taxa-fill ${cls}" style="width:${taxa}%"></div></div>
    <span class="taxa-text">${taxa}%</span>
  </div>`;
}
function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : '—'; }
function ou(v) { return v || '—'; }

function badgeResultado(r) {
  const map = { procedente: 'badge-green', improcedente: 'badge-red', parcialmente_procedente: 'badge-yellow' };
  const label = { procedente: 'Favorável', improcedente: 'Desfavorável', parcialmente_procedente: 'Parcial' };
  return `<span class="badge ${map[r] || 'badge-gray'}">${label[r] || r}</span>`;
}

function badgeTipo(t) {
  const map = { sentenca: 'badge-purple', laudo: 'badge-blue', inicial: 'badge-gray', outro: 'badge-gray' };
  const label = { sentenca: 'Sentença', laudo: 'Laudo', inicial: 'Inicial', outro: 'Outro' };
  return `<span class="badge ${map[t] || 'badge-gray'}">${label[t] || t}</span>`;
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
async function carregarDashboard() {
  try {
    const data = await fetch('/api/dashboard').then(r => r.json());
    const r = data.resumo;

    if (r.total_documentos === 0) {
      document.getElementById('dashboard-vazio').style.display = 'block';
      document.getElementById('dashboard-conteudo').style.display = 'none';
      return;
    }
    document.getElementById('dashboard-vazio').style.display = 'none';
    document.getElementById('dashboard-conteudo').style.display = 'block';

    document.getElementById('total-docs').textContent = r.total_documentos.toLocaleString('pt-BR');
    document.getElementById('total-procedentes').textContent = r.procedentes;
    document.getElementById('total-improcedentes').textContent = r.improcedentes;
    document.getElementById('taxa-geral').textContent = r.taxa_geral + '%';

    const tabelaCids = document.getElementById('tabela-cids');
    if (!data.top_cids.length) {
      tabelaCids.innerHTML = '<p class="sem-dados">Sem dados de sentença ainda.</p>';
    } else {
      tabelaCids.innerHTML = `<table class="tabela">
        <thead><tr><th>CID</th><th>Descrição</th><th>Total</th><th>Taxa</th></tr></thead>
        <tbody>${data.top_cids.map(c => `
          <tr>
            <td><span class="badge badge-blue">${c.cid}</span></td>
            <td class="td-ellipsis" title="${c.descricao}">${c.descricao}</td>
            <td>${c.total}</td>
            <td>${taxaBar(c.taxa)}</td>
          </tr>`).join('')}
        </tbody></table>`;
    }

    const tabelaEstados = document.getElementById('tabela-estados');
    if (!data.por_estado.length) {
      tabelaEstados.innerHTML = '<p class="sem-dados">Sem dados de sentença ainda.</p>';
    } else {
      tabelaEstados.innerHTML = `<table class="tabela">
        <thead><tr><th>Estado</th><th>Total</th><th>Proc.</th><th>Taxa</th></tr></thead>
        <tbody>${data.por_estado.map(e => `
          <tr>
            <td><strong>${e.estado}</strong></td>
            <td>${e.total}</td>
            <td>${e.procedentes}</td>
            <td>${taxaBar(e.taxa)}</td>
          </tr>`).join('')}
        </tbody></table>`;
    }

    const tabelaTipos = document.getElementById('tabela-tipos');
    if (!data.por_tipo_acidente.length) {
      tabelaTipos.innerHTML = '<p class="sem-dados">Sem dados ainda.</p>';
    } else {
      tabelaTipos.innerHTML = `<table class="tabela">
        <thead><tr><th>Tipo de Acidente</th><th>Total Sentenças</th><th>Procedentes</th><th>Taxa de Êxito</th></tr></thead>
        <tbody>${data.por_tipo_acidente.map(t => `
          <tr>
            <td>${capitalize(t.tipo)}</td>
            <td>${t.total}</td>
            <td>${t.procedentes}</td>
            <td>${taxaBar(t.taxa)}</td>
          </tr>`).join('')}
        </tbody></table>`;
    }
  } catch(e) {
    toast('Erro ao carregar dashboard', 'error');
  }
}

// ─── UPLOAD ───────────────────────────────────────────────────────────────────
const uploadZone = document.getElementById('upload-zone');
const fileInput = document.getElementById('file-input');
let arquivosSelecionados = [];

uploadZone.addEventListener('click', () => fileInput.click());
uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('drag-over'); });
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
uploadZone.addEventListener('drop', e => {
  e.preventDefault(); uploadZone.classList.remove('drag-over');
  adicionarArquivos(Array.from(e.dataTransfer.files));
});
fileInput.addEventListener('change', () => {
  adicionarArquivos(Array.from(fileInput.files));
  fileInput.value = '';
});

function adicionarArquivos(novos) {
  const pdfs = novos.filter(f => f.name.endsWith('.pdf'));
  arquivosSelecionados.push(...pdfs);
  renderizarArquivos();
}

function limparTodos() {
  arquivosSelecionados = [];
  renderizarArquivos();
}

function removerArquivo(i) {
  arquivosSelecionados.splice(i, 1);
  renderizarArquivos();
}

function renderizarArquivos() {
  const wrap = document.getElementById('upload-arquivos-wrap');
  const lista = document.getElementById('upload-arquivos-lista');

  if (arquivosSelecionados.length === 0) {
    wrap.style.display = 'none';
    lista.innerHTML = '';
    return;
  }

  wrap.style.display = 'block';
  lista.innerHTML = arquivosSelecionados.map((f, i) => `
    <div class="arquivo-card" id="arquivo-card-${i}">
      <div class="arquivo-header">
        <span class="arquivo-nome">📄 ${f.name}</span>
        <button class="btn-remover" onclick="removerArquivo(${i})" title="Remover">✕</button>
      </div>
      <div class="arquivo-campos">
        <div class="campo-sm">
          <label>Nº do Processo</label>
          <input id="f${i}_numero_processo" placeholder="0000000-00.0000.0.00.0000"/>
        </div>
        <div class="campo-sm">
          <label>Nome da Parte</label>
          <input id="f${i}_nome_parte" placeholder="Nome completo do segurado"/>
        </div>
        <div class="campo-sm">
          <label>Tipo do Documento</label>
          <select id="f${i}_tipo_documento">
            <option value="">Auto-detectar</option>
            <option value="inicial">Petição Inicial</option>
            <option value="laudo">Laudo Pericial</option>
            <option value="sentenca">Sentença</option>
          </select>
        </div>
        <div class="campo-sm">
          <label>CID</label>
          <input id="f${i}_cid_principal" placeholder="Ex: M54.5"/>
        </div>
        <div class="campo-sm">
          <label>Membro da Sequela</label>
          <input id="f${i}_parte_corpo" placeholder="Ex: Coluna lombar"/>
        </div>
        <div class="campo-sm">
          <label>Função Exercida</label>
          <input id="f${i}_profissao" placeholder="Ex: Pedreiro"/>
        </div>
        <div class="campo-sm">
          <label>Comarca</label>
          <input id="f${i}_comarca" placeholder="Ex: São Paulo"/>
        </div>
        <div class="campo-sm">
          <label>Resultado</label>
          <select id="f${i}_resultado">
            <option value="">Auto-detectar</option>
            <option value="procedente">Favorável</option>
            <option value="improcedente">Desfavorável</option>
            <option value="parcialmente_procedente">Parcialmente Favorável</option>
          </select>
        </div>
      </div>
      <p class="arquivo-hint">Campos em branco serão detectados automaticamente do PDF</p>
    </div>`).join('');
}

document.getElementById('btn-enviar').addEventListener('click', async () => {
  if (arquivosSelecionados.length === 0) return;

  const progBox = document.getElementById('upload-progresso');
  const progLista = document.getElementById('progresso-lista');
  progBox.style.display = 'block';
  progLista.innerHTML = '';

  for (let i = 0; i < arquivosSelecionados.length; i++) {
    const arquivo = arquivosSelecionados[i];
    const item = document.createElement('div');
    item.className = 'prog-item';
    item.innerHTML = `<div class="prog-status prog-load">⟳</div><span><strong>${arquivo.name}</strong> — processando...</span>`;
    progLista.appendChild(item);

    try {
      const form = new FormData();
      form.append('file', arquivo);

      const get = id => (document.getElementById(`f${i}_${id}`)?.value || '').trim();
      form.append('numero_processo', get('numero_processo'));
      form.append('nome_parte', get('nome_parte'));
      form.append('tipo_documento', get('tipo_documento'));
      form.append('cid_principal', get('cid_principal'));
      form.append('parte_corpo', get('parte_corpo'));
      form.append('profissao', get('profissao'));
      form.append('comarca', get('comarca'));
      form.append('resultado', get('resultado'));

      const res = await fetch('/api/upload', { method: 'POST', body: form });
      const data = await res.json();

      if (res.ok && data.sucesso) {
        const infos = [
          badgeTipo(data.tipo_detectado),
          data.nome_parte ? `👤 ${data.nome_parte}` : '',
          data.numero_processo ? `Proc: ${data.numero_processo}` : '',
          data.cid_principal ? `CID: ${data.cid_principal}` : '',
          data.comarca ? `Comarca: ${data.comarca}` : '',
          data.resultado ? badgeResultado(data.resultado) : '',
        ].filter(Boolean).join(' &nbsp;');
        item.innerHTML = `<div class="prog-status prog-ok">✓</div><span><strong>${arquivo.name}</strong> — ${infos}</span>`;
      } else {
        item.innerHTML = `<div class="prog-status prog-err">✗</div><span><strong>${arquivo.name}</strong> — Erro: ${data.detail || 'desconhecido'}</span>`;
      }
    } catch (e) {
      item.innerHTML = `<div class="prog-status prog-err">✗</div><span><strong>${arquivo.name}</strong> — Erro de conexão</span>`;
    }
  }

  const ok = document.querySelectorAll('.prog-ok').length;
  arquivosSelecionados = [];
  renderizarArquivos();
  toast(`${ok} arquivo(s) processado(s) com sucesso!`, 'success');
});

// ─── ANÁLISE ──────────────────────────────────────────────────────────────────
document.getElementById('form-analise').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = document.getElementById('btn-analisar');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Analisando...';
  showLoading('Analisando o caso com base nos processos cadastrados...');

  try {
    const form = new FormData(e.target);
    const res = await fetch('/api/analisar', { method: 'POST', body: form });
    const data = await res.json();
    hideLoading();

    if (!res.ok) { toast(data.detail || 'Erro na análise', 'error'); return; }

    const perc = data.percentual_exito || 0;
    const cls = perc >= 65 ? 'perc-alto' : perc >= 40 ? 'perc-medio' : 'perc-baixo';
    const emoji = perc >= 65 ? '🟢' : perc >= 40 ? '🟡' : '🔴';

    const favs = Array.isArray(data.fatores_favoraveis) ? data.fatores_favoraveis : [];
    const desfavs = Array.isArray(data.fatores_desfavoraveis) ? data.fatores_desfavoraveis : [];

    document.getElementById('resultado-conteudo').innerHTML = `
      <div class="percentual-grande ${cls}">
        <div class="perc-num">${perc}%</div>
        <div class="perc-label">${emoji} ${data.classificacao || ''} — Probabilidade de Êxito</div>
      </div>
      <div class="parecer-box">
        <strong>📝 Parecer Jurídico</strong><br/><br/>
        ${(data.parecer || '').replace(/\n/g, '<br/>')}
      </div>
      ${favs.length > 0 ? `<div class="fatores">
        <h3>✅ Fatores Favoráveis</h3>
        ${favs.map(f => `<div class="fator-item"><span>✅</span><span>${f}</span></div>`).join('')}
      </div>` : ''}
      ${desfavs.length > 0 ? `<div class="fatores">
        <h3>⚠️ Fatores Desfavoráveis</h3>
        ${desfavs.map(f => `<div class="fator-item"><span>⚠️</span><span>${f}</span></div>`).join('')}
      </div>` : ''}
      ${data.recomendacao ? `<div class="parecer-box" style="background:#eff5ff;border-left:4px solid #4f8ef7">
        <strong>💡 Recomendação</strong><br/><br/>${data.recomendacao}
      </div>` : ''}
    `;
    document.getElementById('resultado-analise').style.display = 'block';
    document.getElementById('resultado-analise').scrollIntoView({ behavior: 'smooth' });

  } catch(err) {
    hideLoading();
    toast('Erro ao conectar com o servidor', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '🔍 Gerar Análise';
  }
});

// ─── PROCESSOS — VISÃO AGRUPADA ───────────────────────────────────────────────
let viewAtual = 'agrupado';

function setView(v) {
  viewAtual = v;
  document.getElementById('view-agrupado').style.display = v === 'agrupado' ? 'block' : 'none';
  document.getElementById('view-lista').style.display = v === 'lista' ? 'block' : 'none';
  document.getElementById('btn-view-agrupado').classList.toggle('active', v === 'agrupado');
  document.getElementById('btn-view-lista').classList.toggle('active', v === 'lista');
  if (v === 'lista') carregarProcessos(0);
}

async function carregarProcessosAgrupados() {
  try {
    const data = await fetch('/api/processos/agrupados').then(r => r.json());
    document.getElementById('total-processos-label').textContent =
      `${data.total_processos} processo(s) | ${data.total_documentos} documento(s) cadastrado(s)`;

    const container = document.getElementById('grupos-container');

    if (data.total_documentos === 0) {
      container.innerHTML = `<div class="empty-state"><div class="empty-icon">📁</div>
        <h2>Nenhum processo cadastrado</h2>
        <p>Envie documentos na aba <strong>Enviar Processos</strong>.</p></div>`;
      return;
    }

    container.innerHTML = data.grupos.map((g, gi) => {
      const titulo = g.numero_processo
        ? `Processo ${g.numero_processo}`
        : `Documentos sem número de processo (${g.documentos.length})`;

      const meta = [
        g.nome_parte ? `👤 ${g.nome_parte}` : '',
        g.comarca ? `🏛️ Comarca de ${g.comarca}` : '',
        g.estado ? `📍 ${g.estado}` : '',
      ].filter(Boolean).join('&emsp;');

      const docs = g.documentos.map(d => `
        <tr>
          <td>${badgeTipo(d.tipo_documento)}</td>
          <td class="td-ellipsis" title="${d.nome_arquivo}">${d.nome_arquivo}</td>
          <td>${d.cid_principal ? `<span class="badge badge-blue">${d.cid_principal}</span>` : '—'}</td>
          <td>${ou(d.parte_corpo)}</td>
          <td>${ou(d.profissao)}</td>
          <td>${ou(d.comarca)}</td>
          <td>${d.resultado ? badgeResultado(d.resultado) : '—'}</td>
          <td><button class="btn btn-danger btn-sm" onclick="deletarProcesso(${d.id})">🗑</button></td>
        </tr>`).join('');

      return `
        <div class="processo-grupo" id="grupo-${gi}">
          <div class="grupo-header" onclick="toggleGrupo(${gi})">
            <div>
              <span class="grupo-numero">${titulo}</span>
              <span class="grupo-count">${g.documentos.length} doc${g.documentos.length > 1 ? 's' : ''}</span>
            </div>
            <div class="grupo-meta">${meta}</div>
            <span class="grupo-chevron" id="chevron-${gi}">▼</span>
          </div>
          <div class="grupo-docs" id="docs-${gi}">
            <table class="tabela">
              <thead>
                <tr>
                  <th>Tipo</th><th>Arquivo</th><th>CID</th>
                  <th>Membro Sequela</th><th>Função</th><th>Comarca</th><th>Resultado</th><th></th>
                </tr>
              </thead>
              <tbody>${docs}</tbody>
            </table>
          </div>
        </div>`;
    }).join('');

  } catch(e) {
    toast('Erro ao carregar processos', 'error');
  }
}

function toggleGrupo(gi) {
  const docs = document.getElementById(`docs-${gi}`);
  const chevron = document.getElementById(`chevron-${gi}`);
  const aberto = docs.style.display !== 'none';
  docs.style.display = aberto ? 'none' : 'block';
  chevron.textContent = aberto ? '▶' : '▼';
}

// ─── PROCESSOS — VISÃO LISTA ──────────────────────────────────────────────────
let paginaAtual = 0;
const POR_PAGINA = 20;

async function carregarProcessos(skip) {
  try {
    const data = await fetch(`/api/processos?skip=${skip}&limit=${POR_PAGINA}`).then(r => r.json());
    document.getElementById('pag-info').textContent = `Página ${Math.floor(skip / POR_PAGINA) + 1} de ${Math.max(1, Math.ceil(data.total / POR_PAGINA))}`;
    document.getElementById('btn-prev').disabled = skip === 0;
    document.getElementById('btn-next').disabled = skip + POR_PAGINA >= data.total;

    const tbody = document.getElementById('tbody-processos');
    if (!data.processos.length) {
      tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;color:#999;padding:32px">Nenhum processo cadastrado.</td></tr>';
      return;
    }
    tbody.innerHTML = data.processos.map(p => `
      <tr>
        <td class="td-ellipsis" style="max-width:160px" title="${ou(p.numero_processo)}">${ou(p.numero_processo)}</td>
        <td class="td-ellipsis" style="max-width:140px" title="${ou(p.nome_parte)}">${ou(p.nome_parte)}</td>
        <td>${badgeTipo(p.tipo_documento)}</td>
        <td>${p.cid_principal ? `<span class="badge badge-blue">${p.cid_principal}</span>` : '—'}</td>
        <td>${ou(p.parte_corpo)}</td>
        <td>${ou(p.profissao)}</td>
        <td>${ou(p.comarca)}</td>
        <td>${p.resultado ? badgeResultado(p.resultado) : '—'}</td>
        <td>${ou(p.estado)}</td>
        <td style="white-space:nowrap">${p.processado_em ? new Date(p.processado_em).toLocaleDateString('pt-BR') : '—'}</td>
        <td><button class="btn btn-danger btn-sm" onclick="deletarProcesso(${p.id})">🗑</button></td>
      </tr>`).join('');
  } catch(e) {
    toast('Erro ao carregar lista', 'error');
  }
}

function mudarPagina(dir) {
  paginaAtual += dir;
  if (paginaAtual < 0) paginaAtual = 0;
  carregarProcessos(paginaAtual * POR_PAGINA);
}

async function deletarProcesso(id) {
  if (!confirm('Remover este documento da base?')) return;
  await fetch('/api/processos/' + id, { method: 'DELETE' });
  carregarProcessosAgrupados();
  if (viewAtual === 'lista') carregarProcessos(paginaAtual * POR_PAGINA);
  toast('Documento removido', 'success');
}

// ─── ANÁLISES SALVAS ──────────────────────────────────────────────────────────
async function carregarAnalises() {
  try {
    const data = await fetch('/api/analises').then(r => r.json());
    const container = document.getElementById('lista-analises');

    if (!data.analises.length) {
      container.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div>
        <h2>Nenhuma análise ainda</h2>
        <p>Vá em <strong>Analisar Caso</strong> para gerar a primeira análise.</p></div>`;
      return;
    }

    container.innerHTML = data.analises.map(a => {
      const perc = a.percentual_exito || 0;
      const cls = perc >= 65 ? 'alto' : perc >= 40 ? 'medio' : 'baixo';
      const percColor = perc >= 65 ? '#166534' : perc >= 40 ? '#854d0e' : '#991b1b';
      return `<div class="analise-card ${cls}">
        <div class="analise-header">
          <span class="analise-nome">👤 ${a.nome_cliente}</span>
          <span class="analise-perc" style="color:${percColor}">${perc}%</span>
        </div>
        <div class="analise-meta">
          ${a.cid_principal ? `<span>CID: ${a.cid_principal}</span>` : ''}
          ${a.tipo_acidente ? `<span>${capitalize(a.tipo_acidente)}</span>` : ''}
          ${a.estado ? `<span>${a.estado}</span>` : ''}
          ${a.criado_em ? `<span>${new Date(a.criado_em).toLocaleDateString('pt-BR')}</span>` : ''}
        </div>
        ${a.parecer ? `<p style="font-size:13px;color:#555;line-height:1.6">${a.parecer.substring(0, 280)}${a.parecer.length > 280 ? '...' : ''}</p>` : ''}
      </div>`;
    }).join('');
  } catch(e) {
    toast('Erro ao carregar análises', 'error');
  }
}

// ─── INIT ─────────────────────────────────────────────────────────────────────
carregarDashboard();
