import path from 'path';
import fs from 'fs';
import { DEPENDENCY_TYPES } from 'src/lib/engines/constants';
import { DependencyNode, Engine } from 'src/lib/engines/engine';
import { DepGraph } from 'dependency-graph';
import { resolveLocalVersion } from 'src/lib/package';
import { writeJson } from 'src/lib/files';

export abstract class BaseEngine implements Engine {
	getDependencyGraph(packagePath): DepGraph<DependencyNode> {
		const packageJsonPath = this.getPackageJsonPath(packagePath);
		const packageJson = require(packageJsonPath);
		const graph = new DepGraph<DependencyNode>();
		const packageName = packageJson.name;
		graph.addNode(packageName, {
			path: packageJsonPath,
		});
		DEPENDENCY_TYPES.forEach(dependencyType => {
			const dependencies = this.getDependenciesOfType(
				packageJsonPath,
				dependencyType
			);
			for (const [[a, aPath], [b, bPath]] of dependencies) {
				if (!graph.hasNode(a)) {
					graph.addNode(a, {
						path: aPath,
						type: dependencyType,
					});
				}
				if (!graph.hasNode(b)) {
					graph.addNode(b, {
						path: bPath,
						type: dependencyType,
					});
				}
				graph.addDependency(a, b);
			}
		});
		return graph;
	}

	protected getDependenciesOfType(
		packageJsonPath,
		type = 'dependencies',
		currentDeps: any[] = []
	) {
		const packageJson = this.getNormalisedPackageJson(packageJsonPath);
		const dependencies = packageJson[type] || {};
		const name = packageJson.name;
		for (const dependency of Object.keys(dependencies)) {
			const localPath = dependencies[dependency];
			const dependencyPackageJson = path.resolve(
				localPath,
				'package.json'
			);
			if (!fs.existsSync(dependencyPackageJson)) {
				continue;
			}
			currentDeps.push([
				[name, packageJsonPath],
				[dependency, dependencyPackageJson],
			]);
			this.getDependenciesOfType(
				dependencyPackageJson,
				'dependencies',
				currentDeps
			);
		}
		return currentDeps;
	}

	protected getPackageJsonPath(packagePath) {
		return packagePath.endsWith('package.json')
			? path.resolve(packagePath)
			: path.resolve(packagePath, 'package.json');
	}

	cleanLocalDependencies(packagePath) {
		const packageJsonPath = this.getPackageJsonPath(packagePath);
		if (!fs.existsSync(packageJsonPath)) {
			return;
		}
		const packageJson = require(path.resolve(packageJsonPath));
		DEPENDENCY_TYPES.forEach(dependencyType => {
			Object.entries(packageJson[dependencyType] || {}).forEach(
				async ([dependency, version]) => {
					const isLocal = !!resolveLocalVersion(version);
					if (!isLocal) {
						return;
					}
					delete packageJson[dependencyType][dependency];
				}
			);
		});
		writeJson(packageJsonPath, packageJson);
	}

	abstract getNormalisedPackageJson(packagePath): Record<string, any>;
	abstract cleanPackageLock(packageLockPath): void;
	abstract install(installDir: string, installArgs: string[]): void;
	abstract isInstalled(): boolean;
	abstract packageLock: string;
}
