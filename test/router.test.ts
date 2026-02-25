import { test, expect, beforeEach } from "bun:test";
import { addRoute, matchRoute, clearRoutes } from "../src/router";

beforeEach(() => {
  clearRoutes();
});

test("matches simple static path", () => {
  addRoute("GET", "/health", () => new Response("ok"));
  const result = matchRoute("GET", "/health");
  expect(result).not.toBeNull();
  expect(result!.params).toEqual({});
});

test("matches named parameters", () => {
  addRoute("GET", "/api/buckets/:id", () => new Response("ok"));
  const result = matchRoute("GET", "/api/buckets/abc123");
  expect(result).not.toBeNull();
  expect(result!.params.id).toBe("abc123");
});

test("matches multiple named parameters", () => {
  addRoute("GET", "/api/buckets/:id/files/:fileId", () => new Response("ok"));
  const result = matchRoute("GET", "/api/buckets/b1/files/f1");
  expect(result).not.toBeNull();
  expect(result!.params.id).toBe("b1");
  expect(result!.params.fileId).toBe("f1");
});

test("matches wildcard path", () => {
  addRoute("GET", "/raw/:bucketId/*", () => new Response("ok"));
  const result = matchRoute("GET", "/raw/bucket1/path/to/file.txt");
  expect(result).not.toBeNull();
  expect(result!.params.bucketId).toBe("bucket1");
  expect(result!.params["*"]).toBe("path/to/file.txt");
});

test("matches path+ pattern", () => {
  addRoute("GET", "/api/buckets/:id/files/:path+", () => new Response("ok"));
  const result = matchRoute("GET", "/api/buckets/b1/files/dir/file.txt");
  expect(result).not.toBeNull();
  expect(result!.params.id).toBe("b1");
  expect(result!.params.path).toBe("dir/file.txt");
});

test("method dispatch works", () => {
  addRoute("GET", "/items", () => new Response("get"));
  addRoute("POST", "/items", () => new Response("post"));
  expect(matchRoute("GET", "/items")).not.toBeNull();
  expect(matchRoute("POST", "/items")).not.toBeNull();
  expect(matchRoute("DELETE", "/items")).toBeNull();
});

test("returns null for unmatched path", () => {
  addRoute("GET", "/exists", () => new Response("ok"));
  expect(matchRoute("GET", "/not-exists")).toBeNull();
});

test("decodes URI components", () => {
  addRoute("GET", "/files/:name", () => new Response("ok"));
  const result = matchRoute("GET", "/files/my%20file.txt");
  expect(result).not.toBeNull();
  expect(result!.params.name).toBe("my file.txt");
});
