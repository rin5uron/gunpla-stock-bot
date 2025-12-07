import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface TargetSeed {
  id: string;
  name: string;
  url: string;
}

async function main() {
  console.log('🌱 Seeding database...');

  const targetsPath = path.join(process.cwd(), 'config', 'targets.json');

  if (!fs.existsSync(targetsPath)) {
    console.log('✅ Seed: config/targets.json not found, skipping seeding.');
    return;
  }

  const targets: TargetSeed[] = JSON.parse(
    fs.readFileSync(targetsPath, 'utf-8')
  );

  for (const target of targets) {
    await prisma.target.upsert({
      where: { id: target.id },
      update: {
        name: target.name,
        url: target.url,
      },
      create: {
        id: target.id,
        name: target.name,
        url: target.url,
        lastStatus: 'out_of_stock',
        enabled: true,
      },
    });
    console.log(`Upserted target: ${target.name}`);
  }

  console.log('✅ Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
