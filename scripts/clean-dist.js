// Simple cleanup to remove unpacked directories left by electron-builder
const fs = require('fs');
const path = require('path');

function removeRecursive(targetPath) {
	if (!fs.existsSync(targetPath)) return;
	const stat = fs.lstatSync(targetPath);
	if (stat.isDirectory()) {
		for (const entry of fs.readdirSync(targetPath)) {
			removeRecursive(path.join(targetPath, entry));
		}
		try { fs.rmdirSync(targetPath); } catch {}
	} else {
		try { fs.unlinkSync(targetPath); } catch {}
	}
}

const distDir = path.resolve(__dirname, '..', 'dist');
if (!fs.existsSync(distDir)) {
	process.exit(0);
}

// Remove common electron-builder unpacked folders
const patterns = [
	/win-Unpacked/i,
	/-unpacked/i,
];

for (const entry of fs.readdirSync(distDir)) {
	const full = path.join(distDir, entry);
	if (patterns.some((rx) => rx.test(entry))) {
		removeRecursive(full);
	}
}

// Optionally remove blockmaps/yml which are for auto-update
for (const entry of fs.readdirSync(distDir)) {
	if (entry.endsWith('.blockmap') || entry.endsWith('.yml')) {
		try { fs.unlinkSync(path.join(distDir, entry)); } catch {}
	}
}

console.log('Cleaned unpacked artifacts in dist/.');






