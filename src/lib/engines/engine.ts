import { DepGraph } from 'dependency-graph';

export type DependencyNode = {
	path: string;
	version: string;
	type?: string;
};

export enum ENGINE {
	npm = 'npm',
	pnpm = 'pnpm',
}

export interface Engine {
	getNormalisedPackageJson(packagePath): Record<string, any>;
	getDependencyGraph(packagePath): DepGraph<DependencyNode>;
	cleanLocalDependencies(packagePath: string): void;
	cleanPackageLock(packageLockPath: string): void;
	install(installDir: string, installArgs: string[]): void;
	isInstalled(): boolean;
	packageLock: string;
}
