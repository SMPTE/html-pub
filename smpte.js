/*
Copyright (c) Pierre-Anthony Lemieux
Copyright (c) Society of Motion Picture and Television Engineers

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
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

import { smpteValidate } from "./js/validate.mjs";
import * as smpte from "./js/common.mjs";

class Logger {
  constructor() {
    this.events = [];
  }

  error(msg, element) {
    if (element !== undefined) {
      if (!element.hasAttribute("id") || !element.id) {
        element.id = Math.floor(Math.random() * 1000000000);
      }
      element.classList.add("invalid-tag");
    }
    this.events.push({msg: msg, elementId: element === undefined ? null : element.id});
  }

  hasError() {
    return this.events.length > 0;
  }

  errorList() {
    return this.events;
  }
}

const logger_ = new Logger();

const _SCRIPT_PATH = function () {
  const scripts = document.head.getElementsByTagName("script");

  for (const script of scripts) {
    const src = script.getAttribute("src");
    if (src !== null && src.indexOf("smpte.js") > -1)
      return src.split("/").slice(0, -1).join("/");
  }

  logger_.error("Could not determine location of SMPTE document script");
  return null;
}();

function resolveScriptRelativePath(path) {
  return `${_SCRIPT_PATH}/${path}`;
}

function asyncFetchLocal(url) {
  return new Promise(function(resolve, reject) {
    var xhr = new XMLHttpRequest
    xhr.onload = () => resolve(xhr.responseText);
    xhr.onerror = () =>  reject(new TypeError('Local request failed'));
    xhr.open('GET', url);
    xhr.send(null);
  });
}

async function asyncAddStylesheet(url) {
  return asyncFetchLocal(url)
    .then(function (data) {
      let s = document.createElement("style");
      s.textContent = data;
      document.head.appendChild(s);
      })
    .catch(err => logError("Cannot fetch: " + err));
}

function fillTemplate(template, data) {
  if (typeof data != "undefined" && data !== null)
    for (const field of  Object.keys(data))
      template = template.replace(`{{${field}}}`, data[field]);
  return template;
}

function loadDocMetadata() {

  const docMetadata = {...smpte.loadDocumentMetadata(document, logger_)};

  for (const [k, v] of (new URL(document.location)).searchParams.entries()) {
    docMetadata[k] = v;
  }

  return docMetadata;
}

const SMPTE_FRONT_MATTER_BOILERPLATE = `<div id="doc-number-block">
<div id="doc-designator" itemscope="itemscope" itemtype="http://purl.org/dc/elements/1.1/">
<span itemprop="publisher">SMPTE</span>&nbsp;<span id="doc-type">{{pubType}}</span>&nbsp;{{actualPubNumber}}</div>
{{revisionOf}}
</div>
{{longPubStage}}
<img id="smpte-logo" src="{{smpteLogoURL}}" alt="SMPTE logo" />
<div id="long-doc-type">{{longDocType}}</div>
<h1>{{fullTitle}}</h1>
<div id="doc-status">{{publicationState}} - {{actualPubDateTime}}</div>
<p><span id="copyright-text">Copyright © <span id="doc-copyright-year">{{copyrightYear}}</span>,
Society of Motion Picture and Television Engineers</span>.
All rights reserved. No part of this material may be reproduced, by any means whatsoever,
without the prior written permission of the Society of Motion Picture and Television Engineers.</p>
<hr />
{{draftWarning}}`

const SMPTE_PUB_OM_FRONT_MATTER_BOILERPLATE = `<div id="doc-designator" itemscope="itemscope" itemtype="http://purl.org/dc/elements/1.1/">
<span itemprop="publisher">SMPTE</span>&nbsp;<span id="doc-type">{{pubType}}</span>&nbsp;{actualPubNumber}}</div>
<img id="smpte-logo" src="{{smpteLogoURL}}" alt="SMPTE logo" />
<div id="long-doc-type">{{longDocType}}</div>
<h1>{{fullTitle}}</h1>
<div id="doc-status">{{publicationState}}: {{actualPubDateTime}}</div>
<div id="doc-effective">Effective date: {{effectiveDateTime}}</div>
<p><span id="copyright-text">Copyright © <span id="doc-copyright-year">{{copyrightYear}}</span>,
Society of Motion Picture and Television Engineers</span>.
All rights reserved. No part of this material may be reproduced, by any means whatsoever,
without the prior written permission of the Society of Motion Picture and Television Engineers.</p>
<hr />`

const SMPTE_FRONT_MATTER_ID = "sec-front-matter";


function insertFrontMatter(docMetadata) {
  let sec = document.getElementById(SMPTE_FRONT_MATTER_ID);

  if (sec !== null) {
    throw "Front matter section already exists."
  }

  let longDocType = smpte.LONG_PUB_TYPE.get(docMetadata.pubType);

  let longPubStage = "";
  if (docMetadata.pubStage !== smpte.PUB_STAGE_PUB && smpte.ENGDOC_PUBTYPES.has(docMetadata.pubType)) {
    let confidential = docMetadata.pubConfidential ? "CONFIDENTIAL " : "";
    longPubStage = `<div id="long-pub-stage">${confidential}${smpte.LONG_PUB_STAGE.get(docMetadata.pubStage)}</div>`;
  }

  let actualPubDateTime;

  if (docMetadata.pubDateTime === null || docMetadata.pubState == smpte.PUB_STATE_DRAFT) {
    actualPubDateTime = new Date();
  } else {
    actualPubDateTime = new Date(docMetadata.pubDateTime);
  }

  const formattedPubDateTime = docMetadata.pubState == smpte.PUB_STATE_DRAFT ?
    actualPubDateTime :
    actualPubDateTime.toISOString().slice(0, 10);

  let actualPubNumber = "";
  if (docMetadata.pubNumber !== null) {
    actualPubNumber = `<span itemprop="doc-number" id="doc-number">${docMetadata.pubNumber}</span>`;

    switch (docMetadata.pubType) {
      case smpte.AG_PUBTYPE:
      case smpte.OM_PUBTYPE:
        break;
      case smpte.ST_PUBTYPE:
      case smpte.RP_PUBTYPE:
      case smpte.EG_PUBTYPE:
        if (docMetadata.pubPart !== null)
          actualPubNumber += `-<span itemprop="doc-part" id="doc-part">${docMetadata.pubPart}</span>`;
        if (docMetadata.pubStage === smpte.PUB_STAGE_PUB) {
          let pubVersion;
          if (docMetadata.pubVersion) {
            pubVersion = docMetadata.pubVersion;
          } else {
            const d = new Date(docMetadata.pubDateTime);
            pubVersion = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          }
          actualPubNumber += `<span id="doc-version-string">:<span itemprop="doc-version" id="doc-version">${pubVersion}</span></span>`;

        }
          
        break;
    }
  }

  let publicationState;

  switch (docMetadata.pubState) {
    case smpte.PUB_STATE_DRAFT:
      asyncAddStylesheet(resolveScriptRelativePath("css/smpte-draft.css"));
      publicationState = "Draft";
      break;
    case smpte.PUB_STATE_PUB:
      if (docMetadata.pubType === smpte.OM_PUBTYPE)
        publicationState = "Approved by Board of Governors";
      else
        publicationState = "Approved";
      break;
  }

  const draftWarning = docMetadata.pubStage === smpte.PUB_STAGE_PUB ? "" : SMPTE_DRAFT_WARNING;

  let boilerplate;

  if (docMetadata.pubState === smpte.PUB_STATE_PUB && docMetadata.pubType === smpte.OM_PUBTYPE)
    boilerplate = SMPTE_PUB_OM_FRONT_MATTER_BOILERPLATE;
  else
    boilerplate = SMPTE_FRONT_MATTER_BOILERPLATE;

  let fullTitle;

  if (docMetadata.pubSuiteTitle !== null)
    fullTitle = `${docMetadata.pubSuiteTitle} — ${docMetadata.pubTitle}`;
  else
    fullTitle = docMetadata.pubTitle;

  let revisionOf = "";

  if (docMetadata.pubRevisionOf !== null)
    revisionOf = `<div id="revision-text">Revision of <span id="revision-of">${docMetadata.pubRevisionOf}</span></div>`;

  sec = document.createElement("section");
  sec.className = "unnumbered";
  sec.id = SMPTE_FRONT_MATTER_ID;

  sec.innerHTML = fillTemplate(
    boilerplate,
    {
      revisionOf: revisionOf,
      longDocType: longDocType,
      longPubStage: longPubStage,
      fullTitle: fullTitle,
      draftWarning: draftWarning,
      publicationState: publicationState,
      smpteLogoURL: resolveScriptRelativePath("static/smpte-logo.png"),
      actualPubDateTime: formattedPubDateTime,
      actualPubNumber: actualPubNumber,
      copyrightYear: actualPubDateTime.getFullYear(),
      ...docMetadata
    }
    );

  const body = document.body;
  if (body === null)
    throw "Missing body element"

  body.insertBefore(sec, body.firstChild);
}

const SMPTE_TOC_ID = "sec-toc";

function insertTOC(docMetadata) {
  function _processSubSections(parentTOCItem, section, level) {

    if (level == 0) return;

    let subSections = [];

    for (const subSection of section.children) {

      if (subSection.localName !== "section")
        continue;

      const secId = subSection.getAttribute("id")

      if (['sec-front-matter', 'sec-toc'].includes(secId))
        continue;

      const heading = subSection.firstElementChild;

      if (!heading || !secId) {
        logger_.error(`Section must have a heading and id attribute.`, subSection);
        continue;
      }

      subSections.push(subSection);
    }

    if (subSections.length > 0) {

      const tocItem = document.createElement("ol");

      for (const subSection of subSections) {
        let sectionRef = document.createElement("a");
        sectionRef.href = "#" + subSection.id;
        sectionRef.innerHTML = subSection.firstElementChild.innerText;

        let sectionItem = document.createElement("li");
        sectionItem.appendChild(sectionRef);

        tocItem.appendChild(sectionItem);

        _processSubSections(sectionItem, subSection, level - 3);

      }

      parentTOCItem.appendChild(tocItem);

    }

  }

  let toc = document.getElementById(SMPTE_TOC_ID);

  if (toc === null) {
    toc = document.createElement("section");
    toc.id = SMPTE_TOC_ID;
    document.body.insertBefore(toc, document.getElementById(SMPTE_FRONT_MATTER_ID).nextSibling);
  }

  const h2 = document.createElement("h2");
  h2.innerText = "Table of contents";
  toc.className = "unnumbered";

  toc.appendChild(h2);

  _processSubSections(toc, document.body, 1);
}

const SMPTE_INTRODUCTION_ID = "sec-introduction";

function insertIntroduction(docMetadata) {
  const sec = document.getElementById(SMPTE_INTRODUCTION_ID);

  if (sec === null)
    return;

  sec.className = "unnumbered";

  let h2 = sec.getElementsByTagName("h2");

  if (h2.length == 0) {
    h2 = document.createElement("h2");
    sec.insertBefore(h2, sec.firstChild);
  } else if (h2.length == 1) {
    h2 = h2[0];
  } else {
    logger_.error("Introduction section has multiple headings.");
    return;
  }

  h2.innerText = "Introduction";

  if (smpte.ENGDOC_PUBTYPES.has(docMetadata.pubType)) {
    let b = document.createElement("p");
    b.innerHTML = "<em>This clause is entirely informative and does not form an integral part of this Engineering Document.</em>";
    sec.insertBefore(b, h2.nextSibling)
  }
}

const SMPTE_SCOPE_ID = "sec-scope";

function insertScope(docMetadata) {
  const sec = document.getElementById(SMPTE_SCOPE_ID);

  if (sec === null) {
    logger_.error("Missing required scope section.");
    return;
  }

  let h2 = sec.getElementsByTagName("h2");

  if (h2.length == 0) {
    h2 = document.createElement("h2");
    sec.insertBefore(h2, sec.firstChild);
  } else if (h2.length == 1) {
    h2 = h2[0];
  } else {
    logger_.error("Scope section has multiple headings.");
    return;
  }

  h2.innerText = "Scope";
}


const SMPTE_NORM_REFS_ID = "sec-normative-references";

function insertNormativeReferences(docMetadata) {
  let sec = document.getElementById(SMPTE_NORM_REFS_ID);

  if (docMetadata.pubType == smpte.OM_PUBTYPE) {
    if (sec !== null)
      logger_.error("OM must not contain normative references.");
    return;
  }

  if (sec === null) {
    sec = document.createElement("section");
    sec.id = SMPTE_NORM_REFS_ID;
    document.body.insertBefore(sec, document.getElementById(SMPTE_CONFORMANCE_ID).nextSibling);
  }

  const p = document.createElement("p");

  if (sec.childElementCount !== 0) {
    p.innerHTML = `The following documents are referred to in the text in such a way that some or all of
     their content constitutes requirements of this document. For dated references, only the edition cited
      applies. For undated references, the latest edition of the referenced document
       (including any amendments) applies.`
  } else {
    p.innerHTML = `There are no normative references in this document.`
  }

  sec.insertBefore(p, sec.firstChild);


  let h2 = sec.getElementsByTagName("h2");

  if (h2.length == 0) {
    h2 = document.createElement("h2");
    sec.insertBefore(h2, sec.firstChild);
  } else if (h2.length == 1) {
    h2 = h2[0];
  } else {
    logger_.error("Normative reference section has multiple headings.");
    return;
  }

  h2.innerText = "Normative references";

  /* style URLs */

  for(const u of sec.querySelectorAll("ul a")) {
    u.parentNode.insertBefore(document.createTextNode("url:\u00a0"), u);
  }
}

