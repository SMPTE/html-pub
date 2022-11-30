/* (c) Society of Motion Picture and Television Engineers

Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

3. Neither the name of the copyright holder nor the names of its contributors
   may be used to endorse or promote products derived from this software without
   specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR
ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE. */

const path = require('path');
const fs = require('fs');
const process = require("process");
const { S3Client, PutObjectCommand} = require("@aws-sdk/client-s3");
const puppeteer = require('puppeteer');
const child_process = require('child_process');
const { argv } = require('process');

/**
 * build.js (validate | build | deploy)
 */

/**
 * Infers the content type of a file based on its path.
 *
 * @param filePath Path of the file
 * @returns Content type
 */
function guessContentTypeFromExtenstion(filePath) {

  switch (path.extname(filePath)) {
    case ".html":
      return "text/html";
    case ".png":
      return "image/png";
    case ".svg":
      return "image/svg";
    case ".css":
      return "text/css";
    default:
      return null;
  }

}


/**
 * Recursively mirror all contents from a source directory to a target directory.
 * Only normal files and directories are considered.
 * Excludes all directories and files under ${srcDir}/tooling with the exception of
 * ${srcDir}/tooling/static
 *
 * @param srcDir Source directory
 * @param targetDir Target directory
 */
function mirrorDirExcludeNonStaticTooling(srcDir, targetDir, relParentPath) {
  relParentPath = relParentPath || "";

  fs.mkdirSync(path.join(targetDir, relParentPath), {"recursive" : true});

  for(let srcName of fs.readdirSync(path.join(srcDir, relParentPath))) {

    const relSrcPath = path.join(relParentPath, srcName);

    const srcPath = path.join(srcDir, relSrcPath);
    const dstPath = path.join(targetDir, relSrcPath);

    const srcStat = fs.statSync(srcPath);
    if (srcStat.isDirectory()) {

      if (relParentPath !== "tooling" || relSrcPath === "tooling/static")
        mirrorDirExcludeNonStaticTooling(srcDir, targetDir, relSrcPath);

    } else if (srcStat.isFile() && relParentPath !== "tooling") {

      fs.copyFileSync(srcPath, dstPath);

    }
  }
}

/**
 * Recursively uploads all contents from a source directory to a target S3 bucket.
 * Only normal files and directories are considered.
 *
 * @param s3Client S3 object
 * @param bucket S3 bucket name
 * @param srcDir Source directory
 * @param dstPrefix AWS S3 bucket prefix
 */
 async function s3SyncDir(srcDir, s3Client, bucket, dstPrefix) {

  for(let srcName of fs.readdirSync(srcDir)) {

    const dstKey = dstPrefix + srcName;

    const srcPath = path.join(srcDir, srcName);
    const srcStat = fs.statSync(srcPath);

    if (srcStat.isDirectory()) {

      s3SyncDir(srcPath, s3Client, bucket, dstKey + "/");

    } else if (srcStat.isFile()) {

      const contentType = guessContentTypeFromExtenstion(srcPath);

      if (contentType === null)
        throw Error(`Unknown content type for: ${srcPath}`);

      const cmd = new PutObjectCommand({
        Body: fs.createReadStream(srcPath),
        Bucket: bucket,
        Key: dstKey,
        ContentType: contentType
      });
      await s3Client.send(cmd);

    }
  }
}

