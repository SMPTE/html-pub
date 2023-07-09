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

  error(msg, element) {
    this.hasFailed_ = true;
    this.errors_.push({ "message": msg, "element": element === undefined ? null : element });
  }

  warn(msg, element) { }

  log(msg, element) { }

  info(msg, element) { }

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
  return docMetadata;
}

class TerminalPhrasingMatcher {
  constructor(localName) {
    this.localName = localName;
  }

  match(element, logger) {
    if (element.localName !== this.localName)
      return false;

    if (element.childElementCount > 0)
      logger.error(`Element cannot contain children element`, element);

    return true;
  }
}

class PhrasingMatcher {
  constructor(localName) {
    this.localName = localName;
  }

  match(element, logger) {
    if (element.localName !== this.localName)
      return false;

      for (const child of element.children) {
        if (!AnyPhrasingMatcher.match(child, logger))
          logger.error(`Element can only contain phrasing elements`, element);
      }
    return true;
  }
}

class MathMatcher {
  static match(element, logger) {
    if (element.localName !== "math")
      return false;

    return true;
  }
}


const ALL_PHRASING_MATCHERS = [
  new PhrasingMatcher("b"),
  new PhrasingMatcher("bdo"),
  new PhrasingMatcher("bdi"),
  new TerminalPhrasingMatcher("br"),
  new TerminalPhrasingMatcher("code"),
  new TerminalPhrasingMatcher("dfn"),
  new PhrasingMatcher("em"),
  new PhrasingMatcher("i"),
  new TerminalPhrasingMatcher("kbd"),
  MathMatcher,
  new TerminalPhrasingMatcher("q"),
  /* "ruby", */
  new PhrasingMatcher("s"),
  new TerminalPhrasingMatcher("samp"),
  new PhrasingMatcher("span"),
  new TerminalPhrasingMatcher("strong"),
  new PhrasingMatcher("sub"),
  new PhrasingMatcher("sup"),
  new TerminalPhrasingMatcher("time"),
  new PhrasingMatcher("u"),
  new TerminalPhrasingMatcher("var"),
  new TerminalPhrasingMatcher("wbr"),
  new TerminalPhrasingMatcher("a")
];
class AnyPhrasingMatcher {
  static match(element, logger) {
    return ALL_PHRASING_MATCHERS.some(m => m.match(element, logger));
  }
}

class FlowMatcher {
  static match(element, logger) {
    return ALL_BLOCK_MATCHERS.some(m => m.match(element, logger)) || ALL_PHRASING_MATCHERS.some(m => m.match(element, logger));
  }
}

class PMatcher {
  static match(element, logger) {
    if (element.localName !== "p")
      return false;

    for (const child of element.children) {
      if (!AnyPhrasingMatcher.match(child, logger))
        logger.error(`Paragraph contains non-phrasing element`, child);
    }

    return true;
  }
}

class EqDivMatcher {
  static match(element, logger) {
    if (element.localName !== "div" || element.className !== "formula")
      return false;

    if (element.childElementCount !== 1 || element.firstElementChild.localName !== "math")
      logger.error(`Formula div must contain a single math element`, element);

    if (element.id === null)
      logger.error("Formula div is missing an id attribute", element);

    return true;
  }
}

class DivMatcher {
  static match(element, logger) {
    if (element.localName !== "div")
      return false;

    for (const child of element.children) {
      if (!FlowMatcher.match(child, logger))
        logger.error(`Div contains non-flow element`, child);
    }

    return true;
  }
}

class LiMatcher {
  static match(element, logger) {
    if (element.localName !== "li")
      return false;

    for (const child of element.children) {
      if (!FlowMatcher.match(child, logger))
        logger.error(`Li contains non-flow element`, child);
    }

    return true;
  }
}

class DtMatcher {
  static match(element, logger) {
    if (element.localName !== "dt")
      return false;

    for (const child of element.children) {
      if (!AnyPhrasingMatcher.match(child, logger))
        logger.error(`Dt contains non-phrasing element`, child);
    }

    return true;
  }
}

class DdMatcher {
  static match(element, logger) {
    if (element.localName !== "dd")
      return false;

    for (const child of element.children) {
      if (!AnyPhrasingMatcher.match(child, logger))
        logger.error(`Dd contains non-phrasing element`, child);
    }

    return true;
  }
}

class DefinitionSourceMatcher {
  static match(element, logger) {
    if (element.localName !== "dd")
      return false;

    const aMatcher = new TerminalPhrasingMatcher("a");

    if (element.childElementCount !== 1 || !aMatcher.match(element.firstElementChild, logger))
      logger.error(`Definition source must contain a single <a> element`, element);

    return true;
  }
}


