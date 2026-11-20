const STORAGE_KEY = 'leonida-ledger-v1';

let trophies = [];
let earnedTrophies = new Set();
let currentView = 'checklist';
let selectedTrophyId = null;
let seedCount = 0;
let spoilerEnabled = true;

const roadmapStagesData = [
  {
    stage: 1,
    title: "Stage 1: Story Playthrough (Chapters 1–4 & Main Operations)",
    desc: "Dive into the narrative of Leonida. Complete all opening missions, chapters 1 through 4, and the grand finale operations in chronological order."
  },
  {
    stage: 2,
    title: "Stage 2: Strangers, Side Missions & Encounters",
    desc: "Explore Leonida's towns and highways to meet quirky characters, complete stranger strands, enjoy coastal bars, bowling, and witness roadside events."
  },
  {
    stage: 3,
    title: "Stage 3: Collectibles, Exploration & Properties",
    desc: "Uncover all 52 map regions, collect card sets, interact with 100 WAiNK sites, meditate at 18 spots, discover 100 vehicles, buy all 8 garages, and register vehicles."
  },
  {
    stage: 4,
    title: "Stage 4: Activities, Challenges & Combat Mastery",
    desc: "Dominate the 42 shooting range challenges for gold, win 20 races, conquer 14 drone races, land 250 stunt jumps, fish with Cal, rob banks and shops, and launder cash."
  },
  {
    stage: 5,
    title: "Stage 5: 100% Completion & Platinum Cleanup",
    desc: "Finish final cleanup tasks to attain 100% overall completion and unlock the ultimate Vice Got a Price! Platinum trophy."
  }
];

async function init() {
  try {
    const res = await fetch('data/trophies.json');
    const data = await res.json();
    trophies = data.trophies || [];
  } catch (err) {
    console.error('Failed to load trophies data:', err);
    trophies = [];
  }

  loadProgress();
  parseQueryParams();
  setupEventListeners();
  
  // CRITICAL VIEW-INIT FIX: switchView must activate panel and then render
  switchView(currentView);

  if (selectedTrophyId !== null) {
    selectTrophy(selectedTrophyId);
  } else if (trophies.length > 0) {
    // Select first trophy by default if none selected
    selectTrophy(trophies[0].id);
  }

  // Shot readiness for screenshots
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      window.__shotReady = true;
      updateShotDebug();
    });
  });
}

function loadProgress() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const arr = JSON.parse(saved);
      earnedTrophies = new Set(arr);
    } catch (e) {
      earnedTrophies = new Set();
    }
  }
}

function saveProgress() {
  if (seedCount > 0) return; // Do not overwrite localStorage during seeded screenshot runs
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...earnedTrophies]));
}

function parseQueryParams() {
  const params = new URLSearchParams(window.location.search);
  
  const viewParam = params.get('view');
  if (['checklist', 'roadmap', 'missables'].includes(viewParam)) {
    currentView = viewParam;
  }

  const trophyParam = params.get('trophy');
  if (trophyParam) {
    const id = parseInt(trophyParam, 10);
    if (!isNaN(id)) {
      selectedTrophyId = id;
    }
  }

  const seedParam = params.get('seed');
  if (seedParam) {
    const n = parseInt(seedParam, 10);
    if (!isNaN(n) && n > 0) {
      seedCount = n;
      earnedTrophies.clear();
      for (let i = 0; i < Math.min(n, trophies.length); i++) {
        earnedTrophies.add(trophies[i].id);
      }
    }
  }

  const spoilerParam = params.get('spoiler');
  if (spoilerParam === 'off') {
    spoilerEnabled = false;
    const toggle = document.getElementById('spoiler-toggle');
    if (toggle) toggle.checked = false;
  }
}

