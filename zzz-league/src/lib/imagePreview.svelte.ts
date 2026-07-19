export function useObjectUrlPreview(getFile: () => File | undefined) {
	let url = $state<string | null>(null);
	$effect(() => {
		const file = getFile();
		if (!file) {
			url = null;
			return;
		}
		const objectUrl = URL.createObjectURL(file);
		url = objectUrl;
		return () => URL.revokeObjectURL(objectUrl);
	});
	return {
		get url() {
			return url;
		},
	};
}
