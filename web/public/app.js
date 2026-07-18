const SAMPLE_LESSON = `Why do seasons change?

Learning goal: Students will explain how Earth's tilted axis changes the sunlight a hemisphere receives during the year.

Warm-up (5 min): Students write why they think summer is warmer than winter, then share two ideas aloud.

Demonstration (7 min): Darken the room. Place a flashlight in the center and move a tilted globe around it. Ask students to watch how the bright spot changes. During the demonstration, define axis, tilt, direct light, and indirect light. After completing the full orbit, ask: “Why is it warmer in summer?”

Partner task (10 min): Give pairs a diagram of Earth at four positions around the Sun. Students label each position spring, summer, fall, or winter, then write one sentence explaining their labels.

Independent check (5 min): Explain why Earth’s tilt causes seasons.`;

const els = {
  lesson: document.querySelector('#lesson-text'),
  grade: document.querySelector('#grade-subject'),
  count: document.querySelector('#char-count'),
  sample: document.querySelector('#sample-button'),
  analyze: document.querySelector('#analyze-button'),
  modes: [...document.querySelectorAll('.mode-option')],
  modeNote: document.querySelector('#mode-note'),
  loading: document.querySelector('#loading-section'),
  progress: document.querySelector('#progress-bar'),
  loadingTitle: document.querySelector('#loading-title'),
  loadingMessage: document.querySelector('#loading-message'),
  agentStatuses: document.querySelector('#agent-statuses'),
  results: document.querySelector('#results'),
  resultTitle: document.querySelector('#result-title'),
  resultSummary: document.querySelector('#result-summary'),
  resultMode: document.querySelector('#result-mode'),
  export: document.querySelector('#export-button'),
  toast: document.querySelector('#toast'),
};

let mode = 'demo';
let lastAnalysis = null;
let liveAvailable = false;
let teacherDecisions = {};

const escapeHTML = (value = '') => String(value).replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const updateCount = () => { els.count.textContent = `${els.lesson.value.length.toLocaleString()} characters`; };

function showToast(message) {
  els.toast.textContent = message;
  els.toast.hidden = false;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => { els.toast.hidden = true; }, 3500);
}

function loadSample() {
  els.lesson.value = SAMPLE_LESSON;
  els.grade.value = 'Grade 6 · Earth science';
  updateCount();
  els.lesson.focus();
  els.lesson.setSelectionRange(0, 0);
}

async function checkHealth() {
  try {
    const response = await fetch('/api/health');
    const data = await response.json();
    liveAvailable = Boolean(data.live_available);
  } catch {
    liveAvailable = false;
  }
  const liveButton = els.modes.find(button => button.dataset.mode === 'live');
  liveButton.title = liveAvailable ? 'Analyze this lesson with GPT-5.6' : 'Set OPENAI_API_KEY before starting the server';
  updateModeNote();
}

function updateModeNote() {
  els.modeNote.textContent = mode === 'demo'
    ? 'No API key needed'
    : liveAvailable ? 'Uses gpt-5.6-sol' : 'API key not detected';
}

function selectMode(nextMode) {
  mode = nextMode;
  els.modes.forEach(button => button.classList.toggle('active', button.dataset.mode === mode));
  updateModeNote();
  if (mode === 'live' && !liveAvailable) {
    showToast('Set OPENAI_API_KEY, restart the server, then choose Live GPT-5.6.');
  }
}

function startLoading() {
  els.results.hidden = true;
  els.loading.hidden = false;
  els.analyze.disabled = true;
  els.progress.style.width = '8%';
  els.agentStatuses.innerHTML = ['Verbal reasoner', 'Language builder', 'Attention shifter', 'Pattern seeker']
    .map(label => `<span>${label}</span>`).join('');
  els.loading.scrollIntoView({behavior: 'smooth', block: 'center'});
  const stages = [
    [22, 'Delegating four learner lenses…', 350],
    [45, 'Each lens is finding evidence…', 900],
    [68, 'Challenging likely misconceptions…', 1500],
    [84, 'Reconciling the strongest interventions…', 2300],
    [91, 'The skeptic is verifying every evidence quote…', 18000],
    [96, 'Building the teacher-ready lesson redesign…', 42000],
  ];
  startLoading.timers = stages.map(([width, message, delay], index) => setTimeout(() => {
    els.progress.style.width = `${width}%`;
    els.loadingMessage.textContent = message;
    [...els.agentStatuses.children].slice(0, index + 1).forEach(item => item.classList.add('done'));
  }, delay));
}

function stopLoading() {
  (startLoading.timers || []).forEach(clearTimeout);
  els.progress.style.width = '100%';
  [...els.agentStatuses.children].forEach(item => item.classList.add('done'));
  els.analyze.disabled = false;
}

