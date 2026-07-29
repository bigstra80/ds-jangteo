import type { CSSProperties } from "react";

export const SETTLEMENT_TABLE_MIN_WIDTH = 1050;
export const SETTLEMENT_CONTENT_MAX_WIDTH = 1050;
export const ORDER_CONTENT_MAX_WIDTH = 1000;
export const SETTLEMENT_DATE_COLUMN_WIDTH = 100;
export const SETTLEMENT_MEMO_MIN_WIDTH = 120;
export const COMPACT_CONTROL_HEIGHT = 34;
export const COMPACT_TABLE_HEADER_HEIGHT = 32;
export const COMPACT_TABLE_ROW_HEIGHT = 36;
export const COMPACT_TABLE_HEADER_FONT_SIZE = 11;
export const COMPACT_TABLE_BODY_FONT_SIZE = 12;
export const COMPACT_TABLE_CELL_PADDING = "4px 6px";
export const COMPACT_TABLE_LINE_HEIGHT = 1.2;
export const COMPACT_TOOLBAR_MARGIN_BOTTOM = 16;

export const settlementPageStyle: CSSProperties = {
  width: "100%",
  maxWidth: SETTLEMENT_CONTENT_MAX_WIDTH,
  minWidth: 0,
  margin: 0,
};

export const orderPageStyle: CSSProperties = {
  width: "100%",
  maxWidth: ORDER_CONTENT_MAX_WIDTH,
  minWidth: 0,
  margin: 0,
};

export const settlementDateCellStyle: CSSProperties = {
  minWidth: SETTLEMENT_DATE_COLUMN_WIDTH,
  overflow: "visible",
  textOverflow: "clip",
  whiteSpace: "nowrap",
};

export const settlementWrappingCellStyle: CSSProperties = {
  overflow: "visible",
  overflowWrap: "anywhere",
  textOverflow: "clip",
  whiteSpace: "normal",
  wordBreak: "keep-all",
};