const SMPTE_TERMS_ID = "sec-terms-and-definitions";

function insertTermsAndDefinitions(docMetadata) {
  let sec = document.getElementById(SMPTE_TERMS_ID);

  if (docMetadata.pubType == smpte.OM_PUBTYPE) {
    if (sec !== null)
      logger_.error("OM must not contain terms and definitions.");
    return;
  }

  if (sec === null) {
    sec = document.createElement("section");
    sec.id = SMPTE_TERMS_ID;
    document.body.insertBefore(sec, document.getElementById(SMPTE_NORM_REFS_ID).nextSibling);
  }

  const p = document.createElement("p");

  if (sec.childElementCount !== 0) {

    let defList = document.getElementById("terms-int-defs");
    let extList = document.getElementById("terms-ext-defs");

    if (extList === null && defList !== null) {
      p.innerHTML = `For the purposes of this document, the following terms and definitions apply:`;
    } else if (extList !== null && defList === null) {
      p.innerHTML = `For the purposes of this document, the terms and definitions given in the following documents apply:`;
    } else if (extList !== null && defList !== null) {
      p.innerHTML = `For the purposes of this document, the terms and definitions given in the following documents and the additional terms and definitions apply:`;
    }

  } else {
    p.innerHTML = `No terms and definitions are listed in this document.` 
  }

  sec.insertBefore(p, sec.firstChild);

  /* set the heading */

  let h2 = sec.getElementsByTagName("h2");

  if (h2.length == 0) {
    h2 = document.createElement("h2");
    sec.insertBefore(h2, sec.firstChild);
  } else if (h2.length == 1) {
    h2 = h2[0];
  } else {
    logger_.error("Terms and definitions section has multiple headings.");
    return;
  }

  h2.innerText = "Terms and definitions";
}

