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

import * as jsdom from "jsdom"
import * as process from "process";
import * as fs from "fs";
import * as path from "path";
import {smpteValidate, ErrorLogger} from "../../js/validate.mjs";

const testDirPath = "test/resources/html/validation";

async function _test(path) {
  const dom = new jsdom.JSDOM(fs.readFileSync(path));

  const expectation = dom.window.document.head.querySelector("meta[itemprop='test']").getAttribute("content");

  const logger = new ErrorLogger();

  let hasThrown = false;

  try {
    smpteValidate(dom.window.document, logger);
  } catch (e) {
    logger.error(`Exception: ${e.stack}`);
    hasThrown = true;
  }

  const hasPassed = !logger.hasFailed() && !hasThrown;

  if ((expectation === "valid" && hasPassed) || (expectation !== "valid" && !hasPassed)) {
    console.log(`${path} passed.`);
    return true;
  }

  console.log(`**** ${path} failed.`);
  logger.errorList().map(msg => console.log(`    ${msg.message}`))

  return false;
}

const testResults = await Promise.all(fs.readdirSync(testDirPath).map(n => _test(path.join(testDirPath, n))));

const isSuccess = testResults.every(e => e);

if (isSuccess)
  console.log("Validation tests passed");
else
  console.log("Some validation tests failed");

process.exit(isSuccess ? 0 : 1);
