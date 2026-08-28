// Re-uses the root card. A segment that declares its own `openGraph` object
// drops the parent's file-based image, so /create-shop needs its own.
export { default, alt, size, contentType } from "../opengraph-image";
