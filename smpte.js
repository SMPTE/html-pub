/*
Copyright 2022 Pierre-Anthony Lemieux

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

_SCRIPT_PATH = (new URL(document.currentScript.src)).pathname;

function resolveScriptRelativePath(path) {
  return _SCRIPT_PATH.split("/").slice(0, -1).concat([path]).join("/");
}

function resolveStaticResourcePath(resourceName) {
  return resolveScriptRelativePath(`static/${resourceName}`);
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

function getHeadMetadata(paramName) {
  let e = document.querySelector("head meta[itemprop='" + paramName + "']");

  if (e === null) return null;

  return e.getAttribute("content");
}

function loadDocMetadata() {
  let metadata = {};

  let params = (new URL(document.location)).searchParams;

  metadata.pubTitle = document.title;

  metadata.pubType = params.get("pubType") || getHeadMetadata("pubType");
  if (["OM", "AG"].indexOf(metadata.pubType) === -1)
    logEvent(`Unknown publication type: ${metadata.pubType}`);

  metadata.pubState = params.get("pubState") || getHeadMetadata("pubState");
  metadata.pubNumber = params.get("pubNumber") || getHeadMetadata("pubNumber");
  metadata.pubDateTime = params.get("pubDateTime") || getHeadMetadata("pubDateTime");
  metadata.effectiveDateTime = params.get("effectiveDateTime") || getHeadMetadata("effectiveDateTime");

  if (["pub", "draft"].indexOf(metadata.pubState) === -1)
    logEvent(`Unknown publication status: ${metadata.pubState}`);

  return metadata;
}

const SMPTE_FRONT_MATTER_BOILERPLATE = `<div id="doc-designator" itemscope="itemscope" itemtype="http://purl.org/dc/elements/1.1/">
<span itemprop="publisher">SMPTE</span> <span id="doc-type">{{pubType}}</span> <span id="doc-number">{{pubNumber}}</span></div>
<img id="smpte-logo" src="{{smpteLogoURL}}" alt="SMPTE logo" />
<div id="long-doc-type">{{longDocType}}</div>
<h1>{{pubTitle}}</h1>
<div id="doc-status">{{publicationState}} - {{actualPubDateTime}}</div>
<hr />`

const SMPTE_PUB_OM_FRONT_MATTER_BOILERPLATE = `<div id="doc-designator" itemscope="itemscope" itemtype="http://purl.org/dc/elements/1.1/">
<span itemprop="publisher">SMPTE</span> <span id="doc-type">{{pubType}}</span> <span id="doc-number">{{pubNumber}}</span></div>
<img id="smpte-logo" src="{{smpteLogoURL}}" alt="SMPTE logo" />
<div id="long-doc-type">{{longDocType}}</div>
<h1>{{pubTitle}}</h1>
<div id="doc-status">{{publicationState}}: {{actualPubDateTime}}</div>
<div id="doc-effective">Effective date: {{effectiveDateTime}}</div>
<hr />`

const SMPTE_FRONT_MATTER_ID = "sec-front-matter";

function insertFrontMatter(docMetadata) {


  let sec = document.getElementById(SMPTE_FRONT_MATTER_ID);

  if (sec !== null) {
    throw "Front matter section already exists."
  }

  const longDocType = {
    "AG": "Administrative Guideline",
    "OM": "Operations Manual"
  }[docMetadata.pubType];

  if (docMetadata.pubState == "draft")
    asyncAddStylesheet(resolveScriptRelativePath("css/smpte-draft.css"));

  const actualPubDateTime = (() => {
    if (docMetadata.pubDateTime === null || docMetadata.pubState == "draft")
      return new Date();

    return docMetadata.pubDateTime;
  })();

  let publicationState;

  switch (docMetadata.pubState) {
    case "draft":
      publicationState = "Draft";
      break;
    case "pub":
      if (docMetadata.pubType === "OM")
        publicationState = "Approved by Board of Governors";
      else
        publicationState = "Published";
      break
    default:
      publicationState = "XXX";
  }

  sec = document.createElement("section");
  sec.className = "unnumbered";
  sec.id = SMPTE_FRONT_MATTER_ID;

  sec.innerHTML = fillTemplate(
    docMetadata.pubState === "pub" && docMetadata.pubType === "OM" ? SMPTE_PUB_OM_FRONT_MATTER_BOILERPLATE : SMPTE_FRONT_MATTER_BOILERPLATE,
    {
      longDocType: longDocType,
      publicationState: publicationState,
      smpteLogoURL: resolveStaticResourcePath("smpte-logo.png"),
      actualPubDateTime: actualPubDateTime,
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

      if (!secId || ['sec-front-matter', 'sec-toc'].includes(secId))
        continue;

      const heading = subSection.firstElementChild;

      if (!heading)
        continue;

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
    logEvent("Introduction section has multiple headings.");
    return;
  }

  h2.innerText = "Introduction";
}

const SMPTE_SCOPE_ID = "sec-scope";

function insertScope(docMetadata) {
  const sec = document.getElementById(SMPTE_SCOPE_ID);

  if (sec === null) {
    logEvent("Missing required scope section.");
    return;
  }

  let h2 = sec.getElementsByTagName("h2");

  if (h2.length == 0) {
    h2 = document.createElement("h2");
    sec.insertBefore(h2, sec.firstChild);
  } else if (h2.length == 1) {
    h2 = h2[0];
  } else {
    logEvent("Scope section has multiple headings.");
    return;
  }

  h2.innerText = "Scope";
}


const SMPTE_NORM_REFS_ID = "sec-normative-references";

function insertNormativeReferences(docMetadata) {
  let sec = document.getElementById(SMPTE_NORM_REFS_ID);

  if (docMetadata.pubType == "OM") {
    if (sec !== null)
      logEvent("OM must not contain normative references.");
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
    logEvent("Normative reference section has multiple headings.");
    return;
  }

  h2.innerText = "Normative references";
}

const SMPTE_TERMS_ID = "sec-terms-and-definitions";

function insertTermsAndDefinitions(docMetadata) {
  let sec = document.getElementById(SMPTE_TERMS_ID);

  if (docMetadata.pubType == "OM") {
    if (sec !== null)
      logEvent("OM must not contain terms and definitions.");
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
    logEvent("Terms and definitions section has multiple headings.");
    return;
  }

  h2.innerText = "Terms and definitions";
}

function insertBibliography(docMetadata) {
  const sec = document.getElementById("sec-bibliography");

  if (sec === null)
    return;

  if (sec.childElementCount === 0) {
    logEvent(`No informational references listed, Bibliography section must be removed`)
  }

  sec.classList.add("unnumbered");

  let h2 = sec.getElementsByTagName("h2");

  if (h2.length == 0) {
    h2 = document.createElement("h2");
    sec.insertBefore(h2, sec.firstChild);
  } else if (h2.length == 1) {
    h2 = h2[0];
  } else {
    logEvent("Bibliography section has multiple headings.");
    return;
  }

  h2.innerText = "Bibliography";
}

const SMPTE_ELEMENTS_ID = "sec-elements";

function insertElementsAnnex(docMetadata) {
  const sec = document.getElementById(SMPTE_ELEMENTS_ID);

  if (sec === null)
    return;

  if (sec.children.length !== 1 || sec.firstElementChild.tagName !== "OL") {
    logEvent(`Elements section must contain a single <ol> element.`);
    return;
  }

  sec.classList.add("annex");

  const intro = document.createElement("p");
  intro.innerText = "This annex lists non-prose elements of this document."
  sec.insertBefore(intro, sec.firstChild);

  const h2 = document.createElement("h2");
  h2.innerText = "Additional elements";
  sec.insertBefore(h2, sec.firstChild);

  let counter = "a".charCodeAt();

  for(const e of sec.querySelectorAll("li > a")) {

    const headingNum = document.createElement("span");
    headingNum.className = "heading-number";
    headingNum.innerText = String.fromCharCode(counter++);

    const headingLabel = document.createElement("span");
    headingLabel.className = "heading-label";
    headingLabel.appendChild(headingNum);
    headingLabel.appendChild(document.createTextNode("."));

    e.parentElement.insertBefore(headingLabel, e);

    e.innerText = "(link)";

    if (e.title) {
      e.parentElement.insertBefore(document.createTextNode(" " + e.title + " "), e);
    } else {
      logEvent("All links listed in the Elements Annex must have a title attribute.")
    }

  }
}

const SMPTE_CONFORMANCE_ID = "sec-conformance";

function insertConformance(docMetadata) {

  let sec = document.getElementById(SMPTE_CONFORMANCE_ID);

  if (docMetadata.pubType == "OM") {
    if (sec !== null)
      logEvent("OM must not contain a Conformance section.");
    return;
  }

  if (sec === null) {
    sec = document.createElement("section");
    sec.id = SMPTE_CONFORMANCE_ID;

    document.body.insertBefore(sec, document.getElementById(SMPTE_SCOPE_ID).nextSibling);
  }

  let implConformance = "";

  if (docMetadata.pubType !== "AG") {

    if (sec.innerText.trim().length === 0) {

      implConformance = `<p>A conformant implementation according to this document is one that
      includes all mandatory provisions ("shall") and, if implemented, all recommended provisions
      ("should") as described. A conformant implementation need not implement
      optional provisions ("may") and need not implement them as described.</p>`;

    } else {

      implConformance = sec.innerText.innerHTML;

    }

  } else if (sec.innerText.trim().length !== 0) {
    logEvent("Conformance section not used in AGs.");
  }

  sec.innerHTML = `
  <h2>Conformance</h2>
  <p>Normative text is text that describes elements of the design that are indispensable or contains the
   conformance language keywords: "shall", "should", or "may". Informative text is text that is potentially
    helpful to the user, but not indispensable, and can be removed, changed, or added editorially without
     affecting interoperability. Informative text does not contain any conformance keywords. </p>
     
  <p>All text in this document is, by default, normative, except: the Introduction, any section explicitly
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
  Tables shall be next; then formal languages; then figures; and then any other language forms.</p>
  `;
}

const SMPTE_FOREWORD_ID = "sec-foreword";

SMPTE_AG_FOREWORD_BOILERPLATE = `<h2>Foreword</h2>
<p><a href="https://www.smpte.org">SMPTE (the Society of
Motion Picture and Television Engineers)</a> is an
internationally-recognized standards developing organization. Headquartered
and incorporated in the United States of America, SMPTE has members in over
80 countries on six continents. SMPTE’s Engineering Documents, including
Standards, Recommended Practices, and Engineering Guidelines, are prepared
by SMPTE’s Technology Committees. Participation in these Committees is open
to all with a bona fide interest in their work. SMPTE cooperates closely
with other standards-developing organizations, including ISO, IEC and ITU.
SMPTE Engineering Documents are drafted in accordance with the rules given
in its Standards Operations Manual.</p>

<p>This Standards Administrative Guideline forms an adjunct to the use and
interpretation of the SMPTE Standards Operations Manual. In the event of a
conflict, the Operations Manual shall prevail.</p>

<p id="copyright-text">Copyright © The Society of Motion Picture and
Television Engineers.</p>`

SMPTE_DOC_FOREWORD_BOILERPLATE = `<h2>Foreword</h2>
<p><a href="https://www.smpte.org">SMPTE (the Society of
Motion Picture and Television Engineers)</a> is an
internationally-recognized standards developing organization. Headquartered
and incorporated in the United States of America, SMPTE has members in over
80 countries on six continents. SMPTE’s Engineering Documents, including
Standards, Recommended Practices, and Engineering Guidelines, are prepared
by SMPTE’s Technology Committees. Participation in these Committees is open
to all with a bona fide interest in their work. SMPTE cooperates closely
with other standards-developing organizations, including ISO, IEC and ITU.
SMPTE Engineering Documents are drafted in accordance with the rules given
in its Standards Operations Manual.</p>

{{authorProse}}

<p id="copyright-text">Copyright © The Society of Motion Picture and
Television Engineers.</p>`

function insertForeword(docMetadata) {
  let sec = document.getElementById(SMPTE_FOREWORD_ID);

  if (docMetadata.pubType == "OM") {
    if (sec !== null)
      logEvent("OM must not contain a Foreword section.");
    return;
  }

  if (sec === null && docMetadata.pubType != "OM") {
    sec = document.createElement("section");
    sec.id = SMPTE_FOREWORD_ID;
    document.body.insertBefore(sec, document.getElementById(SMPTE_FRONT_MATTER_ID).nextSibling);
  }

  sec.classList.add("unnumbered");

  authorProse = sec.innerHTML;

  if (docMetadata.pubType == "AG") {
    if (authorProse.trim().length > 0)
      logEvent("AGs cannot contain author-specified Foreword prose.")
    sec.innerHTML = SMPTE_AG_FOREWORD_BOILERPLATE;
  } else {
    sec.innerHTML = fillTemplate(SMPTE_AG_FOREWORD_BOILERPLATE, {authorProse: authorProse});
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
      headingLabel.appendChild(document.createElement("br"));
    } else {
      numText += headingCounter.toString();
      headingCounter++;
      headingNum.innerText = numText;
      
      headingLabel.appendChild(headingNum);
      headingLabel.appendChild(document.createTextNode(" "));
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

      const caption = table.querySelector("caption");
  
      if (caption === null) {
        logEvent("Table is missing a caption", table);
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
        logEvent("Figure is missing a caption", figure);
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

function numberNotes() {

  for (let section of document.querySelectorAll("section")) {

    let notes = [];

    function _findNotes(e) {
      for (const child of e.children) {
        if (child.tagName === "SECTION")
          continue;
        if (child.classList.contains("note"))
          notes.push(child);
          _findNotes(child);
      }
    }

    _findNotes(section);

    if (notes.length > 1) {
      let counter = 1;
      for (let note of notes) {
        note.insertBefore(document.createTextNode(`NOTE ${counter++} — `), note.firstChild);
      }

    } else if (notes.length === 1) {
      notes[0].insertBefore(document.createTextNode(`NOTE — `), notes[0].firstChild);
    }

  }
}

function numberElements() {
  let counter = 1;

  for (let e of document.querySelectorAll("#sec-elements li")) {

    let numPrefix = "";

    if (section.classList.contains("annex")) {
      counter = 1;
      numPrefix = section.querySelector(".heading-number").innerText + ".";
    }

    for (let figure of section.querySelectorAll("figure")) {

      const figcaption = figure.querySelector("figcaption");
  
      if (figcaption === null) {
        logEvent(`Figure is missing a caption`);
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

    if (examples.length > 1) {
      let counter = 1;
      for (let example of examples)
        example.insertBefore(document.createTextNode(`EXAMPLE ${counter++} — `), example.firstChild);

    } else if (examples.length === 1) {
      examples[0].insertBefore(document.createTextNode(`EXAMPLE — `), examples[0].firstChild);
    }

  }
}

function _normalizeTerm(term) {
  return term.trim().toLowerCase().replace(/\s+/g," ");
}

function resolveLinks(docMetadata) {
  /* collect definitions */

  const dfns = document.getElementsByTagName("dfn");

  const definitions = new Map();

  for (const dfn of dfns) {

    const baseTerm = _normalizeTerm(dfn.textContent);

    if (baseTerm.length == 0) {
      logEvent("Missing term in definition", dfn);
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
      logEvent("Duplicate definition", dfn);
      continue;
    }

    if (dfn.id === "") {
      const id = baseTerm.replace(/\s/g,"-");

      if (id.match(/[a-zA-Z]\w*/) === null) {
        logEvent("Cannot auto-generate id", dfn);
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

      } else {

        /* process definitions */

        const term = _normalizeTerm(anchor.textContent);

        if (! definitions.has(term)) {
          logEvent("Unresolved link", anchor);
        } else {
          anchor.href = "#" + definitions.get(term).id;
          anchor.classList.add("dfn-ref");
        }

      }

    } else if (specifiedHref.match(/^[a-z]+:/)) {

      /* absolute URLs */

    } else if (specifiedHref[0] == "#") {

      /* process fragments */

      const target_id = specifiedHref.substring(1);

      let target = document.getElementById(target_id);

      if (! target) {
        logEvent("Anchor points to non-existent href", anchor);
        anchor.innerText = "????";
        continue
      }

      if (target.localName === "cite") {
        anchor.innerText = target.innerText;

      } else if (target.localName === "table") {
        anchor.innerText = "Table " + target.querySelector(".heading-number").innerText;

      } else if (target.localName === "figure") {
        anchor.innerText = "Figure " + target.querySelector(".heading-number").innerText
        
      } else if (target.localName === "section") {

        const targetNumber = target.querySelector(".heading-number").innerText;

        if (target.parentElement.tagName === "BODY" || target.parentElement.classList.contains("annex")) {
          if (target.classList.contains("annex"))
            anchor.innerText = "Annex "+ targetNumber;
          else
            anchor.innerText = "Clause "+ targetNumber;
        } else {
          anchor.innerText = targetNumber;
        }

      } else if (target.parentElement.parentElement.parentElement.id === "sec-elements") {
        /* element */

        anchor.innerText = "Element " + target.parentElement.querySelector(".heading-number").innerText;

      } else {
        logEvent("Anchor points to ambiguous href", anchor)
        anchor.innerText = "????";
      }

    } else if (contents !== "") {

      /* nothing to do */
      
    } else {

      logEvent("Empty anchor", anchor);

    }
  }
}

