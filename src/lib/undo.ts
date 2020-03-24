const fsExtra = require('fs-extra');
import fs from 'fs';
import { promisify } from 'util';
import { read, write } from 'src/lib/files';

const existsAsync = promisify(fs.exists).bind(fs);

export class UndoManager {
	private undos: any[];
	private static undoCount = 0;
	constructor() {
		this.undos = [];
	}

	add(undo) {
		this.undos.push(undo);
	}

	async undo() {
		await Promise.all(this.undos.map(currentUndo => currentUndo.undo()));
		this.undos = [];
	}

	registerSigInt() {
		process.on('SIGINT', async () => {
			UndoManager.undoCount++;
			await this.undo();
			UndoManager.undoCount--;
			if (UndoManager.undoCount == 0) {
				process.exit(1);
			}
		});
	}
}

export class FileContent {
	private readonly filePath: string;
	private readonly content: string;
	constructor(filePath, content?: string) {
		this.filePath = filePath;
		if (content == undefined) {
			this.content = read(filePath);
		} else {
			this.content = content;
		}
	}

	async undo() {
		await write(this.filePath, this.content);
	}
}

export class Remove {
	private readonly filePath: string;
	constructor(filePath) {
		this.filePath = filePath;
	}

	async undo() {
		if (await existsAsync(this.filePath)) {
			await fsExtra.remove(this.filePath);
		}
	}
}
