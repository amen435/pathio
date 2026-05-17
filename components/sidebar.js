export function init() {
    // 1. Setup Active Navigation State
    const navItems = document.querySelectorAll('.pathio-sidebar .nav-item');
    const currentPath = window.location.pathname;
    
    // Check localStorage first, or fallback to 'roadmap'
    let activePage = localStorage.getItem('pathio_active_page') || 'roadmap';

    // Auto-detect based on current URL
    navItems.forEach(item => {
        const page = item.getAttribute('data-page');
        if (currentPath.includes(page)) {
            activePage = page;
        }
        
        item.addEventListener('click', (e) => {
            const href = item.getAttribute('href');
            if (href === '#' || href === 'javascript:void(0)') {
                e.preventDefault();
            }
            
            localStorage.setItem('pathio_active_page', page);
            
            // visually update immediately
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
        });
    });

    // Apply active class on load
    navItems.forEach(item => {
        if (item.getAttribute('data-page') === activePage) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    // 2. Fetch Stats & Populate Streak
    fetchStats();
}

async function fetchStats() {
    try {
        const response = await fetch('/api/progress/stats');
        if (response.ok) {
            const data = await response.json();
            updateDOM(data);
        } else {
            throw new Error('Failed to fetch stats, using mock data');
        }
    } catch (error) {
        console.warn(error.message);
        // Fallback mock data matching the design specs
        const mockData = {
            streak: 4,
            percentDone: 25,
            totalHours: 12,
            weekData: Array.from({ length: 16 }, (_, i) => {
                let status = 'locked';
                if (i < 4) status = 'completed';
                else if (i === 4) status = 'active';
                return { week: i + 1, status };
            })
        };
        updateDOM(mockData);
    }
}

function updateDOM(data) {
    // Update Stats Numbers
    const streakEl = document.getElementById('stat-streak');
    const doneEl = document.getElementById('stat-done');
    const timeEl = document.getElementById('stat-time');
    
    if (streakEl) streakEl.textContent = `${data.streak} days`;
    if (doneEl) doneEl.textContent = `${data.percentDone}%`;
    if (timeEl) timeEl.textContent = `${data.totalHours}h`;

    // Update Streak Grid
    const gridEl = document.getElementById('streak-grid');
    if (gridEl && data.weekData) {
        gridEl.innerHTML = '';
        data.weekData.forEach(weekInfo => {
            const square = document.createElement('div');
            square.className = `streak-square ${weekInfo.status}`;
            square.textContent = weekInfo.week;
            gridEl.appendChild(square);
        });
    }
}
