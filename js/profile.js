const firebaseConfig = {
	apiKey: "AIzaSyAlcnUiLJ1cq7ekCQFi_NOPAQ6UiG92ZqM",
	databaseURL: "https://zzz-league-default-rtdb.firebaseio.com",
	projectId: "zzz-league"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// Получаем имя из ссылки: profile.html?player=Name
const params = new URLSearchParams(window.location.search);
const playerName = params.get('player');

if (playerName) {
	document.getElementById('profName').innerText = playerName;

	// Считаем статистику по истории
	db.ref('history').once('value', snap => {
		const matches = snap.val() ? Object.values(snap.val()) : [];
		let wins = 0;
		let losses = 0;

		matches.forEach(m => {
			if (m.p1 === playerName) {
				if (m.change > 0) wins++; else losses++;
			} else if (m.p2 === playerName) {
				if (m.change < 0) wins++; else losses++;
			}
		});

		const total = wins + losses;
		const wr = total > 0 ? Math.round((wins / total) * 100) : 0;

		document.getElementById('totalGames').innerText = total;
		document.getElementById('wins').innerText = wins;
		document.getElementById('losses').innerText = losses;
		document.getElementById('winRate').innerText = wr + '%';
	});

	// Получаем текущий тир
	db.ref('players/' + playerName).once('value', snap => {
		const p = snap.val();
		if (p) {
			let t = "NEWBIE";
			if (p.isHighConfirmed) t = "HIGH TIER";
			else if (p.isMidConfirmed) t = "MID TIER";
			document.getElementById('profTier').innerText = t;
		}
	});
}