async function analyzeLesson() {
  const lessonText = els.lesson.value.trim();
  if (lessonText.length < 80) {
    showToast('Add a little more lesson detail—or load the sample lesson.');
    els.lesson.focus();
    return;
  }
  if (mode === 'live' && !liveAvailable) {
    showToast('Live mode needs OPENAI_API_KEY. Instant demo is ready now.');
    return;
  }
  startLoading();
  const started = Date.now();
  try {
    let data;
    if (mode === 'demo' && globalThis.CLASSROOM_MIRROR_DEMO) {
      const analysis = structuredClone(globalThis.CLASSROOM_MIRROR_DEMO);
      const gradeSubject = els.grade.value.trim();
      if (gradeSubject) analysis.meta.grade_subject = gradeSubject.slice(0, 80);
      data = {ok: true, analysis};
    } else {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ lesson_text: lessonText, grade_subject: els.grade.value.trim(), use_demo: mode === 'demo' }),
      });
      data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'Analysis failed');
    }
    const minimumAnimation = mode === 'demo' ? 2700 : 800;
    await new Promise(resolve => setTimeout(resolve, Math.max(0, minimumAnimation - (Date.now() - started))));
    lastAnalysis = data.analysis;
    stopLoading();
    renderAnalysis(data.analysis);
    setTimeout(() => {
      els.loading.hidden = true;
      els.results.hidden = false;
      els.results.scrollIntoView({behavior: 'smooth', block: 'start'});
    }, 320);
  } catch (error) {
    stopLoading();
    els.loadingTitle.textContent = 'The mirror needs a reset';
    els.loadingMessage.textContent = error.message;
    showToast(error.message);
  }
}

function renderAnalysis(data) {
  teacherDecisions = Object.fromEntries((data.verified_findings || []).map(item => [item.id, 'pending']));
  els.resultTitle.textContent = data.meta.lesson_title;
  els.resultSummary.textContent = data.meta.summary;
  els.resultMode.textContent = data.meta.mode === 'live' ? `${data.meta.model} · live` : 'Demo analysis';
  renderOverview(data);
  renderLearners(data.learner_agents);
  renderRedesign(data.lesson_revision);
  renderTicket(data.exit_ticket);
  document.querySelectorAll('.result-tab').forEach(button => button.classList.toggle('active', button.dataset.tab === 'overview'));
  document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.toggle('active', panel.id === 'tab-overview'));
}

function renderOverview(data) {
  const labels = {clarity: 'Concept clarity', engagement: 'Engagement', accessibility: 'Access & entry', cognitive_load: 'Cognitive ease'};
  const scores = Object.entries(data.scores).map(([key, value]) => `
    <article class="score-card">
      <span>${escapeHTML(labels[key] || key)}</span>
      <div class="score-value">${value}<small>/100</small></div>
      <div class="score-bar"><i style="width:${Math.max(0, Math.min(100, value))}%"></i></div>
    </article>`).join('');
  const misconceptions = data.misconceptions.map(item => `
    <article class="misconception-card">
      <div class="misconception-top"><strong>${escapeHTML(item.concept)}</strong><span class="risk ${escapeHTML(item.likelihood)}">${escapeHTML(item.likelihood)} likelihood</span></div>
      <p>${escapeHTML(item.why)}</p>
    </article>`).join('');
  const evidenceLedger = (data.verified_findings || []).map(item => `
    <article class="finding-card" data-finding="${escapeHTML(item.id)}">
      <div class="finding-top">
        <span class="finding-id">${escapeHTML(item.id)}</span>
        <strong>${escapeHTML(item.title)}</strong>
        <span class="verdict ${escapeHTML(item.verdict)}">${escapeHTML(item.verdict)}</span>
        <span class="confidence-pill">${item.confidence}% confidence</span>
      </div>
      <blockquote><span>Evidence · ${escapeHTML(item.evidence_location)}</span>“${escapeHTML(item.evidence_quote)}”</blockquote>
      <div class="finding-reasoning">
        <div><span>Finding</span><p>${escapeHTML(item.claim)}</p></div>
        <div class="skeptic"><span>Skeptic challenged</span><p>${escapeHTML(item.skeptic_challenge)}</p><small>${escapeHTML(item.verdict_reason)}</small></div>
      </div>
      <div class="finding-action">
        <p><span>Recommended change</span>${escapeHTML(item.intervention)}</p>
        <div class="decision-buttons" role="group" aria-label="Decision for ${escapeHTML(item.id)}">
          <button type="button" data-decision="accepted" data-id="${escapeHTML(item.id)}">Accept</button>
          <button type="button" data-decision="skipped" data-id="${escapeHTML(item.id)}">Skip</button>
        </div>
      </div>
    </article>`).join('');
  document.querySelector('#tab-overview').innerHTML = `
    <div class="score-grid">${scores}</div>
    <div class="overview-grid">
      <section class="misconceptions">
        <div class="section-heading"><h3>Misconceptions to intercept</h3><span>Before they stick</span></div>
        ${misconceptions}
      </section>
      <div class="metrics-column">
        <article class="metric-card"><strong>${data.metrics.students_reached}</strong><div><span>Learner lenses</span><small>reviewed in parallel</small></div></article>
        <article class="metric-card"><strong>${data.metrics.risks_found}</strong><div><span>Learning risks</span><small>surfaced with evidence</small></div></article>
        <article class="metric-card"><strong>${data.metrics.changes_made}</strong><div><span>Teacher moves</span><small>ready to use</small></div></article>
      </div>
    </div>
    <section class="evidence-ledger">
      <div class="section-heading"><div><span class="ledger-label">Adversarial verification</span><h3>Evidence ledger</h3></div><span>${data.verification?.rejected || 0} weak findings removed</span></div>
      <p class="ledger-intro">Every surviving claim is grounded in your lesson, challenged by a skeptic, and left for you—not the model—to accept.</p>
      ${evidenceLedger}
    </section>`;
}

