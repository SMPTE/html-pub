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

  warn(msg) { }

  log(msg) { }

  info(msg) { }

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


class ElementMatcher {
  static match(elements, logger) {
    if (elements.length === 0)
      return false;

    const r = this.match(elements[0], logger);

    if (r)
      elements.shift();

    return r;
  }

  match(elements, logger) {
    if (elements.length === 0)
      return false;

    const r = this.match(elements[0], logger);

    if (r)
      elements.shift();

    return r;
  }
}

class PMatcher {
  static match(element, logger) {
    if (element.localName !== "p")
      return false;

    return true;
  }
}

class DivMatcher {
  static match(element, logger) {
    if (element.localName !== "div")
      return false;

    return true;
  }
}

class UlMatcher {
  static match(element, logger) {
    if (element.localName !== "ul")
      return false;

    return true;
  }
}

class OlMatcher {
  static match(element, logger) {
    if (element.localName !== "ol")
      return false;

    return true;
  }
}

class DlMatcher {
  static match(element, logger) {
    if (element.localName !== "dl")
      return false;

    return true;
  }
}

class PreMatcher {
  static match(element, logger) {
    if (element.localName !== "pre")
      return false;

    return true;
  }
}

class FigureMatcher {
  static match(element, logger) {
    if (element.localName !== "figure")
      return false;

    return true;
  }
}

class AsideMatcher {
  static match(element, logger) {
    if (element.localName !== "aside")
      return false;

    return true;
  }
}

class CaptionMatcher {
  static match(element, logger) {
    if (element.localName !== "caption")
      return false;

    return true;
  }
}

class THeadMatcher {
  static match(element, logger) {
    if (element.localName !== "thead")
      return false;

    return true;
  }
}

class TBodyMatcher {
  static match(element, logger) {
    if (element.localName !== "tbody")
      return false;

    return true;
  }
}

class TFootMatcher {
  static match(element, logger) {
    if (element.localName !== "tfoot")
      return false;

    return true;
  }
}

class TableMatcher {

  static match(element, logger) {
    if (element.localName !== "table")
      return false;

    const children = element.children;

    /* match caption */

    if (children.length > 0 && CaptionMatcher.match(children[0]))
      children.shift();
    else
      logger.error("Table is missing a caption element")

    /* match optional thead */

    if (children.length > 0 && THeadMatcher.match(children[0]))
      children.shift();

    /* validate zero or more tbody */

    while (children.length > 0) {
      if (!TBodyMatcher.match(children[0]))
        break;
      children.shift();
    }

    /* match optional tfoot */

    if (children.length > 0 && TFootMatcher.match(children[0]))
      children.shift();

    /* are there unknown children */

    if (children.length > 0) {
      const unknownchildren = children.map(e => e.id || e.localName).join(" ");
      logger.error(`Table contains out of order or unknown children: ${unknownchildren}`)
    }

    return true;
  }
}

const BLOCK_ELEMENT_MATCHER = [
  PMatcher,
  DivMatcher,
  UlMatcher,
  OlMatcher,
  DlMatcher,
  PreMatcher,
  FigureMatcher,
  AsideMatcher,
  TableMatcher
];

class BlockMatcher {

  static match(element, logger) {
    return BLOCK_ELEMENT_MATCHER.some(e => e.match(element, logger));
  }
}

class ForewordMatcher {

  static match(e, logger) {
    return e.localName === "section" && e.id === "sec-foreword";
  }
}

class IntroductionMatcher {

  static match(e, logger) {
    return e.localName === "section" && e.id === "sec-introduction";
  }
}

class ScopeMatcher {

  static match(e, logger) {
    return e.localName === "section" && e.id === "sec-scope";
  }
}


class ConformanceMatcher {

  static match(e, logger) {
    return e.localName === "section" && e.id === "sec-conformance";
  }
}

