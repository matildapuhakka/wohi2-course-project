const express = require("express");
const router = express.Router();
const prisma = require("../lib/prisma");
const questions = require("../data/questions");

function formatQuestion(question) {
  return {
    ...question,
    keywords: question.keywords.map((k) => k.name),
  };
}

// GET /api/questions/, /api/questions?keyword=sweden
router.get("/", async (req, res) => {
  const { keyword } = req.query;

  const where = keyword
    ? { keywords: { some: { name: keyword } } }
    : {};

  const questions = await prisma.question.findMany({
    where,
    include: { keywords: true },
    orderBy: { id: "asc" },
  });

  res.json(questions.map(formatQuestion));
})

// GET /questions/:questionId
router.get("/:questionId", async (req, res) => {
  const questionId = Number(req.params.questionId);
  const question = await prisma.question.findUnique({
    where: { id: questionId },
    include: { keywords: true },
  });

  if (!question) {
    return res.status(404).json({ 
		message: "Question not found" 
    });
  }

  res.json(formatQuestion(question));
});

// POST /questions
router.post("/", async (req, res) => {
  const { quiz, answer, keywords } = req.body;

  if (!quiz || !answer ) {
    return res.status(400).json({ msg: 
	"quiz and answer are mandatory" });
  }

  const keywordsArray = Array.isArray(keywords) ? keywords : [];

  const newQuestion = await prisma.question.create({
    data: {
      quiz, answer,
      keywords: {
        connectOrCreate: keywordsArray.map((kw) => ({
          where: { name: kw }, create: { name: kw },
        })), },
    },
    include: { keywords: true },
  });

  res.status(201).json(formatQuestion(newQuestion));
});

// PUT /questions/:questionId
router.put("/:questionId", async (req, res) => {
  const questionId = Number(req.params.questionId);
  const { quiz, answer, keywords } = req.body;
  const existingQuestion = await prisma.question.findUnique({ where: { id: questionId } });
  if (!existingQuestion) {
    return res.status(404).json({ message: "Question not found" });
  }

  if (!quiz || !answer) {
    return res.status(400).json({ msg: "quiz and answer are mandatory" });
  }

  const keywordsArray = Array.isArray(keywords) ? keywords : [];
  const updatedQuestion = await prisma.question.update({
    where: { id: questionId },
    data: {
      quiz, answer,
      keywords: {
        set: [],
        connectOrCreate: keywordsArray.map((kw) => ({
          where: { name: kw },
          create: { name: kw },
        })),
      },
    },
    include: { keywords: true },
  });
  res.json(formatQuestion(updatedQuestion));
});

// DELETE /questions/:questionId
router.delete("/:questionId", async (req, res) => {
  const questionId = Number(req.params.questionId);

  const question = await prisma.question.findUnique({
    where: { id: questionId },
    include: { keywords: true },
  });

  if (!question) {
    return res.status(404).json({ message: "Question not found" });
  }

  await prisma.question.delete({ where: { id: questionId } });

  res.json({
    message: "Question deleted successfully",
    question: formatQuestion(question),
  });
});

module.exports = router;