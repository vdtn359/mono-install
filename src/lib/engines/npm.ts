import path from 'path';
import { DEPENDENCY_TYPES } from 'src/lib/engines/constants';
import { resolveLocalVersion } from 'src/lib/package';
import { BaseEngine } from 'src/lib/engines/base';
import fs from 'fs';
import { readJson, writeJson } from 'src/lib/files';
import { execSync } from 'src/lib/child_process';

const isInstalled = require('is-installed');

export class NpmEngine extends BaseEngine {
	packageLock = 'package-lock.json';

	isInstalled(): boolean {
		return isInstalled.sync('npm');
	}

	getNormalisedPackageJson(packagePath) {
		const packageJsonPath = this.getPackageJsonPath(packagePath);
		const packageJson = require(packageJsonPath);
		for (const dependencyType of DEPENDENCY_TYPES) {
			for (const [dependency, version] of Object.entries(
				packageJson[dependencyType] || {}
			)) {
				const localVersion = resolveLocalVersion(version);
				packageJson[dependencyType][dependency] = localVersion
					? path.resolve(path.dirname(packageJsonPath), localVersion)
					: version;
			}
		}
		return packageJson;
	}

	cleanPackageLock(packageLockPath): void {
		if (!fs.existsSync(packageLockPath)) {
			return;
		}
		const packageLock = readJson(packageLockPath);
		DEPENDENCY_TYPES.forEach(async dependencyType => {
			Object.entries(packageLock[dependencyType] || {}).forEach(
				([dependency, dependencyInfo]: any) => {
					const isLocal = !!resolveLocalVersion(
						dependencyInfo.version
					);
					if (!isLocal) {
						return;
					}
					delete packageLock[dependencyType][dependency];
				}
			);
		});
		writeJson(packageLockPath, packageLock);
	}

	install(installDir: string, installArgs: string[]): void {
		execSync(`npm install ${installArgs.join(' ')}`, {
			cwd: installDir,
		});
	}
}
