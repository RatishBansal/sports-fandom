let currentUser = localStorage.getItem("currentUser") || null;
let favoriteTeamIds = [];
try {
    let stored = localStorage.getItem("favoriteTeamIds");
    if (stored) {
        favoriteTeamIds = JSON.parse(stored);
    } else {
        let legacyId = localStorage.getItem("favoriteTeamId");
        if (legacyId) {
            favoriteTeamIds.push(legacyId);
            localStorage.setItem("favoriteTeamIds", JSON.stringify(favoriteTeamIds));
            localStorage.removeItem("favoriteTeamId");
        }
    }
} catch(e) {}
let allTeams = {};
let allMatches = [];
let currentMatchId = null;
let currentReplyTo = null;

const API_BASE = '/api';

function setBg(bgClass) {
    console.log("Setting background to:", bgClass);
    document.body.classList.remove('bg-auth', 'bg-onboarding', 'bg-main');
    document.body.classList.add(bgClass);
}

async function init() {
    try {
        if(currentUser) {
            document.getElementById('userNameDisplay').innerText = currentUser;
        }
        
        const res = await fetch(`${API_BASE}/matches`);
        const data = await res.json();
        allTeams = data.teams;
        allMatches = data.matches;

        if (!currentUser) {
            showAuth();
        } else if (favoriteTeamIds.length === 0) {
            showOnboarding();
        } else {
            showApp();
        }
    } catch(err) {
        console.error("Initialization failed", err);
    }
}

let authMode = 'login';
function showAuth() {
    setBg('bg-auth');
    document.getElementById('authOverlay').style.display = 'flex';
    document.getElementById('onboarding').style.display = 'none';
    document.getElementById('appContainer').style.display = 'none';
    
    document.getElementById('authSwitchText').onclick = () => {
        authMode = authMode === 'login' ? 'register' : 'login';
        document.getElementById('authTitle').innerText = authMode === 'login' ? 'Login' : 'Register';
        document.getElementById('authSubmitBtn').innerText = authMode === 'login' ? 'Login' : 'Create Account';
        document.getElementById('authSwitchText').innerHTML = authMode === 'login' ? 
            `Don't have an account? <span style="color: var(--accent); font-weight: bold;">Register</span>` :
            `Already have an account? <span style="color: var(--accent); font-weight: bold;">Login</span>`;
        document.getElementById('authErrorMsg').style.display = 'none';
    };
    
    document.getElementById('authSubmitBtn').onclick = async () => {
        const user = document.getElementById('authUsername').value.trim();
        const pass = document.getElementById('authPassword').value;
        const errObj = document.getElementById('authErrorMsg');
        
        if(!user || !pass) {
            errObj.innerText = "Please fill in all fields.";
            errObj.style.display = 'block';
            return;
        }
        
        errObj.style.display = 'none';
        document.getElementById('authSubmitBtn').disabled = true;
        
        try {
            const endpoint = authMode === 'login' ? '/api/login' : '/api/register';
            const payload = { username: user, password: pass };
            if(authMode === 'register') payload.favorite_teams = [];
            
            const req = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const res = await req.json();
            
            if(res.status === 'success') {
                currentUser = res.username;
                localStorage.setItem("currentUser", currentUser);
                
                if (res.favorite_team_ids && res.favorite_team_ids.length > 0) {
                    favoriteTeamIds = res.favorite_team_ids;
                    localStorage.setItem("favoriteTeamIds", JSON.stringify(favoriteTeamIds));
                }
                
                document.getElementById('userNameDisplay').innerText = currentUser;
                document.getElementById('authOverlay').style.display = 'none';
                
                if(favoriteTeamIds.length === 0) {
                    showOnboarding();
                } else {
                    showApp();
                }
            } else {
                errObj.innerText = res.message || "An error occurred.";
                errObj.style.display = 'block';
            }
        } catch(e) {
            errObj.innerText = "Network error. Try again.";
            errObj.style.display = 'block';
        }
        document.getElementById('authSubmitBtn').disabled = false;
    };
}

