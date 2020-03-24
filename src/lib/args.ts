import yargs from 'yargs';
import { Engine, ENGINE } from 'src/lib/engines/engine';
import path from 'path';
import { NpmEngine } from 'src/lib/engines/npm';
import { PnpmEngine } from 'src/lib/engines/pnpm';

const engineMap: Record<ENGINE, Engine> = {
	[ENGINE.npm]: new NpmEngine(),
	[ENGINE.pnpm]: new PnpmEngine(),
};

export function getOptions() {
	const args: Record<string, any> = yargs.argv;
	const installArgs = args['_'];
	const installDirectory = path.resolve(args['installDir'] || process.cwd());
	const engineType = args['engine'] || ENGINE.npm;
	const engine: Engine = engineMap[engineType];
	if (!engine) {
		console.error(`Unknown engine ${engine}`);
		process.exit(1);
	}
	const sourcePackageJsonPath = path.resolve(
		args['packageJson'] || `${installDirectory}/package.json`
	);
	const sourcePackageLockPath = path.resolve(
		args['packageLock'] ||
			path.resolve(installDirectory, engine.packageLock)
	);
	const destinationPackageJsonPath = path.resolve(
		`${installDirectory}/package.json`
	);
	const destinationPackageLockPath = path.resolve(
		path.resolve(installDirectory, engine.packageLock)
	);
	return {
		installArgs,
		installDirectory,
		engineType,
		engine,
		sourcePackageLockPath,
		sourcePackageJsonPath,
		destinationPackageJsonPath,
		destinationPackageLockPath,
	};
}
