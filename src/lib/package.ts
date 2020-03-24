export function resolveLocalVersion(version) {
	if (
		version.startsWith('.') ||
		version.startsWith('/') ||
		version.startsWith('workspace:')
	) {
		return version;
	}
	if (version.startsWith('file:')) {
		return version.replace('file:', '');
	}
	return '';
}