function insertSnippets() {
  Array.from(
    document.querySelectorAll("pre[data-include]"),
    (e) => {
      asyncFetchLocal(e.getAttribute("data-include"))
        .then(data => e.textContent = data)
        .catch(err => logError("Cannot fetch: " + err));
    }
  );
}

function render() {
  let docMetadata = loadDocMetadata();

  insertSnippets();

  insertFrontMatter(docMetadata);
  insertForeword(docMetadata);
  insertIntroduction(docMetadata);
  insertScope(docMetadata);
  insertConformance(docMetadata);
  insertNormativeReferences(docMetadata);
  insertTermsAndDefinitions(docMetadata);

  insertElementsAnnex(docMetadata);
  insertBibliography(docMetadata);
  numberSections(document.body, "");
  numberTables();
  numberFigures();
  numberNotes();
  numberExamples();
  resolveLinks(docMetadata);
  insertTOC(docMetadata);
}

var _events = [];

function logEvent(msg, element) {
  if (element !== undefined) {
    if (!element.hasAttribute("id") || !element.id) {
      element.id = Math.floor(Math.random() * 1000000000);
    }
    element.classList.add("invalid-tag");
  }
  _events.push({msg: msg, elementId: element === undefined ? null : element.id});
}

function listEvents() {
  return _events;
}

document.addEventListener('DOMContentLoaded', () => {
  try {
    asyncAddStylesheet(resolveScriptRelativePath("css/smpte.css"));
    render();
  } catch (e) {
    logEvent(e);
  }

  if (listEvents().length > 0) {

    asyncAddStylesheet(resolveScriptRelativePath("css/smpte-errors.css"));

    const eventList = document.createElement('ol');
    eventList.id = "event-list";

    for (const event of listEvents()) {
      const li = document.createElement('li');
      li.innerHTML = event.msg + (event.elementId === null ? "" : ` (<a href='#${event.elementId}'>link</a>)`);
      eventList.appendChild(li);
      console.error(event);
    }

    document.body.appendChild(eventList);

  }

});