function showOnboarding() {
    setBg('bg-auth');
    document.getElementById('onboarding').style.display = 'flex';
    document.getElementById('appContainer').style.display = 'none';
    
    favoriteTeamIds = [];
    
    const grid = document.getElementById('teamsGrid');
    grid.innerHTML = '';
    
    Object.values(allTeams).forEach(team => {
        const div = document.createElement('div');
        div.className = 'team-option';
        div.id = `onboard-team-${team.id}`;
        const logoHtml = team.logo.startsWith('/static') 
            ? `<img src="${team.logo}" alt="${team.name} Logo" style="width:100%; height:100%; object-fit:contain;">`
            : team.logo;
        div.innerHTML = `
            <div class="team-logo" style="background:${team.color}">${logoHtml}</div>
            <div class="team-name">${team.name}</div>
        `;
        div.onclick = () => {
            selectTeam(team.id, div);
        };
        grid.appendChild(div);
    });

    const btn = document.getElementById('finishOnboardingBtn');
    if (btn) {
        btn.style.display = 'none';
        btn.onclick = async () => {
            if(favoriteTeamIds.length > 0) {
                localStorage.setItem('favoriteTeamIds', JSON.stringify(favoriteTeamIds));
                await fetch(`${API_BASE}/update_preferences`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({username: currentUser, favorite_teams: favoriteTeamIds})
                });
                document.getElementById('onboarding').style.display = 'none';
                showApp();
            }
        };
    }
}

function selectTeam(teamId, divMarker) {
    if (favoriteTeamIds.includes(teamId)) {
        favoriteTeamIds = favoriteTeamIds.filter(id => id !== teamId);
        divMarker.style.borderColor = 'rgba(255, 255, 255, 0.05)';
        divMarker.style.background = 'rgba(255, 255, 255, 0.03)';
    } else {
        favoriteTeamIds.push(teamId);
        divMarker.style.borderColor = 'var(--accent)';
        divMarker.style.background = 'rgba(92, 103, 255, 0.08)';
    }
    
    const btn = document.getElementById('finishOnboardingBtn');
    if (btn) {
        btn.style.display = favoriteTeamIds.length > 0 ? 'inline-block' : 'none';
    }
}

function showApp() {
    setBg('bg-main');
    document.getElementById('appContainer').style.display = 'flex';
    renderMyTeam();
    renderMatches();
    
    if (!currentMatchId && favoriteTeamIds.length > 0) {
        const favMatches = allMatches.filter(m => favoriteTeamIds.includes(m.team1_id) || favoriteTeamIds.includes(m.team2_id));
        if (favMatches.length > 0) {
            const liveMatch = favMatches.find(m => m.status === 'live') || favMatches[0];
            if (liveMatch) {
                openChat(liveMatch);
            }
        }
    }
}

function renderMyTeam() {
    const card = document.getElementById('myTeamCard');
    card.innerHTML = '';
    
    if (favoriteTeamIds.length === 1) {
        const team = allTeams[favoriteTeamIds[0]];
        if(team) {
            const logoHtml = team.logo.startsWith('/static') 
                ? `<img src="${team.logo}" alt="${team.name}" style="width:100%; height:100%; object-fit:contain;">`
                : team.logo;
            card.innerHTML = `
                <div class="my-team-inner">
                    <span class="logo-large" style="background:${team.color}">${logoHtml}</span>
                    <span class="name-large">${team.name}</span>
                </div>
            `;
        }
        document.querySelector('.my-team p').innerText = "Your Favorite Team";
    } else if (favoriteTeamIds.length > 1) {
        let htm = `<div style="display:flex; flex-wrap:wrap; justify-content:center; gap:10px;">`;
        favoriteTeamIds.forEach(id => {
            const team = allTeams[id];
            if(team) {
                const logoHtml = team.logo.startsWith('/static') 
                    ? `<img src="${team.logo}" alt="${team.short_name}" style="width:100%; height:100%; object-fit:contain;">`
                    : team.logo;
                htm += `<div style="display:flex; flex-direction:column; align-items:center;">
                    <span class="logo-small" style="background:${team.color}; width:40px; height:40px; font-size:20px; display:flex; align-items:center; justify-content:center;">${logoHtml}</span>
                    <span style="font-size:0.75rem; margin-top:5px; font-weight:bold;">${team.short_name}</span>
                </div>`;
            }
        });
        htm += `</div>`;
        card.innerHTML = htm;
        document.querySelector('.my-team p').innerText = "Your Favorite Teams";
    }
    
    document.getElementById('changeTeamBtn').onclick = () => {
        localStorage.removeItem('favoriteTeamIds');
        localStorage.removeItem('favoriteTeamId');
        favoriteTeamIds = [];
        showOnboarding();
    };

    if (!document.getElementById('logoutBtn')) {
        const loBtn = document.createElement('button');
        loBtn.id = 'logoutBtn';
        loBtn.className = 'change-btn';
        loBtn.style.marginTop = '10px';
        loBtn.style.borderColor = 'var(--danger)';
        loBtn.style.color = 'var(--danger)';
        loBtn.innerText = 'Logout';
        loBtn.onclick = () => {
            localStorage.removeItem('currentUser');
            localStorage.removeItem('favoriteTeamIds');
            location.reload();
        };
        document.querySelector('.my-team').appendChild(loBtn);
    }
}

