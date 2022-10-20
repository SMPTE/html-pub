# SMPTE HTML HOW-TO

## Sections

### Required Sections

The following sections must be present in the HTML:

`<section id="sec-toc"></section>` 

Do not edit! This is generated automatically

`<section id="sec-foreword"></section>` 

Do not edit! This is generated automatically

`<section id="sec-scope"></section>` 

Add `<p>` as needed. Full HTML allowed if needed (use sparingly).

`<section id="sec-conformance"></section>` 

Do not edit! This is generated automatically

`<section id="sec-normative-references"></section>`

Add `li` sub elements as needed in this section as needed for references. If no Normative references, remove the entire `ul` element.

- Use `<cite id="bib-xx">XX</cite>` for the citation to be used within the document. 
  - `XX` shall be the document name (i.e. `IETF RFC 3968`)
  - `bib-xx` shall be the document name normalized for id (i.e. `bib-ietf-rfc-3986`)
- See "External Links" below for URL to document
- EXAMPLE: `<li><cite id="bib-ietf-rfc-3986">IETF RFC 3986</cite>, Uniform Resource Identifiers (URI): Generic Syntax, T. Berners-Lee, et al., January 2005. <a>http://www.ietf.org/rfc/rfc3986.txt</a></li>`
- When using citations in the document, use the format:`<a href="#bib-xx"></a>`
  - EXAMPLE:`<a href="#bib-ietf-rfc-3986"></a>`
  - This will generate an auto link back to the Normative Reference listed, with the citation text on the page (i.e. `IETF RFC 3968`).

Pre text for this section is auto generated based on `ul` present or not.

`<section id="sec-terms-and-definitions"></section>`

Use the `ul` element (do not edit the attributes) to list external documents where Terms are defined (use same logic as referenced docs in the body of the document as example shows). 
  - Document referenced must in the `sec-normative-references` 
  - All `<a>` elements must contain the attribute and value `itemprop="external" `
  - EXAMPLE: `<li><a itemprop="external" href="#bib-ietf-rfc-8259"></a></li>`
  - This will generate an auto link back to the Normative Reference listed, with the citation text on the page (i.e. `IETF RFC 3968`).

Use the `ul` element (do not edit the attributes), adding `dt/dd` sub element pairs as needed for Terms to be defined internally in this document. 
- Terms must be wrapped in `<dt><dfn>Term</dfn></dt>`
- Definition must be wrapped in `<dd></dd>`
  - Do not use `<p>`, as this should be a continous definition, in a single sentence. The definition should be able swapped with the Term within the context of the document. 

Remove either the `ul` if no external Terms, or `dl` if no internally defined Terms. If no Terms needed to be defined at all, remove the both `ul` and `dl` elements. 

Pre text for this section is auto generated based on what elements are present.

### Optional Sections

The following sections must be present in the HTML:

`<section id="sec-introduction"></section>` 

Must be between `<section id="sec-foreword"></section>` and `<section id="sec-scope"></section>`

Add `<p>` as needed. Full HTML allowed if needed (use sparingly).

`<section id="sec-bibliography"></section>` 

Must be the very last section

### Other Sections



## General Guidelines

### External Links

Links to external resources should be written by wrapping the URL in a `<a>` element as follows:

`<a>https://datatracker.ietf.org/doc/html/draft-bhutton-json-schema-00</a>`

An `href` attribute will automatically be generated:

`<a href="https://datatracker.ietf.org/doc/html/draft-bhutton-json-schema-00">https://datatracker.ietf.org/doc/html/draft-bhutton-json-schema-00</a>`
