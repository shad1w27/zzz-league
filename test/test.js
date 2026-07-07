import fs from "fs";

const matchesJson = JSON.parse(fs.readFileSync("./matches.json", "utf8"));

const matches = matchesJson.data.map((m) => {
	const p1 = m.attributes.points_by_participant?.[0]?.participant_id;
	const p2 = m.attributes.points_by_participant?.[1]?.participant_id;


});

// console.log(matches);

const bulkAddJson = JSON.parse(fs.readFileSync("./bulk_add.json", "utf8"));

const participants = Object.fromEntries(
	bulkAddJson.data.map((m) => [m.id, m.attributes.misc]),
);

console.log(participants);