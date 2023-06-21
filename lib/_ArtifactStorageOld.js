const debug = require('debug')('@testomatio/reporter:storage');
const { join, resolve } = require('path');
const fs = require('fs');
const os = require('os');
const uuid = require('uuid');
const { TESTOMAT_ARTIFACT_SUFFIX } = require('./constants');
const { specificTestInfo } = require('./util');

class ArtifactStorage {
  
  constructor(params) {
    this.isFile = false;
    this.isMemory = true;
    this.storage = params?.toFile;

    if (this.storage) {
      // this is fine to use when you start saving artifacts;
      // but when you need to retrieve them, you will not know if there is "isFile" param,
      // because you need to create a new instance of ArtifactStorage inside client
      // so the solution is make it opposite to isMemory (which will be retrieved from global)
      this.isFile = true;
      this.isMemory = false;
      this.tmpDirFullpath = this.createTestomatTmpDir(ArtifactStorage._tmpPrefix);
      debug('SAVE to tmp folder mode enabled!');
    }
  }

  static async storeToFile(tmpDirName, artifact, testSuffix = "test") {
    // this assumes to use multiple files for each test. do we really want this?
    const suffix = TESTOMAT_ARTIFACT_SUFFIX + uuid.v4() + testSuffix;
    const dirpath = join(os.tmpdir(), tmpDirName);
    // why json?
    const filepath = resolve(dirpath, `${suffix}.json`);

    return fs.promises.appendFile(filepath, JSON.stringify(artifact));
  }

  static async artifact(artifact, context) {
    // TODO: mode for different pre-hooks. As variant - "all-tests" || "only_fail"
    // const mode = process.env.TESTOMAT_ARTIFACTS || "only_fail";

    // you save the artifact without specifying its source - test id
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

  // returns all the content from all files; do we really need it?
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

  // no need to use multiple dirs; we can implement it later if required
  static tmpTestomatDirNames() {
    const subname = ArtifactStorage._tmpPrefix || "tsmt_reporter";

    return fs.readdirSync(os.tmpdir(), { withFileTypes: true })
      .filter((item) => item.isDirectory())
      .map((item) => item.name)
      .filter((name) => name.includes(subname));
  }

  cleanup() {
    // when you do a cleanup, I know nothing about isFile param
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

ArtifactStorage._tmpPrefix = "tsmt_reporter";

module.exports = ArtifactStorage;