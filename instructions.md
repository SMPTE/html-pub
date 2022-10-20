# SMPTE HTML HOW-TO

## Sections

### Required Sections

The following sections must be present in the HTML.

#### Table of contents
`<section id="sec-toc"></section>` 

Do not edit! This is generated automatically based on the sections present. 

#### Forward

`<section id="sec-foreword"></section>` 

Do not edit! This is generated automatically.

#### Scope

`<section id="sec-scope"></section>` 

Add `<p>` as needed. Full HTML allowed if needed (use sparingly).

#### Conformance

`<section id="sec-conformance"></section>` 

Do not edit! This is generated automatically.

#### Normative references

`<section id="sec-normative-references"></section>`

Add `li` sub elements as needed in this section as needed for references. If no Normative references, remove the entire `ul` element.

- Use `<cite id="bib-xx">XX</cite>` for the citation to be used within the document. 
  - `<cite>` value `XX` shall be the document name (i.e. `IETF RFC 3968`)
  - `<cite>` attribute `id` shall be the document name normalized for an id, AWLAYS prefixed by "bib-" (i.e. `bib-ietf-rfc-3986`)
- See "External Links" below for URL to document
- EXAMPLE: `<li><cite id="bib-ietf-rfc-3986">IETF RFC 3986</cite>, Uniform Resource Identifiers (URI): Generic Syntax, T. Berners-Lee, et al., January 2005. <a>http://www.ietf.org/rfc/rfc3986.txt</a></li>`
- When using citations in the document, use the format:`<a href="#bib-xx"></a>`
  - EXAMPLE:`<a href="#bib-ietf-rfc-3986"></a>`
  - This will generate an auto link back to the Normative Reference listed, with the citation text on the page (i.e. `IETF RFC 3968`).

Pre text for this section is auto generated based on `ul` present or not.

#### Terms and definitions

`<section id="sec-terms-and-definitions"></section>`

Use the `ul` element (do not edit the attributes or `id`) to list external documents where Terms are defined (use same logic as referenced docs in the body of the document as example shows). Remove the `ul` entirely if no external Terms are needed to be defined.

  - Document referenced must in the `sec-normative-references` 
  - All `<a>` elements must contain the attribute and value `itemprop="external" `
  - EXAMPLE: `<li><a itemprop="external" href="#bib-ietf-rfc-8259"></a></li>`
  - This will generate an auto link back to the Normative Reference listed, with the citation text on the page (i.e. `IETF RFC 3968`).

Use the `dl` element (do not edit the attributes or `id`), adding `dt/dd` sub element pairs as needed for Terms to be defined internally in this document. Remove the `dl` entirely if no internal Terms are needed to be defined. 

- Terms must be wrapped in `<dt><dfn>Term</dfn></dt>`
- Definition must be wrapped in `<dd></dd>`
  - Do not use `<p>`, as this should be a continous definition, in a single sentence. The definition should be able swapped with the Term within the context of the document. 

If no Terms needed to be defined at all, remove the both `ul` and `dl` elements. 

Pre text for this section is auto generated based on what elements are present.

### Optional Sections

The following sections are optional in the HTML. If your document doesn't need these sections, remove them entirely. 

#### Introduction

`<section id="sec-introduction"></section>` 

Must be between `<section id="sec-foreword"></section>` and `<section id="sec-scope"></section>`

Add `<p>` as needed. Full HTML allowed if needed (use sparingly).

#### Bibliography

`<section id="sec-bibliography"></section>` 

Must be the very last section

### Other Sections

For each addtional `<section>` added, there must an `id` attribute present, and accompanying header as appropriate for the the section level starting with `<h2>`.

- The header (i.e. `<h2>`, `<h3>`, `<h4>`) will the true english name of the section defined (i.e `Copyright and License`)
- `<section>` attribute `id` shall be the document name normalized for an id, AWLAYS prefixed by "sec-" (i.e. `sec-copyright-and-license`)
- EXAMPLES: 

```
  <section id="sec-copyright-and-license">
    <h2>Copyright and License</h2>
    
    <section id="sec-license">
      <h3>License</h3>

      ...

    </section>

  </section>

```

If section is required to be an Annex, it must be a `<h2>` level section, and add the additional `class="annex"` attribute. Subsequent sections do not need the attribute added. 
- EXAMPLES:

```
  <section class="annex" id="sec-json-document-license">
    <h2>JSON Document License</h2>

    <section id="sec-copyright-element">
      <h3>Copyright Element</h3>

      ...

    </section>

  </section>

```

When linking back to a section within the text, use the format:`<a href="#sec-xx"></a>`

  - EXAMPLE:`<a href="#sec-json-document-license"></a>`
  - This will generate an auto link back to the section number listed, from the auto generated TOC (i.e. `5`, `Annex A`, etc).

## General Guidelines

### External Links

Links to external resources should be written by wrapping the URL in a `<a>` element as follows:

`<a>https://datatracker.ietf.org/doc/html/draft-bhutton-json-schema-00</a>`

An `href` attribute will automatically be generated:

`<a href="https://datatracker.ietf.org/doc/html/draft-bhutton-json-schema-00">https://datatracker.ietf.org/doc/html/draft-bhutton-json-schema-00</a>`
