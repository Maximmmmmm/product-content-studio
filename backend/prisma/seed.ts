import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const BCRYPT_COST = 12;

type Characteristic = { label: string; value: string };

function characteristics(entries: Characteristic[]): string {
  return JSON.stringify(entries);
}

async function seedAdmin(): Promise<void> {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set. Copy .env.example to .env first.',
    );
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

  await prisma.user.upsert({
    where: { email },
    update: { passwordHash },
    create: { email, passwordHash },
  });

  console.log(`Seeded administrator: ${email}`);
}

async function seedProducts(): Promise<void> {
  const products = [
    {
      slug: 'aurora-wireless-headphones',
      name: 'Aurora Wireless Headphones',
      characteristics: characteristics([
        { label: 'Driver', value: '40 mm dynamic' },
        { label: 'Battery life', value: 'Up to 30 hours' },
        { label: 'Connectivity', value: 'Bluetooth 5.3, USB-C' },
        { label: 'Weight', value: '254 g' },
      ]),
      description:
        'Over-ear wireless headphones tuned for long listening sessions. Adaptive noise cancelling adjusts to the room, and the memory-foam earcups stay comfortable through a full working day.',
      seoTitle: 'Aurora Wireless Headphones — 30h Battery, ANC',
      seoDescription:
        'Over-ear Bluetooth 5.3 headphones with adaptive noise cancelling, 30-hour battery life and memory-foam comfort for all-day listening.',
      status: 'published',
    },
    {
      slug: 'terra-pour-over-set',
      name: 'Terra Ceramic Pour-Over Set',
      characteristics: characteristics([
        { label: 'Material', value: 'Glazed stoneware' },
        { label: 'Capacity', value: '600 ml' },
        { label: 'Includes', value: 'Dripper, carafe, 50 filters' },
        { label: 'Dishwasher safe', value: 'Yes' },
      ]),
      description:
        'A two-piece pour-over set in glazed stoneware. The ribbed cone keeps the filter clear of the wall for an even extraction, and the carafe holds enough for two large cups.',
      seoTitle: 'Terra Ceramic Pour-Over Coffee Set, 600 ml',
      seoDescription:
        'Glazed stoneware pour-over set with a ribbed dripper and 600 ml carafe. Includes 50 filters and is dishwasher safe.',
      status: 'published',
    },
    {
      slug: 'nimbus-standing-desk-mat',
      name: 'Nimbus Standing Desk Mat',
      characteristics: characteristics([
        { label: 'Dimensions', value: '80 x 50 x 2 cm' },
        { label: 'Core', value: 'High-density polyurethane' },
        { label: 'Surface', value: 'Textured, non-slip' },
        { label: 'Warranty', value: '3 years' },
      ]),
      description:
        'Anti-fatigue mat for standing desks. The high-density core resists compression over time, and the bevelled edges sit flat so a chair can roll across without catching.',
      seoTitle: 'Nimbus Anti-Fatigue Standing Desk Mat',
      seoDescription:
        'Anti-fatigue standing desk mat with a high-density polyurethane core, non-slip textured surface and bevelled edges.',
      status: 'draft',
    },
  ];

  for (const product of products) {
    // Empty update: re-seeding must not overwrite edits made in the admin.
    await prisma.product.upsert({
      where: { slug: product.slug },
      update: {},
      create: product,
    });
  }

  console.log(
    `Seeded ${products.length} products ` +
      `(${products.filter((p) => p.status === 'published').length} published, ` +
      `${products.filter((p) => p.status === 'draft').length} draft)`,
  );
}

async function main(): Promise<void> {
  await seedAdmin();
  await seedProducts();
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
