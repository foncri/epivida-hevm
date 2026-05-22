(() => {
  "use strict";

  if (window.__epividaCedulasGridResizePreloader20260522) return;
  window.__epividaCedulasGridResizePreloader20260522 = true;

  const GRID_RESIZE_OPS = [{"start":9598,"deleteCount":18,"insert":["              gridProperties: preventiveCedulaRequiredGrid(payload)","            }","          }","        });","      }","    });","    if (requests.length) {","      await sheetsRequest(\":batchUpdate\", {","        method: \"POST\",","        body: JSON.stringify({ requests })","      });","      metadata = await fetchSpreadsheetSheetsMetadata();","      byTitle = sheetMetadataByNormalizedTitle(metadata);","    }","    await ensurePreventiveCedulaSheetGrid(payloads, byTitle);","    await ensurePreventiveCedulaConsecutiveColumns(payloads, byTitle);","  }","","  function preventiveCedulaRequiredGrid(payload) {","    return {","      rowCount: Math.max(80, payload.spec.rowStart + payload.rowCount + 12),","      columnCount: payload.spec.firstColumnIndex + payload.spec.headers.length + 2","    };","  }","","  async function ensurePreventiveCedulaSheetGrid(payloads, metadataByTitle) {","    const requests = payloads.flatMap(payload => {","      const sheet = metadataByTitle.get(normalizeText(payload.title));","      if (!sheet?.sheetId && sheet?.sheetId !== 0) return [];","      const required = preventiveCedulaRequiredGrid(payload);","      const current = sheet.gridProperties || {};","      const nextGrid = {};","      if (Number(current.rowCount || 0) < required.rowCount) nextGrid.rowCount = required.rowCount;","      if (Number(current.columnCount || 0) < required.columnCount) nextGrid.columnCount = required.columnCount;","      if (!Object.keys(nextGrid).length) return [];","      return [{","        updateSheetProperties: {","          properties: {","            sheetId: sheet.sheetId,","            gridProperties: nextGrid","          },","          fields: Object.keys(nextGrid).map(key => `gridProperties.${key}`).join(\",\")","        }","      }];","    });","    if (requests.length) {","      await sheetsRequest(\":batchUpdate\", {","        method: \"POST\",","        body: JSON.stringify({ requests })","      });","    }"]}];

  function hasGridResizePatch(source) {
    return String(source || "").includes("preventiveCedulaRequiredGrid")
      && String(source || "").includes("ensurePreventiveCedulaSheetGrid");
  }

  function applyOps(source, ops) {
    const lines = String(source || "").replace(/\r\n/g, "\n").split("\n");
    for (let i = ops.length - 1; i >= 0; i -= 1) {
      const op = ops[i];
      lines.splice(op.start, op.deleteCount, ...(op.insert || []));
    }
    return lines.join("\n");
  }

  const nativeEval = window.eval;
  window.eval = function epividaCedulasGridResizeEval(source) {
    if (typeof source === "string"
      && source.includes("PREVENTIVE_CEDULA_SPECS")
      && source.includes("preventiveCedulaSheetPayloads")
      && !hasGridResizePatch(source)) {
      const patched = applyOps(source, GRID_RESIZE_OPS);
      if (hasGridResizePatch(patched)) {
        source = patched;
      } else {
        console.warn("No se pudo aplicar la expansion automatica de cedulas preventivas.");
      }
    }
    return nativeEval.call(this, source);
  };
})();