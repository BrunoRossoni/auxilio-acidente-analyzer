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
    if (page === 'processos') carregarProcessos(0);
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

    // Top CIDs
    const tabelaCids = document.getElementById('tabela-cids');
    if (data.top_cids.length === 0) {
      tabelaCids.innerHTML = '<p style="color:#999;font-size:13px">Sem dados de sentença ainda.</p>';
    } else {
      tabelaCids.innerHTML = `<table class="tabela">
        <thead><tr><th>CID</th><th>Descrição</th><th>Total</th><th>Taxa</th></tr></thead>
        <tbody>${data.top_cids.map(c => `
          <tr>
            <td><span class="badge badge-blue">${c.cid}</span></td>
            <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${c.descricao}">${c.descricao}</td>
            <td>${c.total}</td>
            <td>${taxaBar(c.taxa)}</td>
          </tr>`).join('')}
        </tbody></table>`;
    }

    // Por Estado
    const tabelaEstados = document.getElementById('tabela-estados');
    if (data.por_estado.length === 0) {
      tabelaEstados.innerHTML = '<p style="color:#999;font-size:13px">Sem dados de sentença ainda.</p>';
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

    // Por Tipo
    const tabelaTipos = document.getElementById('tabela-tipos');
    if (data.por_tipo_acidente.length === 0) {
      tabelaTipos.innerHTML = '<p style="color:#999;font-size:13px">Sem dados ainda.</p>';
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

function taxaBar(taxa) {
  const cls = taxa >= 60 ? 'alta' : taxa >= 35 ? 'media' : 'baixa';
  return `<div class="taxa-bar-wrap">
    <div class="taxa-bar"><div class="taxa-fill ${cls}" style="width:${taxa}%"></div></div>
    <span class="taxa-text">${taxa}%</span>
  </div>`;
}
function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : '—'; }

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
fileInput.addEventListener('change', () => adicionarArquivos(Array.from(fileInput.files)));

function adicionarArquivos(novos) {
  const pdfs = novos.filter(f => f.name.endsWith('.pdf'));
  arquivosSelecionados.push(...pdfs);
  renderizarLista();
  document.getElementById('btn-enviar').style.display = arquivosSelecionados.length > 0 ? 'inline-flex' : 'none';
}

function renderizarLista() {
  const lista = document.getElementById('upload-lista');
  lista.innerHTML = arquivosSelecionados.map((f, i) => `
    <div class="upload-item">
      📄 ${f.name}
      <span class="remove" onclick="removerArquivo(${i})">✕</span>
    </div>`).join('');
}

function removerArquivo(i) {
  arquivosSelecionados.splice(i, 1);
  renderizarLista();
  document.getElementById('btn-enviar').style.display = arquivosSelecionados.length > 0 ? 'inline-flex' : 'none';
}

document.getElementById('btn-enviar').addEventListener('click', async () => {
  if (arquivosSelecionados.length === 0) return;

  const progBox = document.getElementById('upload-progresso');
  const progLista = document.getElementById('progresso-lista');
  progBox.style.display = 'block';
  progLista.innerHTML = '';

  for (const arquivo of arquivosSelecionados) {
    const item = document.createElement('div');
    item.className = 'prog-item';
    item.innerHTML = `<div class="prog-status prog-load">⟳</div><span><strong>${arquivo.name}</strong> — processando com IA...</span>`;
    progLista.appendChild(item);

    try {
      const form = new FormData();
      form.append('file', arquivo);

      const res = await fetch('/api/upload', { method: 'POST', body: form });
      const data = await res.json();

      if (res.ok && data.sucesso) {
        item.innerHTML = `<div class="prog-status prog-ok">✓</div><span><strong>${arquivo.name}</strong> — <span class="badge badge-blue">${data.tipo_detectado}</span> ${data.cid_principal ? `CID: ${data.cid_principal}` : ''} ${data.resultado ? `| ${badgeResultado(data.resultado)}` : ''}</span>`;
      } else {
        item.innerHTML = `<div class="prog-status prog-err">✗</div><span><strong>${arquivo.name}</strong> — Erro: ${data.detail || 'desconhecido'}</span>`;
      }
    } catch (e) {
      item.innerHTML = `<div class="prog-status prog-err">✗</div><span><strong>${arquivo.name}</strong> — Erro de conexão</span>`;
    }
  }

  arquivosSelecionados = [];
  renderizarLista();
  document.getElementById('btn-enviar').style.display = 'none';
  toast(`${document.querySelectorAll('.prog-ok').length} arquivo(s) processado(s)!`, 'success');
});

function badgeResultado(r) {
  const map = { procedente: 'badge-green', improcedente: 'badge-red', parcialmente_procedente: 'badge-yellow' };
  const label = { procedente: 'Procedente', improcedente: 'Improcedente', parcialmente_procedente: 'Parcial' };
  return `<span class="badge ${map[r] || 'badge-gray'}">${label[r] || r}</span>`;
}

// ─── ANÁLISE ──────────────────────────────────────────────────────────────────
document.getElementById('form-analise').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = document.getElementById('btn-analisar');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Analisando...';
  showLoading('A IA está analisando o caso. Aguarde...');

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

// ─── PROCESSOS ────────────────────────────────────────────────────────────────
let paginaAtual = 0;
const POR_PAGINA = 20;

async function carregarProcessos(skip) {
  try {
    const data = await fetch(`/api/processos?skip=${skip}&limit=${POR_PAGINA}`).then(r => r.json());
    document.getElementById('total-processos-label').textContent = `${data.total} documentos cadastrados`;
    document.getElementById('pag-info').textContent = `Página ${Math.floor(skip / POR_PAGINA) + 1} de ${Math.ceil(data.total / POR_PAGINA)}`;
    document.getElementById('btn-prev').disabled = skip === 0;
    document.getElementById('btn-next').disabled = skip + POR_PAGINA >= data.total;

    const tbody = document.getElementById('tbody-processos');
    if (data.processos.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#999;padding:32px">Nenhum processo cadastrado ainda.</td></tr>';
      return;
    }
    tbody.innerHTML = data.processos.map(p => `
      <tr>
        <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${p.nome_arquivo}">${p.nome_arquivo}</td>
        <td><span class="badge badge-gray">${p.tipo_documento}</span></td>
        <td>${p.cid_principal ? `<span class="badge badge-blue">${p.cid_principal}</span>` : '—'}</td>
        <td>${p.resultado ? badgeResultado(p.resultado) : '—'}</td>
        <td>${p.estado || '—'}</td>
        <td>${p.tipo_acidente ? capitalize(p.tipo_acidente) : '—'}</td>
        <td style="white-space:nowrap">${p.processado_em ? new Date(p.processado_em).toLocaleDateString('pt-BR') : '—'}</td>
        <td><button class="btn btn-danger btn-sm" onclick="deletarProcesso(${p.id})">🗑</button></td>
      </tr>`).join('');
  } catch(e) {
    toast('Erro ao carregar processos', 'error');
  }
}

function mudarPagina(dir) {
  paginaAtual += dir;
  if (paginaAtual < 0) paginaAtual = 0;
  carregarProcessos(paginaAtual * POR_PAGINA);
}

async function deletarProcesso(id) {
  if (!confirm('Remover este processo da base?')) return;
  await fetch('/api/processos/' + id, { method: 'DELETE' });
  carregarProcessos(paginaAtual * POR_PAGINA);
  toast('Processo removido', 'success');
}

// ─── ANÁLISES SALVAS ──────────────────────────────────────────────────────────
async function carregarAnalises() {
  try {
    const data = await fetch('/api/analises').then(r => r.json());
    const container = document.getElementById('lista-analises');

    if (data.analises.length === 0) {
      container.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><h2>Nenhuma análise ainda</h2><p>Vá em <strong>Analisar Caso</strong> para gerar a primeira análise.</p></div>`;
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
