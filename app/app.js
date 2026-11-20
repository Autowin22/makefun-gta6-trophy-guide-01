// Leonida Ledger - Grand Theft Auto VI Trophy Guide & Tracker
// ES Module app.js

let trophies = [];
let earnedTrophies = new Set();
let currentView = 'checklist';
let selectedTrophyId = null;
let seedCount = 0;
let spoilerEnabled = true;

const STORAGE_KEY = 'leonida-ledger-v1';

async function init() {
  try {
    const res = await fetch('data/trophies.json');
    if (!res.ok) throw new Error('Failed to load trophies data');
    const data = await res.json();
    trophies = data.trophies || [];
  } catch (err) {
    console.error(err);
    trophies = [];
  }

  loadProgress();
  parseUrlParams();
  setupEventListeners();
  render();

  // Shot readiness for automated testing / screenshot capturing
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      window.__shotReady = true;
      updateShotDebug();
    });
  });
}

function loadProgress() {
  const urlParams = new URLSearchParams(window.location.search);
  const seedParam = urlParams.get('seed');
  if (seedParam !== null) {
    seedCount = parseInt(seedParam, 10) || 0;
    earnedTrophies.clear();
    for (let i = 0; i < Math.min(seedCount, trophies.length); i++) {
      earnedTrophies.add(trophies[i].id);
    }
    return;
  }

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const arr = JSON.parse(saved);
      if (Array.isArray(arr)) {
        earnedTrophies = new Set(arr);
      }
    }
  } catch (e) {
    console.error('Failed to load progress from localStorage', e);
  }
}

function saveProgress() {
  // If seeded via URL, do not persist to localStorage
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('seed') !== null) return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(earnedTrophies)));
  } catch (e) {
    console.error('Failed to save progress to localStorage', e);
  }
}

function parseUrlParams() {
  const params = new URLSearchParams(window.location.search);
  const view = params.get('view');
  if (['checklist', 'roadmap', 'missables'].includes(view)) {
    currentView = view;
  }

  const trophy = params.get('trophy');
  if (trophy) {
    const id = parseInt(trophy, 10);
    if (!isNaN(id)) {
      selectedTrophyId = id;
    }
  }

  const spoiler = params.get('spoiler');
  if (spoiler === 'off') {
    spoilerEnabled = false;
    const toggle = document.getElementById('spoiler-toggle');
    if (toggle) toggle.checked = false;
  } else if (spoiler === 'on') {
    spoilerEnabled = true;
    const toggle = document.getElementById('spoiler-toggle');
    if (toggle) toggle.checked = true;
  }
}

function setupEventListeners() {
  // Tab navigation
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const view = e.currentTarget.getAttribute('data-view');
      switchView(view);
    });
  });

  // Search & filters
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', () => renderChecklist());
  }

  const filterKind = document.getElementById('filter-kind');
  if (filterKind) {
    filterKind.addEventListener('change', () => renderChecklist());
  }

  const filterGrade = document.getElementById('filter-grade');
  if (filterGrade) {
    filterGrade.addEventListener('change', () => renderChecklist());
  }

  const spoilerToggle = document.getElementById('spoiler-toggle');
  if (spoilerToggle) {
    spoilerToggle.addEventListener('change', (e) => {
      spoilerEnabled = e.target.checked;
      render();
    });
  }

  // Export / Import / Reset
  const exportBtn = document.getElementById('export-btn');
  if (exportBtn) {
    exportBtn.addEventListener('click', exportProgress);
  }

  const importFile = document.getElementById('import-file');
  if (importFile) {
    importFile.addEventListener('change', importProgress);
  }

  const resetBtn = document.getElementById('reset-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', resetProgress);
  }
}