async function build(buildPaths, baseRef, lastEdRef) {

  /* make sure the document directory does not contain conflicting names */

  if (fs.existsSync(path.join(buildPaths.docDirPath, buildPaths.pubStaticDirName)))
    throw Error(`The document directory cannot contain an entry named ${buildPaths.pubStaticDirName}`);

  if (fs.existsSync(path.join(buildPaths.docDirPath, buildPaths.pubRedlineName)))
    throw Error(`The document directory cannot contain an entry named ${buildPaths.pubRedlineName}`);

  if (fs.existsSync(path.join(buildPaths.docDirPath, buildPaths.baseRedlineName)))
    throw Error(`The document directory cannot contain an entry named ${buildPaths.baseRedlineName}`);

  if (fs.existsSync(path.join(buildPaths.docDirPath, buildPaths.renderedDocName)))
    throw Error(`The document directory cannot contain an entry named ${buildPaths.renderedDocName}`);

  /* create the build directory if it does not already exists */

  fs.mkdirSync(buildPaths.buildDirPath, {"recursive" : true});

  /* populate the publication directory */

  fs.rmSync(buildPaths.pubDirPath, { recursive: true, force: true });

  mirrorDirExcludeNonStaticTooling(buildPaths.docDirPath, buildPaths.pubDirPath);

  /* render the document */

  const renderedDoc = await render(buildPaths.docPath);

  fs.writeFileSync(buildPaths.renderedDocPath, renderedDoc.docHTML);

  /* generate base redline, if requested */

  if (baseRef !== null) {

    console.log(`Generating a redline against base: ${baseRef}.`);

    try {
      await generateRedline(buildPaths, baseRef, buildPaths.baseRedLineRefPath, buildPaths.baseRedlinePath);
    } catch (e) {
      console.warn(`Could not generate a redline: ${e}.`);
    }

  }

  /* generate pub redline, if requested */

  if (lastEdRef !== null) {

    console.log(`Generating a redline against the latest edition tag: ${lastEdRef}.`);

    try {
      await generateRedline(buildPaths, lastEdRef, buildPaths.pubRedLineRefPath, buildPaths.pubRedlinePath);
    } catch (e) {
      console.warn(`Could not generate a redline: ${e}.`);
    }

  }

}

async function generateRedline(buildPaths, refCommit, refPath, rlPath) {

  if (fs.existsSync(buildPaths.refDirPath))
    fs.rmSync(buildPaths.refDirPath, { recursive: true, force: true });

  child_process.execSync(`git clone -b ${refCommit} . ${buildPaths.refDirPath}`);

  if (! fs.existsSync(buildPaths.refDirPath))
    throw Error("Reference file does not exist");

  const r = await render(path.join(buildPaths.refDirPath, buildPaths.docPath));

  fs.writeFileSync(refPath, r.docHTML);

  child_process.execSync(`perl lib/htmldiff/htmldiff.pl ${refPath} ${buildPaths.renderedDocPath} ${rlPath}`);

}

async function s3Upload(buildPaths, versionKey) {
  const s3Region = process.env.AWS_S3_REGION;
  const s3Bucket = process.env.AWS_S3_BUCKET;
  const s3KeyPrefix = process.env.AWS_S3_KEY_PREFIX;

  let linksDocContents = "# Review links\n";

  if (s3Region && s3Bucket && s3KeyPrefix) {

    const s3Client = new S3Client({ region: s3Region });

    const s3PubKeyPrefix = s3KeyPrefix + versionKey + "/";

    s3SyncDir(buildPaths.pubDirPath, s3Client, s3Bucket, s3PubKeyPrefix);

    /* create links */

    const cleanURL = `http://${s3Bucket}.s3-website-${s3Region}.amazonaws.com/${s3PubKeyPrefix}`;
    linksDocContents += `[Clean](${encodeURI(cleanURL)})\n`

    if (fs.existsSync(buildPaths.baseRedlinePath)) {
      const baseRedlineURL = `http://${s3Bucket}.s3-website-${s3Region}.amazonaws.com/${s3PubKeyPrefix}${buildPaths.getBaseRedlineName()}`;
      linksDocContents += `[Redline to current draft](${encodeURI(baseRedlineURL)})\n`
    }

    if (fs.existsSync(buildPaths.pubRedlinePath)) {
      const pubRedlineURL = `http://${s3Bucket}.s3-website-${s3Region}.amazonaws.com/${s3PubKeyPrefix}${buildPaths.getPubRedlineName()}`;
      linksDocContents += `[Redline to most recent edition](${encodeURI(pubRedlineURL)})\n`
    }

  } else {
    console.warn("Skipping AWS upload. One of the following environment variables is not set: AWS_S3_REGION, AWS_S3_BUCKET, AWS_S3_KEY_PREFIX.");

    linksDocContents += "No links available";
  }

  fs.writeFileSync(buildPaths.pubLinksPath, linksDocContents);
}

