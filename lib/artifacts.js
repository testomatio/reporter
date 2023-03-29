const { join, resolve } = require('path');
const fs = require('fs');
const os = require('os');
const uuid = require('uuid');

const { TESTOMAT_ARTIFACT_SUFFIX } = require('./constants');

const createTmpDir = (clientPrefix = 'testomat_reporter') => {
    return fs.mkdtempSync(join(os.tmpdir(), clientPrefix));
}

const artifactToFile = async (dir, artifact) => {   //TODO: use testID as opts?
    // const testId = this.title || this.test_id;

    if (!artifact.hasOwnProperty("path")) {
        artifact = {
            "path": artifact
        };
    }      
    // the rest of your app goes here
    return await appendDataToFile(dir, JSON.stringify(artifact));    
}

const appendDataToFile = async (dir, data) => {
    const artifactSuffix = TESTOMAT_ARTIFACT_SUFFIX + uuid.v4();
    const fullFilepath = resolve(dir, artifactSuffix + ".json");

    return await fs.promises.appendFile(fullFilepath, data);
}

const availableArtifactByFiles = async (dir) => { //TODO: rename function
    const list = []
    const files = fs.readdirSync(dir);

    for (const file of files) {
        const content = await artifactFileContent(dir, file);
        list.push(content)
    }

    return list;
}

const artifactFileContent = async (dir, filename) => {
    const buff = await fs.promises.readFile(dir + "/" + filename); //TODO: theenk about: fix using dir + "/"
    // File content after append 
    return buff.toString();
}

const clearTmpDir = (dir) => {
    if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true });
        console.log(` Testomat tmpDir = ${dir} was deleted successfully!`);
        return;
    }
}

const clearAllTestomatTmpDirs = () => {
    const tmpDirNames = testomatTmpDirNames();

    if (Array.isArray(tmpDirNames) && tmpDirNames.length) {
        for (const tmpDir of tmpDirNames) {
            clearTmpDir(join(os.tmpdir(), tmpDir));
        }
    }
    else {
        console.log("The Testomat tmp folders were not previously created.");
    }
}

const testomatTmpDirNames = () => {
    return fs.readdirSync(os.tmpdir(), { withFileTypes: true })
                        .filter((item) => item.isDirectory())
                        .map((item) => item.name)
                        .filter((name) => name.includes("testomat_reporter"));
}

async function artifact(artifact) { //TODO: расширить функу с возможностью задавать имя
    if(global.testomatioArtifacts === undefined) {      
        const tmpDirNames = testomatTmpDirNames();

        if (Array.isArray(tmpDirNames) && tmpDirNames.length) {
            const fullPath = join(os.tmpdir(), tmpDirNames[tmpDirNames.length - 1]);
            console.log("Save to file");
            return await artifactToFile(fullPath, artifact);
        }
    }
    else {
        console.log("Save to global");
        global.testomatioArtifacts.push(artifact);
    }
}

module.exports = {
    artifact,
    createTmpDir,
    clearAllTestomatTmpDirs
};
