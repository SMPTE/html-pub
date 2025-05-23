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

import * as path from "path";
import * as fs from "fs";
import process from "process";
import { S3Client, PutObjectCommand} from "@aws-sdk/client-s3";
import * as puppeteer from "puppeteer";
import * as child_process from "child_process";
import { argv } from "process";
import * as jsdom from "jsdom";
import { fileURLToPath } from 'url';
import AdmZip from "adm-zip";

import { smpteValidate, ErrorLogger } from "../js/validate.mjs";

/**
 * Determine the location of the build script
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * build.js (validate | build | deploy)
 */

/**
 * Infers the content type of a file based on its path.
 *
 * @param filePath Path of the file
 * @returns Content type
 */
function guessContentTypeFromExtension(filePath) {

  switch (path.extname(filePath)) {
    case ".html":
      return "text/html";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".svg":
      return "image/svg+xml";
    case ".css":
      return "text/css";
    case ".txt":
      return "text/plain";
    case ".xml":
    case ".xsd":
      return "text/xml";
    default:
      return "application/octet-stream";
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
function mirrorDirExcludeTooling(srcDir, targetDir, relParentPath) {
  relParentPath = relParentPath || "";

  if (! fs.existsSync(path.join(srcDir, relParentPath)))
    return;

  fs.mkdirSync(path.join(targetDir, relParentPath), {"recursive" : true});

  for(let srcName of fs.readdirSync(path.join(srcDir, relParentPath))) {

    const relSrcPath = path.join(relParentPath, srcName);

    const srcPath = path.join(srcDir, relSrcPath);
    const dstPath = path.join(targetDir, relSrcPath);

    const srcStat = fs.statSync(srcPath);
    if (srcStat.isDirectory()) {

      if (relParentPath !== "tooling")
        mirrorDirExcludeTooling(srcDir, targetDir, relSrcPath);

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

      const contentType = guessContentTypeFromExtension(srcPath);

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


async function build(buildPaths, baseRef, lastEdRef, docMetadata) {

  const generatedFiles = {};

  /* render the document */

  const renderedDoc = await render(path.join(buildPaths.docDirPath, buildPaths.docName));

  fs.writeFileSync(buildPaths.renderedDocPath, renderedDoc.docHTML);

  generatedFiles.html = buildPaths.renderedDocName;

  /* create pdf */

  generatedFiles.pdf = `SMPTE-${docMetadata.pubType}-${docMetadata.pubNumber}`;
  if (docMetadata.pubPart !== null) {
    generatedFiles.pdf += `-${docMetadata.pubPart}`
  }
  if (docMetadata.pubDateTime !== null) {
    generatedFiles.pdf += `-${docMetadata.pubDateTime}`
  }
  if (docMetadata.pubPart !== null) {
    generatedFiles.pdf += `-${docMetadata.pubSuiteTitle}`
  }
  generatedFiles.pdf += `-${docMetadata.pubTitle}.pdf`;
  generatedFiles.pdf = generatedFiles.pdf.replace(/[\s—–‐‑]+/g, "-");

  await makePDF(buildPaths.renderedDocPath, path.join(buildPaths.pubDirPath, generatedFiles.pdf));

  /* generate base redline, if requested */

  if (baseRef !== null) {

    console.log(`Generating a redline against base: ${baseRef}.`);

    try {
      await generateRedline(buildPaths, baseRef, buildPaths.baseRedLineRefPath, buildPaths.baseRedlinePath);
      generatedFiles.baseRedline = buildPaths.baseRedlineName;
    } catch (e) {
      console.warn(`Could not generate a redline: ${e}.`);
    }

  }

  /* generate pub redline, if requested */

  if (lastEdRef !== null) {

    console.log(`Generating a redline against the latest edition tag: ${lastEdRef}.`);

    try {
      await generateRedline(buildPaths, lastEdRef, buildPaths.pubRedLineRefPath, buildPaths.pubRedlinePath);
      generatedFiles.pubRedline = buildPaths.pubRedlineName;
    } catch (e) {
      console.warn(`Could not generate a redline: ${e}.`);
    }

  }

  return generatedFiles;
}

async function generateRedline(buildPaths, refCommit, refPath, rlPath) {

  if (fs.existsSync(buildPaths.refDirPath))
    fs.rmSync(buildPaths.refDirPath, { recursive: true, force: true });

  child_process.execSync(`git clone --recurse-submodules -b ${refCommit} . "${buildPaths.refDirPath}"`);

  if (! fs.existsSync(buildPaths.refDirPath))
    throw Error("Reference file does not exist");

  const r = await render(path.join(buildPaths.refDirPath, buildPaths.docPath));

  fs.writeFileSync(refPath, r.docHTML);

  child_process.execSync(`perl '${path.join(__dirname, "../lib/htmldiff/htmldiff.pl")}' "${refPath}" "${buildPaths.renderedDocPath}" "${rlPath}"`);

}

async function generatePubLinks(buildPaths, pubLinks) {
  let linksDocContents = "# Review links\n";

  if (pubLinks) {
    if ("clean" in pubLinks)
      linksDocContents += `[Clean](${pubLinks.clean})\n`;

    if ("pdf" in pubLinks)
      linksDocContents += `[Clean PDF](${pubLinks.pdf})\n`;

    if ("baseRedline" in pubLinks)
      linksDocContents += `[Redline to current draft](${pubLinks.baseRedline})\n`;

    if ("pubRedline" in pubLinks)
      linksDocContents += `[Redline to most recent edition](${pubLinks.pubRedline})\n`;

    if ("reviewZip" in pubLinks)
      linksDocContents += `[ZIP package](${pubLinks.reviewZip})\n`;

  } else {
    linksDocContents += "No links available";
  }

  fs.writeFileSync(buildPaths.pubLinksPath, linksDocContents);

  return buildPaths.pubLinksPath;
}

async function s3Upload(buildPaths, versionKey, generatedFiles) {
  const s3Region = process.env.AWS_S3_REGION;
  const s3Bucket = process.env.AWS_S3_BUCKET;
  const s3KeyPrefix = process.env.AWS_S3_KEY_PREFIX;

  if (!(s3Region && s3Bucket && s3KeyPrefix)) {
    console.warn("Skipping AWS upload. One of the following environment variables is not set: AWS_S3_REGION, AWS_S3_BUCKET, AWS_S3_KEY_PREFIX.");
    return null;
  }

  const pubLinks = {};

  const s3Client = new S3Client({ region: s3Region });

  const s3PubKeyPrefix = s3KeyPrefix + versionKey + "/";

  console.log(`Uploading to bucket ${s3Bucket} at key ${s3PubKeyPrefix}`);

  /* create publication links, links file and zip file */

  const deployPrefix = process.env.CANONICAL_LINK_PREFIX || `http://${s3Bucket}.s3-website-${s3Region}.amazonaws.com/`;

  if ("html" in generatedFiles) {
    pubLinks.clean = `${deployPrefix}${s3PubKeyPrefix}`;
  }

  if ("pdf" in generatedFiles) {
    pubLinks.pdf = `${deployPrefix}${s3PubKeyPrefix}${encodeURIComponent(generatedFiles.pdf)}`;
  }

  if ("baseRedline" in generatedFiles) {
    pubLinks.baseRedline = `${deployPrefix}${s3PubKeyPrefix}${encodeURIComponent(generatedFiles.baseRedline)}`;
  }

  if ("pubRedline" in generatedFiles) {
    pubLinks.pubRedline = `${deployPrefix}${s3PubKeyPrefix}${encodeURIComponent(generatedFiles.pubRedline)}`;
  }

  if ("reviewZip" in generatedFiles) {
    pubLinks.reviewZip = `${deployPrefix}${s3PubKeyPrefix}${encodeURIComponent(generatedFiles.reviewZip)}`;
  }

  if ("libraryZip" in generatedFiles) {
    pubLinks.libraryZip = `${deployPrefix}${s3PubKeyPrefix}${encodeURIComponent(generatedFiles.libraryZip)}`;
  }

  s3SyncDir(buildPaths.pubDirPath, s3Client, s3Bucket, s3PubKeyPrefix);

  return pubLinks;
}

async function makeReviewZip(buildPaths, generatedFiles, docMetadata) {
  const zip = new AdmZip();

  if (fs.existsSync(buildPaths.pubElementsPath))
    zip.addLocalFolder(buildPaths.pubElementsPath, buildPaths.pubElementsDirName);

  if (fs.existsSync(buildPaths.pubStaticPath))
    zip.addLocalFolder(buildPaths.pubStaticPath, buildPaths.pubStaticDirName);

  if (fs.existsSync(buildPaths.pubMediaPath))
    zip.addLocalFolder(buildPaths.pubMediaPath, buildPaths.pubMediaDirName);

  if (fs.existsSync(buildPaths.manifestPath))
    zip.addLocalFile(buildPaths.manifestPath);

  if ("html" in generatedFiles)
    zip.addLocalFile(path.join(buildPaths.pubDirPath, generatedFiles.html));

  if ("pdf" in generatedFiles)
    zip.addLocalFile(path.join(buildPaths.pubDirPath, generatedFiles.pdf));

  if ("pubRedline" in generatedFiles)
    zip.addLocalFile(path.join(buildPaths.pubDirPath, generatedFiles.pubRedline));

  /* create zip filename */

  const comps = [];

  if (docMetadata.pubTC)
    comps.push(docMetadata.pubTC);

  if (docMetadata.pubType)
    comps.push(docMetadata.pubType);

  if (docMetadata.pubNumber)
    comps.push(docMetadata.pubNumber);

  if (docMetadata.pubPart)
    comps.push(docMetadata.pubPart);

  if (docMetadata.pubStage)
    comps.push(docMetadata.pubStage);

  comps.push(new Date().toISOString().slice(0, 10));

  if (docMetadata.pubState)
    comps.push(docMetadata.pubState);

  const zipFn = comps.join("-").toLowerCase() + ".zip";

  /* write zip file */

  zip.writeZip(path.join(buildPaths.pubDirPath, zipFn));

  return zipFn;
}

async function makePubArtifacts(buildPaths, generatedFiles, docMetadata) {
  let htmlLinks;

  if ("html" in generatedFiles) {
    htmlLinks = `<p><a href="${encodeURIComponent(generatedFiles.html)}">Clean</a></p>\n`;
  }

  if ("pdf" in generatedFiles) {
    htmlLinks += `<p><a href="${encodeURIComponent(generatedFiles.pdf)}">Clean PDF</a></p>\n`;
  }

  if ("baseRedline" in generatedFiles) {
    htmlLinks += `<p><a href="${encodeURIComponent(generatedFiles.baseRedline)}">Redline to current draft</a></p>\n`;
  }

  if ("pubRedline" in generatedFiles) {
    htmlLinks += `<p><a href="${encodeURIComponent(generatedFiles.pubRedline)}">Redline to most recent edition</a></p>\n`;
  }

  if (generatedFiles.reviewZip !== undefined) {
    htmlLinks += `<p><a href="${encodeURIComponent(generatedFiles.reviewZip)}">Review zip file</a></p>\n`;
  }

  if (generatedFiles.libraryZip !== undefined) {
    htmlLinks += `<p><a href="${encodeURIComponent(generatedFiles.libraryZip)}">Library zip file</a></p>\n`;
  }

  fs.writeFileSync(buildPaths.pubArtifactsPath, `<!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta http-equiv="x-ua-compatible" content="ie=edge" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Publication artifacts</title>
      <link rel="icon" href="data:,">
    </head>
    <body>
      ${htmlLinks}
    </body>
  </html>`);

  return buildPaths.pubArtifactsPath;
}

async function makeLibraryZip(buildPaths, generatedFiles, docMetadata) {

  if (docMetadata.pubDateTime === null || docMetadata.pubStage === null)
    return null;

  /* create manifest file */

  const manifest = {
    approved: docMetadata.pubDateTime,
    stage: docMetadata.pubStage.toLowerCase(),
    main: []
  };

  if (generatedFiles.elements.length > 0)
    manifest.elements = generatedFiles.elements;

  if (generatedFiles.media.length > 0)
    manifest.media = generatedFiles.media;

  if ("pdf" in generatedFiles)
    manifest.main.push({
      mediaType: "application/pdf",
      path: generatedFiles.pdf
    });

  if ("html" in generatedFiles)
    manifest.main.push({
      mediaType: "text/html",
      path: generatedFiles.html
    });

  /* create zip file */

  const zip = new AdmZip();

  zip.addFile(buildPaths.manifestName, JSON.stringify(manifest, null, "  "))

  manifest.main.forEach(e => {
    zip.addFile(
       e.path,
       fs.readFileSync(path.join(buildPaths.pubDirPath, e.path))
    );
 });

  if (manifest.media)
    manifest.media.forEach(e => {
        zip.addFile(
          e.path,
          fs.readFileSync(path.join(buildPaths.pubDirPath, e.path))
        );
    });

  if (manifest.elements)
    manifest.elements.forEach(e => {
        zip.addFile(
          e.file.path,
          fs.readFileSync(path.join(buildPaths.pubDirPath, e.file.path))
        );
    });

  for (const entry of zip.getEntries()) {
    entry.header.time = manifest.approved;
  }

  /* create zip file */

  const zipFn = `${manifest.approved.replaceAll("-", "")}-${manifest.stage}.zip`

  const zipPath = path.join(buildPaths.pubDirPath, zipFn);

  zip.writeZip(zipPath);

  return zipFn;
}

async function makePDF(docPath, pdfPath) {
  const timeout = 6000000;

  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--allow-file-access-from-files"]
  });


  const page = await browser.newPage();
  page.setDefaultTimeout(timeout);
  await page.emulateMediaType("print");
  await page.goto("file://" + path.resolve(docPath));
  await page.content();
  await page.evaluate(() => {
    window.PagedConfig = window.PagedConfig || {};
    window.PagedConfig.auto = false;
  });
  await page.addScriptTag({ url: 'https://cdn.jsdelivr.net/npm/pagedjs@0.4.3/dist/paged.polyfill.js' });

  let renderingDone;
  let rendered = new Promise(function (resolve, reject) {
    renderingDone = resolve;
  });
  await page.exposeFunction("onRendered", (msg) => {
    console.log(msg);
    renderingDone();
  });
  await page.exposeFunction("onPage", (position) => {
    if (position % 10 === 0) {
      console.log("Rendering: Page " + (position + 1));
    }
  });
  await page.evaluate(async () => {
    document.querySelectorAll('#sec-elements a[href]')
      .forEach(e => { if (!e.href.startsWith("http")) e.removeAttribute("href"); });

    window.PagedPolyfill.on("page", (page) => {
      window.onPage(page.position);
    });
    window.PagedPolyfill.on("rendered", (flow) => {
      let msg = "Rendering " + flow.total + " pages took " + flow.performance + " milliseconds.";
      window.onRendered(msg);
    })
    await window.PagedPolyfill.preview();
  }).catch((error) => {
    throw error;
  });
  await page.waitForNetworkIdle({
    timeout: timeout
  });
  await rendered;
  await page.waitForSelector(".pagedjs_pages");

  const pdf = await page.pdf({
    timeout: timeout,
    printBackground: true,
    displayHeaderFooter: false,
    margin: {
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    }
  });

  fs.writeFileSync(pdfPath, pdf);

  await browser.close();

}

async function render(docPath) {

  const commitHash = child_process.execSync(`git -C "${path.dirname(docPath)}" rev-parse HEAD`, {stdio: ['ignore', 'pipe', 'ignore']}).toString().trim();

  /* render the page */

  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--allow-file-access-from-files"],
  });

  try {

    const page = await browser.newPage();

    const pageURL = "file://" + path.resolve(docPath) + (commitHash ? "?buildHash=" + commitHash : "");

    console.log(`Rendering the document at ${pageURL}`)

    await page.goto(pageURL);

    await page.waitForFunction(() => window._smpteRenderComplete === undefined || window._smpteRenderComplete === true);

    await page.evaluate(() => {
      /* remove all scripts */
      const elements = document.getElementsByTagName('script');
      for (let i = elements.length - 1; i >= 0; i--)
        elements[i].parentNode.removeChild(elements[i]);

      /* update the location of static assets */
      const icon = document.querySelector('head link[rel="icon"]');
      if (icon)
        icon.href = "static/smpte-icon.png";

      const logo = document.getElementById("smpte-logo");
      if (logo)
        logo.src = "static/smpte-logo.png";

      /* refuse to render if there are page errors */
      const errorList = typeof smpteLogger !== "undefined" ? smpteLogger.errorList() : listEvents(); /* for compatibility */
      if (errorList.length > 0) {
        for (let event of errorList)
          console.error(`  ${event.msg}\n`);
        throw new Error(`Page has errors`);
      }
    });

    const docHTML = await page.content();

    return {
      docHTML: docHTML
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
    this.pubMediaDirName = "media";
    this.pubElementsDirName = "elements";

    this.pubDirPath = path.join(this.buildDirPath, "pub");

    this.renderedDocName = "index.html";
    this.renderedDocPath = path.join(this.pubDirPath, this.renderedDocName);

    this.manifestName = "manifest.json";
    this.manifestPath = path.join(this.buildDirPath, this.manifestName);

    this.refDirPath = path.join(this.buildDirPath, "ref");
    this.renderedRefDocPath = path.join(this.buildDirPath, "ref.html");

    this.pubLinksName = "pr-links.md";
    this.pubLinksPath = path.join(this.buildDirPath, this.pubLinksName);

    this.pubArtifactsName = "pub-artifacts.html";
    this.pubArtifactsPath = path.join(this.pubDirPath, this.pubArtifactsName);

    this.pubMediaPath = path.join(this.pubDirPath,  this.pubMediaDirName);
    this.pubStaticPath = path.join(this.pubDirPath, this.pubStaticDirName);
    this.pubElementsPath = path.join(this.pubDirPath, this.pubElementsDirName);

    this.pubRedlineName = "pub-rl.html";
    this.pubRedlinePath = path.join(this.pubDirPath, this.pubRedlineName);
    this.pubRedLineRefPath = path.join(this.buildDirPath, this.pubRedlineName);

    this.baseRedlineName = "base-rl.html";
    this.baseRedlinePath = path.join(this.pubDirPath, this.baseRedlineName);
    this.baseRedLineRefPath = path.join(this.buildDirPath, this.baseRedlineName);

    this.varsName = "vars.txt";
    this.varsPath = path.join(this.buildDirPath, this.varsName);
  }

}

class BuildConfig {
  constructor(docDirPath) {
    let config = {};
    try {
      config = JSON.parse(fs.readFileSync(path.join(docDirPath, ".smpte-build.json")));
    } catch {
      console.log("Could not read the publication config file.");
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

  let branchName = process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME;
  if (typeof branchName == "undefined") {
    try {
      branchName = child_process.execSync(`git rev-parse --abbrev-ref HEAD`).toString().trim();
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
    child_process.execSync(`html5validator --errors-only "${buildPaths.docPath}"`);
  } catch (e) {
    console.error(e.stdout.toString());
    throw Error("HTML validation failed.");
  }

  /* validate document structure */

  const logger = new ErrorLogger();

  const dom = new jsdom.JSDOM(fs.readFileSync(buildPaths.docPath));

  const docMetadata = smpteValidate(dom.window.document, logger);

  if (logger.hasFailed())
    throw Error(`SMPTE schema validation failed:\n${logger.errorList().join("\n")}`);

   /* collect elements */

   const generatedFiles = {
    elements: [],
    media: []
   };

   for (const element of dom.window.document.querySelectorAll("section#sec-elements ol li a")) {
    const href = element.getAttribute("href");
    if (! href.startsWith("http"))
      generatedFiles.elements.push({
        title: element.title.replace(/\s+/g, " "),
        file: {
          path: href,
          mediaType: guessContentTypeFromExtension(href)
        }
      });
  }

  /* add images */

  for (const img of dom.window.document.querySelectorAll("img")) {
    const src = img.getAttribute("src");
    if (! src.startsWith("http"))
      generatedFiles.media.push({
        path: src,
        mediaType: guessContentTypeFromExtension(src)
      });
  }

  /* add static assets */

  generatedFiles.media.push({
    path: "static/smpte-logo.png",
    mediaType: "image/png"
  });

  generatedFiles.media.push({
    path: "static/smpte-icon.png",
    mediaType: "image/png"
  });

  /* create the build directory if it does not already exists */

  fs.mkdirSync(buildPaths.buildDirPath, {"recursive" : true});

  /* populate the publication directory */

  fs.rmSync(buildPaths.pubDirPath, { recursive: true, force: true });

  mirrorDirExcludeTooling(
    path.join(buildPaths.docDirPath, buildPaths.pubMediaDirName),
    buildPaths.pubMediaPath
  );

  mirrorDirExcludeTooling(
    path.join(buildPaths.docDirPath, buildPaths.pubElementsDirName),
    buildPaths.pubElementsPath
  );

  mirrorDirExcludeTooling(
    path.join(__dirname, "../static"),
    buildPaths.pubStaticPath
    );

  /* render document */

  Object.assign(generatedFiles, await build(buildPaths, baseRef, config.lastEdRef, docMetadata));

  /* validate rendered document */

  try {
    child_process.execSync(`html5validator --ignore "error: CSS:" --errors-only "${buildPaths.renderedDocPath}"`);
  } catch (e) {
    console.error(e.stdout.toString());
    throw Error("Rendered document validation failed.");
  }

  /* keep track of exported variables */

  let exportedVars = "";

  /* generate the publication artifacts links page */

  generatedFiles.pubArtifacts = await makePubArtifacts(buildPaths, generatedFiles, docMetadata);

  /* skip deployment if validating only */

  if (buildPhase === "validate") {

    console.warn("Skipping deploy to S3.");

  } else {
    /* deploy to S3 */

    const pubLinks = await s3Upload(buildPaths, branchName, generatedFiles);

    await s3Upload(buildPaths, commitHash, generatedFiles);

    if (pubLinks) {
      const pubLinksPath = await generatePubLinks(buildPaths, pubLinks);
      if (pubLinksPath !== null)
        exportedVars += `PUB_LINKS=${pubLinksPath}\n`;
    }
  }

  /* generate the document library zip file */

  generatedFiles.libraryZip = await makeLibraryZip(buildPaths, generatedFiles, docMetadata);
  if (generatedFiles.libraryZip !== null)
    exportedVars += `LIBRARY_ZIP=${path.join(buildPaths.pubDirPath, generatedFiles.libraryZip)}\n`;

  /* generate the review zip file */

  generatedFiles.reviewZip = await makeReviewZip(buildPaths, generatedFiles, docMetadata);
  if (generatedFiles.reviewZip !== null)
    exportedVars += `REVIEW_ZIP=${path.join(buildPaths.pubDirPath, generatedFiles.reviewZip)}\n`;

  /* export variables to other GitHub workflow steps */

  fs.writeFileSync(buildPaths.varsPath, exportedVars, {encoding:"utf-8"});

}


main().catch(e => { console.error(e); process.exitCode = 1; });