function insertBibliography(docMetadata) {
  const sec = document.getElementById("sec-bibliography");

  if (sec === null)
    return;

  if (sec.childElementCount === 0) {
    logger_.error(`No informational references listed, Bibliography section must be removed`)
  }

  sec.classList.add("unnumbered");

  let h2 = sec.getElementsByTagName("h2");

  if (h2.length == 0) {
    h2 = document.createElement("h2");
    sec.insertBefore(h2, sec.firstChild);
  } else if (h2.length == 1) {
    h2 = h2[0];
  } else {
    logger_.error("Bibliography section has multiple headings.");
    return;
  }

  h2.innerText = "Bibliography";

  /* style links */

  for(const u of sec.querySelectorAll("ul a")) {
    u.parentNode.insertBefore(document.createTextNode("url:\u00a0"), u);
  }
}

const SMPTE_ELEMENTS_ID = "sec-elements";

function insertElementsAnnex(docMetadata) {
  const sec = document.getElementById(SMPTE_ELEMENTS_ID);

  if (sec === null)
    return;

  if (sec.children.length !== 1 || sec.firstElementChild.tagName !== "OL") {
    logger_.error(`Elements section must contain a single <ol> element.`);
    return;
  }

  sec.classList.add("unnumbered");

  const intro = document.createElement("p");
  intro.innerText = "The following are the non-prose elements of this document:"
  sec.insertBefore(intro, sec.firstChild);

  const h2 = document.createElement("h2");
  h2.innerText = "Additional elements";
  sec.insertBefore(h2, sec.firstChild);

  let counter = "a".charCodeAt();

  for(const e of sec.querySelectorAll("li > a")) {

    if (! e.title) {
      logger_.error("All links listed in the Elements Annex must have a title attribute.", e);
      continue;
    }

    const href = e.getAttribute("href");

    if (! href) {
      logger_.error("All links listed in the Elements Annex must have an href attribute.", e);
      continue;
    }

    const headingNum = document.createElement("span");
    headingNum.className = "heading-number";
    headingNum.innerText = String.fromCharCode(counter++);

    const headingLabel = document.createElement("span");
    headingLabel.className = "heading-label";
    headingLabel.appendChild(headingNum);
    headingLabel.appendChild(document.createTextNode("."));

    e.parentElement.insertBefore(headingLabel, e);

    const isAbsoluteLink = href.startsWith("http");

    if (isAbsoluteLink) {
      e.innerText = href;
    } else {
      e.innerText = href.split('\\').pop().split('/').pop();
    }

    e.parentElement.insertBefore(
      document.createTextNode(` ${e.title} ${e.classList.contains("informative")? "(informative)" : "(normative)"}. ${isAbsoluteLink ? "url:" : "file:"} <`),
      e
    );

    e.parentElement.insertBefore(document.createTextNode(">."), e.nextSibling);

  }
}

