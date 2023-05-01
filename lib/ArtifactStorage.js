const debug = require('debug')('@testomatio/reporter:storage');
const { join, resolve } = require('path');
const fs = require('fs');
const os = require('os');
const uuid = require('uuid');
const { TESTOMAT_ARTIFACT_SUFFIX } = require('./constants');
const { specificTestInfo } = require('./util');

class ArtifactStorage {

  constructor(params) {
    this._tmpPrefix = "tsmt_reporter";
    this.isFile = false;
    this.isMemory = true;
    this.storage = params?.toFile;

    if (this.storage) {
      this.isFile = true;
      this.isMemory = false;
      this.tmpDirFullpath = this.createTestomatTmpDir(this._tmpPrefix);
      debug('SAVE to tmp folder mode enabled!');
    }
  }

  static async storeToFile(tmpDirName, artifact, testSuffix = "test") {
    const suffix = TESTOMAT_ARTIFACT_SUFFIX + uuid.v4() + testSuffix;
    const dirpath = join(os.tmpdir(), tmpDirName);
    const filepath = resolve(dirpath, `${suffix}.json`);

    return fs.promises.appendFile(filepath, JSON.stringify(artifact));
  }

  static async artifact(artifact, context) {
    // TODO: mode for different pre-hooks. As variant - "all-tests" || "only_fail"
    // const mode = process.env.TESTOMAT_ARTIFACTS || "only_fail";

    if (Array.isArray(global.testomatioArtifacts)) {
      debug("Saving artifacts to global storage");

      global.testomatioArtifacts.push(artifact);
    }

    if (global?.testomatioArtifacts === undefined) {
      const tmpDirNames = ArtifactStorage.tmpTestomatDirNames();

      const testSuffix = specificTestInfo(context.test);

      if (Array.isArray(tmpDirNames) && tmpDirNames.length) {
        debug("Saving artifacts to memory tmp folder");

        return ArtifactStorage.storeToFile(tmpDirNames[tmpDirNames.length - 1], artifact, testSuffix);
      }
    }
  }

  async artifactByTestName(test) {
    const list = [];

    if (this.isFile && this.tmpDirFullpath) {
      const files = fs.readdirSync(this.tmpDirFullpath);

      for (const file of files) {
        if (file.includes(test)) {
          const buff = await fs.promises.readFile(`${this.tmpDirFullpath  }/${  file}`);

          list.push(JSON.parse(buff.toString()));
        }
      }
    }

    return list;
  }

  async tmpContents() {
    const contents = [];

    if (this.isFile && this.tmpDirFullpath) {
      const files = fs.readdirSync(this.tmpDirFullpath);

      for (const file of files) {
        const buff = await fs.promises.readFile(`${this.tmpDirFullpath  }/${  file}`);
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
      debug(` Testomat tmpDir = ${tmpDirPath} was deleted successfully!`);

      
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
          this.clearTmpDirByName(name);
        }
      }
    }
    else {
      debug("The tmp folder has not been created! Nothing to delete");
    }
  }
}

module.exports = ArtifactStorage;