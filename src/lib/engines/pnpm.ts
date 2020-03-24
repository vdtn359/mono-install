import path from 'path';
import { DEPENDENCY_TYPES } from 'src/lib/engines/constants';
import { resolveLocalVersion } from 'src/lib/package';
import { BaseEngine } from 'src/lib/engines/base';
import findup from 'find-up';
import { read, readYml, writeYml } from 'src/lib/files';
import fg from 'fast-glob';
import { execSync } from 'src/lib/child_process';
import { FileContent, UndoManager } from 'src/lib/undo';
import fs from 'fs';

const isInstalled = require('is-installed');
const yaml = require('yaml');

export class PnpmEngine extends BaseEngine {
	packageLock = 'pnpm-lock.yaml';

	isInstalled(): boolean {
		return isInstalled.sync('pnpm');
	}

	getNormalisedPackageJson(packagePath) {
		const packageJsonPath = this.getPackageJsonPath(packagePath);
		packagePath = path.dirname(packageJsonPath);
		const workspacePackages = this.findWorkspacePackages(packagePath);
		const packageJson = require(packageJsonPath);
		for (const dependencyType of DEPENDENCY_TYPES) {
			for (const [dependency, version] of Object.entries(
				packageJson[dependencyType] || {}
			)) {
				let localVersion = resolveLocalVersion(version);
				if (localVersion.startsWith('workspace:')) {
					localVersion =
						path.dirname(workspacePackages[dependency]) || version;
				}
				packageJson[dependencyType][dependency] = localVersion
					? path.isAbsolute(localVersion)
						? localVersion
						: path.resolve(packagePath, localVersion)
					: version;
			}
		}
		return packageJson;
	}

	findWorkspacePackages(directory) {
		const workspace = findup.sync(
			['pnpm-workspace.yml', 'pnpm-workspace.yaml'],
			{
				cwd: directory,
				type: 'file',
			}
		);
		if (!workspace) {
			throw new Error('No workspace file');
		}
		const { packages } = yaml.parse(read(workspace));
		const patterns = packages.map(p => path.join(p, 'package.json'));
		const matches = fg.sync(patterns, {
			cwd: path.dirname(workspace),
			followSymbolicLinks: false,
			absolute: true,
			ignore: ['node_modules/**'],
		});
		const packageMap = {};
		for (const foundPackagePath of matches) {
			const workspacePackageJson = require(foundPackagePath);
			const packageName = workspacePackageJson.name;
			packageMap[packageName] = foundPackagePath;
		}
		return packageMap;
	}

	cleanPackageLock(packageLockPath): void {
		if (!fs.existsSync(packageLockPath)) {
			return;
		}
		const packageLock = readYml(packageLockPath);
		delete packageLock['importers'];
		packageLock.dependencies = packageLock.dependencies || '';
		packageLock.specifiers = packageLock.specifiers || '';
		writeYml(packageLockPath, packageLock);
	}

	install(installDir: string, installArgs: string[]): void {
		const undoManager = new UndoManager();
		undoManager.registerSigInt();
		const workspace = findup.sync(
			['pnpm-workspace.yml', 'pnpm-workspace.yaml'],
			{
				cwd: installDir,
				type: 'file',
			}
		);
		if (workspace) {
			undoManager.add(new FileContent(workspace));
			fs.unlinkSync(workspace);
		}
		try {
			execSync(`pnpm install ${installArgs.join(' ')}`, {
				cwd: installDir,
			});
		} finally {
			undoManager.undo();
		}
	}
}