const SMPTE_CONFORMANCE_ID = "sec-conformance";

function insertConformance(docMetadata) {

  let sec = document.getElementById(SMPTE_CONFORMANCE_ID);

  if (!(docMetadata.pubType == smpte.RP_PUBTYPE || docMetadata.pubType == smpte.ST_PUBTYPE)) {
    if (sec !== null)
      logger_.error(`An ${docMetadata.pubType} document must not contain a conformance section`);
    if (docMetadata.pubType != smpte.EG_PUBTYPE)
      return;
  }

  if (sec === null) {
    sec = document.createElement("section");
    sec.id = SMPTE_CONFORMANCE_ID;

    document.body.insertBefore(sec, document.getElementById(SMPTE_SCOPE_ID).nextSibling);
  }

  let implConformance = "";

  if (docMetadata.pubType !== smpte.AG_PUBTYPE) {

    if (sec.innerText.trim().length === 0) {

      implConformance = `<p>A conformant implementation according to this document is one that
      includes all mandatory provisions ("shall") and, if implemented, all recommended provisions
      ("should") as described. A conformant implementation need not implement
      optional provisions ("may") and need not implement them as described.</p>`;

    } else {

      implConformance = sec.innerHTML;

    }

  } else if (sec.innerText.trim().length !== 0) {
    logger_.error("Conformance section not used in AGs.");
  }

  if (docMetadata.pubType !== smpte.EG_PUBTYPE) {
    
    sec.innerHTML = `
    <h2>Conformance</h2>
    <p>Normative text is text that describes elements of the design that are indispensable or contains the
    conformance language keywords: "shall", "should", or "may". Informative text is text that is potentially
      helpful to the user, but not indispensable, and can be removed, changed, or added editorially without
      affecting interoperability. Informative text does not contain any conformance keywords. </p>

    <p>All text in this document is, by default, normative, except: the Introduction, any clause explicitly
    labeled as "Informative" or individual paragraphs that start with "Note:" </p>

  <p>The keywords "shall" and "shall not" indicate requirements strictly to be followed in order to conform to the
  document and from which no deviation is permitted.</p>

  <p>The keywords, "should" and "should not" indicate that, among several possibilities, one is recommended
    as particularly suitable, without mentioning or excluding others; or that a certain course of action
    is preferred but not necessarily required; or that (in the negative form) a certain possibility
    or course of action is deprecated but not prohibited.</p>

  <p>The keywords "may" and "need not" indicate courses of action permissible within the limits of the document. </p>

  <p>The keyword "reserved" indicates a provision that is not defined at this time, shall not be used,
    and may be defined in the future. The keyword "forbidden" indicates "reserved" and in addition
    indicates that the provision will never be defined in the future.</p>

  ${implConformance}

  <p>Unless otherwise specified, the order of precedence of the types of normative information in
    this document shall be as follows: Normative prose shall be the authoritative definition;
    tables shall be next; then formal languages; then figures; and then any other language forms.</p>
    `;

  } else {

    sec.innerHTML = `
    <h2>Conformance</h2>
    <p>This Engineering Guideline is purely informative and meant to provide tutorial information to the 
    industry. It does not impose Conformance Requirements and avoids the use of Conformance Notation.</p>

    <p>Engineering Guidelines frequently provide tutorial information about a Standard or Recommended Practice
    and when this is the case, the user should rely on the Standards and Recommended Practices referenced for
    interoperability information.</p>
    `;

  }

}

