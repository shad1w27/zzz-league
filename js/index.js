let currentUser = null;
let isAdmin = false;
let players = [];
let isViewingArchive = false;

auth.onAuthStateChanged(async user => {
	if (user) {
		const playerRef = db.ref('players/' + user.uid);
		const snapshot = await playerRef.once('value');

		if (snapshot.exists()) {
			const userData = snapshot.val();

			currentUser = {
				name: userData.name,
				elo: userData.elo,
				tournamentPoints: userData.tournamentPoints,
				promoStreak: userData.promoStreak,
				isMidConfirmed: userData.isMidConfirmed,
				isHighConfirmed: userData.isHighConfirmed
			};

			isAdmin = !!userData.isAdmin;
		}
	}
	else {
		isAdmin = false;
		currentUser = null;
	}

	updateUI();
});

async function handleUserRegister() {
	const username = document.getElementById('registerNickname').value.trim();
	const email = document.getElementById('registerEmail').value.trim();
	const password = document.getElementById('registerPassword').value.trim();
	const discord = document.getElementById('registerDiscord').value.trim();
	const confirmPassword = document.getElementById('registerConfirmPass').value.trim();

	const status = document.getElementById('registerStatus');

	if (username.length < 3 || username.length > 32) {
		status.innerText = "Username от 2 до 32 символов";
		status.style.color = "var(--loss)";
		return;
	}

	if (discord.length < 2 || discord.length > 32) {
		status.innerText = "Не похоже на Discord";
		status.style.color = "var(--loss)";
		return;
	}

	if (password !== confirmPassword) {
		status.innerText = "Пароли не совпадают";
		status.style.color = "var(--loss)";
		return;
	}

	try {
		const usernameRef = db.ref('usernames/' + username);
		const usernameSnapshot = await usernameRef.once('value');
		if (usernameSnapshot.exists()) {
			status.innerText = "Никнейм уже занят";
			status.style.color = "var(--loss)";
			return;
		}

		const userCredential = await auth.createUserWithEmailAndPassword(email, password)
		const user = userCredential.user;
		const prevPlayerRef = db.ref('players/' + username);
		const prevSnapshot = await prevPlayerRef.once('value');

		const playerRef = db.ref('players/' + user.uid);
		const snapshot = await playerRef.once('value');

		if (!snapshot.exists()) {
			console.log(prevSnapshot.elo);
			if (prevSnapshot.exists()) {
				const prevUserData = prevSnapshot.val();
				currentUser = {
					uid: user.uid,
					name: username,
					elo: prevUserData?.elo ?? 1000,
					tournamentPoints: prevUserData?.tournamentPoints ?? 0,
					promoStreak: prevUserData?.promoStreak ?? 0,
					isMidConfirmed: prevUserData?.isMidConfirmed ?? false,
					isHighConfirmed: prevUserData?.isHighConfirmed ?? false,
					discord: discord
				};

				await prevPlayerRef.remove();
			}
			else {
				currentUser = {
					uid: user.uid,
					name: username,
					elo: 1000,
					tournamentPoints: 0,
					promoStreak: 0,
					isMidConfirmed: false,
					isHighConfirmed: false,
					discord: discord
				};
			}

			await usernameRef.set(true);
			await playerRef.set(currentUser);
		}

		closeRegisterPopup();
	}
	catch (error) {
		status.innerText = error.message;
		status.style.color = "var(--loss)";
	}
}

async function handleUserLogin() {
	const username = document.getElementById('loginEmail').value.trim();
	const password = document.getElementById('loginPassword').value.trim();
	const status = document.getElementById('loginStatus');

	try {
		await auth.signInWithEmailAndPassword(username, password)
		closeLoginPopup();
	}
	catch (error) {
		status.innerText = error.message;
		status.style.color = "var(--loss)";
	}
}

function handleUserLogout() { auth.signOut(); }

function openLoginPopup() {
	document.getElementById("loginPopup").style.display = "flex";
}

function closeLoginPopup() {
	document.getElementById("loginPopup").style.display = "none";
}

