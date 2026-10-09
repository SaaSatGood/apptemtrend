import { syncConfiguredCatalog } from '../modules/products/catalog-sync.service.js';

try {
  const result = await syncConfiguredCatalog();
  process.stdout.write(`${JSON.stringify(result)}\n`);
} catch (error) {
  process.stderr.write(`Catalog sync failed: ${error instanceof Error ? error.message : 'unknown error'}\n`);
  process.exitCode = 1;
}
