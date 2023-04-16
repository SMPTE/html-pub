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



class SequenceMatcher {
  constructor (v_seq) {
    this.v_seq = v_seq;
    this.description = this.v_seq.map(e => e.description).join(" ");
  }

  match(elems, logger) {
    for (const v of this.v_seq) {
      const r = v.match(elems, logger);

      if (! r) {
        if (logger !== null)
          logger.error(`Expected ${v.description}`);
        return false;
      }
    }

    if (elems.length !== 0) {
      if (logger !== null)
        logger.error(`Sequence ${this.description} matching failed at ${elems[0].id}`);
      return false;
    }

    return true;
  }
}

class RepeatElementMatcher {
  constructor (v, minCount, maxCount) {
    this.v = v;
    this.minCount = minCount;
    this.maxCount = maxCount;
    this.description = `${v.name}{${minCount},${maxCount}}`;
  }

  match(elems, logger) {
    let count = 0;

    while (elems.length > 0) {
      const r = this.v.match(elems, null);

      if (!r)
        break;

      count++;
    }

    if (count < this.minCount || count > this.maxCount) {
      if (logger !== null)
        logger.error(`Incorrect element count`);
      return false;
    }

    return true;
  }
}

class OneOfMatcher {
  constructor (m_list) {
    this.m_list = m_list;
  }

  match(elems, logger) {
    for (const m of this.m_list) {
      if (m.match(Array.from(elems), null))
        return true;
    }
    return false;
  }
}

class OptionalElementMatcher extends RepeatElementMatcher {
  constructor (v) {
    super(v, 0, 1);
  }
}

class OneOrMoreElementMatcher extends RepeatElementMatcher {
  constructor (v) {
    super(v, 1, Number.MAX_SAFE_INTEGER);
  }
}


class ZeroOrMoreElementMatcher extends RepeatElementMatcher {
  constructor (v) {
    super(v, 0, Number.MAX_SAFE_INTEGER);
  }
}

class OneElementMatcher extends RepeatElementMatcher {
  constructor (v) {
    super(v, 1, 1);
  }
}

class ElementMatcher {
  static match(elements, logger) {
    if (elements.length === 0)
      return false;

    const r = this.matchElement(elements[0], logger);

    if (r)
      elements.shift();

    return r;
  }

  match(elements, logger) {
    if (elements.length === 0)
      return false;

    const r = this.matchElement(elements[0], logger);

    if (r)
      elements.shift();

    return r;
  }
}

class PMatcher extends ElementMatcher {
  static matchElement(element, logger) {
    if (element.localName !== "p")
      return false;

    return true;
  }
}

class DivMatcher extends ElementMatcher {
  static matchElement(element, logger) {
    if (element.localName !== "div")
      return false;

    return true;
  }
}

class UlMatcher extends ElementMatcher {
  static matchElement(element, logger) {
    if (element.localName !== "ul")
      return false;

    return true;
  }
}

class OlMatcher extends ElementMatcher {
  static matchElement(element, logger) {
    if (element.localName !== "ol")
      return false;

    return true;
  }
}

class DlMatcher extends ElementMatcher {
  static matchElement(element, logger) {
    if (element.localName !== "dl")
      return false;

    return true;
  }
}

class PreMatcher extends ElementMatcher {
  static description = "pre";

  static matchElement(element, logger) {
    if (element.localName !== "pre")
      return false;

    return true;
  }
}

class FigureMatcher extends ElementMatcher {
  static description = "figure";

  static matchElement(element, logger) {
    if (element.localName !== "figure")
      return false;

    return true;
  }
}

class AsideMatcher extends ElementMatcher {
  static description = "aside";

  static matchElement(element, logger) {
    if (element.localName !== "aside")
      return false;

    return true;
  }
}

class TableMatcher extends ElementMatcher {
  static description = "table";

  static matchElement(element, logger) {
    if (element.localName !== "table")
      return false;

      const m = new SequenceMatcher([
        new OneElementMatcher(validateCaption),
        new OptionalElementMatcher(validateTHead),
        new ZeroOrMoreElementMatcher(validateTBody),
        new OptionalElementMatcher(validateTFooter)
      ]);

      return m.match(element.children, logger);
  }
}


const BLOCK_ELEMENT_MATCHER = new OneOfMatcher([
  PMatcher,
  DivMatcher,
  UlMatcher,
  OlMatcher,
  DlMatcher,
  PreMatcher,
  FigureMatcher,
  AsideMatcher,
  TableMatcher
]);


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

