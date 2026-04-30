async function f() {
	// Получаем имя из ссылки: profile.html?player=Name
	const params = new URLSearchParams(window.location.search);
	const uid = params.get('player');

	if (uid) {
		const snap = await db.ref('players/' + uid).once('value');
		if (!snap.exists())
			return;

		const player = snap.val();
		if (player) {
			document.getElementById('profName').innerText = player.name;

			// Считаем статистику по истории
			db.ref('history').once('value', snap => {
				const matches = snap.val() ? Object.values(snap.val()) : [];
				let wins = 0;
				let losses = 0;

				matches.forEach(m => {
					if (m.p1 === uid) {
						if (m.change > 0) wins++; else losses++;
					} else if (m.p2 === uid) {
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

			let tier = "NEWBIE";
			const discordTag = player.discord ?? "";
			if (player.isHighConfirmed) tier = "HIGH TIER";
			else if (player.isMidConfirmed) tier = "MID TIER";
			document.getElementById('profTier').innerText = tier;
			document.getElementById('discordTag').innerText = `Discord: ${discordTag}`;
		}
	}
}

f();