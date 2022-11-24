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

/*
# root "/" commit-hash -> commit (clean)
# root "/" commit-hash "/index.html" ->commit (clean)
# root "/" commit-hash "/rl.html" -> commit (diff to parent branch)
*/

const path = require('path');
const fs = require('fs');
const process = require("process");
const { S3Client, PutObjectCommand} = require("@aws-sdk/client-s3");
const puppeteer = require('puppeteer');
const child_process = require('child_process');
const { argv } = require('process');



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
    default:
      return null;
  }

}


/**
 * Recursively mirror all contents from a source directory to a target directory.
 * Only normal files and directories are considered.
 *
 * @param srcDir Source directory
 * @param targetDir Target directory
 */
function mirrorDir(srcDir, targetDir) {
  fs.mkdirSync(targetDir, {"recursive" : true});

  for(let srcName of fs.readdirSync(srcDir)) {

    const dstPath = path.join(targetDir, srcName);

    const srcPath = path.join(srcDir, srcName);
    const srcStat = fs.statSync(srcPath);

    if (srcStat.isDirectory()) {

      mirrorDir(srcPath, dstPath);

    } else if (srcStat.isFile()) {

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

async function build(refBranch) {

  /* retrieve build config */

  let config = null;
  try {
    config = JSON.parse(fs.readFileSync(".smpte-build.json"));
  } catch {
    throw Error("Could not read the publication config file.");
  }

  const docPath = config.docPath;
  const s3Region = process.env.AWS_S3_REGION;
  const s3Bucket = process.env.AWS_S3_BUCKET;
  const s3KeyPrefix = process.env.AWS_S3_KEY_PREFIX;
  const pubDocName = config.pubDocName || "index.html";
  refBranch = refBranch || config.latestEditionTag || null;
  const buildDirPath = config.buildDirPath || "build";
  const refDirName = config.refDirName || "ref";
  const pubDirName = config.pubDirName || "pub";
  const pubRLName = config.pubRLName || "rl.html";
  const pubLinksDocName = "pr-links.md";
  const pubStaticDirName = "_static/";

  let version = null;
  try {
    version = child_process.execSync(`git rev-parse HEAD`).toString().trim();
  } catch (e) {
    throw Error("Cannot retrieve commit hash.");
  }

  if (! docPath)
    throw Error("The config file must provide the path to the document.");

  const s3Client = new S3Client({ region: s3Region });

  /* build the publication directory */

  fs.mkdirSync(buildDirPath, {"recursive" : true});

  const pubDirPath = path.join(buildDirPath, pubDirName);

  fs.rmSync(pubDirPath, { recursive: true, force: true });

  mirrorDir(path.dirname(docPath), pubDirPath);

  mirrorDir(path.join(__dirname, "../static"), path.join(pubDirPath, pubStaticDirName));

  /* render the document */

  const renderedDoc = await render(docPath, pubStaticDirName);

  const renderedDocPath = path.join(pubDirPath, pubDocName);

  fs.writeFileSync(renderedDocPath, renderedDoc.docHTML);

  /* generate the redline, if requested */

  const rlDocPath = path.join(pubDirPath, pubRLName);

  if (refBranch !== null) {

    const refDirPath = path.join(buildDirPath, refDirName);

    if (fs.existsSync(refDirPath))
      child_process.execSync(`git worktree remove -f ${refDirPath}`);

    child_process.execSync(`git worktree add -f ${refDirPath} ${refBranch}`);

    const refDocPath = path.join(refDirPath, docPath);

    if (fs.existsSync(refDocPath)) {

      const renderedRef = await render(refDocPath, pubStaticDirName);

      const renderedRefPath = path.join(buildDirPath, "ref.html");

      fs.writeFileSync(renderedRefPath, renderedRef.docHTML);

      child_process.execSync(`perl lib/htmldiff/htmldiff.pl ${renderedRefPath} ${renderedDocPath} ${rlDocPath}`);

    } else {
      console.warn("No reference document to compare.");
    }

  }

  /* upload to AWS */

  const pubLinksDocPath = path.join(buildDirPath, pubLinksDocName);

  if (s3Region && s3Bucket && s3KeyPrefix) {

    const s3PubKeyPrefix = s3KeyPrefix + version + "/";

    s3SyncDir(pubDirPath, s3Client, s3Bucket, s3PubKeyPrefix);

    /* create links */

    const cleanURL = encodeURI(`http://${s3Bucket}.s3-website-${s3Region}.amazonaws.com/${s3PubKeyPrefix}`);
    const redlineURL = encodeURI(`http://${s3Bucket}.s3-website-${s3Region}.amazonaws.com/${s3PubKeyPrefix}${pubRLName}`);

    if (fs.existsSync(rlDocPath)) {
      fs.writeFileSync(
        pubLinksDocPath,
        "Review links:\n* [Clean](${cleanURL})\n* [Redline](${redlineURL})\n"
      )
    } else {
      fs.writeFileSync(
        pubLinksDocPath,
        "Review link:\n* [Clean](${cleanURL})\n"
      )
    }


  } else {
    console.warn("Skipping AWS upload and PR link creation. One of the following \
environment variables is not set: AWS_S3_REGION, AWS_S3_BUCKET, AWS_S3_KEY_PREFIX.");

    fs.writeFileSync(
      pubLinksDocPath,
      "No links available"
    )
  }

  process.stdout.write(pubLinksDocPath);
}

async function render(docPath, staticRootPath) {

  let commitHash = null;
  try {
    commitHash = child_process.execSync(`git -C ${path.dirname(docPath)} rev-parse HEAD`).toString().trim();
  } catch (e) {
    throw Error("Cannot retrieve commit hash.");
  }

  /* render the page */

  const browser = await puppeteer.launch({
    args: ["--disable-dev-shm-usage", "--allow-file-access-from-files"],
  });

  const page = await browser.newPage();

  await page.evaluateOnNewDocument((e) => {
    window._STATIC_ROOT_PATH = e;
  }, staticRootPath);

  await page.goto("file://" + path.resolve(docPath) + (commitHash ? "?build-hash=" + commitHash : ""));

  const docTitle = await page.evaluate(() => document.title);

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

  await browser.close();

  return {
    "docHTML": docHTML,
    "docTitle": docTitle
  };
}

build(argv[2] || null).catch(e => { console.error(e) });