class ForewordMatcher extends ElementMatcher {
  static description = "foreword section";

  static matchElement(e, logger)  {
    return e.localName === "section" && e.id === "sec-foreword";
  }
}

class IntroductionMatcher extends ElementMatcher {
  static description = "introduction section";

  static matchElement(e, logger)  {
    return e.localName === "section" && e.id === "sec-introduction";
  }
}

class ScopeMatcher extends ElementMatcher {
  static description = "scope section";

  static matchElement(e, logger)  {
    return e.localName === "section" && e.id === "sec-scope";
  }
}


class ConformanceMatcher extends ElementMatcher {
  static description = "conformance section";

  static matchElement(e, logger)  {
    return e.localName === "section" && e.id === "sec-conformance";
  }
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


class NormativeReferencesMatcher extends ElementMatcher {
  static description = "normative references";

  static matchElement(e, logger)  {
    if (e.id !== "sec-normative-references")
      return false;

    validateReferences(e, "Normative references", logger);

    return true;
  }
}


class ExternalDefinitionsMatcher extends ElementMatcher {
  static description = "internal terms and definitions";

  static matchElement(e, logger) {
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


class InternalDefinitionsMatcher extends ElementMatcher {
  static description = "internal terms and definitions";

  static matchElement(e, logger) {
    if (e.localName !== "dl" || e.id !== "terms-int-defs")
      return false;

    return true;
  }
}


class DefinitionsMatcher extends ElementMatcher {
  static description = "terms and definitions";

  static matchElement(e, logger) {
    if (e.localName !== "section" || e.id !== "sec-terms-and-definitions")
      return false;

    const m = new SequenceMatcher([
      new OptionalElementMatcher(ExternalDefinitionsMatcher),
      new OptionalElementMatcher(InternalDefinitionsMatcher),
    ]);

    return m;
  }
}

class HeadingMatcher extends ElementMatcher {
  constructor (level) {
    super();
    this.level = level;
    this.description = `Heading Level ${this.level}`;
  }

  matchElement(element, logger) {
    return element.localName === `h${this.level}`;
  }
}

class ClauseElementMatcher extends ElementMatcher {
  constructor (level) {
    super();
    this.level = level;
  }

  matchElement(element, logger) {
    if (element.localName !== "section")
      return false;

    const m = new SequenceMatcher([
      new HeadingMatcher(this.level),
      new OneOfMatcher([
        new OneOrMoreElementMatcher(new ClauseElementMatcher(this.level + 1)),
        new ZeroOrMoreElementMatcher(BLOCK_ELEMENT_MATCHER)
      ])
    ]);

    return m.match(Array.from(element.children), logger);
  }
}

class ClauseMatcher  extends ElementMatcher {
  static description = "clause";

  static matchElement(e, logger) {
    if (e.classList.contains("annex") || e.id === "sec-bibliography" || e.id === "sec-elements")
      return false;

    const m = new ClauseElementMatcher(2);
    return m.matchElement(e, logger);
  }
}

class AnnexMatcher extends ElementMatcher {
  static description = "annex";

  static matchElement(e, logger) {
    if (e.localName !== "section" || !e.classList.contains("annex"))
      return false;

    const m = new ClauseElementMatcher(2);
    return m.matchElement(e, logger);
  }
}

class ElementsAnnexMatcher extends ElementMatcher {
  static description = "additional elements annex";

  static matchElement(e, logger) {
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

class BibliographyMatcher extends ElementMatcher {
  static description = "bibliography";

  static matchElement(e, logger)  {
    if (e.id !== "sec-bibliography")
      return false;

    validateReferences(e, "Bibliography references", logger);

    return true;
  }
}

function validateBody(body, logger) {
  const m = new SequenceMatcher([
      new OptionalElementMatcher(ForewordMatcher),
      new OptionalElementMatcher(IntroductionMatcher),
      ScopeMatcher,
      new OptionalElementMatcher(ConformanceMatcher),
      new OptionalElementMatcher(NormativeReferencesMatcher),
      new OptionalElementMatcher(DefinitionsMatcher),
      new ZeroOrMoreElementMatcher(ClauseMatcher),
      new ZeroOrMoreElementMatcher(AnnexMatcher),
      new OptionalElementMatcher(ElementsAnnexMatcher),
      new OptionalElementMatcher(BibliographyMatcher),
  ]);

  const r = m.match(Array.from(body.children), logger);

  if (!r && logger !== null)
    logger.error("Invalid body");

  return r;
}