function renderMatches() {
    const list = document.getElementById('matchesList');
    list.innerHTML = '';
    
    // Feature: Only show favorite teams matches
    const favMatches = allMatches.filter(match => 
        favoriteTeamIds.includes(match.team1_id) || favoriteTeamIds.includes(match.team2_id)
    );
    
    favMatches.forEach(match => {
        const t1 = allTeams[match.team1_id];
        const t2 = allTeams[match.team2_id];
        const isFav = true; // All displayed matches are favorite team matches now
        
        const isActive = match.id === currentMatchId;
        const card = document.createElement('div');
        card.className = `match-card favorite-match ${isActive ? 'active-match' : ''}`;
        card.onclick = () => openChat(match);
        
        let statusDisplay = match.status.toUpperCase();
        if(match.status === 'live') statusDisplay = "🔴 LIVE NOW";
        
        const logo1Html = t1.logo.startsWith('/static') 
            ? `<img src="${t1.logo}" alt="${t1.short_name}" style="width:100%; height:100%; object-fit:contain;">`
            : t1.logo;
        const logo2Html = t2.logo.startsWith('/static') 
            ? `<img src="${t2.logo}" alt="${t2.short_name}" style="width:100%; height:100%; object-fit:contain;">`
            : t2.logo;
            
        card.innerHTML = `
            <div class="match-meta">
                <span class="status ${match.status}">${statusDisplay}</span>
                <span class="date">${match.date}</span>
            </div>
            <div class="match-teams">
                <div class="team">
                    <span class="logo-small" style="background:${t1.color}">${logo1Html}</span>
                    <span class="tname">${t1.short_name}</span>
                </div>
                <div class="vs">VS</div>
                <div class="team">
                    <span class="logo-small" style="background:${t2.color}">${logo2Html}</span>
                    <span class="tname">${t2.short_name}</span>
                </div>
            </div>
            ${match.result ? `<div class="match-result">${match.result}</div>` : ''}
            ${match.score_summary ? `<div class="match-score">${match.score_summary}</div>` : ''}
        `;
        list.appendChild(card);
    });
}

function openChat(match) {
    currentMatchId = match.id;
    currentReplyTo = null;
    cancelReply();
    
    document.getElementById('chatPlaceholder').style.display = 'none';
    document.getElementById('chatContainer').style.display = 'flex';
    
    // Refresh matches list to move the highlight
    renderMatches();
    
    // For mobile slide-in
    document.getElementById('chatSidebar').classList.add('active');
    
    const t1 = allTeams[match.team1_id];
    const t2 = allTeams[match.team2_id];
    
    document.getElementById('chatMatchTitle').innerText = `${t1.name} vs ${t2.name}`;
    document.getElementById('chatMatchStatus').innerText = match.status === 'completed' ? match.result : (match.status === 'live' ? 'Live Match' : 'Upcoming Match');
    
    loadChatMessages();
    
    // Realtime simulate poll
    if(window.chatPoll) clearInterval(window.chatPoll);
    window.chatPoll = setInterval(loadChatMessages, 3000);
}

document.getElementById('closeChatBtn').onclick = () => {
    document.getElementById('chatSidebar').classList.remove('active');
};

async function loadChatMessages() {
    if(!currentMatchId) return;
    const res = await fetch(`${API_BASE}/chat/${currentMatchId}`);
    const data = await res.json();
    renderMessages(data.comments);
}

