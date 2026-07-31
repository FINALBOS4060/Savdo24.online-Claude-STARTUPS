import fs from 'fs';
import path from 'path';

// Script to check if models in schema.prisma match schema.sqlite.prisma
function extractModels(schemaContent: string): Set<string> {
  const modelRegex = /model\s+(\w+)\s*\{/g;
  const models = new Set<string>();
  let match;
  while ((match = modelRegex.exec(schemaContent)) !== null) {
    models.add(match[1]);
  }
  return models;
}

function checkDrift() {
  const pgSchemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma');
  const sqliteSchemaPath = path.join(process.cwd(), 'prisma', 'schema.sqlite.prisma');

  if (!fs.existsSync(pgSchemaPath) || !fs.existsSync(sqliteSchemaPath)) {
    console.error('Schema files missing!');
    process.exit(1);
  }

  const pgContent = fs.readFileSync(pgSchemaPath, 'utf8');
  const sqliteContent = fs.readFileSync(sqliteSchemaPath, 'utf8');

  const pgModels = extractModels(pgContent);
  const sqliteModels = extractModels(sqliteContent);

  let hasError = false;

  for (const model of pgModels) {
    if (!sqliteModels.has(model)) {
      console.error(`❌ Model missing in schema.sqlite.prisma: ${model}`);
      hasError = true;
    }
  }

  for (const model of sqliteModels) {
    if (!pgModels.has(model)) {
      console.error(`❌ Model missing in schema.prisma: ${model}`);
      hasError = true;
    }
  }

  if (hasError) {
    console.error('Schema drift detected!');
    process.exit(1);
  } else {
    console.log('✅ Schema models are in sync between Postgres and SQLite schemas.');
  }
}

checkDrift();