const SMPTE_FOREWORD_ID = "sec-foreword";

const SMPTE_AG_FOREWORD_BOILERPLATE = `<h2>Foreword</h2>
<p>The Society of Motion Picture and Television Engineers (SMPTE) is an
internationally-recognized standards developing organization. Headquartered
and incorporated in the United States of America, SMPTE has members in over
80 countries on six continents. SMPTE’s Engineering Documents, including
Standards, Recommended Practices, and Engineering Guidelines, are prepared
by SMPTE’s Technology Committees. Participation in these Committees is open
to all with a bona fide interest in their work. SMPTE cooperates closely
with other standards-developing organizations, including ISO, IEC and ITU.
SMPTE Engineering Documents are drafted in accordance with the rules given
in its Standards Operations Manual. For more information, please visit
<a href="https://www.smpte.org">www.smpte.org</a>.</p>

<p>This Standards Administrative Guideline forms an adjunct to the use and
interpretation of the SMPTE Standards Operations Manual. In the event of a
conflict, the Operations Manual shall prevail.</p>
`

const SMPTE_DOC_FOREWORD_BOILERPLATE = `<h2>Foreword</h2>
<p>The Society of Motion Picture and Television Engineers (SMPTE) is an
internationally-recognized standards developing organization. Headquartered
and incorporated in the United States of America, SMPTE has members in over
80 countries on six continents. SMPTE’s Engineering Documents, including
Standards, Recommended Practices, and Engineering Guidelines, are prepared
by SMPTE’s Technology Committees. Participation in these Committees is open
to all with a bona fide interest in their work. SMPTE cooperates closely
with other standards-developing organizations, including ISO, IEC and ITU.
SMPTE Engineering Documents are drafted in accordance with the rules given
in its Standards Operations Manual.</p> For more information, please visit
<a href="https://www.smpte.org">www.smpte.org</a>.</p>

<p>At the time of publication no notice had been received by SMPTE claiming patent
rights essential to the implementation of this Engineering Document.
However, attention is drawn to the possibility that some of the elements of this document may be the subject of patent rights.
SMPTE shall not be held responsible for identifying any or all such patent rights.</p>

{{authorProse}}
`

const SMPTE_DRAFT_WARNING = `
<div id="sec-draft-warning">
<strong>Warning:</strong> This document is an unpublished work under development and shall not be referred
to as a SMPTE Standard,
Recommended Practice, or Engineering Guideline. It is distributed for review and comment; distribution does not constitute
publication. Recipients of this document are strongly encouraged to submit, with their comments, notification of any relevant
patent rights of which they are aware and to provide supporting documentation.
</div>
`

function insertForeword(docMetadata) {
  let sec = document.getElementById(SMPTE_FOREWORD_ID);

  if (docMetadata.pubType == smpte.OM_PUBTYPE) {
    if (sec !== null)
      logger_.error("OM must not contain a Foreword section.");
    return;
  }

  if (sec === null && docMetadata.pubType != smpte.OM_PUBTYPE) {
    sec = document.createElement("section");
    sec.id = SMPTE_FOREWORD_ID;
    document.body.insertBefore(sec, document.getElementById(SMPTE_FRONT_MATTER_ID).nextSibling);
  }

  sec.classList.add("unnumbered");

  let authorProse = sec.innerHTML;

  if (smpte.ENGDOC_PUBTYPES.has(docMetadata.pubType)) {
    authorProse = `<p>This document was prepared by Technology Committee ${docMetadata.pubTC}.</p>` + authorProse;
  }

  if (docMetadata.pubType == smpte.AG_PUBTYPE) {
    if (authorProse.trim().length > 0)
      logger_.error("AGs cannot contain author-specified Foreword prose.")
    sec.innerHTML = fillTemplate(SMPTE_AG_FOREWORD_BOILERPLATE, {copyrightYear: (new Date()).getFullYear()});
  } else {
    sec.innerHTML = fillTemplate(SMPTE_DOC_FOREWORD_BOILERPLATE, {authorProse: authorProse, copyrightYear: (new Date()).getFullYear()});
  }

}

function addHeadingLinks(docMetadata) {
  const headings = document.querySelectorAll("h2, h3, h4, h5, h6");

  for(const heading of headings) {
    const section = heading.parentElement;

    if (!section.hasAttribute('id'))
      continue;

    const headingLink = document.createElement("a");
    headingLink.className = "heading-link";
    headingLink.href = `#${section.id}`;
    headingLink.innerHTML = "🔗";

    heading.appendChild(headingLink);
  }
}

