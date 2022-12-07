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
    .catch(err => logEvent("Cannot fetch: " + err));
}

function fetchAndInsertTemplate(element, templateURL, kvpairs) {
  return asyncFetchLocal(templateURL)
    .then((data) => {
      if (typeof kvpairs != "undefined")
        for (const field of  Object.keys(kvpairs))
          data = data.replace(`{{${field}}}`, kvpairs[field]);
      element.innerHTML = data;
    })
    .catch(err => logEvent("Cannot fetch: " + err));
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
  metadata.pubState = params.get("pubState") || getHeadMetadata("pubState");
  metadata.pubNumber = params.get("pubNumber") || getHeadMetadata("pubNumber");
  metadata.pubDateTime = params.get("pubDateTime") || getHeadMetadata("pubDateTime");

  if (["pub", "draft"].indexOf(metadata.pubState) === -1)
    logEvent(`Unknown publication status: ${metadata.pubState}`);

  return metadata;
}


const SMPTE_FRONT_MATTER_ID = "sec-front-matter";

async function insertFrontMatter(docMetadata) {
  const body = document.body;

  if (body === null) {
    throw "Missing body element"
  }

  let sec = document.getElementById(SMPTE_FRONT_MATTER_ID);

  if (sec !== null) {
    throw "Front matter section already exists."
  }

  const longDoctype = { "AG": "Administrative Guideline" }[docMetadata.pubType];

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
      publicationState = "Published";
      break
    default:
      publicationState = "XXX";
  }

  sec = document.createElement("section");
  sec.className = "unnumbered";
  sec.id = SMPTE_FRONT_MATTER_ID;
  body.insertBefore(sec, body.firstChild);

  return fetchAndInsertTemplate(
    sec,
    resolveScriptRelativePath("boilerplate/front-matter.html"),
    {
      pubType: docMetadata.pubType,
      pubNumber: docMetadata.pubNumber,
      smpteLogoURL: resolveStaticResourcePath("smpte-logo.png"),
      longDoctype: longDoctype,
      pubTitle: docMetadata.pubTitle,
      publicationState: publicationState,
      actualPubDateTime: actualPubDateTime
    }
  );

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

async function insertIntroduction(docMetadata) {
  const sec = document.getElementById(SMPTE_INTRODUCTION_ID);

  if (sec === null)
    return;

  sec.className = "unnumbered";

  const h2 = document.createElement("h2");
  h2.innerText = "Introduction";
  sec.insertBefore(h2, sec.firstChild);
}

const SMPTE_SCOPE_ID = "sec-scope";

async function insertScope(docMetadata) {
  const sec = document.getElementById(SMPTE_SCOPE_ID);

  if (sec === null) {
    logEvent("Missing required scope section.");
    return;
  }

  const h2 = document.createElement("h2");
  h2.innerText = "Scope";
  sec.insertBefore(h2, sec.firstChild);
}


const SMPTE_NORM_REFS_ID = "sec-normative-references";

async function insertNormativeReferences(docMetadata) {
  let sec = document.getElementById(SMPTE_NORM_REFS_ID);

  if (sec === null) {
    sec = document.createElement("section");
    sec.id = SMPTE_NORM_REFS_ID;
    document.body.insertBefore(sec, document.getElementById(SMPTE_CONFORMANCE_ID).nextSibling);
  }

  const hasReferences = sec.childElementCount !== 0;

  /* add the heading */

  const h2 = document.createElement("h2");
  h2.innerText = "Normative references";
  sec.insertBefore(h2, sec.firstChild);

  /* add the boilerplate */

  const p = document.createElement("p");
  sec.insertBefore(p, h2.nextSibling);

  if (hasReferences) {
    return fetchAndInsertTemplate(p, resolveScriptRelativePath("boilerplate/normative-refs-some.html"));
  } else {
    return fetchAndInsertTemplate(p, resolveScriptRelativePath("boilerplate/normative-refs-none.html"));
  }

}

const SMPTE_TERMS_ID = "sec-terms-and-definitions";

async function insertTermsAndDefinitions(docMetadata) {
  let sec = document.getElementById(SMPTE_TERMS_ID);

  if (sec === null) {
    sec = document.createElement("section");
    sec.id = SMPTE_TERMS_ID;
    document.body.insertBefore(sec, document.getElementById(SMPTE_NORM_REFS_ID).nextSibling);
  }

  /* add the heading */

  const h2 = document.createElement("h2");
  h2.innerText = "Terms and definitions";
  sec.insertBefore(h2, sec.firstChild);

  /* add the boilerplate */

  const p = document.createElement("p");
  sec.insertBefore(p, h2.nextSibling);

  let defList = document.getElementById("terms-int-defs");
  let extList = document.getElementById("terms-ext-defs");

  if (extList === null && defList !== null) {
    return fetchAndInsertTemplate(p, resolveScriptRelativePath("boilerplate/defs-int-only.html"));
  } else if (extList !== null && defList === null) {
    return fetchAndInsertTemplate(p, resolveScriptRelativePath("boilerplate/defs-ext-only.html"));
  } else if (extList !== null && defList !== null) {
    return fetchAndInsertTemplate(p, resolveScriptRelativePath("boilerplate/defs-ext-int.html"));
  } else {
    return fetchAndInsertTemplate(p, resolveScriptRelativePath("boilerplate/defs-none.html"));
  }

}