function switchView(view) {
  currentView = view;
  
  // (a) Set .active class on selected panel and remove from others
  document.querySelectorAll('.view-panel').forEach(panel => {
    panel.classList.remove('active');
  });
  const targetPanel = document.getElementById(`${view}-panel`);
  if (targetPanel) {
    targetPanel.classList.add('active');
  }

  // (b) Update tab state
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
    if (btn.getAttribute('data-view') === view) {
      btn.classList.add('active');
    }
  });

  // (c) Call render AFTER panel is active
  render();
  updateShotDebug();
}

function setupEventListeners() {
  // Tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.getAttribute('data-view');
      if (view) switchView(view);
    });
  });

  // Checklist filters
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', () => renderChecklist());
  }

  const kindFilter = document.getElementById('kind-filter');
  if (kindFilter) {
    kindFilter.addEventListener('change', () => renderChecklist());
  }

  const gradeFilter = document.getElementById('grade-filter');
  if (gradeFilter) {
    gradeFilter.addEventListener('change', () => renderChecklist());
  }

  const spoilerToggle = document.getElementById('spoiler-toggle');
  if (spoilerToggle) {
    spoilerToggle.addEventListener('change', (e) => {
      spoilerEnabled = e.target.checked;
      renderChecklist();
    });
  }

  // Actions
  const exportBtn = document.getElementById('export-btn');
  if (exportBtn) {
    exportBtn.addEventListener('click', exportProgress);
  }

  const importBtn = document.getElementById('import-btn');
  const importFile = document.getElementById('import-file');
  if (importBtn && importFile) {
    importBtn.addEventListener('click', () => importFile.click());
    importFile.addEventListener('change', importProgress);
  }

  const resetBtn = document.getElementById('reset-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', resetProgress);
  }
}

function render() {
  renderHeaderStats();
  if (currentView === 'checklist') {
    renderChecklist();
  } else if (currentView === 'roadmap') {
    renderRoadmap();
  } else if (currentView === 'missables') {
    renderMissables();
  }
}

function renderHeaderStats() {
  const total = trophies.length;
  const earned = earnedTrophies.size;
  const pct = total > 0 ? Math.round((earned / total) * 100) : 0;

  document.getElementById('progress-count').textContent = earned;
  document.getElementById('progress-pct').textContent = `${pct}%`;
  document.getElementById('progress-bar').style.width = `${pct}%`;

  const counts = { platinum: 0, gold: 0, silver: 0, bronze: 0 };
  const totals = { platinum: 0, gold: 0, silver: 0, bronze: 0 };

  trophies.forEach(t => {
    if (totals[t.grade] !== undefined) totals[t.grade]++;
    if (earnedTrophies.has(t.id) && counts[t.grade] !== undefined) {
      counts[t.grade]++;
    }
  });

  document.getElementById('count-platinum').textContent = `${counts.platinum}/${totals.platinum}`;
  document.getElementById('count-gold').textContent = `${counts.gold}/${totals.gold}`;
  document.getElementById('count-silver').textContent = `${counts.silver}/${totals.silver}`;
  document.getElementById('count-bronze').textContent = `${counts.bronze}/${totals.bronze}`;
}

