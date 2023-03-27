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

import * as smpte from "./common.mjs";

export class ErrorLogger {
  constructor() {
    this.hasFailed_ = false;
    this.errors_ = [];
  }

  error(msg) {
    this.hasFailed_ = true;
    this.errors_.push(msg);
  }

  warn(msg) {}

  log(msg) {}

  info(msg) {}

  hasFailed() {
    return this.hasFailed_;
  }

  errorList() {
    return this.errors_;
  }
}

export function smpteValidate(doc, logger) {
  const docMetadata = smpte.validateHead(doc.head, logger);
  validateBody(doc.body, logger);
}

function validateForeword(e, logger) {
  if (e.id !== "sec-foreword")
    return false;

  return true;
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

function validateExternalDefs(e, logger) {
  if (e.tagName !== "UL" || e.id !== "terms-ext-defs")
    return false;

  for (const li of e.children) {
    if (li.tagName === "LI") {
      if (li.childElementCount !== 1 || li.firstElementChild.tagName !== "A") {
        logger.error(`External definitions: each <li> element must contain exactly one <a> element.`);
      }
    } else {
      logger.error(`External definitions: the <ul> element must contain only <li> elements.`);
    }
  }

  return true;
}

function validateInternalDefs(e, logger) {
  if (e.tagName !== "DL" || e.id !== "terms-int-defs")
    return false;

  return true;
}

function validateDefs(e, logger) {
  if (e.id !== "sec-terms-and-definitions")
    return false;

  let hasExternalDefs = false;
  let hasInternalDefs = false;

  for (const child of e.children) {
    if (validateExternalDefs(child, logger)) {
      hasExternalDefs = true;
      if (hasInternalDefs)
        logger.error(`Terms and definitions: external definitions must come first.`);
    } else if (validateInternalDefs(child, logger)) {
      hasInternalDefs = true;
    } else {
      logger.error(`Terms and definitions: unknown element ${child.tagName}`);
    }
  }

  return true;
}


function _validateClause(e, lvl, logger) {

  let containsSection = false;
  let containsNonSection = false;

  for (let i = 0; i < e.childElementCount; i++) {
    const child = e.children[i];

    if (i == 0) {
      if (child.tagName === `H${lvl}`)
        continue;
      logger.error(`Section ${e.id} is missing a heading <h${lvl}>.`);
    }

    if (child.tagName === "SECTION") {
      containsSection = true;

      _validateClause(child, lvl + 1 , logger)
    } else {
      containsNonSection = true;
    }
  }

  if (containsSection && containsNonSection)
    logger.error(`Section ${e.id} combines section and non-section content.`);

}

function validateClause(e, logger) {
  if (e.classList.contains("annex") || e.id === "sec-bibliography" || e.id === "sec-elements")
    return false;

  _validateClause(e, 2, logger);

  return true;
}

function validateAnnex(e, logger) {
  if (! e.classList.contains("annex"))
    return false;

  _validateClause(e, 2, logger);

  return true;
}

function validateElementsAnnex(e, logger) {
  if (e.id !== "sec-elements")
    return false;

  if (e.firstElementChild.tagName === "OL" && e.childElementCount === 1) {
    for (const li of e.firstElementChild.children) {
      if (li.tagName === "LI") {
        if (li.firstElementChild.tagName !== "A" || !li.firstElementChild.id || li.childElementCount !== 1 || !li.firstElementChild.title || !li.firstElementChild.href) {
          logger.error(`Each <li> element of the Elements Annex must contain a single <a> element with a title, id and href attributes.`);
        }
      } else {
        logger.error(`The <ol> element of the Elements Annex must contain only <li> elements`);
      }
    }
  } else {
    logger.error(`The Elements Annex section must contain a single <ol> element.`);
  }

  return true;
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
    [validateForeword, 0, 1],
    [validateIntroduction, 0, 1],
    [validateScope, 1, 1],
    [validateConformance, 0, 1],
    [validateNormRefs, 0, 1],
    [validateDefs, 0, 1],
    [validateClause, 0, Infinity],
    [validateAnnex, 0, Infinity],
    [validateElementsAnnex, 0, 1],
    [validateBibliography, 0, 1],
  ];

  let index = 0;
  let matchCount = 0;

  for (const child of body.children) {
    if (child.tagName !== "SECTION") {
      logger.error(`Invalid element in <body>: ${child.tagName}`);
      continue;
    }

    let sectionDef;

    while (index < sectionDefs.length) {
      sectionDef = sectionDefs.at(index);

      if ((sectionDef.at(0))(child, logger)) {
        matchCount++;
        break;
      }

      index++;

      if (matchCount < sectionDef.at(1))
        logger.error(`Too few instances of ${sectionDef.at(0).name}`);

      matchCount = 0;

    }

    if (index >= sectionDefs.length) {
      logger.error(`Expected ${sectionDef.at(0).name} but found ${child.tagName} with id ${child.id}`);
      break
    }

    if (matchCount > sectionDef.at(2))
      logger.error(`Too few instances of ${sectionDef.at(0).name}`);

  }
}