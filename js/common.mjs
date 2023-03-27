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

export const OM_PUBTYPE = "OM";
export const AG_PUBTYPE = "AG";
export const ST_PUBTYPE = "ST";
export const RP_PUBTYPE = "RP";
export const EG_PUBTYPE = "EG";

export const PUB_TYPES = new Set([AG_PUBTYPE, OM_PUBTYPE, ST_PUBTYPE, RP_PUBTYPE, EG_PUBTYPE]);

export const ENGDOC_PUBTYPES = new Set([ST_PUBTYPE, RP_PUBTYPE, EG_PUBTYPE]);

export const PUB_STAGES = new Set(["WD", "CD", "FCD", "DP", "PUB"]);

export const PUB_STATE_PUB = "pub";
export const PUB_STATES = new Set([PUB_STATE_PUB, "draft"]);

function fatal(logger, msg) {
  logger.error(msg);
  throw msg;
}

function getHeadMetadata(head, paramName) {
  let e = head.querySelector(`meta[itemprop='${paramName}']`);

  if (e === null) return null;

  return e.getAttribute("content");
}

export function validateHead(head, logger) {

  let metadata = {};

  if (head.getAttribute("itemscope") !== "itemscope")
    logger.error("head@itemscope is invalid");

  if (head.getAttribute("itemtype") !== "http://smpte.org/standards/documents")
    logger.error("head@itemtype is invalid");

  /* pubTitle */
  metadata.pubTitle = head.ownerDocument.title;
  if (!metadata.pubTitle)
    fatal("pubType invalid");

  /* pubType */
  metadata.pubType = getHeadMetadata(head, "pubType");
  if (metadata.pubType === null || !PUB_TYPES.has(metadata.pubType))
    fatal(logger, "pubType invalid");

  /* pubState */
  metadata.pubState = getHeadMetadata(head, "pubState");
  if (metadata.pubState === null || !PUB_STATES.has(metadata.pubState))
    fatal(logger, "pubState invalid");

  /* pubNumber */
  metadata.pubNumber = getHeadMetadata(head, "pubNumber");
  if (metadata.pubNumber === null || ! /\d+/.test(metadata.pubNumber))
    fatal(logger, "pubNumber invalid");

  /* pubPart (optional) */
  metadata.pubPart = getHeadMetadata(head, "pubPart");
  if (metadata.pubPart !== null && ! /\d+/.test(metadata.pubPart))
    fatal(logger, "pubPart invalid");

  /* pubDateTime (optional) */
  metadata.pubDateTime = getHeadMetadata(head, "pubDateTime");
  if(metadata.pubDateTime !== null && ! /\d{4}-\d{2}-\d{2}/.test(metadata.pubDateTime))
    fatal(logger, "pubDateTime invalid");

  /* effectiveDateTime (optional) */
  metadata.effectiveDateTime = getHeadMetadata(head, "effectiveDateTime");
  if(metadata.effectiveDateTime !== null && ! /\d{4}-\d{2}-\d{2}/.test(metadata.effectiveDateTime))
    fatal(logger, "effectiveDateTime invalid");

  /* specific to pub state */
  if (metadata.pubState === PUB_STATE_PUB) {
    if(metadata.pubDateTime === null)
      fatal(logger, "pubDateTime must be present for pub state");
  }

  /* specific to OM */
  if (metadata.pubType === OM_PUBTYPE) {
    if (metadata.pubState === PUB_STATE_PUB) {
      if (metadata.effectiveDateTime === null)
        fatal(logger, "Published OM requires effectiveDateTime");
    }
  }

  /* specific to engineering documents */
  if (ENGDOC_PUBTYPES.has(metadata.pubType)) {

    /* pubStage */
    metadata.pubStage = getHeadMetadata(head, "pubStage");
    if (metadata.pubStage === null || !PUB_STAGES.has(metadata.pubStage))
      fatal(logger, "pubStage invalid");

    /* pubTC */
    metadata.pubTC = getHeadMetadata(head, "pubTC");
    if (metadata.pubTC === null || metadata.pubTC.length === 0)
      fatal(logger, "pubTC invalid");
  }

  return metadata;
}