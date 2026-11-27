import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Sin caché incremental: todas las páginas son dinámicas. Si algún día hay ISR, sumar R2 acá.
export default defineCloudflareConfig({});
