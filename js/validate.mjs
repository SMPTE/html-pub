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

function matchSequence(v_seq) {
  return function (elems, logger) {
    for (const v of v_seq) {
      const r = v(elems, logger);

      if (! r) {
        return false;
      }
    }

    if (elems.length !== 0) {
      return false;
    }

    return true;
  }
}

const PHRASING_ELEMENTS = new Set([
  "b",
  "bdo",
  "bdi",
  "br",
  "code",
  "em",
  "i",
  "kbd",
  "math",
  "q",
  "ruby",
  "s",
  "samp",
  "span",
  "strong",
  "sub",
  "sup",
  "time",
  "u",
  "var",
  "wbr",
  "a"
]);
function validateGenericPhrasing(element, logger) {
  return PHRASING_ELEMENTS.has(element.localName);
}

function matchBlocks() {
  return matchZeroOrMore(
    matchOneOf([
      matchOne(validateP),
      matchOne(validateDiv),
      matchOne(validateUl),
      matchOne(validateOl),
      matchOne(validateDl),
      matchOne(validatePre),
      matchOne(validateFigure),
      matchOne(validateAside),
      matchOne(validateTable)
    ])
  );
}

function validateP(element, logger) {
  if (element.localName !== "p")
    return false;

  return true;
}

function validateDiv(element, logger) {
  if (element.localName !== "div")
    return false;

  return true;
}

function validateUl(element, logger) {
  if (element.localName !== "ul")
    return false;

  return true;
}

function validateOl(element, logger) {
  if (element.localName !== "ol")
    return false;

  return true;
}

function validateDl(element, logger) {
  if (element.localName !== "dl")
    return false;

  return true;
}

function validatePre(element, logger) {
  if (element.localName !== "pre")
    return false;

  return true;
}

function validateFigure(element, logger) {
  if (element.localName !== "figure")
    return false;

  return true;
}

function validateAside(element, logger) {
  if (element.localName !== "aside")
    return false;

  return true;
}

function validateTable(element, logger) {
  if (element.localName !== "table")
    return false;

  return matchSequence(
    [
      validateCaption,
      matchOptional(validateTHead),
      matchOneOrMore(validateTBody),
      matchOptional(validateTFooter),
    ])(Array.from(element.children), logger);
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

class RepeatMatcher {
  constructor (v, minCount, maxCount) {
    this.v = v;
    this.minCount = minCount;
    this.maxCount = maxCount;
  }

  match(elements, logger) {
    let count = 0;

    while (elems.length > 0) {
      const r = v(elems[0], null);

      if (!r)
        break;

      count++;
      elems.shift();
    }

    if (count < minCount || count > maxCount) {
      if (logger !== null)
        logger.error(`Incorrect element count`);
      return false;
    }

    return true;
  }
}

function matchRepeat(v, minCount, maxCount) {
  return function(elems, logger) {
    let count = 0;

    while (elems.length > 0) {
      const r = v(elems[0], null);

      if (!r)
        break;

      count++;
      elems.shift();
    }

    if (count < minCount || count > maxCount) {
      if (logger !== null)
        logger.error(`Incorrect element count`);
      return false;
    }

    return true;
  }
}

function matchOneOf(v_list) {
  return function(elems, logger) {
    for (const v of v_list) {
      if (v(Array.from(elems), null))
        return true;
    }
    return false;
  };
}

function matchOptional(v) {
  const f = matchRepeat(v, 0, 1);
  f._description = `${v._description}?`
  return f;
}

function matchOneOrMore(v) {
  const f = matchRepeat(v, 1, Number.MAX_SAFE_INTEGER);
  f._description = `${v._description}+`
  return f;
}

function matchZeroOrMore(v) {
  const f = matchRepeat(v, 0, Number.MAX_SAFE_INTEGER);
  f._description = `${v._description}*`
  return f;
}

function matchOne(v) {
  const f = matchRepeat(v, 1, 1);
  f._description = `${v._description}`
  return f;
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

  return matchSequence(
    [
      matchOptional(validateExternalDefs),
      matchOptional(validateInternalDefs),
    ])(Array.from(e.children), logger);
}

function makeValidateHeading(lvl) {
  return function (element, logger) {
    return element.localName === `h${lvl}`;
  }
}

function makeValidateClause(lvl) {
  return function validateClause(element, logger) {
    if (element.localName !== "section")
      return false;

    if (element.classList.contains("annex") || element.id === "sec-bibliography" || element.id === "sec-elements")
      return false;

    return matchSequence([
      matchOne(makeValidateHeading(lvl)),
      matchOneOf(
        [
          matchOneOrMore(makeValidateClause(lvl + 1)),
          matchBlocks
        ]
      )
    ])(Array.from(element.children), logger);
  };
}

function _validateClause(e, lvl, logger) {

  let containsSection = false;
  let containsNonSection = false;

  for (let i = 0; i < e.childElementCount; i++) {
    const child = e.children[i];

    if (i == 0) {
      if (child.localName === `h${lvl}`)
        continue;
      logger.error(`Section ${e.id} is missing a heading <h${lvl}>.`);
    }

    if (child.localName === "section") {
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
  /*if (e.classList.contains("annex") || e.id === "sec-bibliography" || e.id === "sec-elements")
    return false;*/

  //_validateClause(e, 2, logger);

  return makeValidateClause(2)(e, logger);
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
      if (li.localName === "li") {
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
  const r = matchSequence(
    [
      matchOptional(validateForeword),
      matchOptional(validateIntroduction),
      matchOne(validateScope),
      matchOptional(validateConformance),
      matchOptional(validateNormRefs),
      matchOptional(validateDefs),
      matchZeroOrMore(validateClause),
      matchZeroOrMore(validateAnnex),
      matchOptional(validateElementsAnnex),
      matchOptional(validateBibliography),
    ])(Array.from(body.children), logger);

  if (!r && logger !== null)
    logger.error("Invalid body");

  return r;
}