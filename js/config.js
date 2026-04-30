const firebaseConfig = {
	apiKey: "AIzaSyCCACnq23Ozr0KGUW2MNAti2rltAoBR3EA",
	databaseURL: "https://zzz-shad1w-default-rtdb.firebaseio.com",
	projectId: "zzz-shad1w"
	/* apiKey: "AIzaSyAlcnUiLJ1cq7ekCQFi_NOPAQ6UiG92ZqM",
	databaseURL: "https://zzz-league-default-rtdb.firebaseio.com",
	projectId: "zzz-league" */
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.database();