function switchView(view) {
  currentView = view;
  document.querySelectorAll('.tab-btn').forEach(btn => {
    if (btn.getAttribute('data-view') === view) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  document.querySelectorAll('.view-panel').forEach(panel => {
    panel.classList.remove('active');
  });

  const targetPanel = document.getElementById(`view-${view}`);
  if (targetPanel) {
    targetPanel.classList.add('active');
  }

  const toolbar = document.getElementById('toolbar');
  if (toolbar) {
    toolbar.style.display = (view === 'checklist') ? 'flex' : 'none';
  }

  render();
}

function render() {
  updateHeaderStats();
  if (currentView === 'checklist') {
    renderChecklist();
  } else if (currentView === 'roadmap') {
    renderRoadmap();
  } else if (currentView === 'missables') {
    renderMissables();
  }

  if (selectedTrophyId !== null) {
    renderGuideDetail(selectedTrophyId);
  }
  updateShotDebug();
}

function updateHeaderStats() {
  const total = trophies.length;
  const earned = earnedTrophies.size;
  const pct = total > 0 ? Math.round((earned / total) * 100) : 0;

  const earnedEl = document.getElementById('earned-count');
  const totalEl = document.getElementById('total-count');
  const pctEl = document.getElementById('percent-complete');
  const fillEl = document.getElementById('progress-bar-fill');

  if (earnedEl) earnedEl.textContent = earned;
  if (totalEl) totalEl.textContent = total;
  if (pctEl) pctEl.textContent = pct + '%';
  if (fillEl) fillEl.style.width = pct + '%';

  // Counts by grade
  let counts = { platinum: [0, 1], gold: [0, 3], silver: [0, 7], bronze: [0, 44] };
  trophies.forEach(t => {
    if (counts[t.grade]) {
      counts[t.grade][1]++;
      if (earnedTrophies.has(t.id)) {
        counts[t.grade][0]++;
      }
    }
  });

  // Re-tally exact counts from trophies data
  counts = { platinum: [0, 0], gold: [0, 0], silver: [0, 0], bronze: [0, 0] };
  trophies.forEach(t => {
    if (counts[t.grade]) {
      counts[t.grade][1]++;
      if (earnedTrophies.has(t.id)) {
        counts[t.grade][0]++;
      }
    }
  });

  const platEl = document.getElementById('plat-count');
  const goldEl = document.getElementById('gold-count');
  const silverEl = document.getElementById('silver-count');
  const bronzeEl = document.getElementById('bronze-count');

  if (platEl) platEl.textContent = `${counts.platinum[0]}/${counts.platinum[1]}`;
  if (goldEl) goldEl.textContent = `${counts.gold[0]}/${counts.gold[1]}`;
  if (silverEl) silverEl.textContent = `${counts.silver[0]}/${counts.silver[1]}`;
  if (bronzeEl) bronzeEl.textContent = `${counts.bronze[0]}/${counts.bronze[1]}`;
}

function renderChecklist() {
  const listEl = document.getElementById('trophies-list');
  if (!listEl) return;

  const searchInput = document.getElementById('search-input');
  const filterKind = document.getElementById('filter-kind');
  const filterGrade = document.getElementById('filter-grade');

  const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
  const kindVal = filterKind ? filterKind.value : 'all';
  const gradeVal = filterGrade ? filterGrade.value : 'all';

  const filtered = trophies.filter(t => {
    const isEarned = earnedTrophies.has(t.id);
    const isHidden = t.hidden && !isEarned && spoilerEnabled;

    if (kindVal !== 'all') {
      if (kindVal === 'missable') {
        if (!t.missable) return false;
      } else if (t.kind !== kindVal) {
        return false;
      }
    }

    if (gradeVal !== 'all' && t.grade !== gradeVal) {
      return false;
    }

    if (query) {
      const nameMatch = isHidden ? 'hidden trophy'.includes(query) : t.name.toLowerCase().includes(query);
      const descMatch = isHidden ? false : t.description.toLowerCase().includes(query);
      if (!nameMatch && !descMatch) return false;
    }

    return true;
  });

  if (filtered.length === 0) {
    listEl.innerHTML = `<div class="detail-placeholder"><h3>No trophies found</h3><p>Try adjusting your search query or filters.</p></div>`;
    return;
  }

  listEl.innerHTML = filtered.map(t => {
    const isEarned = earnedTrophies.has(t.id);
    const isHidden = t.hidden && !isEarned && spoilerEnabled;
    const displayName = isHidden ? 'Hidden Trophy — Earn it to reveal' : t.name;
    const displayDesc = isHidden ? 'Complete story progression to unveil this secret trophy.' : t.description;

    return `
      <div class="trophy-card ${isEarned ? 'earned' : ''}" data-id="${t.id}">
        <input type="checkbox" class="trophy-checkbox" data-id="${t.id}" ${isEarned ? 'checked' : ''} aria-label="Mark ${t.name} as earned">
        <div class="trophy-medal-icon medal-${t.grade}" title="${t.grade}">${t.grade[0].toUpperCase()}</div>
        <div class="trophy-info">
          <div class="trophy-header-row">
            <span class="trophy-title">${displayName}</span>
            <div class="trophy-tags">
              <span class="tag">${t.grade}</span>
              <span class="tag">${t.kind}</span>
              ${t.missable ? '<span class="tag tag-missable">Missable</span>' : ''}
              ${t.hidden ? '<span class="tag">Secret</span>' : ''}
            </div>
          </div>
          <div class="trophy-desc ${isHidden ? 'hidden-trophy-text' : ''}">${displayDesc}</div>
        </div>
      </div>
    `;
  }).join('');

  // Attach event listeners for checkboxes and card clicks
  listEl.querySelectorAll('.trophy-checkbox').forEach(chk => {
    chk.addEventListener('click', (e) => e.stopPropagation());
    chk.addEventListener('change', (e) => {
      const id = parseInt(e.currentTarget.getAttribute('data-id'), 10);
      if (e.currentTarget.checked) {
        earnedTrophies.add(id);
      } else {
        earnedTrophies.delete(id);
      }
      saveProgress();
      updateHeaderStats();
      // re-render checklist items to update earned classes without losing scroll if possible
      renderChecklist();
      if (selectedTrophyId === id) {
        renderGuideDetail(id);
      }
    });
  });

  listEl.querySelectorAll('.trophy-card').forEach(card => {
    card.addEventListener('click', (e) => {
      const id = parseInt(e.currentTarget.getAttribute('data-id'), 10);
      selectedTrophyId = id;
      renderGuideDetail(id);
    });
  });
}

function renderGuideDetail(id) {
  const pane = document.getElementById('guide-detail-pane');
  if (!pane) return;

  const t = trophies.find(item => item.id === id);
  if (!t) {
    pane.innerHTML = `<div class="detail-placeholder"><h3>Select a Trophy</h3><p>Click any trophy in the checklist or roadmap to view its guide.</p></div>`;
    return;
  }

  const isEarned = earnedTrophies.has(t.id);
  const isHidden = t.hidden && !isEarned && spoilerEnabled;
  const displayName = isHidden ? 'Hidden Trophy — Earn it to reveal' : t.name;
  const displayDesc = isHidden ? 'Complete story progression to unveil this secret trophy description and guide.' : t.description;
  const displayGuide = isHidden ? 'This is a hidden story trophy. Earn it in-game or uncheck "Hide Spoilers" in the toolbar to reveal strategy guidance.' : (t.guide || 'Guide details coming soon.');

  const sourcesHtml = (t.sources && t.sources.length > 0 && !isHidden) ? `
    <div class="sources-section">
      <h4>Sources & Citations</h4>
      <ul class="sources-list">
        ${t.sources.map(s => `<li><a href="${s.url}" target="_blank" rel="noopener noreferrer">${s.name} (${s.url})</a></li>`).join('')}
      </ul>
    </div>
  ` : '';

  pane.innerHTML = `
    <div class="detail-content">
      <div class="trophy-header-row" style="margin-bottom: 0.75rem;">
        <div class="trophy-medal-icon medal-${t.grade}">${t.grade[0].toUpperCase()}</div>
        <div>
          <h2>${displayName}</h2>
          <div class="detail-meta">
            <span class="tag">${t.grade}</span>
            <span class="tag">Stage ${t.stage}</span>
            <span class="tag">${t.kind}</span>
            ${t.missable ? '<span class="tag tag-missable">Missable</span>' : ''}
          </div>
        </div>
      </div>
      <div class="detail-desc">${displayDesc}</div>
      <div class="guide-section">
        <h4>Trophy Guide & Strategy</h4>
        <p class="guide-text">${displayGuide}</p>
      </div>
      ${sourcesHtml}
    </div>
  `;
}

function renderRoadmap() {
  const roadmapEl = document.getElementById('view-roadmap');
  if (!roadmapEl) return;

  const stages = [
    { num: 1, title: "Stage 1: Story Playthrough", desc: "Covers chapters 1-4 and all primary narrative missions in order. Focus purely on enjoying the story while knocking out campaign milestones and early side encounters." },
    { num: 2, title: "Stage 2: Stranger Strands & Side Missions", desc: "Covers stranger character strands across Leonida (Andy, Kenton, Billy, Randy, Tyrone, Bret). Warning: Side strands may be missable if advanced past story gates." },
    { num: 3, title: "Stage 3: Collectibles & Exploration", desc: "Covers Don't Touch My Deck (3 card sets), You WAiNKer! (100 WAiNK sightseeing locations), Whip It Good (100 vehicles), and The Goodtime State (explore all 52 areas of Leonida)." },
    { num: 4, title: "Stage 4: Activities & Challenges", desc: "Covers Cunning Stunts (250 stunts), The Shootist (42 shooting range gold medals), Top Fun (14 drone races), Earn Cash, Not Kudos (20 races), fishing, arcade, robberies, launder $250k, and properties." },
    { num: 5, title: "Stage 5: Cleanup to 100% & Platinum", desc: "Covers A Long Road (100% completion) and earning any remaining cleanup trophies before unlocking the Vice Got a Price! Platinum." }
  ];

  roadmapEl.innerHTML = `
    <div class="roadmap-container">
      <div class="roadmap-notice">
        Roadmap built from the official trophy descriptions.
      </div>
      ${stages.map(stage => {
        const stageTrophies = trophies.filter(t => t.stage === stage.num);
        return `
          <div class="roadmap-stage-card">
            <div class="roadmap-stage-header">
              <div class="stage-number">${stage.num}</div>
              <h3>${stage.title}</h3>
            </div>
            <p class="roadmap-stage-desc">${stage.desc}</p>
            <div class="roadmap-trophies-list">
              ${stageTrophies.map(t => {
                const isEarned = earnedTrophies.has(t.id);
                const isHidden = t.hidden && !isEarned && spoilerEnabled;
                const displayName = isHidden ? 'Hidden Trophy' : t.name;
                return `
                  <div class="roadmap-trophy-item ${isEarned ? 'earned' : ''}" data-id="${t.id}">
                    <div>
                      <strong style="font-size: 0.9rem; display: block; color: var(--text-primary);">${displayName}</strong>
                      <span style="font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase;">${t.grade} • ${t.kind}</span>
                    </div>
                    <span style="font-size: 0.8rem; color: ${isEarned ? 'var(--success-color)' : 'var(--text-muted)'};">${isEarned ? '✓ Earned' : 'Pending'}</span>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;

  roadmapEl.querySelectorAll('.roadmap-trophy-item').forEach(item => {
    item.addEventListener('click', (e) => {
      const id = parseInt(e.currentTarget.getAttribute('data-id'), 10);
      selectedTrophyId = id;
      switchView('checklist');
    });
  });
}

function renderMissables() {
  const missablesEl = document.getElementById('view-missables');
  if (!missablesEl) return;

  const missables = trophies.filter(t => t.missable);

  missablesEl.innerHTML = `
    <div class="missables-container">
      <div class="missables-notice">
        Note: The missable flags are the guide's reading of the official descriptions and not yet verified in-game (GTA 6 launched 2026-11-19, one day ago).
      </div>
      ${missables.map(t => {
        const isEarned = earnedTrophies.has(t.id);
        const isHidden = t.hidden && !isEarned && spoilerEnabled;
        const displayName = isHidden ? 'Hidden Trophy — Earn it to reveal' : t.name;
        const displayDesc = isHidden ? 'Complete story progression to unveil this secret trophy.' : t.description;

        return `
          <div class="missable-card">
            <div class="missable-card-header">
              <div style="display: flex; align-items: center; gap: 0.75rem;">
                <div class="trophy-medal-icon medal-${t.grade}">${t.grade[0].toUpperCase()}</div>
                <div>
                  <h3 style="font-size: 1.05rem; color: var(--text-primary);">${displayName}</h3>
                  <span style="font-size: 0.8rem; color: var(--text-secondary);">${t.grade} • Stage ${t.stage}</span>
                </div>
              </div>
              <span class="tag tag-missable">Missable</span>
            </div>
            <p style="font-size: 0.9rem; color: var(--text-secondary);">${displayDesc}</p>
            <div class="missable-warning">
              <strong>Missable Warning / Strategy:</strong> ${t.guide}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function exportProgress() {
  const data = {
    game: "Grand Theft Auto VI",
    earnedTrophies: Array.from(earnedTrophies),
    exportedAt: new Date().toISOString()
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'leonida-ledger-progress.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function importProgress(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const parsed = JSON.parse(event.target.result);
      if (parsed && Array.isArray(parsed.earnedTrophies)) {
        earnedTrophies = new Set(parsed.earnedTrophies);
        saveProgress();
        render();
        alert('Progress imported successfully!');
      } else {
        alert('Invalid progress file format.');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to parse JSON file.');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

function resetProgress() {
  if (confirm('Are you sure you want to reset all earned trophy progress?')) {
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

document.addEventListener('DOMContentLoaded', init);
