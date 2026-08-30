import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, doc, getDoc, setDoc, deleteDoc, updateDoc, arrayUnion, query, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyAG-jheYkESMeOwvXM7WTA2qS-Oetj04hg",
    authDomain: "nextlevel-esports-d7728.firebaseapp.com",
    databaseURL: "https://nextlevel-esports-d7728-default-rtdb.firebaseio.com",
    projectId: "nextlevel-esports-d7728",
    storageBucket: "nextlevel-esports-d7728.appspot.com",
    messagingSenderId: "722064280924",
    appId: "1:722064280924:web:3ddc9b6ea5ae79ad4f4599"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const ADMIN_EMAIL = "devloper gautam";
const ADMIN_PASS = "gautam@#";

let deviceUserId = '';

let allTournamentsCache = []; 
let currentSelectedFilter = 'all';

let currentAdminUpi = "merchant@upi";
let currentAdminQr = "https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=upi://pay?pa=merchant@upi&pn=NextLeveleSports";

let currentSlideIndex = 0;
let sliderInterval = null;
let currentBannerImages = [];

document.addEventListener("DOMContentLoaded", () => {
    setupAuthListeners();
    observeAuthState();
});

// Custom Modern Alert Modal Function (Replaces browser standard alert)
window.showCustomAlert = function(title, message, icon = "✨", callback = null) {
    const modal = document.getElementById('customModal');
    const titleEl = document.getElementById('modalTitle');
    const bodyEl = document.getElementById('modalBody');
    const iconEl = document.getElementById('modalHeaderIcon');
    const submitBtn = document.getElementById('modalSubmitBtn');
    const closeBtn = document.getElementById('modalCloseBtn');
    const actionsEl = document.getElementById('modalActions');

    titleEl.innerText = title;
    bodyEl.innerHTML = message;
    iconEl.innerText = icon;
    
    if(submitBtn) {
        submitBtn.style.display = 'none';
    }
    if(closeBtn) {
        closeBtn.innerText = "OK";
        closeBtn.style.flex = "1";
        closeBtn.onclick = () => {
            modal.classList.add('hidden');
            if (callback) callback();
        };
    }
    modal.classList.remove('hidden');
};

// --- Real Firebase Auth Session & State ---
function observeAuthState() {
    onAuthStateChanged(auth, async (user) => {
        const authContainer = document.getElementById('authContainer');
        const mainAppWrapper = document.getElementById('mainAppWrapper');

        if (user) {
            deviceUserId = user.uid;
            if(authContainer) authContainer.classList.add('hidden');
            if(mainAppWrapper) mainAppWrapper.classList.remove('hidden');

            loadBanners();
            loadPaymentSettings();
            loadTournaments();
            loadUserProfile();
            loadUserWallet();
            loadUserTransactions();
            if(document.getElementById('tCategory')) {
                handleCategoryChange();
            }
        } else {
            if(authContainer) authContainer.classList.remove('hidden');
            if(mainAppWrapper) mainAppWrapper.classList.add('hidden');
        }
    });
}

function setupAuthListeners() {
    const switchToRegister = document.getElementById('switchToRegister');
    const switchToLogin = document.getElementById('switchToLogin');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const authTitle = document.getElementById('authTitle');
    const authSubtitle = document.getElementById('authSubtitle');

    if(switchToRegister) {
        switchToRegister.onclick = () => {
            loginForm.classList.add('hidden');
            registerForm.classList.remove('hidden');
            authTitle.innerText = "Create Account";
            authSubtitle.innerText = "Register to start playing tournaments";
        };
    }

    if(switchToLogin) {
        switchToLogin.onclick = () => {
            registerForm.classList.add('hidden');
            loginForm.classList.remove('hidden');
            authTitle.innerText = "Welcome Back";
            authSubtitle.innerText = "Login to your NextLevel eSports account";
        };
    }

    if(loginForm) {
        loginForm.onsubmit = async (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value.trim();
            const pass = document.getElementById('loginPass').value.trim();
            
            const submitBtn = loginForm.querySelector('button[type="submit"]');
            const originalText = submitBtn ? submitBtn.innerText : "Login Now";
            if(submitBtn) {
                submitBtn.innerText = "Logging in...";
                submitBtn.disabled = true;
            }

            try {
                // Firebase Login Request
                await signInWithEmailAndPassword(auth, email, pass);
                // Agar login successful hoga, tabhi aage badhega
            } catch (err) {
                console.error("Login Error Code:", err.code);
                let errorMsg = "Invalid email or password. Please check your credentials.";
                
                if (err.code === 'auth/invalid-email') {
                    errorMsg = "Please enter a valid email address.";
                } else if (err.code === 'auth/user-not-found') {
                    errorMsg = "No account found with this email.";
                } else if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
                    errorMsg = "Incorrect password. Please try again.";
                }
                
                showCustomAlert("Login Failed", errorMsg, "⚠️");
                
                // Button reset karke execution yahin rok denge taaki dashboard na khule
                if(submitBtn) {
                    submitBtn.innerText = originalText;
                    submitBtn.disabled = false;
                }
                return; // Ye sabse important hai - galat password hone par function yahin terminate ho jayega
            }
        };
    }

    if(registerForm) {
        registerForm.onsubmit = async (e) => {
            e.preventDefault();
            const name = document.getElementById('regName').value.trim();
            const email = document.getElementById('regEmail').value.trim();
            const pass = document.getElementById('regPass').value.trim();

            if(pass.length < 6) {
                showCustomAlert("Weak Password", "Password must be at least 6 characters long!", "⚠️");
                return;
            }

            const submitBtn = registerForm.querySelector('button[type="submit"]');
            const originalText = submitBtn ? submitBtn.innerText : "Create Account";
            if(submitBtn) {
                submitBtn.innerText = "Creating Account...";
                submitBtn.disabled = true;
            }

            try {
                const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
                const uid = userCredential.user.uid;

                await setDoc(doc(db, "users", uid), {
                    name: name,
                    contact: email,
                    balance: 0,
                    createdAt: new Date().toISOString()
                }, { merge: true });

                showCustomAlert("Success! 🎉", "Account created successfully!", "✅");
            } catch (err) {
                let errorMsg = err.message;
                if (err.code === 'auth/email-already-in-use') {
                    errorMsg = "This email is already registered. Please login instead.";
                }
                showCustomAlert("Registration Error", errorMsg, "⚠️");
            } finally {
                if(submitBtn) {
                    submitBtn.innerText = originalText;
                    submitBtn.disabled = false;
                }
            }
        };
    }
}


window.logoutUser = async function() {
    if(confirm("Are you sure you want to logout?")) {
        try {
            await signOut(auth);
            // Logout ke baad onAuthStateChanged automatic auth screen par le jayega
        } catch (e) {
            showCustomAlert("Error", e.message, "⚠️");
        }
    }
};

// --- Banner Slider Logic ---
async function loadBanners() {
    try {
        const bannerDoc = await getDoc(doc(db, "settings", "bannerSlider"));
        currentBannerImages = [
            "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?auto=format&fit=crop&w=800&q=80"
        ];

        if (bannerDoc.exists() && bannerDoc.data().images && bannerDoc.data().images.length > 0) {
            currentBannerImages = bannerDoc.data().images;
        }

        renderSlider(currentBannerImages);
    } catch (e) {
        console.log("Using default banner slider");
    }
}

function renderSlider(images) {
    const track = document.getElementById('bannerSliderTrack');
    const dotsContainer = document.getElementById('sliderDots');
    if (!track || !dotsContainer) return;

    let trackHtml = '';
    let dotsHtml = '';

    images.forEach((imgSrc, idx) => {
        trackHtml += `
            <div class="banner-slide">
                <img src="${imgSrc}" alt="Banner ${idx + 1}">
            </div>
        `;
        dotsHtml += `<div class="slider-dot ${idx === 0 ? 'active-dot' : ''}" data-index="${idx}"></div>`;
    });

    track.innerHTML = trackHtml;
    dotsContainer.innerHTML = dotsHtml;

    currentSlideIndex = 0;
    if (sliderInterval) clearInterval(sliderInterval);

    sliderInterval = setInterval(() => {
        currentSlideIndex = (currentSlideIndex + 1) % images.length;
        updateSliderPosition(images.length);
    }, 3000);
}

function updateSliderPosition(totalSlides) {
    const track = document.getElementById('bannerSliderTrack');
    const dots = document.querySelectorAll('.slider-dot');
    if (!track) return;

    track.style.transform = `translateX(-${currentSlideIndex * 100}%)`;

    dots.forEach((dot, idx) => {
        if (idx === currentSlideIndex) {
            dot.classList.add('active-dot');
        } else {
            dot.classList.remove('active-dot');
        }
    });
}

async function loadPaymentSettings() {
    try {
        const payDoc = await getDoc(doc(db, "settings", "payment"));
        if (payDoc.exists()) {
            const data = payDoc.data();
            if (data.upiId) currentAdminUpi = data.upiId;
            if (data.qrUrl) currentAdminQr = data.qrUrl;
        }
    } catch (e) {
        console.log("Using default payment settings");
    }
}

async function loadUserProfile() {
    if (!deviceUserId) return;
    try {
        const userDocRef = doc(db, "users", deviceUserId);
        const userSnap = await getDoc(userDocRef);
        
        if (userSnap.exists()) {
            const data = userSnap.data();
            if(data.name) document.getElementById('displayProfileName').innerText = data.name;
            if(data.uid) document.getElementById('displayProfileUid').innerText = data.uid;
        }
    } catch (e) {
        console.log("Error loading user profile:", e);
    }
}