function renderChecklist() {
  const listEl = document.getElementById('trophy-list');
  if (!listEl) return;

  const searchVal = (document.getElementById('search-input')?.value || '').toLowerCase();
  const kindVal = document.getElementById('kind-filter')?.value || 'all';
  const gradeVal = document.getElementById('grade-filter')?.value || 'all';

  const filtered = trophies.filter(t => {
    if (kindVal !== 'all' && t.kind !== kindVal) return false;
    if (gradeVal !== 'all' && t.grade !== gradeVal) return false;
    if (searchVal) {
      const matchName = t.name.toLowerCase().includes(searchVal);
      const matchDesc = t.description.toLowerCase().includes(searchVal);
      if (!matchName && !matchDesc) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    listEl.innerHTML = `<div style="padding: 2rem; text-align: center; color: var(--text-secondary);">No trophies match your filters.</div>`;
    return;
  }

  let html = '';
  filtered.forEach(t => {
    const isEarned = earnedTrophies.has(t.id);
    const isSelected = selectedTrophyId === t.id;
    const isHiddenStory = t.kind === 'story' && spoilerEnabled && !isEarned && t.id > 2 && t.id < 7;

    const displayName = isHiddenStory ? 'Hidden trophy — earn it to reveal' : t.name;
    const displayDesc = isHiddenStory ? 'Complete story progression to unlock and reveal this trophy details.' : t.description;

    html += `
      <div class="trophy-item ${isEarned ? 'earned' : ''} ${isSelected ? 'selected' : ''}" data-id="${t.id}">
        <input type="checkbox" class="trophy-checkbox" data-id="${t.id}" ${isEarned ? 'checked' : ''}>
        <span class="trophy-meta-badge ${t.grade}">${t.grade}</span>
        <div class="trophy-info">
          <div class="trophy-name">${escapeHtml(displayName)}</div>
          <div class="trophy-desc">${escapeHtml(displayDesc)}</div>
        </div>
      </div>
    `;
  });

  listEl.innerHTML = html;

  // Bind item clicks & checkbox changes
  listEl.querySelectorAll('.trophy-item').forEach(itemEl => {
    const id = parseInt(itemEl.getAttribute('data-id'), 10);
    
    itemEl.addEventListener('click', (e) => {
      if (e.target.tagName === 'INPUT') return; // let checkbox handle itself
      selectTrophy(id);
    });

    const checkbox = itemEl.querySelector('.trophy-checkbox');
    if (checkbox) {
      checkbox.addEventListener('change', (e) => {
        const checked = e.target.checked;
        if (checked) {
          earnedTrophies.add(id);
        } else {
          earnedTrophies.delete(id);
        }
        saveProgress();
        renderHeaderStats();
        renderChecklist();
      });
    }
  });

  if (selectedTrophyId !== null) {
    renderGuidePane(selectedTrophyId);
  }
}

function selectTrophy(id) {
  selectedTrophyId = id;
  document.querySelectorAll('.trophy-item').forEach(el => {
    if (parseInt(el.getAttribute('data-id'), 10) === id) {
      el.classList.add('selected');
    } else {
      el.classList.remove('selected');
    }
  });
  renderGuidePane(id);
}

function renderGuidePane(id) {
  const paneEl = document.getElementById('guide-pane');
  if (!paneEl) return;

  const t = trophies.find(item => item.id === id);
  if (!t) {
    paneEl.innerHTML = `<h3>Trophy Not Found</h3>`;
    return;
  }

  const isEarned = earnedTrophies.has(id);
  const isHiddenStory = t.kind === 'story' && spoilerEnabled && !isEarned && t.id > 2 && t.id < 7;

  const displayName = isHiddenStory ? 'Hidden trophy — earn it to reveal' : t.name;
  const displayDesc = isHiddenStory ? 'Complete story progression to unlock and reveal this trophy details.' : t.description;
  const displayGuide = isHiddenStory ? 'Earn this hidden story trophy during campaign progression to reveal its complete guide strategy.' : t.guide;

  let sourcesHtml = '';
  if (t.sources && t.sources.length > 0) {
    sourcesHtml = `
      <div class="guide-sources">
        <h4>Sources &amp; References</h4>
        <ul>
          ${t.sources.map(src => {
            // Convert URLs in source string to clickable links
            const linked = src.replace(/(https?:\/\/[^\s)]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
            return `<li>${linked}</li>`;
          }).join('')}
        </ul>
      </div>
    `;
  }

  paneEl.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; margin-bottom: 0.5rem;">
      <h3 style="margin: 0;">${escapeHtml(displayName)}</h3>
      <span class="trophy-meta-badge ${t.grade}">${t.grade}</span>
    </div>
    <div class="guide-tags">
      <span class="tag">Kind: ${t.kind}</span>
      <span class="tag">Stage: ${t.stage}</span>
      ${t.missable ? '<span class="tag missable">Missable</span>' : '<span class="tag">Missable: No</span>'}
      <span class="tag">${isEarned ? 'Status: Earned' : 'Status: Unearned'}</span>
    </div>
    <p style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 1rem; font-style: italic;">"${escapeHtml(displayDesc)}"</p>
    <div class="guide-body">${escapeHtml(displayGuide)}</div>
    ${sourcesHtml}
  `;
}

function renderRoadmap() {
  const container = document.getElementById('roadmap-stages');
  if (!container) return;

  let html = '';
  roadmapStagesData.forEach(stageObj => {
    const stageTrophies = trophies.filter(t => t.stage === stageObj.stage);
    
    let chipsHtml = '';
    stageTrophies.forEach(t => {
      const isEarned = earnedTrophies.has(t.id);
      chipsHtml += `<span class="stage-trophy-chip ${isEarned ? 'earned' : ''}" data-id="${t.id}">${escapeHtml(t.name)} (${t.grade})</span>`;
    });

    html += `
      <div class="roadmap-stage">
        <h3>${escapeHtml(stageObj.title)}</h3>
        <p class="stage-desc">${escapeHtml(stageObj.desc)}</p>
        <div class="stage-trophies">
          ${chipsHtml}
        </div>
      </div>
    `;
  });

  container.innerHTML = html;

  // Bind clicks on roadmap chips to switch to checklist and select trophy
  container.querySelectorAll('.stage-trophy-chip').forEach(chip => {
    const id = parseInt(chip.getAttribute('data-id'), 10);
    chip.addEventListener('click', () => {
      selectedTrophyId = id;
      switchView('checklist');
    });
  });
}

function renderMissables() {
  const container = document.getElementById('missables-list');
  if (!container) return;

  const missables = trophies.filter(t => t.missable);

  if (missables.length === 0) {
    container.innerHTML = `<div style="padding: 2rem; text-align: center; color: var(--text-secondary);">No missable trophies flagged.</div>`;
    return;
  }

  let html = '';
  missables.forEach(t => {
    const isEarned = earnedTrophies.has(t.id);
    html += `
      <div class="missable-card">
        <div class="missable-header">
          <strong style="font-size: 1rem; color: var(--text-primary);">${escapeHtml(t.name)}</strong>
          <span class="trophy-meta-badge ${t.grade}">${t.grade}</span>
        </div>
        <p style="font-size: 0.85rem; color: var(--text-secondary);">"${escapeHtml(t.description)}"</p>
        <p style="font-size: 0.9rem; color: var(--text-primary); margin-top: 0.25rem;"><strong>Guide Warning:</strong> ${escapeHtml(t.guide)}</p>
        <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.25rem;">
          Status: ${isEarned ? '<span style="color: var(--success); font-weight: 600;">Earned</span>' : '<span style="color: #ff7b72; font-weight: 600;">Not Earned Yet</span>'} | Stage ${t.stage}
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

function exportProgress() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify([...earnedTrophies], null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", "leonida-ledger-progress.json");
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

function importProgress(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(event) {
    try {
      const arr = JSON.parse(event.target.result);
      if (Array.isArray(arr)) {
        earnedTrophies = new Set(arr);
        saveProgress();
        render();
        alert('Progress imported successfully!');
      } else {
        alert('Invalid progress file format.');
      }
    } catch (err) {
      alert('Error parsing JSON file.');
    }
  };
  reader.readAsText(file);
}

function resetProgress() {
  if (confirm('Are you sure you want to reset all earned trophies?')) {
    earnedTrophies.clear();
    saveProgress();
    render();
  }
}

function updateShotDebug() {
  const debugEl = document.getElementById('shot-debug');
  if (debugEl) {
    debugEl.textContent = `shot-ok view=${currentView} earned=${earnedTrophies.size}`;
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

document.addEventListener('DOMContentLoaded', init);