function validateReferences(e, prefix, logger) {
  if (e.childElementCount === 1 && e.firstElementChild.localName === "ul") {
    for (const li of e.firstElementChild.children) {
      if (li.tagName === "LI") {
        const cites = li.querySelectorAll("cite");

        if (cites.length === 1) {
          if (!cites[0].id)
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


class NormativeReferencesMatcher {
  static match(e, logger) {
    if (e.id !== "sec-normative-references")
      return false;

    validateReferences(e, "Normative references", logger);

    return true;
  }
}


class ExternalDefinitionsMatcher {
  static match(e, logger) {
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
}


class InternalDefinitionsMatcher {
  static match(e, logger) {
    if (e.localName !== "dl" || e.id !== "terms-int-defs")
      return false;

    return true;
  }
}


class DefinitionsMatcher {
  static match(element, logger) {
    if (element.localName !== "section" || element.id !== "sec-terms-and-definitions")
      return false;

    const children = Array.from(element.children);

    /* validate optional additional elements */

    if (children.length > 0 && ExternalDefinitionsMatcher.match(children[0]))
      children.shift();

    /* validate optional bibliography */

    if (children.length > 0 && InternalDefinitionsMatcher.match(children[0]))
      children.shift();

    /* are there unknown children */

    if (children.length > 0) {
      const unknownchildren = children.map(e => e.id || e.localName).join(" ");
      logger.error(`Terms and definition clause contains out of order or unknown children: ${unknownchildren}`)
    }

    return true;
  }
}

class SectionMatcher {
  constructor(level) {
    this.level = level;
  }

  match(element, logger) {
    if (element.localName !== "section")
      return false;

    const children = Array.from(element.children);

    /* check the header */

    if (children.length > 0 && children[0].localName === `h${this.level}`) {
      children.shift();
    } else {
      logger.error("Clause is missing a heading");
    }

    let hasSubClauses = false;
    let hasBlocks = false;

    const subClauseMatcher = new SectionMatcher(this.level + 1);

    while (children.length > 0) {
      if (BlockMatcher.match(children[0])) {
        hasBlocks = true;
      } else if (subClauseMatcher.match(children[0])) {
        hasSubClauses = true;
      } else {
        logger.error("Unknown element in clause");
      }
      children.shift();
    }

    if (hasSubClauses && hasBlocks)
      logger.error("Clause contains both sub-clauses and text");

    return true;
  }
}

class ClauseMatcher {

  static match(e, logger) {
    if (e.classList.contains("annex") || e.id === "sec-bibliography" || e.id === "sec-elements")
      return false;

    const m = new SectionMatcher(2);
    return m.match(e, logger);
  }
}

class AnnexMatcher {

  static match(e, logger) {
    if (!e.classList.contains("annex"))
      return false;

    const m = new SectionMatcher(2);
    return m.match(e, logger);
  }
}

class ElementsAnnexMatcher {

  static match(e, logger) {
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
}

class BibliographyMatcher {

  static match(e, logger) {
    if (e.id !== "sec-bibliography")
      return false;

    validateReferences(e, "Bibliography references", logger);

    return true;
  }
}

function validateBody(body, logger) {
  if (body.localName !== "body")
    return false;

  const elements = Array.from(body.children);

  /* validate (optional) foreword */

  if (elements.length > 0 && ForewordMatcher.match(elements[0]))
    elements.shift();

  /* validate optional introduction */

  if (elements.length > 0 && IntroductionMatcher.match(elements[0]))
    elements.shift();

  /* validate mandatory scope */

  if (elements.length > 0 && ScopeMatcher.match(elements[0])) {
    elements.shift();
  } else {
    logger.error("Mandatory Scope clause missing");
  }

  /* validate optional conformance */

  if (elements.length > 0 && ConformanceMatcher.match(elements[0]))
    elements.shift();

  /* validate optional normative references */

  if (elements.length > 0 && NormativeReferencesMatcher.match(elements[0]))
    elements.shift();

  /* validate optional terms and definitions */

  if (elements.length > 0 && DefinitionsMatcher.match(elements[0]))
    elements.shift();

  /* validate zero or more clauses */

  while (elements.length > 0) {
    if (!ClauseMatcher.match(elements[0]))
      break;
    elements.shift();
  }

  /* validate zero or more annexes */

  while (elements.length > 0) {
    if (!AnnexMatcher.match(elements[0]))
      break;
    elements.shift();
  }

  /* validate optional additional elements */

  if (elements.length > 0 && ElementsAnnexMatcher.match(elements[0]))
    elements.shift();

  /* validate optional bibliography */

  if (elements.length > 0 && BibliographyMatcher.match(elements[0]))
    elements.shift();

  /* are there unknown elements */

  if (elements.length > 0) {
    const unknownElements = elements.map(e => e.id || e.localName).join(" ");
    logger.error(`Body section contains out of order or unknown elements: ${unknownElements}`)
  }

  return true;
}