class UlMatcher {
  static match(element, logger) {
    if (element.localName !== "ul")
      return false;

    for (const child of element.children) {
      if (!LiMatcher.match(child, logger))
        logger.error(`UL element contains non-LI element`, child);
    }

    return true;
  }
}

class OlMatcher {
  static match(element, logger) {
    if (element.localName !== "ol")
      return false;

    for (const child of element.children) {
      if (!LiMatcher.match(child, logger))
        logger.error(`OL element contains non-LI element`, child);
    }

    return true;
  }
}

class DlMatcher {
  static match(element, logger) {
    if (element.localName !== "dl")
      return false;

    const children = Array.from(element.children);

    while (children.length > 0) {

      let dtCount = 0;

      /* look for dt elements */
      while (children.length > 0) {
        if (!DtMatcher.match(children[0], logger))
          break;
        children.shift();
        dtCount++;
      }

      let ddCount = 0;

      /* look for definition */
      while (children.length > 0) {
        if (!DdMatcher.match(children[0], logger))
          break;
        children.shift();
        ddCount++;
      }

      if (ddCount === 0 || dtCount === 0)
        logger.error(`A definition must consist of one or more dt elements followed by one or more dd elements`, element);

    }

    return true;
  }
}

class PreMatcher {
  static match(element, logger) {
    if (element.localName !== "pre")
      return false;

    if (element.childElementCount !== 0)
      logger.error(`Pre element must contain only text`, element);

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

class BlockQuoteMatcher {
  static match(element, logger) {
    if (element.localName !== "blockquote")
      return false;

    if (element.childElementCount !== 0)
      logger.error(`Pre element must contain only text`, element);

    return true;
  }
}

class TableMatcher {

  static match(element, logger) {
    if (element.localName !== "table")
      return false;

    const children = Array.from(element.children);

    /* match caption */

    if (children.length > 0 && CaptionMatcher.match(children[0], logger))
      children.shift();
    else
      logger.error("Table is missing a caption element", element)

    /* match optional thead */

    if (children.length > 0 && THeadMatcher.match(children[0], logger))
      children.shift();

    /* validate zero or more tbody */

    while (children.length > 0) {
      if (!TBodyMatcher.match(children[0], logger))
        break;
      children.shift();
    }

    /* match optional tfoot */

    if (children.length > 0 && TFootMatcher.match(children[0], logger))
      children.shift();

    /* are there unknown children */

    if (children.length > 0) {
      const unknownchildren = children.map(e => e.id || e.localName).join(" ");
      logger.error(`Table contains out of order or unknown children: ${unknownchildren}`, element)
    }

    return true;
  }
}

const ALL_BLOCK_MATCHERS = [
  PMatcher,
  EqDivMatcher,
  DivMatcher,
  UlMatcher,
  OlMatcher,
  DlMatcher,
  PreMatcher,
  FigureMatcher,
  AsideMatcher,
  TableMatcher,
  BlockQuoteMatcher
];

class BlockMatcher {
  static match(element, logger) {
    return ALL_BLOCK_MATCHERS.some(e => e.match(element, logger));
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

class ReferenceMatcher {
  static match(element, logger) {
    if (element.localName !== "li")
      return false;

    let aCount = 0;
    let citeCount = 0;

    for (const child of element.children) {
      if (child.localName === "a") {
        aCount++;
      } else if (child.localName === "cite") {
        if (child.id === null)
          logger.error(`All cite element must have an id attribute`, child);
        citeCount++;
      }
    }

    if (aCount > 1)
      logger.error(`Reference element must contain at most one link`, element);

    if (citeCount !== 1)
      logger.error(`Reference element must contain exactly one cite element`, element);

    return true;
  }
}

function validateReferences(sectionElement, logger) {
  const children = Array.from(sectionElement.children);

  if (sectionElement.childElementCount !== 1 || sectionElement.firstElementChild.localName !== "ul") {
    logger.error(`References must contain a single ul element`, sectionElement);
    return;
  }

  for (const liElement of sectionElement.firstElementChild.children) {
    if (!ReferenceMatcher.match(liElement, logger)) {
      logger.error(`Ul element contains a non-Li element: ${liElement.outerHTML}`, sectionElement.firstElementChild);
      continue;
    }

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
          logger.error(`Each <li> element must contain exactly one <a> element`, e);
        }
      } else {
        logger.error(`The <ul> element must contain only <li> elements`, e);
      }
    }

    return true;
  }
}


class InternalDefinitionsMatcher {
  static match(element, logger) {
    if (element.localName !== "dl" || element.id !== "terms-int-defs")
      return false;

    const children = Array.from(element.children);

    while (children.length > 0) {

      let dtCount = 0;

      /* look for dt elements */
      while (children.length > 0) {
        if (!DtMatcher.match(children[0], logger))
          break;
        children.shift();
        dtCount++;
      }

      let ddCount = 0;

      /* look for definition */
      if (children.length > 0 && DdMatcher.match(children[0], logger)) {
        children.shift();
        ddCount++;
      }

      /* look for definition source */
      if (children.length > 0 && DefinitionSourceMatcher.match(children[0], logger)) {
        children.shift();
        ddCount++;
      }

      if (ddCount === 0 || ddCount > 2 || dtCount === 0)
        logger.error(`A definition must consist of one or more dt elements followed by one or two dd elements`, element);

    }

    return true;
  }
}


class DefinitionsMatcher {
  static match(element, logger) {
    if (element.localName !== "section" || element.id !== "sec-terms-and-definitions")
      return false;

    const children = Array.from(element.children);

    /* validate optional additional elements */

    if (children.length > 0 && ExternalDefinitionsMatcher.match(children[0], logger))
      children.shift();

    /* validate optional bibliography */

    if (children.length > 0 && InternalDefinitionsMatcher.match(children[0], logger))
      children.shift();

    /* are there unknown children */

    if (children.length > 0) {
      const unknownchildren = children.map(e => e.id || e.localName).join(" ");
      logger.error(`Terms and definition clause contains out of order or unknown children: ${unknownchildren}`, element)
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

    if (element.id === null)
      logger.error("Section element is missing an id attribute", element);

    const children = Array.from(element.children);

    /* check the header */

    if (children.length > 0 && children[0].localName === `h${this.level}`) {
      children.shift();
    } else {
      logger.error("Section is missing a heading", element);
    }

    let hasSubClauses = false;
    let hasBlocks = false;

    const subClauseMatcher = new SectionMatcher(this.level + 1);

    while (children.length > 0) {
      if (BlockMatcher.match(children[0], logger)) {
        hasBlocks = true;
      } else if (subClauseMatcher.match(children[0], logger)) {
        hasSubClauses = true;
      } else {
        logger.error("Unknown element in clause", element);
      }
      children.shift();
    }

    if (hasSubClauses && hasBlocks)
      logger.error("Clause contains both sub-clauses and text", element);

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

    if (e.childElementCount !== 1 || e.firstElementChild.localName !== "ol") {
      logger.error(`The Elements Annex section must contain a single <ol> element.`);
      return true;
    }

    for (const child of e.firstElementChild.children) {
      if (child.localName !== "li") {
        logger.error(`The <ol> element of the Elements Annex must contain only <li> elements`, e);
        continue;
      }

      if (child.firstElementChild.localName !== "a" || !child.firstElementChild.id || child.childElementCount !== 1 || !child.firstElementChild.title || !child.firstElementChild.href) {
        logger.error(`Each <li> element of the Elements Annex must contain a single <a> element with a title, id and href attributes`, child);
      }

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

  if (elements.length > 0 && ForewordMatcher.match(elements[0], logger))
    elements.shift();

  /* validate optional introduction */

  if (elements.length > 0 && IntroductionMatcher.match(elements[0], logger))
    elements.shift();

  /* validate mandatory scope */

  if (elements.length > 0 && ScopeMatcher.match(elements[0], logger)) {
    elements.shift();
  } else {
    logger.error("Mandatory Scope clause missing", elements[0]);
  }

  /* validate optional conformance */

  if (elements.length > 0 && ConformanceMatcher.match(elements[0], logger))
    elements.shift();

  /* validate optional normative references */

  if (elements.length > 0 && NormativeReferencesMatcher.match(elements[0], logger))
    elements.shift();

  /* validate optional terms and definitions */

  if (elements.length > 0 && DefinitionsMatcher.match(elements[0], logger))
    elements.shift();

  /* validate zero or more clauses */

  while (elements.length > 0) {
    if (!ClauseMatcher.match(elements[0], logger))
      break;
    elements.shift();
  }

  /* validate zero or more annexes */

  while (elements.length > 0) {
    if (!AnnexMatcher.match(elements[0], logger))
      break;
    elements.shift();
  }

  /* validate optional additional elements */

  if (elements.length > 0 && ElementsAnnexMatcher.match(elements[0], logger))
    elements.shift();

  /* validate optional bibliography */

  if (elements.length > 0 && BibliographyMatcher.match(elements[0], logger))
    elements.shift();

  /* are there unknown elements */

  if (elements.length > 0) {
    const unknownElements = elements.map(e => e.id || e.localName).join(" ");
    logger.error(`Body section contains out of order or unknown elements: ${unknownElements}`, body)
  }

  return true;
}