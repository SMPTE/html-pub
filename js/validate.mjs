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

function validateSequence(elems, v_seq, logger) {
  for (const v of v_seq) {
    const r = v(elems, logger);

    if (! r) {
      logger.error(`Expecting ${v.name}`);
      return false;
    }
  }

  if (elems.length !== 0) {
    logger.error("Missing elements in the sequence.")
    return false;
  }

  return true;
}

function validateTable(element, logger) {
  if (element.localName !== "table")
    return false;

  return validateSequence(
    Array.from(element.children),
    [
      validateCaption,
      (e, l) => validateOptional(e, validateTHead, l),
      (e, l) => validateOneOrMore(e, validateTBody, l),
      (e, l) => validateOptional(e, validateTFooter, l),
    ],
    logger
  )
}

function validateCaption(element, logger) {
  if (element.localName !== "caption")
    return false;

  return true;
}

function validateTHead(element, logger) {
  if (element.localName !== "thead")
    return false;

  return true;
}

function validateTBody(element, logger) {
  if (element.localName !== "tbody")
    return false;

  return true;
}

function validateTFooter(element, logger) {
  if (element.localName !== "tfooter")
    return false;

  return true;
}

function validateRepeat(elems, v, minCount, maxCount, logger) {
  let count = 0;

  while (elems.length > 0) {
    const r = v(elems[0]);

    if (!r)
      break;

    count++;
    elems.shift();
  }

  if (count < minCount || count > maxCount) {
    logger.error(`Incorrect element count`);
    return false;
  }

  return true;
}

function validateOptional(elems, v, logger) {
  return validateRepeat(elems, v, 0, 1, logger);
}

function validateOneOrMore(elems, v, logger) {
  return validateRepeat(elems, v, 1, Number.MAX_SAFE_INTEGER, logger);
}

function validateZeroOrMore(elems, v, logger) {
  return validateRepeat(elems, v, 0, Number.MAX_SAFE_INTEGER, logger);
}

function validateOne(elems, v, logger) {
  return validateRepeat(elems, v, 1, 1, logger);
}

function validateForeword(e, logger) {
  return e.localName === "section" && e.id === "sec-foreword";
}

function validateIntroduction(e, logger) {
  return e.localName === "section" && e.id === "sec-introduction";
}

function validateScope(e, logger) {
  return e.localName === "section" && e.id === "sec-scope";
}

function validateConformance(e, logger) {
  return e.localName === "section" && e.id === "sec-conformance";
}

function validateReferences(e, prefix, logger) {
  if (e.childElementCount === 1 && e.firstElementChild.localName === "ul") {
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
  if (e.localName !== "ul" || e.id !== "terms-ext-defs")
    return false;

  for (const li of e.children) {
    if (li.localName === "li") {
      if (li.childElementCount !== 1 || li.firstElementChild.localName !== "a") {
        logger.error(`External definitions: each <li> element must contain exactly one <a> element.`);
      }
    } else {
      logger.error(`External definitions: the <ul> element must contain only <li> elements.`);
    }
  }

  return true;
}

function validateInternalDefs(e, logger) {
  if (e.localName !== "dl" || e.id !== "terms-int-defs")
    return false;

  return true;
}

function validateDefs(e, logger) {
  if (e.localName !== "section" || e.id !== "sec-terms-and-definitions")
    return false;

  return validateSequence(
    Array.from(e.children),
    [
      (e, l) => validateOptional(e, validateExternalDefs, l),
      (e, l) => validateOptional(e, validateInternalDefs, l),
    ],
    logger
  );
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
  if (e.localName !== "section" || !e.classList.contains("annex"))
    return false;

  _validateClause(e, 2, logger);

  return true;
}

function validateElementsAnnex(e, logger) {
  if (e.localName !== "section" || e.id !== "sec-elements")
    return false;

  if (e.childElementCount === 1 && e.firstElementChild.localName === "ol") {
    for (const li of e.firstElementChild.children) {
      if (li.tagName === "LI") {
        if (li.firstElementChild.localName !== "a" || !li.firstElementChild.id || li.childElementCount !== 1 || !li.firstElementChild.title || !li.firstElementChild.href) {
          logger.error(`Each <li> element of the Elements Annex must contain a single <a> element with a title, id and href attributes.`);
          return false;
        }
      } else {
        logger.error(`The <ol> element of the Elements Annex must contain only <li> elements`);
        return false;
      }
    }
  } else {
    logger.error(`The Elements Annex section must contain a single <ol> element.`);
    return false;
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
  return validateSequence(
    Array.from(body.children),
    [
      (e, l) => validateOptional(e, validateForeword, l),
      (e, l) => validateOptional(e, validateIntroduction, l),
      (e, l) => validateOne(e, validateScope, l),
      (e, l) => validateOptional(e, validateConformance, l),
      (e, l) => validateOptional(e, validateNormRefs, l),
      (e, l) => validateOptional(e, validateDefs, l),
      (e, l) => validateZeroOrMore(e, validateClause, l),
      (e, l) => validateZeroOrMore(e, validateAnnex, l),
      (e, l) => validateOptional(e, validateElementsAnnex, l),
      (e, l) => validateOptional(e, validateBibliography, l),
    ],
    logger
  );
}