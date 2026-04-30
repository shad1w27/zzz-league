let isAdmin = false;
let players = [];

auth.onAuthStateChanged((user) => {
	isAdmin = !!user;
	const layout = document.getElementById('mainLayout');
	layout.className = isAdmin ? 'layout' : 'layout no-admin';
	updateUI();
});

db.ref('players').on('value', (snapshot) => {
	const data = snapshot.val();
	players = data ? Object.values(data) : [];
	updateUI();
});

db.ref('history').limitToLast(10).on('value', (snapshot) => {
	const log = document.getElementById('logItems');
	const data = snapshot.val();
	if (!data) { log.innerHTML = "Игр пока нет"; return; }
	log.innerHTML = Object.values(data).reverse().map(m => `
            <div class="history-item"><b>${m.p1}</b> vs <b>${m.p2}</b>: <span class="${m.change > 0 ? 'gain' : 'loss'}">${m.change > 0 ? '+' : ''}${m.change} ELO</span></div>
        `).join('');
});

async function login() {
	const email = prompt("Email:");
	const pass = prompt("Пароль:");
	if (email && pass) {
		try { await auth.signInWithEmailAndPassword(email, pass); }
		catch (e) { alert("Ошибка: " + e.message); }
	}
}
function logout() { auth.signOut(); }

function updateUI() {
	document.querySelectorAll('.admin-only').forEach(el => {
		el.style.display = isAdmin ? (el.tagName === 'TH' || el.tagName === 'TD' ? 'table-cell' : 'block') : 'none';
	});
	document.getElementById('loginBtn').style.display = isAdmin ? 'none' : 'block';

	const tbody = document.querySelector('#leaderboard tbody');
	tbody.innerHTML = "";

	[...players].sort((a, b) => b.elo - a.elo).forEach((p) => {
		const tp = p.tournamentPoints || 0;
		const isPro = p.isPro === true;

		let actionCell = isAdmin ? `<td class="admin-only" style="display: table-cell;"><button class="btn-del" onclick="deletePlayer('${p.name}')">Удалить</button></td>` : '';
		let editIcon = isAdmin ? `<span class="edit-btn" onclick="manualEditElo('${p.name}', ${p.elo})">⚙️</span>` : '';

		tbody.innerHTML += `<tr>
                <td class="${isPro ? 'league-pro' : 'league-newbie'}">${isPro ? 'PRO' : 'NEWBIE'}</td>
                <td>${p.name} ${editIcon}</td>
                <td><b>${p.elo}</b> <small style="color:#666;">${tp !== 0 ? '(' + (tp > 0 ? '+' + tp : tp) + ')' : ''}</small></td>
                <td><span class="lvl-badge">LVL ${Math.min(10, Math.max(1, Math.floor((p.elo - 1000) / 40) + 1))}</span></td>
                ${actionCell}
            </tr>`;
	});

	const s1 = document.getElementById('p1Select');
	const s2 = document.getElementById('p2Select');
	const sel1 = s1.value; const sel2 = s2.value;
	s1.innerHTML = ""; s2.innerHTML = "";
	players.forEach((p, i) => {
		let opt = `<option value="${i}">${p.name}</option>`;
		s1.innerHTML += opt; s2.innerHTML += opt;
	});
	if (sel1) s1.value = sel1; if (sel2) s2.value = sel2;
}

function getPointsChange(p1, p2, res1) {
	if (!p1 || !p2) return 0;
	const ea = 1 / (1 + Math.pow(10, (p2.elo - p1.elo) / 400));
	const k = p1.isPro ? 20 : 50;
	let change = Math.round(k * (res1 - ea));
	if (change === 0) change = (res1 === 1) ? 1 : -1;
	return change;
}

function playMatch() {
	if (!isAdmin) return;
	const p1 = players[document.getElementById('p1Select').value];
	const p2 = players[document.getElementById('p2Select').value];
	const res = parseFloat(document.getElementById('matchResult').value);
	if (!p1 || !p2 || p1.name === p2.name) return;
	const c1 = getPointsChange(p1, p2, res);
	db.ref('players/' + p1.name).update({ tournamentPoints: (p1.tournamentPoints || 0) + c1 });
	db.ref('players/' + p2.name).update({ tournamentPoints: (p2.tournamentPoints || 0) + getPointsChange(p2, p1, 1 - res) });
	db.ref('history').push({ p1: p1.name, p2: p2.name, change: c1 });
	resetForecastUI();
}

function finalizeTournament() {
	if (!isAdmin || !confirm("Завершить турнир? Очки прибавятся к основному ELO.")) return;
	players.forEach(p => {
		let fElo = p.elo + (p.tournamentPoints || 0);
		db.ref('players/' + p.name).update({ elo: fElo, tournamentPoints: 0, isPro: fElo >= 1200 });
	});
}

function calculateForecast() {
	const p1 = players[document.getElementById('p1Select').value];
	const p2 = players[document.getElementById('p2Select').value];
	if (!p1 || !p2 || p1.name === p2.name) return alert("Выберите разных игроков!");
	const box = document.getElementById('forecastBox');
	box.style.display = 'block';
	box.innerHTML = `Победа ${p1.name}: +${getPointsChange(p1, p2, 1)} / ${getPointsChange(p1, p2, 0)} ELO<br>Победа ${p2.name}: +${getPointsChange(p2, p1, 1)} / ${getPointsChange(p2, p1, 0)} ELO`;
	document.getElementById('confirmBlock').style.display = 'block';
}

function resetForecastUI() { document.getElementById('forecastBox').style.display = 'none'; document.getElementById('confirmBlock').style.display = 'none'; }
function addPlayer() { if (isAdmin) { const n = document.getElementById('playerName').value; if (n) db.ref('players/' + n).set({ name: n, elo: 1000, isPro: false, tournamentPoints: 0 }); } }
function deletePlayer(n) { if (isAdmin && confirm("Удалить игрока " + n + "?")) db.ref('players/' + n).remove(); }
function manualEditElo(n, e) { if (isAdmin) { const v = prompt("Новое ELO для " + n + ":", e); if (v) db.ref('players/' + n).update({ elo: parseInt(v), isPro: parseInt(v) >= 1200 }); } }
function clearHistory() { if (isAdmin) db.ref('history').remove(); }