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

import * as fs from "fs";
import process from "process";
import { argv } from "process";

const PUB_STAGES = new Set(["WD", "CD", "FCD", "DP", "PUB"]);

function extractMeta(html, name) {
  const re = new RegExp(`<meta[^>]*itemprop=["']${name}["'][^>]*content=["']([^"']*)["']`, "i");
  const m = html.match(re);
  if (m) return m[1];
  const reSwapped = new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*itemprop=["']${name}["']`, "i");
  const m2 = html.match(reSwapped);
  return m2 ? m2[1] : null;
}

function emit(tag) {
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `tag=${tag}\n`);
  }
  process.stdout.write(`tag=${tag}\n`);
}

const docPath = argv[2] || "doc/main.html";

if (!fs.existsSync(docPath)) {
  console.error(`Document not found: ${docPath}`);
  process.exit(1);
}

const html = fs.readFileSync(docPath, "utf8");
const headEnd = html.search(/<\/head>/i);
const head = headEnd >= 0 ? html.slice(0, headEnd) : html;

const pubState = extractMeta(head, "pubState");
const pubDateTime = extractMeta(head, "pubDateTime");
const pubStage = extractMeta(head, "pubStage");

if (pubState !== "pub") {
  emit("");
  process.exit(0);
}

if (pubDateTime === null || !/^\d{4}-\d{2}-\d{2}$/.test(pubDateTime)) {
  console.error(`pubDateTime must be a full YYYY-MM-DD date to form a release tag. Got: ${pubDateTime}`);
  process.exit(1);
}

if (pubStage === null || !PUB_STAGES.has(pubStage)) {
  console.error(`pubStage must be one of ${[...PUB_STAGES].join(", ")} to form a release tag. Got: ${pubStage}`);
  process.exit(1);
}

const tag = `${pubDateTime.replace(/-/g, "")}-${pubStage.toLowerCase()}`;
emit(tag);