async function render(docPath) {

  const commitHash = child_process.execSync(`git -C ${path.dirname(docPath)} rev-parse HEAD`, {stdio: ['ignore', 'pipe', 'ignore']}).toString().trim();

  /* render the page */

  const browser = await puppeteer.launch({
    args: ["--disable-dev-shm-usage", "--allow-file-access-from-files"],
  });

  const page = await browser.newPage();

  const pageURL = "file://" + path.resolve(docPath) + (commitHash ? "?buildHash=" + commitHash : "");

  await page.goto(pageURL);

  const docTitle = await page.evaluate(() => document.title);

  try {

    await page.evaluate(() => {
      /* remove all scripts */
      const elements = document.getElementsByTagName('script');
      for (let i = elements.length - 1; i >= 0; i--)
        elements[i].parentNode.removeChild(elements[i]);

      /* refuse to render if there are page errors */
      if (listEvents().length)
        throw new Error(`Page has errors`);
    })

    const docHTML = await page.content();

    return {
      "docHTML": docHTML,
      "docTitle": docTitle
    };

  } finally {

    await browser.close();

  }

}

class BuildPaths {
  constructor() {

    this.docPath = "doc/main.html";
    this.docDirPath = path.dirname(this.docPath);
    this.docName = path.basename(this.docPath);

    this.buildDirPath = "build";

    this.pubStaticDirName = "static";

    this.pubDirPath = path.join(this.buildDirPath, "pub");

    this.renderedDocName = "index.html";
    this.renderedDocPath = path.join(this.pubDirPath, this.renderedDocName);

    this.refDirPath = path.join(this.buildDirPath, "ref");
    this.renderedRefDocPath = path.join(this.buildDirPath, "ref.html");

    this.pubLinksPath = path.join(this.buildDirPath, "pr-links.md")

    this.pubRedlineName = "pub-rl.html";
    this.pubRedlinePath = path.join(this.pubDirPath, this.pubRedlineName);
    this.pubRedLineRefPath = path.join(this.buildDirPath, this.pubRedlineName);

    this.baseRedlineName = "base-rl.html";
    this.baseRedlinePath = path.join(this.pubDirPath, this.baseRedlineName);
    this.baseRedLineRefPath = path.join(this.buildDirPath, this.baseRedlineName);
  }

}

class BuildConfig {
  constructor(docDirPath) {
    let config = null;
    try {
      config = JSON.parse(fs.readFileSync(path.join(docDirPath, ".smpte-build.json")));
    } catch {
      throw Error("Could not read the publication config file.");
    }

    this.lastEdRef = config.latestEditionTag || null;
  }
}

async function main() {
  /* retrieve build phase */

  const buildPhase = argv[2] || "validate";

  /* retrieve build config */

  const config = new BuildConfig(".");

  /* initialize the build paths */

  const buildPaths = new BuildPaths();

  /* get the target commit and reference commits */

  const baseRef = process.env.GITHUB_BASE_REF || null;

  let branchName = process.env.GITHUB_REF;
  if (branchName == null) {
    try {
      branchName = child_process.execSync(`git branch --show-current`).toString().trim();
      
    } catch (e) {
      throw Error("Cannot retrieve branch name.");
    }
  }
  console.log(`Current branch: ${branchName}`);

  let commitHash = null;
  try {
    commitHash = child_process.execSync(`git rev-parse HEAD`).toString().trim();
  } catch (e) {
    throw Error("Cannot retrieve commit hash.");
  }
  console.log(`Current commit hash: ${commitHash}`);

  /* validate source document */

  try {
    child_process.execSync(`html5validator --errors-only ${buildPaths.docPath}`);
  } catch (e) {
    console.error(e.stdout.toString());
    throw Error("Document validation failed.");
  }

  /* build document */

  await build(buildPaths, baseRef, config.lastEdRef);

  /* validate rendered document */

  try {
    child_process.execSync(`html5validator --errors-only ${buildPaths.renderedDocPath}`);
  } catch (e) {
    console.error(e.stdout.toString());
    throw Error("Rendered document validation failed.");
  }

  /* skip deployment if validating only */

  if (buildPhase === "validate") {
    console.warn("Skipping deploy to S3.");
    return;
  }

  /* deploy to S3 */

  s3Upload(buildPaths, branchName);

  s3Upload(buildPaths, commitHash);

}


main().catch(e => { console.error(e) });
