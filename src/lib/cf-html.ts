const encoder = new TextEncoder();
const startMarker = "<!--StartFragment-->";
const endMarker = "<!--EndFragment-->";

/** The pinned plugin's combined write sends these bytes verbatim as HTML Format. */
export function encodeCfHtml(html: string): string {
  let fragmentRange: { start: number; end: number } | undefined;
  if (/^Version:/i.test(html)) {
    const bytes = encoder.encode(html);
    const start = Number(html.match(/^StartHTML:(-?\d+)\r?$/m)?.[1]);
    const end = Number(html.match(/^EndHTML:(-?\d+)\r?$/m)?.[1]);
    if (start === -1 && end === -1) {
      const fromField = /^StartFragment:(\d+)\r?\n/m.exec(html);
      const toField = /^EndFragment:(\d+)\r?\n/m.exec(html);
      const from = Number(fromField?.[1]);
      const to = Number(toField?.[1]);
      const headerEnd = Math.max(
        fromField ? fromField.index + fromField[0].length : bytes.length,
        toField ? toField.index + toField[0].length : bytes.length,
      );
      if (
        !Number.isSafeInteger(from) ||
        !Number.isSafeInteger(to) ||
        from < encoder.encode(html.slice(0, headerEnd)).length ||
        to < from ||
        to > bytes.length
      ) {
        throw new Error("Invalid CF_HTML fragment offsets");
      }
      const fragment = new TextDecoder("utf-8", { fatal: true }).decode(bytes.slice(from, to));
      const prefix = `<html><body>${startMarker}`;
      html = `${prefix}${fragment}${endMarker}</body></html>`;
      fragmentRange = { start: prefix.length, end: prefix.length + fragment.length };
    } else if (
      !Number.isInteger(start) ||
      !Number.isInteger(end) ||
      start < 0 ||
      end <= start ||
      end > bytes.length
    ) {
      throw new Error("Invalid CF_HTML context offsets");
    } else {
      html = new TextDecoder("utf-8", { fatal: true }).decode(bytes.slice(start, end));
    }
  }

  if (!html.includes(startMarker) || !html.includes(endMarker)) {
    const body = /<body\b[^>]*>/i.exec(html);
    const closeBody = /<\/body\s*>/i.exec(html);
    if (body && closeBody && closeBody.index >= body.index + body[0].length) {
      const start = body.index + body[0].length;
      html =
        html.slice(0, start) +
        startMarker +
        html.slice(start, closeBody.index) +
        endMarker +
        html.slice(closeBody.index);
    } else {
      html = `<html><body>${startMarker}${html}${endMarker}</body></html>`;
    }
  }
  const fragmentStart = fragmentRange?.start ?? html.indexOf(startMarker) + startMarker.length;
  const fragmentEnd = fragmentRange?.end ?? html.indexOf(endMarker, fragmentStart);
  if (fragmentEnd < fragmentStart) throw new Error("Invalid HTML fragment markers");

  const header = (start: number, end: number, from: number, to: number) =>
    "Version:1.0\r\n" +
    `StartHTML:${String(start).padStart(10, "0")}\r\n` +
    `EndHTML:${String(end).padStart(10, "0")}\r\n` +
    `StartFragment:${String(from).padStart(10, "0")}\r\n` +
    `EndFragment:${String(to).padStart(10, "0")}\r\n`;
  const start = encoder.encode(header(0, 0, 0, 0)).length;
  return (
    header(
      start,
      start + encoder.encode(html).length,
      start + encoder.encode(html.slice(0, fragmentStart)).length,
      start + encoder.encode(html.slice(0, fragmentEnd)).length,
    ) + html
  );
}