function renderMessages(comments) {
    const list = document.getElementById('chatMessages');
    const wasAtBottom = list.scrollHeight - list.scrollTop <= list.clientHeight + 50;
    
    list.innerHTML = '';
    
    function renderCommentTree(msgs, container, isReply = false) {
        msgs.forEach(msg => {
            const div = document.createElement('div');
            div.className = `comment ${isReply ? 'reply' : ''} ${msg.user_name === currentUser ? 'own-comment' : ''}`;
            
            const reactionsHTML = Object.entries(msg.reactions || {}).map(([emoji, count]) => `
                <span class="reaction" onclick="reactTo(event, '${msg.id}', '${emoji}')">${emoji} <span style="opacity:0.8">${count}</span></span>
            `).join('');
            
            div.innerHTML = `
                <div class="comment-header">
                    <span class="comment-author">${msg.user_name}</span>
                    <span class="comment-time">${new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                </div>
                <div class="comment-text">${msg.text}</div>
                <div class="comment-actions">
                    <button class="action-btn" onclick="setReply('${msg.id}', '${msg.user_name}')">💬 Reply</button>
                    <button class="action-btn react-trigger" onclick="toggleReactMenu(event, '${msg.id}')">😊 React</button>
                    <div class="reactions-list">${reactionsHTML}</div>
                </div>
            `;
            container.appendChild(div);
            
            if(msg.replies && msg.replies.length > 0) {
                const subContainer = document.createElement('div');
                subContainer.className = 'replies-container';
                renderCommentTree(msg.replies, subContainer, true);
                container.appendChild(subContainer);
            }
        });
    }
    
    if(comments.length === 0) {
        list.innerHTML = '<div class="empty-chat">It\'s quiet here... Write something to spark the discussion!</div>';
    } else {
        renderCommentTree(comments, list);
    }
    
    if (wasAtBottom) {
        list.scrollTop = list.scrollHeight;
    }
}

function setReply(commentId, userName) {
    currentReplyTo = commentId;
    const ind = document.getElementById('replyIndicator');
    ind.style.display = 'flex';
    document.getElementById('replyToUser').innerText = '@' + userName;
    document.getElementById('chatInput').focus();
}

function cancelReply() {
    currentReplyTo = null;
    document.getElementById('replyIndicator').style.display = 'none';
}

async function sendMessage() {
    const input = document.getElementById('chatInput');
    const text = input.value.trim();
    if(!text || !currentMatchId) return;
    
    const payload = {
        match_id: currentMatchId,
        user_name: currentUser,
        text: text,
        parent_id: currentReplyTo
    };
    
    input.value = '';
    cancelReply();
    
    // Optimistic UI could be implemented here
    
    await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    
    loadChatMessages();
    
    // Force scroll bottom
    setTimeout(() => {
        const list = document.getElementById('chatMessages');
        list.scrollTop = list.scrollHeight;
    }, 100);
}

document.getElementById('sendBtn').onclick = sendMessage;
document.getElementById('chatInput').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

let activeReactPopup = null;
function toggleReactMenu(e, commentId) {
    e.stopPropagation();
    if(activeReactPopup) {
        activeReactPopup.remove();
        activeReactPopup = null;
    }
    
    const emojis = ['👍','❤️','😂','😲','🔥', '😢'];
    const p = document.createElement('div');
    p.className = 'react-popup';
    
    emojis.forEach(em => {
        const span = document.createElement('span');
        span.innerText = em;
        span.onclick = (ev) => {
            ev.stopPropagation();
            reactTo(null, commentId, em);
            p.remove();
            activeReactPopup = null;
        };
        p.appendChild(span);
    });
    
    document.body.appendChild(p);
    activeReactPopup = p;
    
    const rect = e.target.getBoundingClientRect();
    
    // Ensure it doesn't go offscreen
    let top = rect.top - 60;
    if(top < 0) top = rect.bottom + 10;
    
    p.style.top = `${top}px`;
    p.style.left = `${rect.left - 50}px`;
}

document.body.onclick = () => {
    if(activeReactPopup) {
        activeReactPopup.remove();
        activeReactPopup = null;
    }
};

async function reactTo(event, commentId, emoji) {
    if(event) event.stopPropagation();
    
    await fetch(`${API_BASE}/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            match_id: currentMatchId,
            comment_id: commentId,
            emoji: emoji
        })
    });
    loadChatMessages();
}

// Ensure init is called when script loads
document.addEventListener('DOMContentLoaded', init);
