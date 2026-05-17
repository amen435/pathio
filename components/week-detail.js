import {
  initCodeEditor,
  destroyCodeEditor,
  runCode,
  switchToFillBlanks,
} from './code-editor.js';

export async function openWeekDetail(weekId) {
    const detailPanel = document.getElementById('week-detail');
    if (!detailPanel) return;

    // Show loading state
    detailPanel.innerHTML = `
        <button class="close-modal-btn" onclick="closeWeekDetail()">×</button>
        <div class="empty-detail-state">Loading week ${weekId}...</div>
    `;
    detailPanel.classList.add('active');

    // Add backdrop if mobile/tablet
    if (window.innerWidth <= 1024) {
        let backdrop = document.getElementById('modal-backdrop');
        if (!backdrop) {
            backdrop = document.createElement('div');
            backdrop.id = 'modal-backdrop';
            backdrop.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); z-index:1999; backdrop-filter: blur(2px); transition: opacity 0.3s ease;';
            backdrop.onclick = window.closeWeekDetail;
            document.body.appendChild(backdrop);
        }
        backdrop.style.display = 'block';
    }

    try {
        const response = await fetch(`/api/roadmap/week/${weekId}`);
        let data;
        if (response.ok) {
            const resData = await response.json();
            data = resData.data || resData;
        } else {
            throw new Error('Fetch failed');
        }
        renderPanel(data);
    } catch (e) {
        console.warn('Using mock data for week detail:', e);
        // Mock data fallback matching specifications
        const mockData = {
            weekNumber: weekId,
            phase: "Foundation",
            topicName: "JavaScript\nFunctions",
            whyItMatters: "Functions are the building blocks of JavaScript. They allow you to reuse code, keep things organized, and build complex logic without repeating yourself.",
            explanation: "In this week, we'll dive deep into parameters, return values, arrow functions, and scoping rules. By the end, you'll be writing modular code.",
            videoUrl: "https://www.youtube.com/embed/nZ1DMMsyVyI", // Placeholder valid embed URL
            videoTitle: "Learn JS Functions in 15 Minutes",
            notebookCode: "function greet(name) {\n  return 'Hello, ' + name + '!';\n}\n\nconsole.log(greet('Amen'));",
            notebookLanguage: "javascript",
            miniProject: "Build a tip calculator that dynamically calculates totals based on user input and service quality.",
            starterCode: "const billAmount = 50;\n// Your code here",
            estimatedHours: 4,
            difficulty: "easy",
            status: "ACTIVE",
            mobileFillBlanks: {
                template: "<__>function</__> greet(name) {\\n  return <__>'Hello, '</__> + name;\\n}",
                blanks: ["function", "'Hello, '"],
                explanation: "Fill in the missing keywords to complete the function."
            }
        };
        renderPanel(mockData);
    }
}

window.closeWeekDetail = function() {
    destroyCodeEditor();
    const detailPanel = document.getElementById('week-detail');
    if (detailPanel) detailPanel.classList.remove('active');
    
    const backdrop = document.getElementById('modal-backdrop');
    if (backdrop) backdrop.style.display = 'none';
}

// Global listener for Escape key to close modal
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') window.closeWeekDetail();
});

