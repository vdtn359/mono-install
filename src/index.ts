#!/usr/bin/env node
import { execSync } from 'src/lib/child_process';
import fs from 'fs';
import path from 'path';
import { FileContent, Remove, UndoManager } from 'src/lib/undo';
import { read, readJson, writeJson } from 'src/lib/files';
import { getOptions } from 'src/lib/args';
import cpy from 'cpy';
import { DEPENDENCY_TYPES } from 'src/lib/engines/constants';
import yargs from 'yargs';
import { ENGINE } from 'src/lib/engines/engine';

yargs
	.usage('$0 [args] -- [install args]')
	.option('install-dir', {
		alias: 'i',
		type: 'string',
		description: 'The installation directory',
	})
	.option('package-json', {
		alias: 'p',
		type: 'string',
		description: 'package.json location',
	})
	.option('package-lock', {
		alias: 'l',
		type: 'string',
		description: 'Lock file (package-lock.json, pnpm-lock.yaml) location',
	})
	.option('engine', {
		alias: 'e',
		default: ENGINE.npm,
		type: 'string',
		choices: [ENGINE.npm, ENGINE.pnpm],
		description: 'Engine to use',
	})
	.strict();

const fsExtra = require('fs-extra');

const options = getOptions();
const undoManager = new UndoManager();
const {
	installDirectory,
	engine,
	sourcePackageJsonPath,
	destinationPackageJsonPath,
	sourcePackageLockPath,
	destinationPackageLockPath,
	installArgs,
} = options;

if (!fs.existsSync(installDirectory)) {
	fsExtra.mkdirpSync(installDirectory);
}

run();

async function run() {
	let linkDir;
	let exitCode = 0;
	undoManager.registerSigInt();
	try {
		await ensurePackageJsonFiles();
		linkDir = path.resolve(installDirectory, `tmp-${Date.now()}`);
		fsExtra.mkdirpSync(linkDir);
		undoManager.add(new Remove(linkDir));
		await prepareDependencies({ linkDir });
		await engine.install(installDirectory, installArgs);
	} catch (e) {
		console.error('Link install failed', e);
		exitCode = 1;
	} finally {
		await undoManager.undo();
	}
	process.exit(exitCode);
}

async function ensurePackageJsonFiles() {
	if (!fs.existsSync(sourcePackageLockPath)) {
		console.info(`Package lock ${engine.packageLock} does not exist`);
	} else {
		if (sourcePackageLockPath !== destinationPackageLockPath) {
			console.info(
				`Copying ${engine.packageLock} from ${path.dirname(
					sourcePackageLockPath
				)} to ${installDirectory}`
			);
			await cpy(sourcePackageLockPath, installDirectory);
		} else {
			undoManager.add(new FileContent(sourcePackageLockPath));
		}
		engine.cleanPackageLock(destinationPackageLockPath);
	}
	console.log(sourcePackageJsonPath);
	if (!fs.existsSync(sourcePackageJsonPath)) {
		console.error('package.json does not exist');
		process.exit(1);
	}
	const packagePath = path.dirname(sourcePackageJsonPath);
	if (sourcePackageJsonPath === destinationPackageJsonPath) {
		undoManager.add(new FileContent(sourcePackageJsonPath));
	}
	if (packagePath !== installDirectory) {
		console.info(
			`Copying package.json from ${packagePath} to ${installDirectory}`
		);
		await copyPackageFiles();
	}
}

async function copyPackageFiles() {
	const normalizedJson = engine.getNormalisedPackageJson(
		sourcePackageJsonPath
	);
	DEPENDENCY_TYPES.forEach(dependencyType => {
		Object.entries(normalizedJson[dependencyType] || {}).map(
			async ([dependency, version]: any) => {
				if (!version.startsWith('/')) {
					return;
				}
				normalizedJson[dependencyType][
					dependency
				] = `file:${path.relative(
					path.resolve(process.cwd(), installDirectory),
					version as string
				)}`;
			}
		);
	});
	writeJson(destinationPackageJsonPath, normalizedJson);
}

async function prepareDependencies({ linkDir }) {
	const packageJson = readJson(destinationPackageJsonPath);
	const graph = engine.getDependencyGraph(destinationPackageJsonPath);
	const dependencies = graph.dependenciesOf(packageJson.name);
	console.log(`Found the following dependencies ${dependencies}`);
	await Promise.all(
		dependencies.map(async dependency => {
			const {
				path: dependencyJsonPath,
				type: dependencyType,
			} = graph.getNodeData(dependency);
			console.info(`Preparing ${dependency}`);
			const childUndo = new UndoManager();
			undoManager.add(childUndo);
			try {
				packageJson[dependencyType as string][
					dependency
				] = `file:${path.relative(
					installDirectory,
					await prepareTarFile({
						dependency,
						dependencyJsonPath,
						linkDir,
						undoManager: childUndo,
					})
				)}`;
			} catch (e) {
				console.error(`Failed to prepare ${dependency}`);
				throw e;
			} finally {
				await childUndo.undo();
			}
		})
	);
	writeJson(destinationPackageJsonPath, packageJson);

	return packageJson;
}

async function prepareTarFile({
	dependency,
	dependencyJsonPath,
	linkDir,
	undoManager,
}) {
	if (!fs.existsSync(dependencyJsonPath)) {
		console.log(
			`Skip ${dependency} as ${dependencyJsonPath} does not exist`
		);
		return;
	}
	const dependencyJsonContent = read(dependencyJsonPath);
	undoManager.add(new FileContent(dependencyJsonPath, dependencyJsonContent));
	const dependencyJson = JSON.parse(dependencyJsonContent);
	const dependencyPath = path.dirname(dependencyJsonPath);
	const newPath = path.resolve(linkDir, dependency);
	fsExtra.mkdirpSync(newPath);
	engine.cleanLocalDependencies(dependencyJsonPath);

	const tarFile = `${dependency}-${dependencyJson.version}.tgz`;
	undoManager.add(new Remove(path.resolve(dependencyPath, tarFile)));
	execSync('npm pack', {
		cwd: dependencyPath,
	});
	console.log(`Copying ${dependencyPath} to ${newPath}`);
	const tarLocation = path.resolve(newPath, tarFile);
	await fsExtra.move(path.resolve(dependencyPath, tarFile), tarLocation, {
		overwrite: true,
	});

	return tarLocation;
}