function numberSections(element, curHeadingNumber) {
  let headingCounter = 1;
  let annexCounter = "A".charCodeAt();

  for (let child of element.children) {

    if (child.localName !== "section")
      continue;

    if (child.classList.contains("unnumbered"))
      continue;

    if (child.firstElementChild === null)
      continue;

    const heading = child.firstElementChild;

    let numText = curHeadingNumber;

    if (curHeadingNumber.length !== 0) {
      numText += ".";
    }

    const headingNum = document.createElement("span");
    headingNum.className = "heading-number";

    const headingLabel = document.createElement("span");
    headingLabel.className = "heading-label";

    if (child.classList.contains("annex")) {
      numText = String.fromCharCode(annexCounter++);
      headingNum.innerText = numText;

      headingLabel.appendChild(document.createTextNode("Annex "));
      headingLabel.appendChild(headingNum);
      heading.insertBefore(document.createElement("br"), heading.firstChild);

    } else {
      numText += headingCounter.toString();
      headingCounter++;
      headingNum.innerText = numText;

      headingLabel.appendChild(headingNum);
      headingLabel.appendChild(document.createTextNode(" "));
      heading.insertBefore(headingLabel, heading.firstChild);
    }

    heading.insertBefore(headingLabel, heading.firstChild);
    numberSections(child, numText);
  }

}

function numberTables() {
  let counter = 1;

  for (let section of document.querySelectorAll("body > section")) {

    let numPrefix = "";

    if (section.classList.contains("annex")) {
      counter = 1;
      numPrefix = section.querySelector(".heading-number").innerText + ".";
    }

    for (let table of section.querySelectorAll("table")) {

      if (!table.id) {
        logger_.error(`Table is missing an id`, table);
        continue;
      }

      const caption = table.querySelector("caption");

      if (caption === null) {
        logger_.error("Table is missing a caption", table);
        continue;
      }

      const headingLabel = document.createElement("span");
      headingLabel.className = "heading-label";

      const headingNumberElement = document.createElement("span");
      headingNumberElement.className = "heading-number";
      headingNumberElement.innerText = numPrefix + counter;

      headingLabel.appendChild(document.createTextNode("Table "));
      headingLabel.appendChild(headingNumberElement);
      headingLabel.appendChild(document.createTextNode(" –⁠ "));


      caption.insertBefore(headingLabel, caption.firstChild);

      counter++;
    }

  }
}

function numberFigures() {
  let counter = 1;

  for (let section of document.querySelectorAll("body > section")) {

    let numPrefix = "";

    if (section.classList.contains("annex")) {
      counter = 1;
      numPrefix = section.querySelector(".heading-number").innerText + ".";
    }

    for (let figure of section.querySelectorAll("figure")) {

      const figcaption = figure.querySelector("figcaption");

      if (figcaption === null) {
        logger_.error("Figure is missing a caption", figure);
        continue;
      }

      const headingLabel = document.createElement("span");
      headingLabel.className = "heading-label";

      const headingNumberElement = document.createElement("span");
      headingNumberElement.className = "heading-number";
      headingNumberElement.innerText = numPrefix + counter;

      headingLabel.appendChild(document.createTextNode("Figure "));
      headingLabel.appendChild(headingNumberElement);
      headingLabel.appendChild(document.createTextNode(" –⁠ "));


      figcaption.insertBefore(headingLabel, figcaption.firstChild);

      counter++;
    }

  }
}

function numberFormulae() {
  let counter = 1;

  for (let section of document.querySelectorAll("body > section")) {

    let numPrefix = "";

    if (section.classList.contains("annex")) {
      counter = 1;
      numPrefix = section.querySelector(".heading-number").innerText + ".";
    }

    for (let formula of section.querySelectorAll("div[class=formula]")) {

      const eqLabel = document.createElement("span");
      eqLabel.className = "heading-label";

      const headingNumberElement = document.createElement("span");
      headingNumberElement.className = "heading-number";
      headingNumberElement.innerText = "(" + numPrefix + counter + ")";

      eqLabel.appendChild(headingNumberElement);

      formula.appendChild(eqLabel);

      counter++;
    }

  }
}

function numberNotesToEntry(internalTermsSection) {
  let counter = 1;

  for (const child of internalTermsSection.children) {
    if (child.localName === "dt") {
      counter = 1;
      continue;
    }

    if (child.localName !== "dd" || !child.classList.contains("note")) {
      continue;
    }

    const headingLabel = document.createElement("span");
    headingLabel.className = "heading-label";

    const headingNumberElement = document.createElement("span");
    headingNumberElement.className = "heading-number";
    headingNumberElement.innerText = counter++;

    headingLabel.appendChild(document.createTextNode("Note "));
    headingLabel.appendChild(headingNumberElement);
    headingLabel.appendChild(document.createTextNode(" to entry: "));

    child.insertBefore(headingLabel, child.firstChild);
  }
}