async function loadUserWallet() {
    if (!deviceUserId) return;
    try {
        const userDocRef = doc(db, "users", deviceUserId);
        const userSnap = await getDoc(userDocRef);
        let balance = 0;
        
        if (userSnap.exists() && userSnap.data().balance !== undefined) {
            balance = userSnap.data().balance;
        } else {
            await setDoc(userDocRef, { balance: 0 }, { merge: true });
        }

        document.querySelectorAll('.wallet-balance-amount, #headerBalance').forEach(el => {
            el.innerText = `🪙 ${balance}`;
        });
        document.querySelectorAll('.profile-stats-grid .p-stat-val').forEach((el, idx) => {
            if(idx === 0) el.innerText = `🪙 ${balance}`;
        });
    } catch (e) {
        console.log("Error loading wallet balance:", e);
    }
}

async function loadUserTransactions() {
    if (!deviceUserId) return;
    const txListContainer = document.querySelector('.wallet-tx-list');
    if (!txListContainer) return;

    try {
        const q = query(collection(db, "transactions"), where("deviceId", "==", deviceUserId));
        const querySnapshot = await getDocs(q);

        let html = '';
        querySnapshot.forEach((docSnap) => {
            const tx = docSnap.data();
            const isDeposit = tx.type === "deposit";
            const sign = isDeposit ? "+" : "-";
            const colorClass = isDeposit ? "var(--success)" : "var(--danger)";
            const iconSymbol = isDeposit ? "📥" : "📤";

            html += `
                <div class="tx-item" style="margin-top: 8px;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div class="tx-icon" style="background: rgba(245,158,11,0.1); border: 1px solid rgba(245,158,11,0.2);">${iconSymbol}</div>
                        <div>
                            <div style="font-size: 13px; font-weight: 700; color: white;">${tx.title}</div>
                            <div style="font-size: 10px; color: var(--text-muted);">${tx.desc || 'Account Activity'}</div>
                        </div>
                    </div>
                    <div style="font-size: 13px; font-weight: 800; color: ${colorClass};">${sign}🪙 ${tx.amount}</div>
                </div>
            `;
        });

        if (html === '') {
            html = '<p style="text-align: center; color: var(--text-muted); font-size: 12px; padding: 10px;">No recent transactions</p>';
        }

        txListContainer.innerHTML = html;
    } catch (e) {
        console.log("Error loading transactions:", e);
    }
}

