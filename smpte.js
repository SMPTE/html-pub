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

  return metadata;
}

function insertFrontMatter(docMetadata) {
  const body = document.body;

  if (body === null) {
    throw "Missing body element"
  }

  const FRONT_MATTER_ID = "sec-front-matter";
  let sec = document.getElementById(FRONT_MATTER_ID);

  if (sec !== null) {
    throw "Front matter section already exists."
  }

  const longDoctype = { "AG": "Administrative Guideline" }[docMetadata.pubType];

  const actualPubDateTime = (() => {
    if (docMetadata.pubDateTime === null)
      return new Date();

    return docMetadata.pubDateTime;
  })();

  sec = document.createElement("section");
  sec.id = FRONT_MATTER_ID;
  sec.innerHTML = `<div id="doc-designator" itemtype="http://purl.org/dc/elements/1.1/">
    <span itemprop="publisher">SMPTE</span> <span id="doc-type">${docMetadata.pubType}</span> <span id="doc-number">${docMetadata.pubNumber}</span></div>
    <img id="smpte-logo" src="tooling/smpte-logo.png" />
    <div id="long-doc-type">${longDoctype}</div>
    <h1>${docMetadata.pubTitle}</h1>
    <div id="doc-status">${docMetadata.pubState} ${actualPubDateTime}</div>
  <hr />
  </section>`;

  body.insertBefore(sec, body.firstChild);
}

function insertTOC(docMetadata) {
  function _processSubSections(parentTOCItem, section, level) {

    if (level == 0) return;

    let subSections = [];

    for (const subSection of section.children) {

      if (subSection.localName !== "section")
        continue;

      if (!subSection.hasAttribute("id"))
        continue;

      const heading = subSection.firstElementChild;

      if (!heading)
        continue;

      const headingNumber = heading.firstElementChild;

      if (!headingNumber || !headingNumber.classList.contains("heading-number"))
        continue;

      subSections.push(subSection);
    }

    if (subSections.length > 0) {

      const tocItem = document.createElement("ol");

      for (const subSection of subSections) {
        let sectionRef = document.createElement("a");
        sectionRef.href = "#" + subSection.id;
        sectionRef.innerHTML = subSection.firstElementChild.innerHTML;

        let sectionItem = document.createElement("li");
        sectionItem.appendChild(sectionRef);

        tocItem.appendChild(sectionItem);

        _processSubSections(sectionItem, subSection, level - 1);

      }

      parentTOCItem.appendChild(tocItem);

    }

  }

  if (! document.body) {
    logEvent("No document body")
    return;
  }

  const scope = document.getElementById("sec-scope");

  if (scope === null) {
    throw "Missing scope element"
  }

  const h2 = document.createElement("h2");
  h2.innerText = "Table of contents";
  h2.className = "unnumbered";

  const toc = document.createElement("section");
  toc.id = "sec-toc";
  toc.appendChild(h2);

  scope.parentElement.insertBefore(toc, scope);

  _processSubSections(toc, document.body, 1);
}

function insertNormativeReferences(docMetadata) {
  const sec = document.getElementById("sec-normative-references");

  if (sec === null)
    return;

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

function insertBibliography(docMetadata) {
  const sec = document.getElementById("sec-bibliographic-references");

  if (sec === null)
    return;

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

function insertConformance(docMetadata) {
  const sec = document.getElementById("sec-conformance");

  if (sec === null) {
    throw "Missing required `conformance` section."
  }

  if (sec.innerText.trim().length !== 0)
    return;

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

<p>A conformant implementation according to this document is one that includes all mandatory provisions ("shall") and,
  if implemented, all recommended provisions ("should") as described. A conformant implementation need not implement
  optional provisions ("may") and need not implement them as described.</p>

<p>Unless otherwise specified, the order of precedence of the types of normative information in
  this document shall be as follows: Normative prose shall be the authoritative definition;
  Tables shall be next; then formal languages; then figures; and then any other language forms.</p>
  `;
}

function insertForeword(docMetadata) {
  let sec = document.getElementById("sec-foreword");

  if (sec === null) {
    throw "Missing required `foreword` section."
  }

  custom_text = sec.innerHTML;

  if (docMetadata.pubType == "AG") {
    desc = `<p>This Standards Administrative Guideline forms an adjunct to the use and
    interpretation of the SMPTE Standards Operations Manual. In the event of a
    conflict, the Operations Manual shall prevail.</p>`;
  } else {
    desc = "";
  }

  sec.innerHTML = `
  <h2>Foreword</h2>
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

    ${desc}

    ${custom_text}

  <p id="copyright-text">Copyright © The Society of Motion Picture and
    Television Engineers.</p>`;
}

function numberSections(element, curHeadingNumber) {
  const unnumberedSectionIds = new Set(["sec-foreword", "sec-front-matter"])

  let headingCounter = 1;
  let annexCounter = "A".charCodeAt();

  for (let child of element.children) {

    if (child.localName !== "section")
      continue;

    if (unnumberedSectionIds.has(child.id))
      continue;

    if (child.classList.contains("unnumbered"))
      continue;

    let numText = curHeadingNumber;

    if (curHeadingNumber.length !== 0) {
      numText += ".";
    }

    const headingNumberElement = document.createElement("span");
    headingNumberElement.className = "heading-number";
    
    if (child.classList.contains("annex")) {
      numText = "Annex " + String.fromCharCode(annexCounter);
      headingNumberElement.innerText = numText + "\n";
      annexCounter++;
    } else {
      numText += headingCounter.toString();
      headingNumberElement.innerText = numText + " ";
      headingCounter++;
    }
    
    child.firstElementChild.insertBefore(headingNumberElement, child.firstElementChild.firstChild);
    numberSections(child, numText);
  }

}

function resolveLinks(docMetadata) {
  const anchors = document.getElementsByTagName("a");

  for (const anchor of anchors) {
    const fragmentIndex = anchor.href.indexOf("#");

    if (fragmentIndex < 0)
      continue;

    const target_id = anchor.href.substring(fragmentIndex + 1);

    let target = document.getElementById(target_id);

    if (! target) {
      logEvent(`anchor points to non-existent #${target_id}`)
      anchor.innerText = "????";
      continue
    }

    if (target.localName === "cite") {
      anchor.innerText = target.innerText;
    } else if (target.localName === "section") {
      anchor.innerText = target.firstElementChild.firstElementChild.innerText.trim();
    } else {
      logEvent(`Anchor points to ambiguous #${target_id}`)
      anchor.innerText = "????";
    }
  }
}

function render() {
  let docMetadata = loadDocMetadata();

  insertFrontMatter(docMetadata);
  insertForeword(docMetadata);
  insertConformance(docMetadata);
  insertNormativeReferences(docMetadata);
  insertBibliography(docMetadata);
  numberSections(document.body, "");
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

document.addEventListener('DOMContentLoaded', () => {
  try {
    render();
  } catch (e) {
    logEvent(e);
  }

  if (listEvents().length > 0) {

    const styleLink = document.createElement("link");
    styleLink.type = "text/css";
    styleLink.rel = "stylesheet";
    styleLink.href = "tooling/smpte-errors.css";
    document.head.appendChild(styleLink);

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