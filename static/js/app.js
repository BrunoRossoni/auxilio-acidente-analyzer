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

    document.getElementById('total-docs').textContent = (r.total_processos ?? r.total_documentos).toLocaleString('pt-BR');
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

// ─── UPLOAD — FICHAS POR PROCESSO ────────────────────────────────────────────
let fichaCount = 0;

function adicionarFicha() {
  const id = fichaCount++;
  const container = document.getElementById('fichas-container');

  const div = document.createElement('div');
  div.className = 'ficha-processo';
  div.id = `ficha-${id}`;
  div.innerHTML = `
    <div class="ficha-topo">
      <h2 class="ficha-titulo">📋 Processo ${fichaCount}</h2>
      ${fichaCount > 1 ? `<button class="btn-remover" onclick="removerFicha(${id})" title="Remover ficha">✕ Remover</button>` : ''}
    </div>

    <div class="ficha-campos">
      <div class="campo-ficha campo-largo">
        <label>Nº do Processo</label>
        <input id="p${id}_numero_processo" placeholder="0000000-00.0000.0.00.0000"/>
      </div>
      <div class="campo-ficha campo-largo">
        <label>Nome da Parte (Segurado)</label>
        <input id="p${id}_nome_parte" placeholder="Nome completo do segurado"/>
      </div>
      <div class="campo-ficha">
        <label>CID</label>
        <input id="p${id}_cid_principal" placeholder="Ex: M54.5"/>
      </div>
      <div class="campo-ficha">
        <label>Membro da Sequela</label>
        <input id="p${id}_parte_corpo" placeholder="Ex: Coluna lombar"/>
      </div>
      <div class="campo-ficha">
        <label>Função Exercida</label>
        <input id="p${id}_profissao" placeholder="Ex: Pedreiro"/>
      </div>
      <div class="campo-ficha">
        <label>Comarca</label>
        <input id="p${id}_comarca" placeholder="Ex: São Paulo"/>
      </div>
      <div class="campo-ficha">
        <label>Estado</label>
        <select id="p${id}_estado">
          <option value="">UF...</option>
          <option>AC</option><option>AL</option><option>AP</option><option>AM</option>
          <option>BA</option><option>CE</option><option>DF</option><option>ES</option>
          <option>GO</option><option>MA</option><option>MT</option><option>MS</option>
          <option>MG</option><option>PA</option><option>PB</option><option>PR</option>
          <option>PE</option><option>PI</option><option>RJ</option><option>RN</option>
          <option>RS</option><option>RO</option><option>RR</option><option>SC</option>
          <option>SP</option><option>SE</option><option>TO</option>
        </select>
      </div>
      <div class="campo-ficha">
        <label>Resultado da Sentença</label>
        <select id="p${id}_resultado">
          <option value="">Auto-detectar</option>
          <option value="procedente">Favorável</option>
          <option value="improcedente">Desfavorável</option>
          <option value="parcialmente_procedente">Parcialmente Favorável</option>
        </select>
      </div>
    </div>

    <div class="ficha-docs-titulo">📎 Documentos do Processo</div>
    <div class="ficha-docs">
      <div class="doc-slot" id="slot-inicial-${id}" onclick="selecionarDoc(${id},'inicial')">
        <div class="doc-slot-icon">📄</div>
        <div class="doc-slot-label">Petição Inicial</div>
        <div class="doc-slot-nome" id="nome-inicial-${id}">Nenhum arquivo</div>
        <input type="file" id="file-inicial-${id}" accept=".pdf" style="display:none"
          onchange="onDocSelecionado(${id},'inicial',this)"/>
      </div>
      <div class="doc-slot" id="slot-laudo-${id}" onclick="selecionarDoc(${id},'laudo')">
        <div class="doc-slot-icon">🩺</div>
        <div class="doc-slot-label">Laudo Pericial</div>
        <div class="doc-slot-nome" id="nome-laudo-${id}">Nenhum arquivo</div>
        <input type="file" id="file-laudo-${id}" accept=".pdf" style="display:none"
          onchange="onDocSelecionado(${id},'laudo',this)"/>
      </div>
      <div class="doc-slot" id="slot-sentenca-${id}" onclick="selecionarDoc(${id},'sentenca')">
        <div class="doc-slot-icon">⚖️</div>
        <div class="doc-slot-label">Sentença</div>
        <div class="doc-slot-nome" id="nome-sentenca-${id}">Nenhum arquivo</div>
        <input type="file" id="file-sentenca-${id}" accept=".pdf" style="display:none"
          onchange="onDocSelecionado(${id},'sentenca',this)"/>
      </div>
    </div>

    <div style="display:flex; justify-content:flex-end; margin-top:20px">
      <button class="btn btn-primary" onclick="enviarFicha(${id})">
        📤 Enviar Processo ${fichaCount}
      </button>
    </div>
  `;
  container.appendChild(div);
  div.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function removerFicha(id) {
  document.getElementById(`ficha-${id}`)?.remove();
}

function selecionarDoc(fichaId, tipo) {
  document.getElementById(`file-${tipo}-${fichaId}`).click();
}

function onDocSelecionado(fichaId, tipo, input) {
  const file = input.files[0];
  const nomeEl = document.getElementById(`nome-${tipo}-${fichaId}`);
  const slot = document.getElementById(`slot-${tipo}-${fichaId}`);
  if (file) {
    nomeEl.textContent = file.name;
    slot.classList.add('doc-slot-preenchido');
  } else {
    nomeEl.textContent = 'Nenhum arquivo';
    slot.classList.remove('doc-slot-preenchido');
  }
}

async function enviarFicha(id) {
  const get = campo => (document.getElementById(`p${id}_${campo}`)?.value || '').trim();

  const docs = [
    { tipo: 'inicial', file: document.getElementById(`file-inicial-${id}`)?.files[0] },
    { tipo: 'laudo',   file: document.getElementById(`file-laudo-${id}`)?.files[0] },
    { tipo: 'sentenca',file: document.getElementById(`file-sentenca-${id}`)?.files[0] },
  ].filter(d => d.file);

  if (docs.length === 0) {
    toast('Selecione ao menos um documento PDF', 'error');
    return;
  }

  const progBox = document.getElementById('upload-progresso');
  const progLista = document.getElementById('progresso-lista');
  progBox.style.display = 'block';
  progLista.innerHTML = '';
  progBox.scrollIntoView({ behavior: 'smooth' });

  let ok = 0;
  for (const doc of docs) {
    const item = document.createElement('div');
    item.className = 'prog-item';
    item.innerHTML = `<div class="prog-status prog-load">⟳</div><span><strong>${doc.file.name}</strong> (${doc.tipo}) — enviando...</span>`;
    progLista.appendChild(item);

    try {
      const form = new FormData();
      form.append('file', doc.file);
      form.append('tipo_documento', doc.tipo);
      form.append('numero_processo', get('numero_processo'));
      form.append('nome_parte',      get('nome_parte'));
      form.append('cid_principal',   get('cid_principal'));
      form.append('parte_corpo',     get('parte_corpo'));
      form.append('profissao',       get('profissao'));
      form.append('comarca',         get('comarca'));
      form.append('resultado',       get('resultado'));

      const res = await fetch('/api/upload', { method: 'POST', body: form });
      const data = await res.json();

      if (res.ok && data.sucesso) {
        ok++;
        const infos = [
          badgeTipo(doc.tipo),
          data.cid_principal ? `CID: ${data.cid_principal}` : '',
          data.resultado ? badgeResultado(data.resultado) : '',
        ].filter(Boolean).join(' &nbsp;');
        item.innerHTML = `<div class="prog-status prog-ok">✓</div><span><strong>${doc.file.name}</strong> — ${infos}</span>`;
      } else {
        item.innerHTML = `<div class="prog-status prog-err">✗</div><span><strong>${doc.file.name}</strong> — Erro: ${data.detail || 'desconhecido'}</span>`;
      }
    } catch (e) {
      item.innerHTML = `<div class="prog-status prog-err">✗</div><span><strong>${doc.file.name}</strong> — Erro de conexão</span>`;
    }
  }

  toast(`${ok} de ${docs.length} documento(s) enviado(s) com sucesso!`, ok > 0 ? 'success' : 'error');
}

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
          <td style="white-space:nowrap">
            <button class="btn btn-edit btn-sm" onclick='abrirModal(${JSON.stringify(d)})'>✏️</button>
            <button class="btn btn-danger btn-sm" onclick="deletarProcesso(${d.id})">🗑</button>
          </td>
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
        <td style="white-space:nowrap">
          <button class="btn btn-edit btn-sm" onclick='abrirModal(${JSON.stringify(p)})'>✏️</button>
          <button class="btn btn-danger btn-sm" onclick="deletarProcesso(${p.id})">🗑</button>
        </td>
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

// ─── MODAL DE EDIÇÃO ─────────────────────────────────────────────────────────
function abrirModal(p) {
  document.getElementById('edit-id').value = p.id;
  document.getElementById('edit-numero_processo').value = p.numero_processo || '';
  document.getElementById('edit-nome_parte').value = p.nome_parte || '';
  document.getElementById('edit-tipo_documento').value = p.tipo_documento || '';
  document.getElementById('edit-cid_principal').value = p.cid_principal || '';
  document.getElementById('edit-parte_corpo').value = p.parte_corpo || '';
  document.getElementById('edit-profissao').value = p.profissao || '';
  document.getElementById('edit-comarca').value = p.comarca || '';
  document.getElementById('edit-estado').value = p.estado || '';
  document.getElementById('edit-resultado').value = p.resultado || '';
  document.getElementById('edit-tipo_acidente').value = p.tipo_acidente || '';
  document.getElementById('edit-grau_incapacidade').value = p.grau_incapacidade || '';
  document.getElementById('modal-editar').style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function fecharModalBtn() {
  document.getElementById('modal-editar').style.display = 'none';
  document.body.style.overflow = '';
}

function fecharModal(e) {
  if (e.target.id === 'modal-editar') fecharModalBtn();
}

async function salvarEdicao() {
  const id = document.getElementById('edit-id').value;
  const get = campo => document.getElementById(`edit-${campo}`).value;

  const payload = {
    numero_processo: get('numero_processo'),
    nome_parte:      get('nome_parte'),
    tipo_documento:  get('tipo_documento'),
    cid_principal:   get('cid_principal'),
    parte_corpo:     get('parte_corpo'),
    profissao:       get('profissao'),
    comarca:         get('comarca'),
    estado:          get('estado'),
    resultado:       get('resultado'),
    tipo_acidente:   get('tipo_acidente'),
    grau_incapacidade: get('grau_incapacidade'),
  };

  try {
    const res = await fetch(`/api/processos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      toast(err.detail || 'Erro ao salvar', 'error');
      return;
    }
    fecharModalBtn();
    toast('Processo atualizado com sucesso!', 'success');
    carregarProcessosAgrupados();
    if (viewAtual === 'lista') carregarProcessos(paginaAtual * POR_PAGINA);
  } catch(e) {
    toast('Erro de conexão', 'error');
  }
}

// ─── INIT ─────────────────────────────────────────────────────────────────────
carregarDashboard();
adicionarFicha();