async function loadTournaments() {
    const listDiv = document.getElementById('tournamentList');
    if (!listDiv) return;
    try {
        // Firestore se tournaments ko creation time ke hisab se descending order me fetch karenge
        const q = query(collection(db, "tournaments"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            listDiv.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 20px;">No active tournaments right now.</p>';
            return;
        }
        
        allTournamentsCache = [];
        querySnapshot.forEach((docSnap) => {
            allTournamentsCache.push({ id: docSnap.id, ...docSnap.data() });
        });

        updateJoinedMatchesCount();
        filterTournaments(currentSelectedFilter);
    } catch (err) {
        // Fallback agar index abhi create na hua ho
        try {
            const querySnapshot = await getDocs(collection(db, "tournaments"));
            if (querySnapshot.empty) {
                listDiv.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 20px;">No active tournaments right now.</p>';
                return;
            }
            
            allTournamentsCache = [];
            querySnapshot.forEach((docSnap) => {
                allTournamentsCache.push({ id: docSnap.id, ...docSnap.data() });
            });

            // Agar createdAt field maujood hai toh frontend par bhi sort kar lenge
            allTournamentsCache.sort((a, b) => {
                const timeA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
                const timeB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
                return timeB - timeA;
            });

            updateJoinedMatchesCount();
            filterTournaments(currentSelectedFilter);
        } catch (e) {
            listDiv.innerHTML = '<p style="text-align: center; color: var(--danger);">Failed to load tournaments from Firebase.</p>';
        }
    }
}


function updateJoinedMatchesCount() {
    if (!deviceUserId) return;
    let count = 0;
    allTournamentsCache.forEach(t => {
        const players = t.players || [];
        if (players.some(p => p.deviceId === deviceUserId)) {
            count++;
        }
    });
    const statEl = document.getElementById('joinedCountStat');
    if (statEl) statEl.innerText = count;
}

function calculateJoinedSlots(t) {
    const playersList = t.players || [];
    const category = t.category || 'br-solo';
    let count = 0;
    
    playersList.forEach(p => {
        if (category.includes('squad') && p.players && Array.isArray(p.players)) {
            count += p.players.length;
        } else {
            count += 1;
        }
    });
    return count;
}

function renderTournamentList(tournaments) {
    const listDiv = document.getElementById('tournamentList');
    if (!listDiv) return;

    if (tournaments.length === 0) {
        listDiv.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 20px;">No tournaments found in this category.</p>';
        return;
    }

    listDiv.innerHTML = '';
    
    tournaments.forEach((t) => {
        const tId = t.id;
        const playersList = t.players || [];
        const isJoined = playersList.some(p => p.deviceId === deviceUserId);
        
        const currentJoined = calculateJoinedSlots(t);
        const maxSlots = Number(t.slots) || 48;

        let formattedTime = "TBA";
        if (t.schedule) {
            const dateObj = new Date(t.schedule);
            formattedTime = dateObj.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        }

        const safeTitle = (t.title || '').replace(/'/g, "\\'");
        const category = t.category || 'br-solo'; 
        
        let displayPrize = 0;
        if (category === 'br-solo') {
            displayPrize = Number(t.prize1 || 0) + Number(t.prize2 || 0) + Number(t.prize3 || 0);
        } else if (category === 'br-squad') {
            displayPrize = Number(t.booyahPrize || t.prize1 || 0);
        } else {
            displayPrize = Number(t.winnerPrize || t.prize1 || 0);
        }

        const gameTypeTag = category.includes('solo') ? 'SOLO' : 'SQUAD';
        const modeLabel = category.startsWith('br') ? `BR (${gameTypeTag})` : `CS (${gameTypeTag})`;

        let thirdColumnHtml = '';
        if (category.startsWith('br')) {
            thirdColumnHtml = `
                <div>
                    <div class="t-label">Per Kill</div>
                    <div class="t-val" style="color: var(--success);">🪙 ${Number(t.perKill) || 0}</div>
                </div>
            `;
        } else {
            thirdColumnHtml = `
                <div>
                    <div class="t-label">Winner</div>
                    <div class="t-val" style="color: var(--success);">🪙 ${displayPrize}</div>
                </div>
            `;
        }

        listDiv.innerHTML += `
            <div class="t-card" onclick="openTournamentDetailsModal('${safeTitle}', '${modeLabel}', '${category}', ${maxSlots}, ${currentJoined}, ${Number(t.fee) || 0}, ${Number(t.prize1) || 0}, ${Number(t.prize2) || 0}, ${Number(t.prize3) || 0}, ${Number(t.booyahPrize) || 0}, ${Number(t.winnerPrize) || 0}, ${displayPrize}, ${Number(t.perKill) || 0}, '${t.map}', '${t.schedule || ''}', '${t.room || 'Not published yet'}', '${tId}', ${isJoined})">
                <div class="t-header">
                    <span class="t-game-tag">Free Fire (${modeLabel})</span>
                    <span style="font-size: 12px; color: var(--success); font-weight: bold;">● Slots: ${currentJoined}/${maxSlots}</span>
                </div>
                <div class="t-title">${t.title}</div>
                <div class="t-grid">
                    <div>
                        <div class="t-label">Prize Pool</div>
                        <div class="t-val" style="color: var(--accent);">🪙 ${displayPrize}</div>
                    </div>
                    <div>
                        <div class="t-label">Entry Fee</div>
                        <div class="t-val">🪙 ${Number(t.fee) || 0}</div>
                    </div>
                    ${thirdColumnHtml}
                </div>
                <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 12px; display: flex; justify-content: space-between;">
                    <span>🗺️ Map: <b>${t.map}</b></span>
                    <span>⏰ Time: <b>${formattedTime}</b></span>
                </div>
                ${isJoined 
                    ? `<button class="btn" style="background: #1e293b; color: var(--success); border: 1px solid var(--success);" onclick="event.stopPropagation(); openRoomModal('${tId}', '${t.schedule}', '${t.room || 'Not published yet'}')">📍 View Room Details</button>`
                    : `<button class="btn" style="background: var(--accent); color: #05080f;" onclick="event.stopPropagation(); openJoinModal('${tId}', '${safeTitle}', '${category}', ${Number(t.fee) || 0}, ${maxSlots})">Join Match</button>`
                }
            </div>
        `;
    });
}

window.handleCategoryChange = function() {
    const categorySelect = document.getElementById('tCategory');
    const container = document.getElementById('prizeInputsContainer');
    const perKillGroup = document.getElementById('perKillGroup');
    if (!categorySelect || !container) return;

    const val = categorySelect.value;

    if (val === 'br-solo') {
        container.innerHTML = `
            <div class="input-group"><label class="form-label">1st Rank Prize (Booyah)</label><input type="number" id="tPrize1" class="form-input" placeholder="e.g. 100" required></div>
            <div class="input-group"><label class="form-label">2nd Rank Prize</label><input type="number" id="tPrize2" class="form-input" placeholder="e.g. 50" required></div>
            <div class="input-group"><label class="form-label">3rd Rank Prize</label><input type="number" id="tPrize3" class="form-input" placeholder="e.g. 25" required></div>
        `;
        if(perKillGroup) perKillGroup.style.display = 'block';
    } else if (val === 'br-squad') {
        container.innerHTML = `
            <div class="input-group"><label class="form-label">Booyah / Squad Winner Prize</label><input type="number" id="tBooyahPrize" class="form-input" placeholder="e.g. 200" required></div>
        `;
        if(perKillGroup) perKillGroup.style.display = 'block';
    } else if (val === 'cs-solo' || val === 'cs-squad') {
        container.innerHTML = `
            <div class="input-group"><label class="form-label">Winner / Winner Team Prize</label><input type="number" id="tWinnerPrize" class="form-input" placeholder="e.g. 150" required></div>
        `;
        if(perKillGroup) perKillGroup.style.display = 'none';
    }
}

window.toggleSubFilters = function(type, btn) {
    document.querySelectorAll('.filter-container .filter-chip').forEach(b => b.classList.remove('active-chip'));
    if(btn) btn.classList.add('active-chip');

    const brSub = document.getElementById('brSubFilters');
    const csSub = document.getElementById('csSubFilters');

    if (type === 'br') {
        if(brSub) brSub.style.display = 'flex';
        if(csSub) csSub.style.display = 'none';
        const firstSubBtn = brSub ? brSub.querySelector('.sub-chip') : null;
        filterTournaments('br-solo', firstSubBtn);
    } else if (type === 'cs') {
        if(csSub) csSub.style.display = 'flex';
        if(brSub) brSub.style.display = 'none';
        const firstSubBtn = csSub ? csSub.querySelector('.sub-chip') : null;
        filterTournaments('cs-solo', firstSubBtn);
    }
}

window.filterTournaments = function(filterType, btn) {
    currentSelectedFilter = filterType;
    
    if (btn) {
        if (filterType.startsWith('br-') || filterType.startsWith('cs-')) {
            document.querySelectorAll('.sub-chip').forEach(b => b.classList.remove('active-sub'));
            btn.classList.add('active-sub');
        } else if (filterType === 'all') {
            document.querySelectorAll('.filter-container .filter-chip').forEach(b => b.classList.remove('active-chip'));
            btn.classList.add('active-chip');
            const brSub = document.getElementById('brSubFilters');
            const csSub = document.getElementById('csSubFilters');
            if(brSub) brSub.style.display = 'none';
            if(csSub) csSub.style.display = 'none';
        }
    }

    if (filterType === 'all') {
        renderTournamentList(allTournamentsCache);
    } else {
        const filtered = allTournamentsCache.filter(t => t.category === filterType);
        renderTournamentList(filtered);
    }
}

window.openTournamentDetailsModal = function(title, modeLabel, category, slots, currentJoined, fee, p1, p2, p3, booyahPrize, winnerPrize, totalPrize, perKill, map, scheduleTime, room, id, isJoined) {
    if (window.activeRoomInterval) clearInterval(window.activeRoomInterval);
    
    const modal = document.getElementById('customModal');
    const titleEl = document.getElementById('modalTitle');
    const bodyEl = document.getElementById('modalBody');
    const iconEl = document.getElementById('modalHeaderIcon');
    const submitBtn = document.getElementById('modalSubmitBtn');
    const closeBtn = document.getElementById('modalCloseBtn');
    
    iconEl.innerText = "🏆";
    titleEl.innerText = title;

    let formattedTime = "TBA";
    if (scheduleTime) {
        const dateObj = new Date(scheduleTime);
        formattedTime = dateObj.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    }

    let prizeHtml = '';
    let perKillHtml = '';

    const isBrCategory = category.startsWith('br');
    const perKillText = (isBrCategory && Number(perKill) > 0) ? ` <span style="font-size: 10px; color: var(--success); font-weight: normal;">(+ Per Kill)</span>` : '';

    if (category === 'br-solo') {
        prizeHtml = `
            <div style="background: #05080f; border: 1px solid var(--card-border); padding: 12px; border-radius: 12px; margin-bottom: 12px; text-align: left;">
                <div style="font-size: 12px; font-weight: bold; color: var(--accent); margin-bottom: 8px; text-align: center;">🏆 Prize Distribution (Total: 🪙 ${totalPrize})</div>
                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px; margin-bottom: 6px; padding: 6px 10px; background: rgba(255,255,255,0.02); border-radius: 8px;">
                    <span>🥇 1st Rank (Booyah)${perKillText}</span><b style="color: var(--success);">🪙 ${p1}</b>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px; margin-bottom: 6px; padding: 6px 10px; background: rgba(255,255,255,0.02); border-radius: 8px;">
                    <span>🥈 2nd Rank${perKillText}</span><b style="color: var(--accent);">🪙 ${p2}</b>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px; padding: 6px 10px; background: rgba(255,255,255,0.02); border-radius: 8px;">
                    <span>🥉 3rd Rank${perKillText}</span><b style="color: #38bdf8;">🪙 ${p3}</b>
                </div>
            </div>
        `;
        perKillHtml = `
            <div style="background: #05080f; border: 1px solid var(--card-border); padding: 10px; border-radius: 12px; text-align: center;">
                <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 3px;">Per Kill</div>
                <div style="font-size: 14px; font-weight: 800; color: var(--success);">🪙 ${perKill}</div>
            </div>
        `;
    } else if (category === 'br-squad') {
        prizeHtml = `
            <div style="background: #05080f; border: 1px solid var(--card-border); padding: 14px; border-radius: 12px; margin-bottom: 12px; text-align: center;">
                <div style="font-size: 12px; font-weight: bold; color: var(--accent); margin-bottom: 6px;">🦅 BR Squad Prize ${perKillText}</div>
                <div style="font-size: 16px; font-weight: 800; color: var(--success);">🪙 ${booyahPrize || totalPrize} (Winning Squad)</div>
            </div>
        `;
        perKillHtml = `
            <div style="background: #05080f; border: 1px solid var(--card-border); padding: 10px; border-radius: 12px; text-align: center;">
                <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 3px;">Per Kill</div>
                <div style="font-size: 14px; font-weight: 800; color: var(--success);">🪙 ${perKill}</div>
            </div>
        `;
    } else if (category === 'cs-solo' || category === 'cs-squad') {
        prizeHtml = `
            <div style="background: #05080f; border: 1px solid var(--card-border); padding: 14px; border-radius: 12px; margin-bottom: 12px; text-align: center;">
                <div style="font-size: 12px; font-weight: bold; color: var(--accent); margin-bottom: 6px;">🛡️ Winner Prize</div>
                <div style="font-size: 16px; font-weight: 800; color: var(--success);">🪙 ${winnerPrize || totalPrize}</div>
            </div>
        `;
        perKillHtml = '';
    }

    bodyEl.innerHTML = `
        <div style="text-align: left;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <span style="background: rgba(245,158,11,0.1); padding: 4px 10px; border-radius: 8px; font-size: 11px; color: var(--accent); font-weight: 700;">Free Fire (${modeLabel})</span>
                <span style="font-size: 12px; color: var(--success); font-weight: bold;">● Slots: ${currentJoined}/${slots}</span>
            </div>

            ${prizeHtml}

            <div style="display: grid; grid-template-columns: repeat(${perKillHtml ? '2' : '1'}, 1fr); gap: 10px; margin-bottom: 12px;">
                <div style="background: #05080f; border: 1px solid var(--card-border); padding: 10px; border-radius: 12px; text-align: center;">
                    <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 3px;">Entry Fee</div>
                    <div style="font-size: 14px; font-weight: 800; color: white;">🪙 ${fee}</div>
                </div>
                ${perKillHtml}
            </div>

            <div style="background: #05080f; border: 1px solid var(--card-border); padding: 12px; border-radius: 12px; margin-bottom: 12px; font-size: 12px; color: var(--text-muted); display: flex; justify-content: space-between;">
                <span>🗺️ Map: <b style="color: white;">${map}</b></span>
                <span>⏰ Time: <b style="color: white;">${formattedTime}</b></span>
            </div>
        </div>
    `;

    if(submitBtn) {
        submitBtn.style.display = 'block';
        if(isJoined) {
            submitBtn.innerText = "View Room Details";
            submitBtn.className = "modal-btn-cancel";
            submitBtn.onclick = () => {
                modal.classList.add('hidden');
                openRoomModal(id, scheduleTime, room);
            };
        } else {
            submitBtn.innerText = "Join Match Now";
            submitBtn.className = "modal-btn-submit";
            submitBtn.onclick = () => {
                modal.classList.add('hidden');
                openJoinModal(id, title, category, fee, slots);
            };
        }
    }

    if(closeBtn) {
        closeBtn.innerText = "Close";
        closeBtn.className = "modal-btn-cancel";
        closeBtn.onclick = () => modal.classList.add('hidden');
    }

    modal.classList.remove('hidden');
};

window.openJoinModal = async function(id, title, category, fee, maxSlots) {
    if (window.activeRoomInterval) clearInterval(window.activeRoomInterval);
    const modal = document.getElementById('customModal');
    const titleEl = document.getElementById('modalTitle');
    const bodyEl = document.getElementById('modalBody');
    const iconEl = document.getElementById('modalHeaderIcon');
    const submitBtn = document.getElementById('modalSubmitBtn');
    const closeBtn = document.getElementById('modalCloseBtn');

    iconEl.innerText = "⚔️";
    titleEl.innerText = `Join: ${title}`;

    let isSquad = category.includes('squad'); 

    let savedUid = '';
    let savedContact = '';
    let currentBalance = 0;

    try {
        const userDocRef = doc(db, "users", deviceUserId);
        const userSnap = await getDoc(userDocRef);
        if (userSnap.exists()) {
            savedUid = userSnap.data().uid || '';
            savedContact = userSnap.data().contact || '';
            currentBalance = Number(userSnap.data().balance) || 0;
        }
    } catch(e) {
        console.log("Could not fetch user profile");
    }

    let formHtml = `
        <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 14px; text-align: center;">Entry Fee: <b style="color: var(--accent);">${fee} Coins</b> | Balance: <b style="color: var(--success);">${currentBalance} Coins</b></p>
    `;

    if (isSquad) {
        formHtml += `
            <div style="max-height: 250px; overflow-y: auto; padding-right: 4px; margin-bottom: 12px; text-align: left;">
                <div style="font-size: 12px; color: var(--accent); font-weight: bold; margin-bottom: 6px;">Leader Details (Player 1)</div>
                <div class="input-group" style="margin-bottom: 8px;">
                    <input type="text" id="modalFFId1" class="form-input" value="${savedUid}" placeholder="Leader Free Fire IGN / ID" style="padding: 10px; font-size: 12px;">
                </div>
                
                <div style="font-size: 12px; color: var(--text-muted); font-weight: bold; margin: 10px 0 6px 0;">Player 2 Details</div>
                <div class="input-group" style="margin-bottom: 8px;">
                    <input type="text" id="modalFFId2" class="form-input" placeholder="Player 2 IGN / ID" style="padding: 10px; font-size: 12px;">
                </div>

                <div style="font-size: 12px; color: var(--text-muted); font-weight: bold; margin: 10px 0 6px 0;">Player 3 Details</div>
                <div class="input-group" style="margin-bottom: 8px;">
                    <input type="text" id="modalFFId3" class="form-input" placeholder="Player 3 IGN / ID" style="padding: 10px; font-size: 12px;">
                </div>

                <div style="font-size: 12px; color: var(--text-muted); font-weight: bold; margin: 10px 0 6px 0;">Player 4 Details</div>
                <div class="input-group" style="margin-bottom: 8px;">
                    <input type="text" id="modalFFId4" class="form-input" placeholder="Player 4 IGN / ID" style="padding: 10px; font-size: 12px;">
                </div>

                <div class="input-group" style="margin-top: 10px;">
                    <label class="form-label" style="font-size: 11px;">Squad Contact (Email or Phone)</label>
                    <input type="text" id="modalContact" class="form-input" value="${savedContact}" placeholder="e.g. leader@gmail.com" style="padding: 10px; font-size: 12px;">
                </div>
            </div>
        `;
    } else {
        formHtml += `
            <div class="input-group" style="text-align: left; margin-bottom: 12px;">
                <label class="form-label">Free Fire ID / IGN</label>
                <input type="text" id="modalFFId" class="form-input" value="${savedUid}" placeholder="e.g. ProLegend99">
            </div>
            <div class="input-group" style="text-align: left; margin-bottom: 16px;">
                <label class="form-label">Email or Phone Number</label>
                <input type="text" id="modalContact" class="form-input" value="${savedContact}" placeholder="e.g. gamer@gmail.com">
            </div>
        `;
    }

    bodyEl.innerHTML = formHtml;

    if(closeBtn) {
        closeBtn.innerText = "Cancel";
        closeBtn.onclick = () => modal.classList.add('hidden');
    }
    if(submitBtn) {
        submitBtn.style.display = 'block';
        submitBtn.innerText = "Join Now";
        submitBtn.onclick = async () => {
            if (currentBalance < fee) {
                showCustomAlert("Low Balance", `Insufficient balance! You need ${fee} Coins to join.`, "⚠️");
                return;
            }

            let playerInfo = {};
            const contact = document.getElementById('modalContact').value.trim();

            if (isSquad) {
                const p1 = document.getElementById('modalFFId1').value.trim();
                const p2 = document.getElementById('modalFFId2').value.trim();
                const p3 = document.getElementById('modalFFId3').value.trim();
                const p4 = document.getElementById('modalFFId4').value.trim();

                if (!p1 || !p2 || !p3 || !p4 || !contact) {
                    showCustomAlert("Incomplete", "Please fill in all 4 players' IDs and contact info!", "⚠️");
                    return;
                }
                playerInfo = { deviceId: deviceUserId, squadLeader: p1, players: [p1, p2, p3, p4], contact, joinedAt: new Date().toISOString() };
            } else {
                const ffId = document.getElementById('modalFFId').value.trim();
                if (!ffId || !contact) {
                    showCustomAlert("Incomplete", "Please fill in all fields!", "⚠️");
                    return;
                }
                playerInfo = { deviceId: deviceUserId, ffId, contact, joinedAt: new Date().toISOString() };
            }

            try {
                const tRef = doc(db, "tournaments", id);
                const tSnap = await getDoc(tRef);
                if (!tSnap.exists()) return;

                const tData = tSnap.data();
                const players = tData.players || [];

                let currentFilledSlots = 0;
                players.forEach(p => {
                    if (isSquad && p.players && Array.isArray(p.players)) {
                        currentFilledSlots += p.players.length;
                    } else {
                        currentFilledSlots += 1;
                    }
                });

                const slotsNeeded = isSquad ? 4 : 1;

                if (currentFilledSlots + slotsNeeded > maxSlots) {
                    showCustomAlert("Slots Full", "Sorry! Not available slots for this entry.", "⚠️");
                    modal.classList.add('hidden');
                    return;
                }

                const userRef = doc(db, "users", deviceUserId);
                await setDoc(userRef, { balance: currentBalance - fee }, { merge: true });

                await addDoc(collection(db, "transactions"), {
                    deviceId: deviceUserId,
                    title: `Match Entry Fee`,
                    desc: title,
                    amount: fee,
                    type: "withdrawal",
                    createdAt: new Date().toISOString()
                });

                await updateDoc(tRef, { players: arrayUnion(playerInfo) });

                showCustomAlert("Success! 🎉", `Successfully registered for <b>${title}</b>!`, "✅", () => {
                    loadUserWallet();
                    loadUserTransactions();
                    loadTournaments();
                });

            } catch (e) {
                showCustomAlert("Error", e.message, "⚠️");
            }
        };
    }

    modal.classList.remove('hidden');
};

window.openRoomModal = function(id, scheduleTime, roomData) {
    if (window.activeRoomInterval) clearInterval(window.activeRoomInterval);
    
    const modal = document.getElementById('customModal');
    const titleEl = document.getElementById('modalTitle');
    const bodyEl = document.getElementById('modalBody');
    const iconEl = document.getElementById('modalHeaderIcon');
    const submitBtn = document.getElementById('modalSubmitBtn');
    const closeBtn = document.getElementById('modalCloseBtn');

    iconEl.innerText = "🔑";
    titleEl.innerText = "Room Details";

    if (!roomData || roomData === 'Not published yet') {
        bodyEl.innerHTML = `
            <div style="text-align: center; padding: 10px 0;">
                <div style="font-size: 32px; margin-bottom: 10px;">⏳</div>
                <h4 style="color: white; font-size: 15px; margin-bottom: 6px;">Waiting for Admin</h4>
                <p style="color: var(--text-muted); font-size: 13px;">Admin has not published the Room ID & Password yet. Please check back closer to match time!</p>
            </div>
        `;
        if(submitBtn) submitBtn.style.display = 'none';
    } else {
        bodyEl.innerHTML = `
            <div style="background: #05080f; border: 1px solid var(--card-border); padding: 14px; border-radius: 12px; margin-bottom: 15px; text-align: left;">
                <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 4px;">🔓 ROOM ID & PASSWORD</p>
                <div id="roomCredentialsText" style="font-size: 15px; font-weight: bold; color: var(--success); word-break: break-all;">${roomData}</div>
            </div>
        `;
        if(submitBtn) {
            submitBtn.style.display = 'block';
            submitBtn.innerText = "📋 Copy Details";
            submitBtn.onclick = () => {
                navigator.clipboard.writeText(roomData);
                showCustomAlert("Copied! ✅", "Room details copied to clipboard.", "📋");
            };
        }
    }

    if(closeBtn) {
        closeBtn.innerText = "Close";
        closeBtn.onclick = () => modal.classList.add('hidden');
    }

    modal.classList.remove('hidden');
};

// --- Add Coins Deposit Modal ---
window.openAddMoneyModal = async function() {
    await loadPaymentSettings();

    const modal = document.getElementById('customModal');
    const titleEl = document.getElementById('modalTitle');
    const bodyEl = document.getElementById('modalBody');
    const iconEl = document.getElementById('modalHeaderIcon');
    const submitBtn = document.getElementById('modalSubmitBtn');
    const closeBtn = document.getElementById('modalCloseBtn');

    iconEl.innerText = "🪙";
    titleEl.innerText = "Add Coins (Deposit)";

    let upiId = currentAdminUpi;
    let qrImgSrc = currentAdminQr;

    bodyEl.innerHTML = `
        <div style="max-height: 350px; overflow-y: auto; text-align: center;">
            <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 8px;">Minimum Deposit: <b style="color: var(--accent);">20 Coins (₹20)</b></p>
            
            <div class="input-group" style="text-align: left; margin-bottom: 12px;">
                <label class="form-label" style="font-size: 11px;">Enter Amount to Deposit (₹ / Coins)</label>
                <input type="number" id="depositAmountInput" class="form-input" placeholder="e.g. 50" value="50" min="20" style="padding: 10px; font-size: 13px;" oninput="updateUpiLink(this)">
            </div>

            <div style="background: white; padding: 10px; border-radius: 12px; display: inline-block; margin-bottom: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.3);">
                <img id="dynamicQrImg" src="${qrImgSrc}" alt="UPI QR Code" style="width: 130px; height: 130px; display: block; object-fit: contain;">
            </div>

            <div style="background: #05080f; border: 1px solid var(--card-border); padding: 10px; border-radius: 10px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 11px; color: white; word-break: break-all;" id="upiIdText">${upiId}</span>
                <button type="button" class="btn" style="background: var(--accent); color: #05080f; padding: 6px 10px; font-size: 11px; width: auto;" onclick="copyUpiId()">Copy</button>
            </div>

            <div style="margin-bottom: 6px;">
                <a id="dynamicUpiBtn" href="upi://pay?pa=${upiId}&pn=NextLeveleSports&am=50&cu=INR" class="btn" style="background: #10b981; color: white; text-decoration: none; display: block; padding: 12px; font-size: 13px; font-weight: bold; border-radius: 12px;">⚡ Pay ₹50 via UPI App</a>
            </div>

            <div style="text-align: left; background: #05080f; border: 1px solid var(--card-border); padding: 12px; border-radius: 12px; margin-top: 10px;">
                <label class="form-label" style="font-size: 11px; margin-bottom: 4px;">Enter UTR / Transaction ID (Required)</label>
                <input type="text" id="utrInput" class="form-input" placeholder="e.g. 4235xxxxxxxx" style="padding: 10px; font-size: 12px; margin-bottom: 10px;">
            </div>
        </div>
    `;

    if(submitBtn) {
        submitBtn.style.display = 'block';
        submitBtn.innerText = "Submit Deposit";
        submitBtn.onclick = submitDepositRequest;
    }
    if(closeBtn) {
        closeBtn.innerText = "Cancel";
        closeBtn.onclick = () => modal.classList.add('hidden');
    }

    modal.classList.remove('hidden');
};

window.updateUpiLink = function(input) {
    let amt = Number(input.value) || 20;
    let upiId = currentAdminUpi;
    const upiBtn = document.getElementById('dynamicUpiBtn');

    if(upiBtn) {
        upiBtn.href = `upi://pay?pa=${upiId}&pn=NextLeveleSports&am=${amt}&cu=INR`;
        upiBtn.innerText = `⚡ Pay ₹${amt} via UPI App`;
    }
};

window.copyUpiId = function() {
    navigator.clipboard.writeText(currentAdminUpi);
    showCustomAlert("Copied! ✅", "UPI ID copied successfully!", "📋");
};

window.submitDepositRequest = async function() {
    const utr = document.getElementById('utrInput').value.trim();
    const amount = Number(document.getElementById('depositAmountInput').value) || 20;

    if (!utr) {
        showCustomAlert("Missing UTR", "Please enter the UTR / Transaction ID to submit request!", "⚠️");
        return;
    }
    if (amount < 20) {
        showCustomAlert("Invalid Amount", "Minimum deposit amount is 20 Coins!", "⚠️");
        return;
    }

    try {
        await addDoc(collection(db, "deposits"), {
            deviceId: deviceUserId,
            utr: utr,
            amount: amount,
            status: "pending",
            createdAt: new Date().toISOString()
        });

        showCustomAlert("Request Submitted! 🎉", `Your deposit request of <b>${amount} Coins</b> has been submitted. Coins will be added within 1-2 hours after verification.`, "⏳", () => {
            document.getElementById('customModal').classList.add('hidden');
        });
    } catch (e) {
        showCustomAlert("Error", e.message, "⚠️");
    }
};

window.openWithdrawModal = function() {
    const modal = document.getElementById('customModal');
    const titleEl = document.getElementById('modalTitle');
    const bodyEl = document.getElementById('modalBody');
    const iconEl = document.getElementById('modalHeaderIcon');
    const submitBtn = document.getElementById('modalSubmitBtn');
    const closeBtn = document.getElementById('modalCloseBtn');

    iconEl.innerText = "💸";
    titleEl.innerText = "Withdraw Coins";

    bodyEl.innerHTML = `
        <div style="text-align: left;">
            <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 14px; text-align: center;">Minimum Withdrawal: <b style="color: var(--accent);">20 Coins (₹20)</b></p>
            
            <div class="input-group" style="margin-bottom: 12px;">
                <label class="form-label">Enter Your UPI ID / Paytm Number</label>
                <input type="text" id="withdrawUpi" class="form-input" placeholder="e.g. username@okhdfcbank">
            </div>
            <div class="input-group" style="margin-bottom: 16px;">
                <label class="form-label">Withdrawal Amount (Coins)</label>
                <input type="number" id="withdrawAmount" class="form-input" placeholder="Min 20">
            </div>
        </div>
    `;

    if(submitBtn) {
        submitBtn.style.display = 'block';
        submitBtn.innerText = "Submit Request";
        submitBtn.onclick = submitWithdrawRequest;
    }
    if(closeBtn) {
        closeBtn.innerText = "Cancel";
        closeBtn.onclick = () => modal.classList.add('hidden');
    }

    modal.classList.remove('hidden');
};

window.submitWithdrawRequest = async function() {
    const upi = document.getElementById('withdrawUpi').value.trim();
    const amount = Number(document.getElementById('withdrawAmount').value);

    if (!upi || !amount) {
        showCustomAlert("Incomplete", "Please fill in all fields!", "⚠️");
        return;
    }
    if (amount < 20) {
        showCustomAlert("Invalid Amount", "Minimum withdrawal amount is 20 Coins!", "⚠️");
        return;
    }
          const userDocRef = doc(db, "users", deviceUserId);
        const userSnap = await getDoc(userDocRef);
        const currentBalance = userSnap.exists() ? (Number(userSnap.data().balance) || 0) : 0;

        if (amount > currentBalance) {
            showCustomAlert("Insufficient Balance", `You only have ${currentBalance} coins available in your wallet!`, "⚠️");
            return;
        }

    try {
        await addDoc(collection(db, "withdrawals"), {
            deviceId: deviceUserId,
            upi: upi,
            amount: amount,
            status: "pending",
            createdAt: new Date().toISOString()
        });

        showCustomAlert("Request Submitted! 🚀", `Your payout request of <b>${amount} Coins</b> has been sent to admin for verification.`, "✅", () => {
            document.getElementById('customModal').classList.add('hidden');
        });
    } catch (e) {
        showCustomAlert("Error", e.message, "⚠️");
    }
};

window.openProfileSettingsModal = async function() {
    const modal = document.getElementById('customModal');
    const titleEl = document.getElementById('modalTitle');
    const bodyEl = document.getElementById('modalBody');
    const iconEl = document.getElementById('modalHeaderIcon');
    const submitBtn = document.getElementById('modalSubmitBtn');
    const closeBtn = document.getElementById('modalCloseBtn');

    iconEl.innerText = "⚙️";
    titleEl.innerText = "Edit Profile & FF ID";

    let savedName = '';
    let savedUid = '';
    let savedContact = '';

    try {
        const userDocRef = doc(db, "users", deviceUserId);
        const userSnap = await getDoc(userDocRef);
        if (userSnap.exists()) {
            savedName = userSnap.data().name || '';
            savedUid = userSnap.data().uid || '';
            savedContact = userSnap.data().contact || '';
        }
    } catch(e) {
        console.log("Error fetching profile from cloud");
    }

    bodyEl.innerHTML = `
        <div style="text-align: left;">
            <div style="margin-bottom: 12px;">
                <label class="form-label">In-Game Name (IGN)</label>
                <input type="text" id="editIgn" class="form-input" value="${savedName}" placeholder="e.g. ProLegend">
            </div>
            <div style="margin-bottom: 12px;">
                <label class="form-label">Free Fire UID</label>
                <input type="text" id="editUid" class="form-input" value="${savedUid}" placeholder="e.g. 123456789">
            </div>
            <div style="margin-bottom: 16px;">
                <label class="form-label">WhatsApp / Phone Number</label>
                <input type="text" id="editContact" class="form-input" value="${savedContact}" placeholder="e.g. 9876543210">
            </div>
        </div>
    `;

    if(submitBtn) {
        submitBtn.style.display = 'block';
        submitBtn.innerText = "Save to Cloud ☁️";
        submitBtn.onclick = async () => {
            const name = document.getElementById('editIgn').value.trim();
            const uid = document.getElementById('editUid').value.trim();
            const contact = document.getElementById('editContact').value.trim();

            if(!name || !uid || !contact) {
                showCustomAlert("Incomplete", "Please fill in all fields!", "⚠️");
                return;
            }

            try {
                await setDoc(doc(db, "users", deviceUserId), {
                    name: name,
                    uid: uid,
                    contact: contact,
                    updatedAt: new Date().toISOString()
                }, { merge: true });

                document.getElementById('displayProfileName').innerText = name;
                document.getElementById('displayProfileUid').innerText = uid;

                showCustomAlert("Success! ☁️", "Profile saved to Firebase Cloud successfully!", "✅", () => {
                    modal.classList.add('hidden');
                });
            } catch (err) {
                showCustomAlert("Error", err.message, "⚠️");
            }
        };
    }

    if(closeBtn) {
        closeBtn.innerText = "Cancel";
        closeBtn.onclick = () => modal.classList.add('hidden');
    }

    modal.classList.remove('hidden');
};

window.openJoinedMatchesModal = function() {
    const modal = document.getElementById('customModal');
    const titleEl = document.getElementById('modalTitle');
    const bodyEl = document.getElementById('modalBody');
    const iconEl = document.getElementById('modalHeaderIcon');
    const submitBtn = document.getElementById('modalSubmitBtn');
    const closeBtn = document.getElementById('modalCloseBtn');

    iconEl.innerText = "⚔️";
    titleEl.innerText = "My Joined Matches";

    let html = `<div style="max-height: 250px; overflow-y: auto; text-align: left;">`;
    let joinedCount = 0;
    
    allTournamentsCache.forEach(t => {
        const players = t.players || [];
        if (players.some(p => p.deviceId === deviceUserId)) {
            joinedCount++;
            html += `
                <div style="background: #05080f; border: 1px solid var(--card-border); padding: 12px; border-radius: 12px; margin-bottom: 10px;">
                    <div style="font-weight: bold; color: white; font-size: 14px; margin-bottom: 4px;">${t.title}</div>
                    <div style="font-size: 12px; color: var(--success); margin-bottom: 6px;">Status: Registered Successfully ✅</div>
                    <button class="btn" style="padding: 6px 10px; font-size: 11px; width: auto; background: #1e293b; color: var(--success); border: 1px solid var(--success);" onclick="openRoomModal('${t.id}', '${t.schedule}', '${t.room || 'Not published yet'}')">📍 View Room Details</button>
                </div>
            `;
        }
    });

    if (joinedCount === 0) {
        html += `<p style="color: var(--text-muted); text-align: center; padding: 20px;">You haven't joined any matches yet.</p>`;
    }
    html += `</div>`;

    bodyEl.innerHTML = html;
    
    if(submitBtn) submitBtn.style.display = 'none';
    if(closeBtn) {
        closeBtn.innerText = "Close";
        closeBtn.onclick = () => modal.classList.add('hidden');
    }

    modal.classList.remove('hidden');
};

window.openWalletHistoryModal = async function() {
    const modal = document.getElementById('customModal');
    const titleEl = document.getElementById('modalTitle');
    const bodyEl = document.getElementById('modalBody');
    const iconEl = document.getElementById('modalHeaderIcon');
    const submitBtn = document.getElementById('modalSubmitBtn');
    const closeBtn = document.getElementById('modalCloseBtn');

    iconEl.innerText = "🪙";
    titleEl.innerText = "My Transaction Ledger";

    try {
        const q = query(collection(db, "transactions"), where("deviceId", "==", deviceUserId));
        const querySnapshot = await getDocs(q);

        let html = `<div style="max-height: 250px; overflow-y: auto; text-align: left;">`;
        let hasTx = false;

        querySnapshot.forEach((docSnap) => {
            hasTx = true;
            const tx = docSnap.data();
            const isDeposit = tx.type === "deposit";
            const sign = isDeposit ? "+" : "-";
            const colorClass = isDeposit ? "var(--success)" : "var(--danger)";

            html += `
                <div style="background: #05080f; border: 1px solid var(--card-border); padding: 10px 12px; border-radius: 10px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; font-size: 12px;">
                    <div>
                        <b>${tx.title}</b>
                        <div style="font-size: 10px; color: var(--text-muted);">${tx.desc || 'Account Activity'}</div>
                    </div>
                    <b style="color: ${colorClass};">${sign}🪙 ${tx.amount}</b>
                </div>
            `;
        });

        if (!hasTx) {
            html += `<p style="color: var(--text-muted); text-align: center; padding: 15px; font-size: 12px;">No transactions found</p>`;
        }

        html += `</div>`;
        bodyEl.innerHTML = html;
    } catch (e) {
        bodyEl.innerHTML = `<p style="color: var(--danger); text-align: center;">Error loading transactions.</p>`;
    }

    if(submitBtn) submitBtn.style.display = 'none';
    if(closeBtn) {
        closeBtn.innerText = "Close";
        closeBtn.onclick = () => modal.classList.add('hidden');
    }

    modal.classList.remove('hidden');
};

window.openReferralModal = function() {
    const modal = document.getElementById('customModal');
    const titleEl = document.getElementById('modalTitle');
    const bodyEl = document.getElementById('modalBody');
    const iconEl = document.getElementById('modalHeaderIcon');
    const submitBtn = document.getElementById('modalSubmitBtn');
    const closeBtn = document.getElementById('modalCloseBtn');

    iconEl.innerText = "🎁";
    titleEl.innerText = "Invite & Earn";

    let referralCode = "NEXT" + (deviceUserId ? deviceUserId.slice(-4).toUpperCase() : '0000');

    bodyEl.innerHTML = `
        <div style="max-height: 350px; overflow-y: auto; text-align: left;">
            <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 12px; text-align: center;">
                Share your code with friends. When they join and register for a match, you get <b style="color: var(--accent);">🪙 100 Coins</b> free!
            </p>

            <div class="referral-box" style="background: #05080f; border: 1px dashed var(--accent); padding: 16px; border-radius: 14px; text-align: center; margin-bottom: 16px;">
                <div style="font-size: 12px; color: var(--text-muted);">Your Exclusive Promo Code</div>
                <div style="font-size: 18px; font-weight: 800; color: var(--accent); letter-spacing: 2px; background: rgba(245, 158, 11, 0.1); padding: 10px; border-radius: 10px; margin: 10px 0; border: 1px solid rgba(245, 158, 11, 0.3);">${referralCode}</div>
                <button type="button" class="btn" style="background: var(--accent); color: #05080f; padding: 8px 12px; font-size: 12px;" onclick="copyReferralCode('${referralCode}')">📋 Copy Code</button>
            </div>

            <div style="margin-bottom: 14px;">
                <button type="button" class="btn" style="background: #25D366; color: white;" onclick="shareOnWhatsApp('${referralCode}')">💬 Share via WhatsApp</button>
            </div>
        </div>
    `;

    if(submitBtn) submitBtn.style.display = 'none';
    if(closeBtn) {
        closeBtn.innerText = "Close";
        closeBtn.onclick = () => modal.classList.add('hidden');
    }

    modal.classList.remove('hidden');
};

window.copyReferralCode = function(code) {
    navigator.clipboard.writeText(code);
    showCustomAlert("Copied! ✅", "Promo code copied to clipboard!", "📋");
};

window.shareOnWhatsApp = function(code) {
    const text = encodeURIComponent(`🎮 Join NextLevel eSports using my referral code *${code}* and let's play Free Fire tournaments together!`);
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
};

window.openTelegramSupport = function() {
    window.open(`https://t.me/Next_Level_eSports`, '_blank');
};

// --- Admin Panel & Registered Users List ---
async function loadAdminTournaments() {
    const adminListDiv = document.getElementById('adminTournamentList');
    const adminUsersDiv = document.getElementById('adminRegisteredUsersList');
    if (!adminListDiv) return;

    try {
        // Load Registered Users List from Firestore users collection
        const usersSnap = await getDocs(collection(db, "users"));
        let usersHtml = '';
        let uIndex = 1;

        usersSnap.forEach((uDoc) => {
            const uData = uDoc.data();
            const userEmail = uData.contact || uData.email || 'No email';
            const userName = uData.name || 'Gamer';
            usersHtml += `
                <div style="display: flex; justify-content: space-between; align-items: center; background: #05080f; border: 1px solid var(--card-border); padding: 8px 10px; border-radius: 8px; font-size: 11px;">
                    <div><b>${uIndex}.</b> <span style="color: white;">${userName}</span> (<span style="color: var(--accent);">${userEmail}</span>)</div>
                </div>
            `;
            uIndex++;
        });

        if (uIndex === 1) {
            usersHtml = `<p style="color: var(--text-muted); font-size: 11px;">No registered users found.</p>`;
        }
        if(adminUsersDiv) adminUsersDiv.innerHTML = usersHtml;

        // Load Banners list
        let bannerListHtml = '';
        currentBannerImages.forEach((imgSrc, idx) => {
            bannerListHtml += `
                <div style="display: flex; align-items: center; justify-content: space-between; background: #05080f; border: 1px solid var(--card-border); padding: 6px 10px; border-radius: 8px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <img src="${imgSrc}" style="width: 35px; height: 25px; object-fit: cover; border-radius: 4px;">
                        <span style="font-size: 11px; color: white;">Banner ${idx + 1}</span>
                    </div>
                    <button class="btn" style="padding: 4px 8px; font-size: 10px; width: auto; background: var(--danger); color: white;" onclick="deleteBannerImage(${idx})">🗑️ Delete</button>
                </div>
            `;
        });

        if(currentBannerImages.length === 0) {
            bannerListHtml = `<p style="color: var(--text-muted); font-size: 11px;">No banners added yet.</p>`;
        }

        let html = `
            <div style="background: #0b101d; border: 1px solid var(--card-border); padding: 14px; border-radius: 14px; margin-bottom: 15px;">
                <h4 style="color: var(--accent); margin-bottom: 10px; font-size: 14px;">Manage Banner Slider Images (Direct URL)</h4>
                <div class="input-group" style="margin-bottom: 10px;">
                    <label class="form-label" style="font-size: 11px;">Paste Image Link (.jpg / .png)</label>
                    <input type="url" id="adminBannerUrlInput" class="form-input" placeholder="https://imgur.com/abc.jpg" style="padding: 10px; font-size: 12px;">
                </div>
                <button class="btn" style="background: var(--accent); color: #05080f; padding: 10px; font-size: 12px; margin-bottom: 12px;" onclick="addBannerSliderUrl()">Add Banner to Slider</button>
                
                <h5 style="color: var(--text-muted); font-size: 11px; margin-bottom: 6px;">Active Sliders:</h5>
                <div style="display: flex; flex-direction: column; gap: 6px; max-height: 180px; overflow-y: auto;">
                    ${bannerListHtml}
                </div>
            </div>
        `;

        html += `<h4 style="color: var(--accent); margin-bottom: 10px;">Tournaments Management</h4>`;
        const querySnapshot = await getDocs(collection(db, "tournaments"));
        if (querySnapshot.empty) {
            html += '<p style="color: var(--text-muted); font-size: 13px;">No tournaments created yet.</p>';
        } else {
            querySnapshot.forEach((docSnap) => {
                const tId = docSnap.id;
                const t = docSnap.data();
                const playersCount = calculateJoinedSlots(t);
                const totalSlots = Number(t.slots) || 48;

                html += `
                    <div style="background: #05080f; border: 1px solid var(--card-border); padding: 14px; border-radius: 14px; margin-bottom: 12px;">
                        <div style="font-weight: bold; font-size: 14px; margin-bottom: 4px; color: white;">${t.title} (${t.category || 'br-solo'})</div>
                        <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 10px;">Joined Slots: <b>${playersCount}/${totalSlots}</b></div>
                        <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                            <button class="btn" style="padding: 8px 12px; font-size: 11px; width: auto; background: #1e293b; color: white;" onclick="publishRoom('${tId}')">🔑 Publish ID</button>
                            <button class="btn" style="padding: 8px 12px; font-size: 11px; width: auto; background: #3b82f6; color: white;" onclick="viewPlayersModal('${tId}')">👥 View Players</button>
                            <button class="btn" style="padding: 8px 12px; font-size: 11px; width: auto; background: var(--danger); color: white;" onclick="deleteTournament('${tId}')">🗑️ Delete</button>
                        </div>
                    </div>
                `;
            });
        }

        html += `<h4 style="color: var(--accent); margin: 20px 0 10px 0;">Deposit Requests (Add Money)</h4>`;
        const depSnapshot = await getDocs(collection(db, "deposits"));
        let pendingDepCount = 0;
        depSnapshot.forEach(dSnap => {
            const d = dSnap.data();
            if(d.status === "pending") {
                pendingDepCount++;
                html += `
                    <div style="background: #05080f; border: 1px solid var(--card-border); padding: 12px; border-radius: 12px; margin-bottom: 10px; font-size: 12px;">
                        <div>User ID: <b>${d.deviceId}</b></div>
                        <div>Amount: <b style="color: var(--accent);">${d.amount} Coins</b> | UTR: <b>${d.utr}</b></div>
                        <div style="margin-top: 8px;">
                            <button class="btn" style="padding: 6px 12px; font-size: 11px; width: auto; background: var(--success); color: #05080f;" onclick="approveDeposit('${dSnap.id}', '${d.deviceId}', ${d.amount}, '${d.utr}')">Accept & Add Coins</button>
                       <div style="margin-top: 8px; display: flex; gap: 8px;">
    <button class="btn" style="padding: 6px 12px; font-size: 11px; width: auto; background: var(--success); color: #05080f;" onclick="approveDeposit('${dSnap.id}', '${d.deviceId}', ${d.amount}, '${d.utr}')">Accept & Add Coins</button>
    <button class="btn" style="padding: 6px 12px; font-size: 11px; width: auto; background: var(--danger); color: white;" onclick="deleteAdminRequest('deposits', '${dSnap.id}')">🗑️ Delete</button>
</div>
 </div>
                    </div>
                `;
            }
        });
        if(pendingDepCount === 0) html += '<p style="color: var(--text-muted); font-size: 13px;">No pending deposit requests.</p>';

        html += `<h4 style="color: var(--accent); margin: 20px 0 10px 0;">Withdrawal Requests</h4>`;
        const witSnapshot = await getDocs(collection(db, "withdrawals"));
        let pendingWitCount = 0;
        witSnapshot.forEach(wSnap => {
            const w = wSnap.data();
            if(w.status === "pending") {
                pendingWitCount++;
                html += `
                    <div style="background: #05080f; border: 1px solid var(--card-border); padding: 12px; border-radius: 12px; margin-bottom: 10px; font-size: 12px;">
                        <div>User ID: <b>${w.deviceId}</b></div>
                        <div>UPI: <b style="color: var(--accent);">${w.upi}</b> | Amount: <b>${w.amount} Coins</b></div>
                        <div style="margin-top: 8px;">
                            <button class="btn" style="padding: 6px 12px; font-size: 11px; width: auto; background: var(--success); color: #05080f;" onclick="approveWithdrawal('${wSnap.id}', '${w.deviceId}', ${w.amount}, '${w.upi}')">Accept & Deduct</button>
                  <div style="margin-top: 8px; display: flex; gap: 8px;">
    <button class="btn" style="padding: 6px 12px; font-size: 11px; width: auto; background: var(--success); color: #05080f;" onclick="approveWithdrawal('${wSnap.id}', '${w.deviceId}', ${w.amount}, '${w.upi}')">Accept & Deduct</button>
    <button class="btn" style="padding: 6px 12px; font-size: 11px; width: auto; background: var(--danger); color: white;" onclick="deleteAdminRequest('withdrawals', '${wSnap.id}')">🗑️ Delete</button>
</div>
      </div>
                    </div>
                `;
            }
        });
        if(pendingWitCount === 0) html += '<p style="color: var(--text-muted); font-size: 13px;">No pending withdrawal requests.</p>';

        adminListDiv.innerHTML = html;
    } catch (e) {
        adminListDiv.innerHTML = '<p style="color: var(--danger);">Error loading admin data.</p>';
    }
}

window.addBannerSliderUrl = async function() {
    const urlInput = document.getElementById('adminBannerUrlInput');
    const url = urlInput ? urlInput.value.trim() : '';

    if (!url) {
        showCustomAlert("Error", "Please enter a valid image URL!", "⚠️");
        return;
    }

    try {
        let updatedList = [...currentBannerImages, url].slice(0, 6);
        await setDoc(doc(db, "settings", "bannerSlider"), {
            images: updatedList,
            updatedAt: new Date().toISOString()
        });
        showCustomAlert("Success! 🚀", "Banner added successfully!", "✅");
        loadBanners();
        loadAdminTournaments();
    } catch(err) {
        showCustomAlert("Error", err.message, "⚠️");
    }
};

window.deleteBannerImage = async function(index) {
    if (confirm("Are you sure you want to delete this banner photo?")) {
        try {
            currentBannerImages.splice(index, 1);
            await setDoc(doc(db, "settings", "bannerSlider"), {
                images: currentBannerImages,
                updatedAt: new Date().toISOString()
            });
            showCustomAlert("Success", "Banner deleted successfully!", "✅");
            loadBanners();
            loadAdminTournaments();
        } catch(e) {
            showCustomAlert("Error", e.message, "⚠️");
        }
    }
};

window.approveDeposit = async function(depId, targetUserId, amount, utr) {
    try {
        await updateDoc(doc(db, "deposits", depId), { status: "approved" });

        await addDoc(collection(db, "transactions"), {
            deviceId: targetUserId,
            title: "Deposit Added",
            desc: `UTR: ${utr}`,
            amount: amount,
            type: "deposit",
            createdAt: new Date().toISOString()
        });

        const userRef = doc(db, "users", targetUserId);
        const userSnap = await getDoc(userRef);
        let currentBal = 0;
        if(userSnap.exists() && userSnap.data().balance !== undefined) {
            currentBal = Number(userSnap.data().balance);
        }

        await setDoc(userRef, { balance: currentBal + amount }, { merge: true });
        showCustomAlert("Approved! ✅", `Deposit approved! ${amount} coins added to user wallet.`);
        loadAdminTournaments();
        loadUserWallet();
        loadUserTransactions();
    } catch(e) {
        showCustomAlert("Error", e.message, "⚠️");
    }
};

window.approveWithdrawal = async function(witId, targetUserId, amount, upi) {
    try {
        const userRef = doc(db, "users", targetUserId);
        const userSnap = await getDoc(userRef);
        let currentBal = 0;
        if(userSnap.exists() && userSnap.data().balance !== undefined) {
            currentBal = Number(userSnap.data().balance);
        }

        if (currentBal < amount) {
            showCustomAlert("Low Balance", "User does not have sufficient balance for this withdrawal!", "⚠️");
            return;
        }

        await updateDoc(doc(db, "withdrawals", witId), { status: "approved" });

        await addDoc(collection(db, "transactions"), {
            deviceId: targetUserId,
            title: "Withdrawal Payout",
            desc: `UPI: ${upi}`,
            amount: amount,
            type: "withdrawal",
            createdAt: new Date().toISOString()
        });

        await setDoc(userRef, { balance: currentBal - amount }, { merge: true });

        showCustomAlert("Approved! ✅", `Withdrawal approved! ${amount} coins deducted from user wallet.`);
        loadAdminTournaments();
        loadUserWallet();
        loadUserTransactions();
    } catch(e) {
        showCustomAlert("Error", e.message, "⚠️");
    }
};

window.viewPlayersModal = async function(id) {
    try {
        const tRef = doc(db, "tournaments", id);
        const tSnap = await getDoc(tRef);
        if (!tSnap.exists()) return;

        const players = tSnap.data().players || [];
        const modal = document.getElementById('customModal');
        const titleEl = document.getElementById('modalTitle');
        const bodyEl = document.getElementById('modalBody');
        const iconEl = document.getElementById('modalHeaderIcon');
        const submitBtn = document.getElementById('modalSubmitBtn');
        const closeBtn = document.getElementById('modalCloseBtn');

        iconEl.innerText = "👥";
        titleEl.innerText = "Joined Players Management";

        if (players.length === 0) {
            bodyEl.innerHTML = `<p style="color: var(--text-muted); text-align: center; padding: 10px;">No players joined yet.</p>`;
            if(submitBtn) submitBtn.style.display = 'none';
        } else {
            if(submitBtn) submitBtn.style.display = 'none';

            let html = `<div style="max-height: 250px; overflow-y: auto; text-align: left;">`;
            players.forEach((p, idx) => {
                let displayName = p.ffId || (p.players ? p.players.join(', ') : 'Squad');
                let targetUserId = p.deviceId;
                html += `
                    <div class="player-row">
                        <div>
                            <b>${idx + 1}. ${displayName}</b>
                            <div style="font-size: 11px; color: var(--text-muted);">${p.contact}</div>
                        </div>
                        <div style="display: flex; gap: 5px;">
                            <button style="background: var(--success); color: #05080f; border: none; padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: bold; cursor: pointer;" onclick="openAddPrizeModal('${targetUserId}', '${displayName}')">🎁 Add Coins</button>
                            <button style="background: var(--danger); color: white; border: none; padding: 4px 8px; border-radius: 6px; font-size: 11px; cursor: pointer;" onclick="kickPlayer('${id}', '${idx}')">Kick</button>
                        </div>
                    </div>
                `;
            });
            html += `</div>`;
            bodyEl.innerHTML = html;
        }

        if(closeBtn) {
            closeBtn.innerText = "Close";
            closeBtn.onclick = () => modal.classList.add('hidden');
        }

        modal.classList.remove('hidden');

    } catch (e) {
        showCustomAlert("Error", e.message, "⚠️");
    }
};

window.openAddPrizeModal = function(targetUserId, playerName) {
    const prizeAmt = prompt(`Enter winning coins to add for ${playerName}:`);
    if (!prizeAmt || isNaN(prizeAmt)) return;
    
    const coinsToAdd = Number(prizeAmt);
    if (coinsToAdd <= 0) return;

    addPrizeToUserWallet(targetUserId, coinsToAdd, playerName);
};

async function addPrizeToUserWallet(targetUserId, amount, playerName) {
    try {
        const userRef = doc(db, "users", targetUserId);
        const userSnap = await getDoc(userRef);
        let currentBal = 0;
        
        if (userSnap.exists() && userSnap.data().balance !== undefined) {
            currentBal = Number(userSnap.data().balance);
        }

        await setDoc(userRef, { balance: currentBal + amount }, { merge: true });

        await addDoc(collection(db, "transactions"), {
            deviceId: targetUserId,
            title: `Tournament Winning Prize`,
            desc: `Reward for winning/performance`,
            amount: amount,
            type: "deposit",
            createdAt: new Date().toISOString()
        });

        showCustomAlert("Success! 🪙", `Successfully added 🪙 ${amount} coins to ${playerName}'s wallet!`, "🎉", () => {
            loadUserWallet();
            loadUserTransactions();
        });
    } catch (e) {
        showCustomAlert("Error", e.message, "⚠️");
    }
}

window.kickPlayer = async function(tournamentId, playerIndex) {
    if (confirm(`Are you sure you want to remove this entry?`)) {
        try {
            const tRef = doc(db, "tournaments", tournamentId);
            const tSnap = await getDoc(tRef);
            if (!tSnap.exists()) return;

            const players = tSnap.data().players || [];
            players.splice(playerIndex, 1);

            await updateDoc(tRef, { players });
            showCustomAlert("Success", "Player removed successfully!", "✅", () => {
                document.getElementById('customModal').classList.add('hidden');
                loadAdminTournaments();
                loadTournaments();
            });
        } catch (e) {
            showCustomAlert("Error", e.message, "⚠️");
        }
    }
};

window.publishRoom = async function(id) {
    const roomInfo = prompt("Enter Room ID & Password (e.g., ID: 12345 | Pass: abcd):");
    if (!roomInfo) return;
    try {
        await updateDoc(doc(db, "tournaments", id), { room: roomInfo });
        showCustomAlert("Published! 🔑", "Room ID & Password published successfully!", "✅");
    } catch (e) {
        showCustomAlert("Error", e.message, "⚠️");
    }
};

window.deleteTournament = async function(id) {
    if (confirm("Are you sure you want to delete this tournament?")) {
        try {
            await deleteDoc(doc(db, "tournaments", id));
            showCustomAlert("Deleted", "Tournament deleted successfully!", "🗑️", () => {
                loadAdminTournaments();
                loadTournaments();
            });
        } catch (e) {
            showCustomAlert("Error", e.message, "⚠️");
        }
    }
};

// --- Modern Admin Login Modal Handlers ---
const openAdminModalBtn = document.getElementById('openAdminModalBtn');
if (openAdminModalBtn) {
    openAdminModalBtn.addEventListener('click', () => {
        document.getElementById('adminLoginEmail').value = "";
        document.getElementById('adminLoginPass').value = "";
        document.getElementById('adminLoginModal').classList.remove('hidden');
    });
}

window.closeAdminLoginModal = function() {
    document.getElementById('adminLoginModal').classList.add('hidden');
};

window.submitAdminLogin = function() {
    const email = document.getElementById('adminLoginEmail').value.trim();
    const pass = document.getElementById('adminLoginPass').value.trim();

    if (email === ADMIN_EMAIL && pass === ADMIN_PASS) {
        document.getElementById('adminLoginModal').classList.add('hidden');
        document.getElementById('profileTab').classList.add('hidden');
        document.getElementById('adminView').classList.remove('hidden');
        loadAdminTournaments();
    } else {
        showCustomAlert("Login Failed", "Incorrect Email or Password!", "⚠️");
    }
};

const closeAdminBtn = document.getElementById('closeAdminBtn');
if (closeAdminBtn) {
    closeAdminBtn.addEventListener('click', () => {
        document.getElementById('adminView').classList.add('hidden');
        document.getElementById('profileTab').classList.remove('hidden');
    });
}

const tournamentForm = document.getElementById('tournamentForm');
if (tournamentForm) {
    tournamentForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = document.getElementById('tTitle').value;
        const type = document.getElementById('tType').value; 
        const category = document.getElementById('tCategory') ? document.getElementById('tCategory').value : 'br-solo'; 
        const slots = Number(document.getElementById('tSlots').value);
        const fee = Number(document.getElementById('tFee').value);
        
        let prize1 = 0, prize2 = 0, prize3 = 0, booyahPrize = 0, winnerPrize = 0;
        let perKill = 0;

        if (category === 'br-solo') {
            prize1 = Number(document.getElementById('tPrize1').value) || 0;
            prize2 = Number(document.getElementById('tPrize2').value) || 0;
            prize3 = Number(document.getElementById('tPrize3').value) || 0;
            perKill = Number(document.getElementById('tPerKill').value) || 0;
        } else if (category === 'br-squad') {
            booyahPrize = Number(document.getElementById('tBooyahPrize').value) || 0;
            prize1 = booyahPrize; 
            perKill = Number(document.getElementById('tPerKill').value) || 0;
        } else if (category === 'cs-solo' || category === 'cs-squad') {
            winnerPrize = Number(document.getElementById('tWinnerPrize').value) || 0;
            prize1 = winnerPrize;
        }

        const schedule = document.getElementById('tSchedule').value;
        const map = document.getElementById('tMap').value;

        try {
            await addDoc(collection(db, "tournaments"), { 
                title, type, category, slots, fee, prize1, prize2, prize3, booyahPrize, winnerPrize, perKill, schedule, map, room: "Not published yet", players: [], createdAt: new Date() 
            });
            showCustomAlert("Published! 🎉", "Tournament Published Successfully!", "✅", () => {
                tournamentForm.reset();
                handleCategoryChange();
                loadTournaments();
                loadAdminTournaments();
            });
        } catch (err) {
            showCustomAlert("Error", err.message, "⚠️");
        }
    });
}

const navItems = document.querySelectorAll('.nav-item');
navItems.forEach(item => {
    item.addEventListener('click', () => {
        navItems.forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');

        const targetTab = item.getAttribute('data-tab');
        document.getElementById('homeTab').classList.add('hidden');
        document.getElementById('walletTab').classList.add('hidden');
        document.getElementById('profileTab').classList.add('hidden');
        document.getElementById('adminView').classList.add('hidden');

        document.getElementById(targetTab).classList.remove('hidden');
    });
});

window.deleteAdminRequest = async function(collectionName, docId) {
    if (confirm("Are you sure you want to delete this request?")) {
        try {
            await deleteDoc(doc(db, collectionName, docId));
            showCustomAlert("Deleted", "Request removed successfully!", "✅");
            loadAdminTournaments(); // List ko refresh karne ke liye
        } catch (e) {
            showCustomAlert("Error", "Failed to delete request: " + e.message, "❌");
        }
    }
};
