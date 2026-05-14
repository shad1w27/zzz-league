<script lang="ts">
	import {
		openLoginPopup,
		openProfilePopup,
		openRegistrationPopup,
		openSettingsPopup,
	} from "$lib/uiCommon";

	import type { Player } from "$lib/types";
	import { auth } from "$lib/firebase";
	import { signOut } from "firebase/auth";
	import AdminPanel from "./AdminPanel.svelte";
	import { currentUser, isAdmin } from "$lib/store";
</script>

<div class="side-panel">
	{#if !$currentUser}
		<div class="card">
			<div class="btn-row">
				<button class="btn-common btn-play" onclick={openLoginPopup}
					>Вход</button
				>
				<button class="btn-common" onclick={openRegistrationPopup}
					>Регистрация</button
				>
			</div>
		</div>
	{:else}
		<div class="card">
			<button class="user-label" onclick={() => openProfilePopup($currentUser)}
				>{$currentUser.name}</button
			>
			<button class="btn-common" onclick={openSettingsPopup}
				>Настройки</button
			>
			<button class="btn-common" onclick={() => signOut(auth)}>Выход</button>
		</div>
	{/if}

	{#if !isAdmin}
		<div class="card">
			<h2>🏆 Кодекс Лиги</h2>
			<ul class="rules-list">
				<li>
					<b>Ранги:</b> <span class="tier-badge t-newbie">NEWBIE</span>
					<b>1000+</b>, <span class="tier-badge t-mid">MID</span>
					<b>1200+</b>, <span class="tier-badge t-high">HIGH</span>
					<b>1400+</b>.
				</li>
				<li>
					<b>Квалификация:</b> Для входа в
					<span class="tier-badge t-mid">MID TIER</span>
					нужно
					<b>1200</b> ELO. Для
					<span class="tier-badge t-high">HIGH TIER</span>
					достаточно достичь отметки <b>1400</b> ELO.
				</li>
				<li>
					<b>Уровни (LVL):</b> Каждые <b>40</b> единиц ELO повышают ваш
					уровень. Максимальный уровень —
					<b>L10</b> (начинается с <b>1360</b> ELO).
				</li>
				<li>
					<b>Турнирный бонус:</b> За победу на <b>любом</b> турнире игрок
					получает фиксированную награду
					<b>+40 ELO</b>.
				</li>
				<li>
					<b>Финальный турнир:</b> На последней неделе сезона проводится
					масштабный турнир для
					<b>ТОП-16</b> игроков рейтинга.
				</li>
				<li>
					<b>Сброс лиги:</b> По завершении таймера прогресс уходит в архив.
					ELO сбрасывается до стартового значения текущего подтвержденного тира.
				</li>
				<li>
					<b>Сезоны:</b> Новый сезон — это возможность занять топы с чистого
					листа.
				</li>
				<li>
					<b>Вылет:</b> При падении ELO на <b>50</b> пунктов ниже границы тира,
					вы переходите в предыдущую лигу.
				</li>
				<li>
					<b>ELO-очки:</b> Начисляются сразу, но фиксируются в основном балансе
					игрока только после завершения турнирного дня.
				</li>
				<li>
					<b>Техлузы:</b> Если игрок получает техлуз по
					<b>уважительной причине</b>, <b>ELO</b> с него не снимается, а
					его оппонент не получает <b>ELO за победу.</b>
					Если техлуз происходит <b>во время игры</b>, игрок, получивший
					техлуз, получает <b>двойную потерю ELO</b>
				</li>
			</ul>
		</div>
	{/if}

	{#if $isAdmin || false}
		<AdminPanel/>
	{/if}
</div>
