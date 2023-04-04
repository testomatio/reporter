const { join, resolve } = require('path');
const fs = require('fs');
const os = require('os');
const uuid = require('uuid');
const chalk = require('chalk');

const { TESTOMAT_ARTIFACT_SUFFIX } = require('./constants');

class ArtifactStorage {
    _tmpPrefix = "tsmt_reporter";
     
    constructor(filestore) {
        this.isFile = false;
        this.isMemory = true;

        if (filestore) {
            this.isFile = true;
            this.isMemory = false;
            this.tmpDirFullpath = this.createTestomatTmpDir(this._tmpPrefix);
            console.log(chalk.yellow('SAVE to tmp folder mode enabled!'));
        }
    }

    static async storeToFile(tmpDirName, artifact) { //TODO: use testID as opts? - нужно обязательно для ЗАФЕЙЛЕНЫХ тестов
        const suffix = TESTOMAT_ARTIFACT_SUFFIX + uuid.v4();
        const dirpath = join(os.tmpdir(), tmpDirName);
        const filepath = resolve(dirpath, suffix + ".json");

        return await fs.promises.appendFile(filepath, JSON.stringify(artifact));
    }

    static async artifact(artifact) {  //TODO: use testID as opts?
        // const mode = process.env.TESTOMAT_ARTIFACTS || "only_fail"; //TODO: как мен использовать это в дальнейшем???
        // как пример может быть "all-tests" || "only_fail"

        if (Array.isArray(global.testomatioArtifacts)) {
            console.log("Save to global");
            global.testomatioArtifacts.push(artifact);
        }

        if (global?.testomatioArtifacts === undefined) {
            const tmpDirNames = ArtifactStorage.tmpTestomatDirNames();

            if (Array.isArray(tmpDirNames) && tmpDirNames.length) {
                console.log("Save to file");
                
                return await ArtifactStorage.storeToFile(tmpDirNames[tmpDirNames.length - 1], artifact);
            }
        }
    }

    async tmpContents() {
        const contents = [];

        if (this.isFile && this.tmpDirFullpath) {            
            const files = fs.readdirSync(this.tmpDirFullpath);

            for (const file of files) {
                const buff = await fs.promises.readFile(this.tmpDirFullpath + "/" + file);
                const content = buff.toString();

                contents.push(content);
            }
        }

        return contents;
    }

    createTestomatTmpDir(clientPrefix) {
        return fs.mkdtempSync(join(os.tmpdir(), clientPrefix));
    }

    clearTmpDirByName(name) {
        const tmpDirPath = join(os.tmpdir(), name);

        if (fs.existsSync(tmpDirPath)) {
            fs.rmSync(tmpDirPath, { recursive: true });
            console.log(` Testomat tmpDir = ${tmpDirPath} was deleted successfully!`); //TODO: remove before push
            
            return;
        }
    }

    static tmpTestomatDirNames() {
        const subname = this._tmpPrefix || "tsmt_reporter";

        return fs.readdirSync(os.tmpdir(), { withFileTypes: true })
                        .filter((item) => item.isDirectory())
                        .map((item) => item.name)
                        .filter((name) => name.includes(subname));
    }

    cleanup() {
        if (this.isFile && this.tmpDirFullpath) {
            const tmpDirNames = ArtifactStorage.tmpTestomatDirNames();

            if (Array.isArray(tmpDirNames) && tmpDirNames.length) {
                for (const name of tmpDirNames) {
                    this.clearTmpDirByName(name); //TODO: doublecheck
                }
            }
        }
        else {
            console.log("Nothing to clean!!") //TODO: remove after
        }
    }
}

module.exports = ArtifactStorage;