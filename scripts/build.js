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

# spec
# - render
# - listAssets

# read args
#   - current branch/commit
#   - base branch/commit (optional)
#   - path to config file (optional)
#   - path to links markdown doc

# read config

# clone repo to "current_spec_repo"

# render current spec
#   render(specDir = "current_spec_repo", renderedSpecFileName, buildDir = "current_spec")

# if (ref exists)

# clone ref repo to "ref_spec_repo"

# render ref spec
#   render(specDir = "ref_spec_repo", renderedSpecFileName, buildDir = "ref_spec")

# if (diff between current and ref)

# generate redline

# endif (diff between current and ref)

# endif (ref exists)

# generate PR message

# push to AWS
*/

const path = require('path');
const fs = require('fs');
const process = require('process');
const { s3 } = require("@aws-sdk/client-s3");
const puppeteer = require('puppeteer');
const child_process = require('child_process');

const s3Client = new S3({ region: common.HOA_REGION });

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

      await s3Client.putObject({
        Body: createReadStream(srcPath),
        Bucket: bucket,
        Key: dstKey
      });

    }
  }
}

async function build(configFilePath, refBranch) {

  /* retrieve build config */

  let config = null;
  try {
    config = JSON.parse(fs.readFileSync(configFilePath));
  } catch {
    throw Error("Could not read the publication config file.");
  }

  const docPath = config.docPath;
  const s3Region = process.env.AWS_S3_REGION;
  const s3Bucket = process.env.AWS_S3_BUCKET;
  const s3KeyPrefix = process.env.AWS_S3_KEY_PREFIX;
  const pubDocName = config.pubDocName || "index.html";
  const refBranch = refBranch || config.latestEditionTag || null;
  const buildDirPath = config.buildDirPath || "build";
  const refDirName = config.refDirName || "ref";
  const pubDirName = config.pubDirName || "pub";
  const pubRLName = config.pubRLName || "rl.html";


  let commitHash = null;
  try {
    commitHash = child_process.execSync(`git -C ${path.dirname(docPath)} rev-parse --short HEAD`);
  } catch (e) {
    throw Error("Cannot retrieve commit hash.");
  }

  if (! docPath)
    throw Error("The config file must provide the path to the document.");

  if (! s3Region)
    throw Error("The environment variable `AWS_S3_REGION` must be set.");

  if (! s3Bucket)
    throw Error("The environment variable `AWS_S3_BUCKET` must be set.");

  if (! s3KeyPrefix)
    throw Error("The environment variable `AWS_S3_KEY_PREFIX` must be set.");

  const s3Client = new S3({ region: s3Region });

  /* build the publication directory */

  fs.mkdirSync(buildDirPath, {"recursive" : true});

  const pubDirPath = path.join(buildDirPath, pubDirName);

  mirrorDir(path.dirname(docPath), pubDirPath);

  /* render the document */

  const renderedDoc = await render(docPath, commitHash);

  const renderedDocPath = path.join(pubDirPath, pubDocName);

  fs.writeFileSync(renderedDocPath, renderedDoc.docHTML);

  /* generate the redline, if requested */

  if (refBranch !== null) {

    const refDirPath = path.join(buildDirPath, refDirName);

    if (fs.existsSync(refDirPath))
      child_process.execSync(`git worktree remove -f ${refDirPath}`);

    child_process.execSync(`git worktree add -f ${refDirPath} ${refBranch}`);

    const renderedRef = await render(path.join(refDirPath, docPath), commitHash);

    const renderedRefPath = path.join(buildDirPath, "ref.html");

    fs.writeFileSync(renderedRefPath, renderedRef.docHTML);

    /* bash ${HTMLDIFF_PL} ${RENDERED_OLD_PATH} ${RENDERED_NEW_PATH} ${BUILT_SPEC_DIR}/${REDLINE_FILENAME} */

    const rlDocPath = path.join(pubDirPath, pubRLName);

    child_process.execSync(`perl lib/htmldiff/htmldiff.pl ${renderedRefPath} ${renderedDocPath} ${rlDocPath}`);

  }

  /* upload to AWS */

  s3SyncDir(pubDirPath, s3Client, s3Bucket, s3KeyPrefix + commitHash + "/");

}

async function render(docPath, commitHash) {

  /* render the page */

  const browser = await puppeteer.launch({
    args: ["--disable-dev-shm-usage", "--allow-file-access-from-files"],
  });

  const page = await browser.newPage();

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

build(".smpte-build.json").catch(e => { console.error(e) });
