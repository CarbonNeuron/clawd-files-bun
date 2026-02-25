import { addRoute } from "../router";
import { queryCsv, renderTableFragment } from "../render/csv";

export function registerTableViewerRoutes() {
  addRoute("GET", "/view/table/:tableId", async (req, params) => {
    const url = new URL(req.url);
    const tableId = decodeURIComponent(params.tableId);
    const page = parseInt(url.searchParams.get("page") ?? "1", 10);
    const perPage = parseInt(url.searchParams.get("per_page") ?? "100", 10);
    const sort = url.searchParams.get("sort") ?? undefined;
    const dir = url.searchParams.get("dir") ?? undefined;
    const filter = url.searchParams.get("filter") ?? undefined;

    const result = queryCsv(tableId, { page, perPage, sort, dir, filter });
    if (!result) {
      return new Response(
        `<p style="color:var(--text-muted);padding:16px;">CSV data expired. Reload the page to re-parse.</p>`,
        { headers: { "Content-Type": "text/html" } }
      );
    }

    const viewerUrl = `/view/table/${encodeURIComponent(tableId)}`;
    const html = renderTableFragment(
      result.header,
      result.rows,
      result.total,
      result.page,
      result.perPage,
      result.totalPages,
      viewerUrl,
      sort,
      dir,
      filter
    );

    return new Response(html, {
      headers: { "Content-Type": "text/html" },
    });
  });
}