function renderLearners(learners) {
  document.querySelector('#tab-learners').innerHTML = `<div class="learner-grid">${learners.map(learner => `
    <article class="learner-card">
      <div class="learner-head">
        <span class="learner-avatar">${escapeHTML(learner.avatar)}</span>
        <div><h3>${escapeHTML(learner.name)}</h3><p>${escapeHTML(learner.lens)}</p></div>
        <div class="confidence"><strong>${learner.confidence}%</strong><span>likely ready</span></div>
      </div>
      <blockquote class="learner-thought">“${escapeHTML(learner.thought)}”</blockquote>
      <div class="evidence-row"><span>Friction</span><p>${escapeHTML(learner.friction)}</p></div>
      <div class="evidence-row"><span>Evidence in the plan</span><p>${escapeHTML(learner.evidence)}</p></div>
      <div class="evidence-row intervention"><span>Try this</span><p>${escapeHTML(learner.intervention)}</p></div>
    </article>`).join('')}</div>`;
}

function renderRedesign(revision) {
  document.querySelector('#tab-redesign').innerHTML = `
    <div class="redesign-intro"><span>What changes</span><p>${escapeHTML(revision.original_problem)}</p></div>
    <section class="timeline">
      <div class="section-heading"><h3>A stronger learning path</h3><span>Goal preserved</span></div>
      ${revision.revised_sequence.map((item, index) => `
        <article class="timeline-step">
          <span class="timeline-time">${escapeHTML(item.time)}</span>
          <i class="timeline-dot">${String(index + 1).padStart(2, '0')}</i>
          <div class="timeline-copy"><strong>${escapeHTML(item.step)}</strong><p>${escapeHTML(item.teacher_move)}</p></div>
          <div class="learner-check"><span>Check for learning</span>${escapeHTML(item.learner_check)}</div>
        </article>`).join('')}
    </section>
    <div class="udl-card"><strong>Access by design</strong><p>${escapeHTML(revision.universal_design)}</p></div>`;
}

function renderTicket(ticket) {
  document.querySelector('#tab-ticket').innerHTML = `<div class="ticket-grid">${ticket.map((item, index) => `
    <article class="ticket-card">
      <div style="display:flex;align-items:center"><span class="ticket-number">${String(index + 1).padStart(2, '0')}</span><span class="ticket-type">${escapeHTML(item.type)}</span></div>
      <h3>${escapeHTML(item.question)}</h3>
      <div class="answer-look"><span>Listen / look for</span><p>${escapeHTML(item.answer_look_for)}</p></div>
    </article>`).join('')}</div>`;
}

function switchTab(tab) {
  document.querySelectorAll('.result-tab').forEach(button => button.classList.toggle('active', button.dataset.tab === tab));
  document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.toggle('active', panel.id === `tab-${tab}`));
}

function exportAnalysis() {
  if (!lastAnalysis) return;
  const blob = new Blob([JSON.stringify({...lastAnalysis, teacher_decisions: teacherDecisions}, null, 2)], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'classroom-mirror-analysis.json';
  link.click();
  URL.revokeObjectURL(url);
  showToast('Analysis exported.');
}

els.lesson.addEventListener('input', updateCount);
els.sample.addEventListener('click', loadSample);
els.analyze.addEventListener('click', analyzeLesson);
els.modes.forEach(button => button.addEventListener('click', () => selectMode(button.dataset.mode)));
els.export.addEventListener('click', exportAnalysis);
document.querySelectorAll('.result-tab').forEach(button => button.addEventListener('click', () => switchTab(button.dataset.tab)));
els.results.addEventListener('click', event => {
  const button = event.target.closest('[data-decision]');
  if (!button) return;
  const {id, decision} = button.dataset;
  teacherDecisions[id] = decision;
  const card = button.closest('.finding-card');
  card.querySelectorAll('[data-decision]').forEach(item => item.classList.toggle('selected', item.dataset.decision === decision));
  card.dataset.teacherDecision = decision;
  const accepted = Object.values(teacherDecisions).filter(value => value === 'accepted').length;
  showToast(decision === 'accepted' ? `Change accepted · ${accepted} selected` : 'Finding skipped · teacher judgment recorded');
});

loadSample();
checkHealth();
