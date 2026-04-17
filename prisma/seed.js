const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const seedQuestions = [
  {
    quiz: "What is the capital of Finland?",
    answer: "Helsinki",
    keywords: ["finland", "helsinki"],
  },
  {
    quiz: "What is the capital of Sweden?",
    answer: "Stockholm",
    keywords: ["sweden", "stockholm"],
  },
  {
    quiz: "What is the capital of Norway?",
    answer: "Oslo",
    keywords: ["norway", "oslo"],
  },
  {
    quiz: "What is the capital of Denmark?",
    answer: "Copenhagen",
    keywords: ["denmark", "copenhagen"],
  },
];

async function main() {
  await prisma.question.deleteMany();
  await prisma.keyword.deleteMany();

  for (const question of seedQuestions) {
    await prisma.question.create({
      data: {
        quiz: question.quiz,
        answer: question.answer,
        keywords: {
          connectOrCreate: question.keywords.map((kw) => ({
            where: { name: kw },
            create: { name: kw },
          })),
        },
      },
    });
  }

  console.log("Seed data inserted successfully");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());