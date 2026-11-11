// Bridge between Netlify Functions and the existing Vercel-style API handlers.
export function adaptVercelHandler(handler) {
  return async function netlifyHandler(event) {
    const headers = Object.fromEntries(Object.entries(event.headers || {}).map(([k, v]) => [k.toLowerCase(), v]));
    let body = event.body || "";
    if (event.isBase64Encoded && body) body = Buffer.from(body, "base64").toString("utf8");
    if (typeof body === "string" && body) {
      try { body = JSON.parse(body); } catch { /* keep raw body for webhook parsers */ }
    } else if (!body) body = undefined;

    const req = {
      method: event.httpMethod || "GET",
      headers,
      body,
      query: event.queryStringParameters || {},
      url: event.rawUrl || event.path || "/"
    };
    let statusCode = 200;
    let responseBody = "";
    const responseHeaders = {};
    let ended = false;
    const res = {
      status(code) { statusCode = code; return this; },
      setHeader(name, value) { responseHeaders[name] = value; return this; },
      json(value) {
        responseHeaders["Content-Type"] = "application/json; charset=utf-8";
        responseBody = JSON.stringify(value);
        ended = true;
        return this;
      },
      send(value) {
        if (value !== undefined && value !== null) responseBody = typeof value === "string" ? value : JSON.stringify(value);
        ended = true;
        return this;
      },
      end(value) {
        if (value !== undefined) responseBody = String(value);
        ended = true;
        return this;
      }
    };
    await handler(req, res);
    return {
      statusCode,
      headers: responseHeaders,
      body: ended ? responseBody : responseBody || ""
    };
  };
}
