export function renderPath(weeks, containerSelector = '#roadmap-container') {
    const container = document.querySelector(containerSelector);
    if (!container) return;

    let html = '<div class="roadmap-path-container">';
    let currentPhase = "";
    let phaseIndex = 0;

    weeks.forEach((week, i) => {
        // Phase Banner Logic
        if (week.phase !== currentPhase) {
            // Check if we should render a reward milestone for the PREVIOUS phase
            if (currentPhase !== "") {
                const phaseWeeks = weeks.filter(w => w.phase === currentPhase);
                const allComplete = phaseWeeks.every(w => w.status === 'COMPLETE');
                
                if (allComplete) {
                    html += `
                    <div class="reward-milestone">
                        <span class="reward-icon">🎁</span>
                        <span class="reward-text">MILESTONE — Phase ${phaseIndex} complete!</span>
                    </div>`;
                }
            }

            phaseIndex++;
            currentPhase = week.phase;
            
            // Check if this new phase is locked (if this first week is locked and previous was locked too)
            const isPhaseLocked = week.status === 'LOCKED' && (i === 0 || weeks[i-1].status === 'LOCKED');
            
            html += `
            <div class="phase-banner ${isPhaseLocked ? 'locked' : ''}">
                <div class="phase-label">// PHASE ${phaseIndex}</div>
                <div class="phase-title">${week.phase}</div>
            </div>`;
        }

        // Zigzag calculation
        const isOdd = week.weekNumber % 2 !== 0;
        const rowClass = isOdd ? 'odd' : 'even';
        
        const isComplete = week.status === 'COMPLETE';
        const isActive = week.status === 'ACTIVE';
        const isLocked = week.status === 'LOCKED';
        const statusClass = isComplete ? 'completed' : (isActive ? 'active' : 'locked');
        
        let nodeContent = '';
        if (isComplete) {
            nodeContent = `
                <span class="node-icon">⭐</span>
                <span class="node-label">W${week.weekNumber}</span>
                <div class="node-badge">★</div>
            `;
        } else if (isActive) {
            nodeContent = `
                <span class="node-icon">🔥</span>
                <span class="node-label">W${week.weekNumber}</span>
            `;
        } else {
            nodeContent = `
                <span class="node-icon">🔒</span>
                <span class="node-label">W${week.weekNumber}</span>
            `;
        }

        const connectorClass = isComplete ? 'connector-completed' : 'connector-locked';
        const hideConnector = (i === weeks.length - 1) ? 'style="display:none;"' : '';
        
        let statusText = 'DONE';
        if (isActive) statusText = 'ACTIVE';
        if (isLocked) statusText = 'LOCKED';

        const tooltip = isLocked ? `data-tooltip="Complete Week ${week.weekNumber - 1} first"` : '';
        const onclick = (isComplete || isActive) ? `onclick="window.location.href='/week.html?id=${week.weekNumber}'"` : '';

        html += `
        <div class="path-row ${rowClass} ${statusClass}" ${onclick}>
            <div class="node-wrapper ${statusClass}" ${tooltip}>
                <div class="node ${statusClass}">
                    ${nodeContent}
                </div>
                <div class="connector ${connectorClass}" ${hideConnector}></div>
            </div>
            <div class="info-wrapper">
                <div class="week-tag">WEEK ${week.weekNumber} · ${statusText}</div>
                <div class="topic-name">${week.topicName}</div>
                <div class="mini-project">${week.miniProject}</div>
            </div>
        </div>
        `;
    });

    // Check final phase completion for the last milestone
    if (weeks.length > 0) {
        const phaseWeeks = weeks.filter(w => w.phase === currentPhase);
        const allComplete = phaseWeeks.every(w => w.status === 'COMPLETE');
        if (allComplete) {
            html += `
            <div class="reward-milestone">
                <span class="reward-icon">🎁</span>
                <span class="reward-text">MILESTONE — Phase ${phaseIndex} complete!</span>
            </div>`;
        }
    }

    html += '</div>';
    container.innerHTML = html;
}

// Initialization and Data Fetching logic
export async function initRoadmapPath(containerSelector = '#roadmap-container') {
    try {
        const response = await fetch('/api/roadmap/weeks');
        if (response.ok) {
            const weeks = await response.json();
            renderPath(weeks, containerSelector);
        } else {
            throw new Error('Failed to fetch roadmap weeks');
        }
    } catch (e) {
        console.warn('API fetch failed, falling back to mock data', e);
        const mockWeeks = [
            { weekNumber: 1, phase: "Foundation — 8 weeks", topicName: "HTML Structure", miniProject: "Built: Personal bio page", status: "COMPLETE" },
            { weekNumber: 2, phase: "Foundation — 8 weeks", topicName: "CSS Styling", miniProject: "Built: Pricing component", status: "COMPLETE" },
            { weekNumber: 3, phase: "Foundation — 8 weeks", topicName: "JS Basics", miniProject: "Built: Calculator", status: "ACTIVE" },
            { weekNumber: 4, phase: "Foundation — 8 weeks", topicName: "DOM Manipulation", miniProject: "Built: Todo App", status: "LOCKED" },
            { weekNumber: 5, phase: "Backend — 8 weeks", topicName: "Node & Express", miniProject: "Built: API Server", status: "LOCKED" }
        ];
        renderPath(mockWeeks, containerSelector);
    }
}
