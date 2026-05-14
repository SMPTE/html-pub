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

function emit(fields) {
  for (const [key, value] of Object.entries(fields)) {
    const line = `${key}=${value ?? ""}`;
    if (process.env.GITHUB_OUTPUT) {
      fs.appendFileSync(process.env.GITHUB_OUTPUT, `${line}\n`);
    }
    process.stdout.write(`${line}\n`);
  }
}

const privateRepo = process.env.GITHUB_REPOSITORY || "";

if (!privateRepo || !privateRepo.includes("/")) {
  console.error(`GITHUB_REPOSITORY not set or invalid: "${privateRepo}"`);
  emit({ private_repo: "", private_repo_name: "", public_repo: "", public_repo_name: "" });
  process.exit(0);
}

const [owner, privateRepoName] = privateRepo.split("/");

let publicRepo = "";
try {
  const cfg = JSON.parse(fs.readFileSync(".smpte-build.json", "utf8"));
  if (cfg.publicRepo && typeof cfg.publicRepo === "string") {
    publicRepo = cfg.publicRepo.trim();
  }
} catch {
  /* .smpte-build.json absent or unreadable; fall through to convention */
}

if (!publicRepo && privateRepoName.endsWith("-private")) {
  publicRepo = `${owner}/${privateRepoName.slice(0, -"-private".length)}`;
}

const publicRepoName = publicRepo.includes("/") ? publicRepo.split("/")[1] : "";

emit({
  private_repo: privateRepo,
  private_repo_name: privateRepoName,
  public_repo: publicRepo,
  public_repo_name: publicRepoName,
});