async function insertBibliography(docMetadata) {
  const sec = document.getElementById("sec-bibliography");

  if (sec === null)
    return;

  if (sec.childElementCount === 0) {
    logEvent(`No informational references listed, Bibliography section must be removed`)
  }

  sec.classList.add("unnumbered");

  const h2 = document.createElement("h2");
  h2.innerText = "Bibliography";
  sec.insertBefore(h2, sec.firstChild);
}

const SMPTE_CONFORMANCE_ID = "sec-conformance";

async function insertConformance(docMetadata) {

  let sec = document.getElementById(SMPTE_CONFORMANCE_ID);

  if (sec === null) {
    sec = document.createElement("section");
    sec.id = SMPTE_CONFORMANCE_ID;

    document.body.insertBefore(sec, document.getElementById(SMPTE_SCOPE_ID).nextSibling);
  }

  /* replace with boilerplate */

  const userConformance = sec.innerHTML.trim();

  let implConformance = "";

  if (docMetadata.pubType !== "AG") {
    if (userConformance.length === 0)
      implConformance = await asyncFetchLocal(resolveScriptRelativePath("boilerplate/eng-doc-conformance.html"));
    else
      implConformance = userConformance;
  } else if (userConformance.length > 0) {
    logEvent("Conformance section not used in AGs.");
  }

  await fetchAndInsertTemplate(
    sec,
    resolveScriptRelativePath("boilerplate/conformance.html"),
    {implConformance: implConformance}
  );

  /* add heading */

  const h2 = document.createElement("h2");
  h2.innerText = "Conformance";
  sec.insertBefore(h2, sec.firstChild);
}

const SMPTE_FOREWORD_ID = "sec-foreword";

async function insertForeword(docMetadata) {
  let sec = document.getElementById(SMPTE_FOREWORD_ID);

  if (sec === null) {
    sec = document.createElement("section");
    sec.id = SMPTE_FOREWORD_ID;
    document.body.insertBefore(sec, document.getElementById(SMPTE_FRONT_MATTER_ID).nextSibling);
  }
  sec.classList.add("unnumbered");

  /* replace with boilerplate */

  const userText = sec.innerHTML;

  let docSpecificText = "";

  if (docMetadata.pubType === "AG")
    docSpecificText = await asyncFetchLocal(resolveScriptRelativePath("boilerplate/foreword-ag-add.html"));

  await fetchAndInsertTemplate(
    sec,
    resolveScriptRelativePath("boilerplate/foreword.html"),
    {
      userText: userText,
      docSpecificText: docSpecificText
    }
  );

  /* insert heading */

  const h2 = document.createElement("h2");
  h2.innerText = "Foreword";
  sec.insertBefore(h2, sec.firstChild);
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
        logEvent(`Table is missing a caption`);
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

function numberNotes() {

  for (let section of document.querySelectorAll("section")) {

    let notes = [];

    for (const child of section.children)
      if (child.classList.contains("note"))
        notes.push(child);

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
      logEvent(`Missing term in definition`);
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
      logEvent(`Duplicate definition ${baseTerm}`);
      continue;
    }

    if (dfn.id === "") {
      const id = baseTerm.replace(/\s/g,"-");

      if (id.match(/[a-zA-Z]\w*/) === null) {
        logEvent(`Cannot auto-generate id: ${baseTerm}`);
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
          logEvent(`Unresolved link: ${term}`);
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
        logEvent(`anchor points to non-existent #${target_id}`)
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
        anchor.innerText = target.firstElementChild.firstElementChild.innerText.trim();

      } else {
        logEvent(`Anchor points to ambiguous #${target_id}`)
        anchor.innerText = "????";
      }

    } else if (contents !== "") {

      /* nothing to do */
      
    } else {

      logEvent(`Empty anchor`);

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

async function render() {
  let docMetadata = loadDocMetadata();

  insertSnippets();

  await insertFrontMatter(docMetadata);
  await insertForeword(docMetadata);
  await insertIntroduction(docMetadata);
  await insertScope(docMetadata);
  await insertConformance(docMetadata);
  await insertNormativeReferences(docMetadata);
  await insertTermsAndDefinitions(docMetadata);
  await insertBibliography(docMetadata);

  numberSections(document.body, "");
  numberTables();
  numberFigures();
  numberNotes();
  resolveLinks(docMetadata);
  insertTOC(docMetadata);
}

var _events = [];

function logEvent(e) {
  _events.push(e);
}

function listEvents() {
  return _events;
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await asyncAddStylesheet(resolveScriptRelativePath("css/smpte.css"));
    await render();
  } catch (e) {
    logEvent(e);
  }

  if (listEvents().length > 0) {

    await asyncAddStylesheet(resolveScriptRelativePath("css/smpte-errors.css"));

    const eventList = document.createElement('ol');
    eventList.id = "event-list";

    for (const event of listEvents()) {
      const li = document.createElement('li');
      li.innerText = event;
      eventList.appendChild(li);
      console.error(event);
    }

    document.body.appendChild(eventList);

  }

});