function renderPanel(data) {
    const detailPanel = document.getElementById('week-detail');
    if (!detailPanel) return;

    detailPanel.innerHTML = `
        <button class="close-modal-btn" onclick="closeWeekDetail()">×</button>
        
        <div class="detail-header">
            <div class="detail-eyebrow">WEEK ${data.weekNumber} · ${data.phase} PHASE · ${data.status}</div>
            <h2 class="detail-title">${data.topicName.replace(/\n/g, '<br>')}</h2>
            <div class="detail-desc">${data.whyItMatters}</div>
        </div>

        <div class="tabs-header">
            <button class="tab-btn active" onclick="switchTab('watch')">WATCH</button>
            <button class="tab-btn" onclick="switchTab('code')">CODE</button>
            <button class="tab-btn" onclick="switchTab('build')">BUILD</button>
            <button class="tab-btn" onclick="switchTab('prove')">PROVE</button>
        </div>

        <!-- WATCH TAB -->
        <div class="tab-content active" id="tab-watch">
            <div class="video-block">
                <iframe src="${data.videoUrl}" width="100%" height="180"></iframe>
                <div class="video-info">
                    <div class="video-title">${data.videoTitle}</div>
                    <div class="video-meta">YouTube · Recommended by Pathio</div>
                </div>
            </div>
            <div class="explanation">${data.explanation}</div>
        </div>

        <!-- CODE TAB -->
        <div class="tab-content" id="tab-code">
            <div class="code-notebook">
                <div class="notebook-bar">
                    <span class="lang-label">${(data.notebookLanguage || 'javascript').toUpperCase()} · LIVE</span>
                    <button type="button" class="run-btn" id="run-code-btn">▶ RUN</button>
                </div>
                <div id="code-editor-wrap">
                    <div id="code-editor-container" class="code-editor-container"></div>
                    <textarea id="code-editor-mobile" class="code-editor-mobile hidden" spellcheck="false"></textarea>
                    <div id="fill-blanks-panel" class="fill-blanks-panel hidden"></div>
                </div>
                <div class="code-output output-neutral" id="code-output">▸ Click RUN to see output</div>
            </div>
            <div class="mobile-note">
                📱 On mobile? <a href="#" id="fill-blanks-link">Switch to fill-the-blanks mode</a> — same concept, touch friendly.
            </div>
        </div>

        <!-- BUILD TAB -->
        <div class="tab-content" id="tab-build">
            <div class="project-card">
                <div class="project-header">
                    <span class="project-icon">🛠</span>
                    <span class="project-title">Mini Project</span>
                </div>
                <div class="project-desc">${data.miniProject}</div>
                <div class="project-starter">
                    <pre>${data.starterCode}</pre>
                </div>
                <div class="project-actions">
                    <button onclick="openFullEditor()">Open in Full Editor</button>
                    <button onclick="showHint()">Show Hint (available after 10 min)</button>
                </div>
                <div class="project-meta">
                    <span class="pill">Est. ${data.estimatedHours} hours</span>
                    <span class="pill">${data.difficulty}</span>
                    <span class="pill">Visible result</span>
                </div>
            </div>
        </div>

        <!-- PROVE TAB -->
        <div class="tab-content" id="tab-prove">
            <div class="prove-section">
                <p class="prove-instruction">
                    Upload a screenshot of your working project OR paste your code below.
                </p>
                <div class="upload-zone">
                    <input type="file" id="screenshot" accept="image/*">
                    <label for="screenshot">📸 Upload Screenshot</label>
                </div>
                <div class="or-divider">OR</div>
                <textarea id="code-submission" placeholder="Paste your code here..."></textarea>
                
                <div class="reflection">
                    <label>What did you learn this week?</label>
                    <textarea id="reflection" placeholder="In one or two sentences..."></textarea>
                </div>
                
                <button class="complete-btn" onclick="completeWeek(${data.weekNumber})">
                    Mark Week ${data.weekNumber} Complete ✓
                </button>
                
                <div class="progress-hint">
                    ${data.weekNumber - 1} of 16 weeks done · ${Math.round(((data.weekNumber - 1) / 16) * 100)}% complete
                </div>
            </div>
        </div>
    `;

    setupCodeNotebook(data);
}

function setupCodeNotebook(data) {
    const lang = data.notebookLanguage || 'javascript';
    const code = data.notebookCode || '';

    destroyCodeEditor();
    initCodeEditor(lang, code, { mobileFillBlanks: data.mobileFillBlanks || null });

    document.getElementById('run-code-btn')?.addEventListener('click', () => runCode(lang));

    document.getElementById('fill-blanks-link')?.addEventListener('click', (event) => {
        event.preventDefault();
        switchToFillBlanks();
    });
}

window.switchTab = function(tabId) {
    const detailPanel = document.getElementById('week-detail');
    if (!detailPanel) return;

    // Update buttons
    const buttons = detailPanel.querySelectorAll('.tab-btn');
    buttons.forEach(btn => {
        if (btn.textContent.trim().toLowerCase() === tabId) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Update content
    const contents = detailPanel.querySelectorAll('.tab-content');
    contents.forEach(content => {
        if (content.id === `tab-${tabId}`) {
            content.classList.add('active');
        } else {
            content.classList.remove('active');
        }
    });
}

window.completeWeek = async function(weekNumber) {
    const screenshot = document.getElementById('screenshot').files[0];
    const codeSubmission = document.getElementById('code-submission').value.trim();
    const reflection = document.getElementById('reflection').value.trim();

    if (!screenshot && !codeSubmission) {
        alert("Please provide a screenshot OR paste your code.");
        return;
    }
    if (!reflection) {
        alert("Please write a short reflection on what you learned.");
        return;
    }

    const completeBtn = document.querySelector('.complete-btn');
    completeBtn.textContent = 'Submitting...';
    completeBtn.style.opacity = '0.7';

    try {
        // Mock POST request to /api/progress/complete
        await new Promise(resolve => setTimeout(resolve, 800)); 
        
        const tabProve = document.getElementById('tab-prove');
        tabProve.innerHTML = `
            <div class="celebration">
                🎉<br><br>
                Week ${weekNumber} Completed!<br>
                <span style="font-size: 14px; color: #E8F0EB; font-family: 'Hind', sans-serif;">Redirecting to roadmap...</span>
            </div>
        `;
        
        setTimeout(() => {
            window.location.reload();
        }, 2000);
        
    } catch (err) {
        console.error(err);
        alert("Something went wrong. Please try again.");
        completeBtn.textContent = `Mark Week ${weekNumber} Complete ✓`;
        completeBtn.style.opacity = '1';
    }
}

window.openFullEditor = function() {
    alert("Opening full IDE mode...");
}
window.showHint = function() {
    alert("Hint: Break the problem down into smaller steps!");
}
