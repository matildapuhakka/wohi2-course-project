const express = require("express");
const router = express.Router();
const prisma = require("../lib/prisma");
const authenticate = require("../middleware/auth");
const isOwner = require("../middleware/isOwner");
const multer = require("multer");
const path = require('path');

const storage = multer.diskStorage({
  destination: path.join(__dirname, "..", "..", "public", "uploads"),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed"));
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});

function formatQuestion(question) {
  return {
    ...question,
    keywords: question.keywords.map((k) => k.name),
    userName: question.user?.name || null,
    solvedCount: question._count?.solveds ?? 0,
    solved: question.solveds ? question.solveds.length > 0 : false,
    user: undefined,
    solveds: undefined,
    _count: undefined,
  };
}

router.use(authenticate);

// GET /api/questions/, /api/questions?keyword=sweden&page=1&limit=5
router.get("/", async (req, res) => {
  const { keyword } = req.query;

  const where = keyword
    ? { keywords: { some: { name: keyword } } }
    : {};

  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(req.query.limit) || 5));
  const skip = (page - 1) * limit;

  const [questions, total] = await Promise.all([
    prisma.question.findMany({
        where,
        include: {
          keywords: true,
          user: true, 
          solveds: { where: { userId: req.user.userId }, take: 1 }, 
          _count: { select: { solveds: true } },
        },
        orderBy: { id: "asc" },
        skip,
        take: limit,
    }),
    prisma.question.count({ where }),
  ]);

  res.json({
    data: questions.map(formatQuestion),
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  })

});

// GET /questions/:questionId
router.get("/:questionId", async (req, res) => {
  const questionId = Number(req.params.questionId);
  const question = await prisma.question.findUnique({
    where: { id: questionId },
    include: {
      keywords: true,
      user: true,
      solveds: { where: { userId: req.user.userId }, take: 1 },
      _count: { select: { solveds: true } },
    },
  });

  if (!question) {
    return res.status(404).json({ 
		message: "Question not found" 
    });
  }

  res.json(formatQuestion(question));
});

// POST /questions
router.post("/", upload.single("image"), async (req, res) => {
  const { quiz, answer, keywords } = req.body;

  if (!quiz || !answer ) {
    return res.status(400).json({ msg: 
	"quiz and answer are mandatory" });
  }

  const keywordsArray = Array.isArray(keywords) ? keywords : [];

  const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

  const newQuestion = await prisma.question.create({
    data: {
      quiz, answer,
      userId: req.user.userId,
      imageUrl,
      keywords: {
        connectOrCreate: keywordsArray.map((kw) => ({
          where: { name: kw }, create: { name: kw },
        })), },
    },
    include: { keywords: true },
  });

  res.status(201).json(formatQuestion(newQuestion));
});

// POST /api/questions/:questionId/solved
router.post("/:questionId/solved", async (req, res) => {
    const questionId = Number(req.params.questionId);

    const question = await prisma.question.findUnique({ where: { id: questionId } });
    if (!question) {
        return res.status(404).json({ message: "Question not found" });
    }

    const solved = await prisma.solved.upsert({
        where: { userId_questionId: { userId: req.user.userId, questionId } },
        update: {},
        create: { userId: req.user.userId, questionId },
    });

    const solvedCount = await prisma.solved.count({ where: { questionId } });

    res.status(201).json({
        id: solved.id,
        questionId,
        solved: true,
        solvedCount,
        createdAt: solved.createdAt,
    });
});

// POST /api/questions/:questionId/play
router.post("/:questionId/play", async (req, res) => {
  const questionId = Number(req.params.questionId);
  const { answer } = req.body;

  const question = await prisma.question.findUnique({
    where: { id: questionId },
  });

  if (!question) {
    return res.status(404).json({
      message: "Question not found",
    });
  }

  const correct =
    question.answer.trim().toLowerCase() ===
    answer.trim().toLowerCase();

  // If answer is correct, mark question as solved
  if (correct) {
    await prisma.solved.upsert({
      where: {
        userId_questionId: {
          userId: req.user.userId,
          questionId,
        },
      },
      update: {},
      create: {
        userId: req.user.userId,
        questionId,
      },
    });
  }

  res.json({
    correct,
    correctAnswer: question.answer,
  });
});

// PUT /questions/:questionId
router.put("/:questionId", upload.single("image"), isOwner, async (req, res) => {
  const questionId = Number(req.params.questionId);
  const { quiz, answer, keywords } = req.body;
  const existingQuestion = await prisma.question.findUnique({ where: { id: questionId } });
  
  if (req.file) data.imageUrl = `/uploads/${req.file.filename}`;

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
      quiz, answer, imageUrl,
      keywords: {
        set: [],
        connectOrCreate: keywordsArray.map((kw) => ({
          where: { name: kw },
          create: { name: kw },
        })),
      },
    },
    include: { keywords: true, user: true },
  });
  res.json(formatQuestion(updatedQuestion));
});

// DELETE /questions/:questionId
router.delete("/:questionId", isOwner, async (req, res) => {
  const questionId = Number(req.params.questionId);

  const question = await prisma.question.findUnique({
    where: { id: questionId },
    include: { keywords: true, user: true },
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

// DELETE /api/questions/:questionId/solved
router.delete("/:questionId/solved", async (req, res) => {
    const questionId = Number(req.params.questionId);

    const question = await prisma.question.findUnique({ where: { id: questionId } });
    if (!question) {
        return res.status(404).json({ message: "Question not found" });
    }

    await prisma.solved.deleteMany({
        where: { userId: req.user.userId, questionId },
    });

    const solvedCount = await prisma.solved.count({ where: { questionId } });

    res.json({ questionId, solved: false, solvedCount });
});

module.exports = router;