function numberSectionNotes(section) {
  let notes = [];

  function _findNotes(e) {
    for (const child of e.children) {
      if (child.localName === "section")
        numberSectionNotes(child);
      else if (child.classList.contains("note"))
        notes.push(child);
      else
        _findNotes(child);
    }
  }

  _findNotes(section);

  let counter = 1;
  for (let note of notes) {
    const headingLabel = document.createElement("span");
    headingLabel.className = "heading-label";

    const headingNumberElement = document.createElement("span");
    headingNumberElement.className = "heading-number";
    if (notes.length !== 1)
      headingNumberElement.innerText = counter++;

    headingLabel.appendChild(document.createTextNode("NOTE "));
    headingLabel.appendChild(headingNumberElement);
    headingLabel.appendChild(document.createTextNode(" —⁠ "));

    note.insertBefore(headingLabel, note.firstChild);
  }
}

function numberNotes() {
  for (const element of document.body.children) {
    if (element.localName !== "section")
      continue;

    if (element.id === "sec-terms-and-definitions") {
      const terms = document.getElementById("terms-int-defs");

      if (terms !== null)
        numberNotesToEntry(terms);
    } else {
      numberSectionNotes(element);
    }
  }
}

function numberExamples() {

  for (let section of document.querySelectorAll("section")) {

    const examples = [];

    function _findExamples(e) {
      for (const child of e.children) {
        if (child.tagName === "SECTION")
          continue;
        if (child.classList.contains("example"))
          examples.push(child);
        _findExamples(child);
      }
    }

    _findExamples(section);

    let counter = 1;
    for (let example of examples) {
      const headingLabel = document.createElement("span");
      headingLabel.className = "heading-label";

      const headingNumberElement = document.createElement("span");
      headingNumberElement.className = "heading-number";
      if (examples.length !== 1)
        headingNumberElement.innerText = counter++;

      headingLabel.appendChild(document.createTextNode("EXAMPLE "));
      headingLabel.appendChild(headingNumberElement);
      headingLabel.appendChild(document.createTextNode(" —⁠ "));

      example.insertBefore(headingLabel, example.firstChild);
    }

  }
}

function _normalizeTerm(term) {
  return term.trim().toLowerCase().replace(/\s+/g," ");
}

function _getSectionReference(target) {
  const targetNumber = target.querySelector(".heading-number").innerText;

  if (target.parentElement.tagName === "BODY" || target.parentElement.classList.contains("annex")) {
    if (target.classList.contains("annex"))
      return "Annex "+ targetNumber;
    else
      return "Clause "+ targetNumber;
  }

  return targetNumber;
}

function resolveLinks(docMetadata) {
  /* collect definitions */

  const dfns = document.getElementsByTagName("dfn");

  const definitions = new Map();

  for (const dfn of dfns) {

    const baseTerm = _normalizeTerm(dfn.textContent);

    if (baseTerm.length == 0) {
      logger_.error("Missing term in definition", dfn);
      continue;
    }

    const terms = new Set();

    terms.add(baseTerm);

    if (baseTerm.slice(-1) !== "s")
      terms.add(baseTerm + "s");

    if (dfn.hasAttribute("data-lt")) {
      dfn.getAttribute("data-lt").split("|").forEach(t => terms.add(_normalizeTerm(t)));
    }

    const termExists = function() {
      for(const term of terms.values())
        if (definitions.has(term))
          return true;
      return false;
    }();

    if (termExists) {
      logger_.error("Duplicate definition", dfn);
      continue;
    }

    if (dfn.id === "") {
      const id = baseTerm.replace(/\s/g,"-");

      if (id.match(/[a-zA-Z]\w*/) === null) {
        logger_.error("Cannot auto-generate id", dfn);
        continue;
      }

      dfn.id = "dfn-" + id;
    }

    for(let term of terms) {
      definitions.set(term, dfn);
    }

  }

  const anchors = document.getElementsByTagName("a");

  for (const anchor of anchors) {

    const contents = anchor.textContent;
    const specifiedHref = anchor.getAttribute('href') || "";

    if (specifiedHref === "") {

      if (contents.match(/^[a-z]+:/)) {

        /* process URLs */

        anchor.href = anchor.textContent;
        anchor.classList.add("ext-ref");

      } else if (contents === "") {

        anchor.innerText = "?????";
        logger_.error(`An anchor must either reference a definition (non-empty contents) or link to a resource (non-empty href attribute).`, anchor);

      } else {
        /* process definitions */

        const term = _normalizeTerm(anchor.textContent);

        if (! definitions.has(term)) {
          logger_.error(`No definition for ${term} was provided`, anchor);
        } else {
          anchor.href = "#" + definitions.get(term).id;
          anchor.classList.add("dfn-ref");
        }

      }

    } else if (specifiedHref[0] == "#") {

      /* process fragments */

      const target_id = specifiedHref.substring(1);

      let target = document.getElementById(target_id);

      if (! target) {
        logger_.error("Anchor points to non-existent href", anchor);
        anchor.innerText = "????";
        continue
      }

      if (target.localName === "cite") {
        anchor.innerText = target.innerText;

      } else if (target.localName === "table") {
        anchor.innerText = "Table " + target.querySelector(".heading-number").innerText;

      } else if (target.localName === "figure") {
        anchor.innerText = "Figure " + target.querySelector(".heading-number").innerText

      } else if (target.localName === "div" && target.className === "formula") {
        anchor.innerText = "Formula " + target.querySelector(".heading-number").innerText

      } else if (target.className === "note") {
        let parentSection = target.closest("section");

        if (parentSection) {
          let t = _getSectionReference(parentSection) + ", Note";
          let n = target.querySelector(".heading-number").innerText;
          if (n.length > 0) {
            t += " " + n;
          }
          anchor.innerText = t;
        }

      } else if (target.className === "example") {
        let parentSection = target.closest("section");

        if (parentSection) {
          let t = _getSectionReference(parentSection) + ", Example";
          let n = target.querySelector(".heading-number").innerText;
          if (n.length > 0) {
            t += " " + n;
          }
          anchor.innerText = t;
        }

      } else if (target.localName === "section") {

        anchor.innerText = _getSectionReference(target);

      } else if (target.parentElement.parentElement.parentElement.id === "sec-elements") {
        /* element */

        anchor.innerText = "Element " + target.parentElement.querySelector(".heading-number").innerText;

      } else {
        logger_.error("Anchor points to ambiguous href", anchor)
        anchor.innerText = "????";
      }

    }
  }
}