function openRegisterPopup() {
	document.getElementById("registerPopup").style.display = "flex";
}

function closeRegisterPopup() {
	document.getElementById("registerPopup").style.display = "none";
}

db.ref('timer').on('value', snap => {
	const endTime = snap.val();
	if (!endTime) return;
	const updateTimer = () => {
		const diff = endTime - new Date().getTime();
		if (diff <= 0) { document.getElementById('timerDisplay').innerText = "СЕЗОН ОКОНЧЕН"; return; }
		const d = Math.floor(diff / 86400000), h = Math.floor((diff % 86400000) / 3600000), m = Math.floor((diff % 3600000) / 60000), s = Math.floor((diff % 60000) / 1000);
		document.getElementById('timerDisplay').innerText = `${d}д ${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
	};
	if (window.tInt) clearInterval(window.tInt);
	window.tInt = setInterval(updateTimer, 1000); updateTimer();
});

function setTimer() {
	const hours = prompt("Через сколько часов закончить?");
	if (hours) db.ref('timer').set(new Date().getTime() + (parseFloat(hours) * 3600000));
}

db.ref('archives').on('value', snap => {
	const container = document.getElementById('archiveButtons');
	const data = snap.val();
	if (!data) { container.innerHTML = ""; return; }
	container.innerHTML = Object.keys(data).reverse().map(key => `
            <div class="archive-item">
                <button class="archive-btn" onclick="loadArchiveTable('${key}')">${key}</button>
                <button class="archive-del admin-only" onclick="deleteArchive('${key}')" style="display: ${isAdmin ? 'block' : 'none'}">✕</button>
            </div>
        `).join('');
});

function deleteArchive(key) {
	if (confirm(`Удалить сезон "${key}" навсегда?`)) db.ref('archives/' + key).remove();
}

function loadArchiveTable(key) {
	isViewingArchive = true;
	document.getElementById('tableTitle').innerText = "Архив: " + key;
	document.getElementById('backToLive').style.display = "inline-block";
	db.ref('archives/' + key).once('value', snap => renderTable(snap.val(), true));
}

function loadLiveTable() {
	isViewingArchive = false;
	document.getElementById('tableTitle').innerText = "Турнирная Таблица ZZZ";
	document.getElementById('backToLive').style.display = "none";
	updateUI();
}

function resetSeason() {
	const name = prompt("Название сезона для архива:");
	if (!name) return;
	db.ref('archives/' + name).set(players.map(p => ({
		name: p.name, elo: p.elo || 1000,
		isMidConfirmed: p.isMidConfirmed || false,
		isHighConfirmed: p.isHighConfirmed || false
	})));
	players.forEach(p => {
		let start = p.isHighConfirmed ? 1400 : (p.isMidConfirmed ? 1200 : 1000);
		db.ref('players/' + p.uid).update({ elo: start, tournamentPoints: 0, promoStreak: 0 });
	});
	db.ref('history').remove();
}

db.ref('players').on('value', snap => {
	players = snap.val() ? Object.values(snap.val()) : [];
	if (!isViewingArchive) updateUI();
});

db.ref('history').on('value', snap => {
	const data = snap.val();
	document.getElementById('logItems').innerHTML = data ? Object.values(data).reverse().map(m => `
            <div style="font-size:0.85em; padding:8px 0; border-bottom:1px solid #222; color:#999;">
                <b>${m.p1}</b> vs <b>${m.p2}</b>: <span class="${m.change >= 0 ? 'gain' : 'loss'}">${m.change >= 0 ? '+' : ''}${m.change} ELO</span>
            </div>
        `).join('') : "";
});

function renderTable(dataList, hideOptions = false) {
	const tbody = document.querySelector('#leaderboard tbody');
	const sorted = [...dataList].sort((a, b) => (b.elo || 1000) - (a.elo || 1000));
	tbody.innerHTML = "";

	sorted.forEach((p, i) => {
		const elo = p.elo || 1000;
		const streak = p.promoStreak || 0;
		const isMid = p.isMidConfirmed || false;
		const isHigh = p.isHighConfirmed || false;

		let tClass = "t-newbie", tName = "NEWBIE";
		if (isHigh) { tClass = "t-high"; tName = "HIGH TIER"; }
		else if (isMid) { tClass = "t-mid"; tName = "MID TIER"; }

		let promoHtml = (elo >= 1200 && elo < 1400 && !isMid) ?
			`<div class="promo-wrap"><div class="dot ${streak >= 1 ? 'active' : ''}"></div><div class="dot ${streak >= 2 ? 'active' : ''}"></div><div class="dot ${streak >= 3 ? 'active' : ''}"></div></div>` : "";

		tbody.innerHTML += `
                <tr class="${(i + 1) <= 3 ? 'top-' + (i + 1) : ''}">
                    <td>${i + 1}</td>
                    <td><span class="tier-badge ${tClass}">${tName}</span></td>
                    <td class="player-name">
                        <a href="profile.html?player=${encodeURIComponent(p.uid)}" style="color: inherit; text-decoration: none;">${p.name}</a> 
                        ${promoHtml}
                    </td>
                    <td><b>${elo}</b> ${p.tournamentPoints ? `<small class="${p.tournamentPoints > 0 ? 'gain' : 'loss'}">(${p.tournamentPoints > 0 ? '+' : ''}${p.tournamentPoints})</small>` : ''}</td>
                    <td><span class="lvl-badge">L${Math.min(10, Math.floor((elo - 1000) / 40) + 1)}</span></td>
                    ${isAdmin && !hideOptions ? `<td class="admin-only-cell" style="display: flex; gap: 10px;">
                        <button onclick="manualElo('${p.uid}', ${elo})" style="background:none; border:none; width:auto; padding:0; cursor:pointer;">⚙️</button>
                        <button onclick="deletePlayer('${p.uid}')" style="background:none; border:none; width:auto; padding:0; cursor:pointer; color:#ff4444;">✕</button>
                    </td>` : (isAdmin ? '<td class="admin-only-cell"></td>' : '')}
                </tr>`;
	});
}

function updateUI() {
	document.getElementById('mainLayout').className = isAdmin ? 'layout' : 'layout no-admin';
	document.querySelectorAll('.user-only').forEach(el => el.style.display = isAdmin ? 'none' : 'block');

	document.querySelectorAll('.admin-only').forEach(el => el.style.display = isAdmin ? 'block' : 'none');
	document.querySelectorAll('.admin-only-cell').forEach(el => el.style.display = isAdmin ? 'table-cell' : 'none');

	let loggedIn = currentUser != null;

	document.getElementById('userAuthCard').style.display = loggedIn ? 'none' : 'block';
	document.getElementById('userCard').style.display = loggedIn ? 'block' : 'none';

	if (loggedIn)
		document.getElementById('username').innerText = currentUser.name;

	if (!isViewingArchive) {
		renderTable(players);
		const p1 = document.getElementById('p1Select'), p2 = document.getElementById('p2Select');
		const v1 = p1.value, v2 = p2.value;
		const opts = players.map(p => `<option value="${p.name}">${p.name}</option>`).join('');
		p1.innerHTML = opts; p2.innerHTML = opts;
		if (v1) p1.value = v1; if (v2) p2.value = v2;
	}
}

function calculateEloChange(pA, pB, outcome) {
	const k = (pA.elo || 1000) >= 1200 ? 20 : 50;
	const expected = 1 / (1 + Math.pow(10, ((pB.elo || 1000) - (pA.elo || 1000)) / 400));
	let change = Math.round(k * (outcome - expected));
	if (outcome === 1 && change <= 0) change = 1;
	if (outcome === 0 && change >= 0) change = -1;
	return change;
}

function showForecast() {
	const p1 = players.find(p => p.name === document.getElementById('p1Select').value);
	const p2 = players.find(p => p.name === document.getElementById('p2Select').value);
	if (!p1 || !p2 || p1.name === p2.name) return alert("Выберите разных");
	const w1 = calculateEloChange(p1, p2, 1), l1 = calculateEloChange(p1, p2, 0);
	const w2 = calculateEloChange(p2, p1, 1), l2 = calculateEloChange(p2, p1, 0);
	const fBox = document.getElementById('forecast');
	fBox.style.display = 'block';
	fBox.innerHTML = `<div>${p1.name}: <span class="gain">+${w1}</span> / <span class="loss">${l1}</span></div><div>${p2.name}: <span class="gain">+${w2}</span> / <span class="loss">${l2}</span></div>`;
}

function playMatch() {
	const p1 = players.find(p => p.name === document.getElementById('p1Select').value);
	const p2 = players.find(p => p.name === document.getElementById('p2Select').value);
	const res = parseFloat(document.getElementById('matchResult').value);
	if (!p1 || !p2 || p1.name === p2.name) return;
	const c1 = calculateEloChange(p1, p2, res)
	const c2 = calculateEloChange(p2, p1, res === 1 ? 0 : 1);
	updateMatchData(p1, c1, res === 1);
	updateMatchData(p2, c2, res === 0);
	db.ref('history').push({ p1: p1.name, p2: p2.name, change: c1 });
	document.getElementById('forecast').style.display = 'none';
}

function updateMatchData(p, change, isWin) {
	let streak = p.promoStreak || 0, confirmed = p.isMidConfirmed || false;
	if ((p.elo || 1000) >= 1200 && !confirmed) {
		if (isWin) { streak++; if (streak >= 3) { confirmed = true; streak = 0; } }
		else streak = 0;
	}
	db.ref('players/' + p.uid).update({ tournamentPoints: (p.tournamentPoints || 0) + change, promoStreak: streak, isMidConfirmed: confirmed });
}

function finalizeTournament() {
	if (!confirm("Применить очки?")) return;
	players.forEach(p => {
		const next = (p.elo || 1000) + (p.tournamentPoints || 0);
		let m = p.isMidConfirmed, h = p.isHighConfirmed;
		if (m && next < 1150) m = false; if (h && next < 1350) h = false; if (next >= 1400) h = true;
		db.ref('players/' + p.uid).update({ elo: next, tournamentPoints: 0, isMidConfirmed: m, isHighConfirmed: h });
	});
}

function manualElo(uid, elo) {
	const v = prompt(`Новое ELO для ${uid}:`, elo);
	if (v) {
		const val = parseInt(v);
		db.ref('players/' + uid).update({ elo: val, isMidConfirmed: val >= 1200, isHighConfirmed: val >= 1400, promoStreak: 0 });
	}
}

document.getElementById('playerSearch').addEventListener('keyup', e => {
	const q = e.target.value.toLowerCase();
	document.querySelectorAll('#leaderboard tbody tr').forEach(r => {
		r.style.display = r.innerText.toLowerCase().includes(q) ? "" : "none";
	});
});

function filterSelect(i, s) {
	const q = document.getElementById(i).value.toLowerCase();
	const opts = document.getElementById(s).options;
	for (let i = 0; i < opts.length; i++) opts[i].style.display = opts[i].text.toLowerCase().includes(q) ? "" : "none";
}

function clearHistory() { if (confirm("Очистить историю?")) db.ref('history').remove(); }

function addPlayer() {
	const playerName = document.getElementById('playerName').value.trim();
	if (playerName)
		db.ref('players/' + playerName)
			.set({
				name: playerName,
				uid: playerName,
				elo: 1000,
				tournamentPoints: 0,
				promoStreak: 0,
				isMidConfirmed: false,
				isHighConfirmed: false
			});
}

async function deletePlayer(uid) {
	if (confirm("Удалить игрока?")) {
		const playerRef = db.ref('players/' + uid);
		const snapshot = await playerRef.once('value');
		const username = snapshot.val().name;

		if (snapshot.exists())
			db.ref('usernames/' + username).remove();

		db.ref('players/' + uid).remove();
	}
}