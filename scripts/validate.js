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

const jsdom = require("jsdom");
const process = require('process');
const fs = require('fs');

function validate(doc, logger) {
  validateHead(doc.head, logger);
  validateBody(doc.body, logger);
}


function validatePubType(head, logger) {
  const e = head.querySelector("meta[itemprop = 'pubType']");

  if (e === null || e.getAttribute("content") !== "AG")
    logger.error("pubType invalid");
}

function validatePubNumer(head, logger) {
  const e = head.querySelector("meta[itemprop = 'pubNumber']");

  if (e === null || ! /\d+/.test(e.getAttribute("content")))
    logger.error("pubNumber invalid");
}

function getPubState(head, logger) {
  return head.querySelector("meta[itemprop = 'pubState']");
}

function validatePubState(head, logger) {
  const pubStates = new Set(["pub", "draft"]);

  const e = getPubState(head, logger);

  if (e === null || !pubStates.has(e.getAttribute("content")))
    logger.error("pubState invalid");
}

function validatePubDateTime(head, logger) {
  let e = getPubState(head, logger);

  if (e.getAttribute("content") !== "pub")
    return;

  e = head.querySelector("meta[itemprop = 'pubDateTime']");

  if (! /\d{4}-\d{2}-\d{2}/.test(e.getAttribute("content")))
    logger.error("pubDateTime invalid");
}

function validateHead(head, logger) {
  if (head.getAttribute("itemscope") !== "itemscope")
    logger.error("head@itemscope is invalid");
  if (head.getAttribute("itemtype") !== "http://smpte.org/standards/documents")
    logger.error("head@itemtype is invalid");

  validatePubType(head, logger);
  validatePubNumer(head, logger);
  validatePubState(head, logger);
  validatePubDateTime(head, logger);
}

function validateIntroduction(e, logger) {
  if (e.id !== "sec-introduction")
    return false;

  return true;
}

function validateScope(e, logger) {
  if (e.id !== "sec-scope")
    return false;

  return true;
}

function validateConformance(e, logger) {
  if (e.id !== "sec-conformance")
    return false;

  return true;
}

function validateReferences(e, prefix, logger) {
  if (e.firstElementChild.tagName === "UL" && e.childElementCount === 1) {
    for (const li of e.firstElementChild.children) {
      if (li.tagName === "LI") {
        const cites = li.querySelectorAll("cite");

        if (cites.length === 1) {
          if (! cites[0].id)
            logger.error(`${prefix}: each <cite> element must contain an id attribute.`);
        } else {
          logger.error(`${prefix}: each <li> element must contain a single <cite> element.`);
        }

        if (li.querySelectorAll("a").length > 1) {
          logger.error(`${prefix}: each <li> element must contain at most one <a> element.`);
        }
      } else {
        logger.error(`${prefix}: the <ul> element must contain only <li> elements.`);
      }
    }
  } else {
    logger.error(`${prefix} section must contain a single <ul> element.`);
  }
}

function validateNormRefs(e, logger) {
  if (e.id !== "sec-normative-references")
    return false;

  validateReferences(e, "Normative references", logger);

  return true;
}

function validateClause(e, logger) {
  const h = e.firstElementChild;

  if (h === null || h.tagName !== "H2") {
    logger.error("Missing heading.");
    return false;
  }

  return true;
}

function validateAnnex(e, logger) {
  return e.classList.has("annex");
}

function validateBibliography(e, logger) {
  if (e.id !== "sec-bibliography")
    return false;

  validateReferences(e, "Bibliography references", logger);

  return true;
}


function validateBody(body, logger) {
  const sectionDefs = [
    /* [validation function, min number, max number] */
    [validateIntroduction, 0, 1],
    [validateScope, 1, 1],
    [validateConformance, 0, 1],
    [validateNormRefs, 0, 1],
    [validateClause, 0, Infinity],
    [validateAnnex, 0, Infinity],
    [validateBibliography, 0, 1],
  ];

  let index = 0;
  let matchCount = 0;

  for (const child of body.children) {
    if (child.tagName !== "SECTION") {
      logger.error(`Invalid element: ${child.tagName}`);
      continue;
    }

    let sectionDef;

    while (index < sectionDefs.length) {
      sectionDef = sectionDefs.at(index);

      if ((sectionDef.at(0))(child, logger))
        break;

      if (matchCount < sectionDef.at(1))
        logger.error(`Too few instances of ${sectionDef.at(0).name}`);

      matchCount = 0

      index++;
    }

    matchCount++;

    if (matchCount > sectionDef.at(2))
      logger.error(`Too few instances of ${sectionDef.at(0).name}`);

  }
}

async function main() {
  const dom = new jsdom.JSDOM(fs.readFileSync(process.argv[2]));
  validate(dom.window.document, console);
}

main().catch(e => { console.error(e) });