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

const fs = require('fs');
const path = require('path');
const jsdom = require("jsdom");
const { smpteValidate, ErrorLogger } = require("../../scripts/validate")

const testDirPath = "test/resources/html/validation";

async function _test(path) {
  const dom = new jsdom.JSDOM(fs.readFileSync(path));

  const expectation = dom.window.document.head.querySelector("meta[itemprop='test']").getAttribute("content");

  const logger = new ErrorLogger();

  smpteValidate(dom.window.document, logger);

  const hasPassed = (expectation === "valid") ? !logger.hasFailed() : logger.hasFailed();

  if (hasPassed) {
    console.log(`${path} passed.`);
  } else {
    console.log(`**** ${path} failed.`);
    logger.errorList().map(msg => console.log(`    ${msg}`))
  } 

  return hasPassed;
}

async function main() {
  const testResults = await Promise.all(fs.readdirSync(testDirPath).map(n => _test(path.join(testDirPath, n))));

  const isSuccess = testResults.every(e => e);

  if (isSuccess)
    console.log("Validation tests passed");
  else
    console.log("Some validation tests failed");

  process.exitCode = isSuccess ? 0 : 1;
}


main().catch(e => { console.error(e) });