const CONFORMANCE_RE = /\s*(shall)|(should)|(may)\s/i;

function checkConformanceNotation(docMetadata) {
  if (docMetadata.pubType !== smpte.EG_PUBTYPE)
    return;

  for (let section of document.querySelectorAll("section:not(:has(section))")) {

    const id = section.id;

    if (id === SMPTE_FRONT_MATTER_ID || id === SMPTE_FOREWORD_ID || id === SMPTE_CONFORMANCE_ID)
      continue;

    const r = CONFORMANCE_RE.exec(section.innerText);

    if (r !== null)
      logger_.error(`An EG must not contain the conformance notation ${r[1]}`, section);

  };
}

function asyncInsertSnippets() {
  return Promise.all(Array.from(
    document.querySelectorAll("pre[data-include]"),
    (e) => {
      asyncFetchLocal(e.getAttribute("data-include"))
        .then(data => e.textContent = data)
        .catch(err => logError("Cannot fetch: " + err));
    }
  ));
}

function formatTermsAndDefinitions(docMetadata) {
  const section = document.getElementById("terms-int-defs");

  if (section === null)
    return;

  for (const element of section.children) {
    if (element.localName === "dd" &&
        element.childNodes.length === 1 &&
        element.firstChild.nodeType === Node.ELEMENT_NODE &&
        element.firstChild.localName === "a") {
      const anchor = element.firstChild;
      element.classList.add("term-source");
      element.insertBefore(document.createTextNode("[SOURCE: "), anchor);
      element.insertBefore(document.createTextNode("]"), anchor.nextSibling);
    }
  }
}

function insertIconLink() {
  const icoLink = document.createElement("link");

  icoLink.type = "image/png";
  icoLink.rel = "icon";
  icoLink.href = resolveScriptRelativePath("static/smpte-icon.png");

  document.head.insertBefore(icoLink, null);
}

async function render() {
  const asyncFunctions = [];

  let docMetadata = loadDocMetadata();

  insertIconLink();
  checkConformanceNotation(docMetadata);
  insertFrontMatter(docMetadata);
  insertForeword(docMetadata);
  insertIntroduction(docMetadata);
  insertScope(docMetadata);
  insertConformance(docMetadata);
  insertNormativeReferences(docMetadata);
  insertTermsAndDefinitions(docMetadata);

  insertElementsAnnex(docMetadata);
  insertBibliography(docMetadata);

  formatTermsAndDefinitions(docMetadata);

  numberSections(document.body, "");
  numberTables();
  numberFigures();
  numberFormulae();
  numberNotes();
  numberExamples();
  resolveLinks(docMetadata);
  insertTOC(docMetadata);
  addHeadingLinks(docMetadata);

  asyncFunctions.push(asyncAddStylesheet(resolveScriptRelativePath("css/smpte.css")));

  if (docMetadata.pubState === smpte.PUB_STATE_DRAFT)
    asyncFunctions.push(asyncAddStylesheet(resolveScriptRelativePath("css/smpte-draft.css")));

  asyncFunctions.push(asyncInsertSnippets());

  /* debug print version */
  if (docMetadata.media === "print") {
    let pagedJS = document.createElement("script");
    pagedJS.setAttribute("src", "https://unpkg.com/pagedjs/dist/paged.polyfill.js");
    pagedJS.id = "paged-js-script";
    document.head.appendChild(pagedJS);
  }

  return Promise.all(asyncFunctions);
}

window._smpteRenderComplete = false;

document.addEventListener('DOMContentLoaded', async () => {
   try {
    smpteValidate(window.document, logger_);
    await render();
    window._smpteRenderComplete = true;
  } catch (e) {
    logger_.error(e);
  }

  if (logger_.hasError()) {

    asyncAddStylesheet(resolveScriptRelativePath("css/smpte-errors.css"));

    const eventList = document.createElement('ol');
    eventList.id = "event-list";

    for (const event of logger_.errorList()) {
      const li = document.createElement('li');
      li.innerHTML = event.msg + (event.elementId === null ? "" : ` (<a href='#${event.elementId}'>link</a>)`);
      eventList.appendChild(li);
    }

    document.body.appendChild(eventList);

  }

});


window.smpteLogger = logger_;
