const express = require("express");
const router = express.Router();

const questions = require("../data/questions");

// GET /api/questions/, /api/questions?keyword=sweden
router.get("/", (req, res) => {
    const { keyword } = req.query;

    if(!keyword){
        return res.json(questions);
    }

    const filteredQuestions = questions.filter(q => q.keywords.includes(keyword));
    res.json(filteredQuestions);
})

// GET /questions/:questionId
router.get("/:questionId", (req, res) => {
  const questionId = Number(req.params.questionId);

  const question = questions.find((q) => q.id === questionId);

  if (!question) {
    return res.status(404).json({ message: "Question not found" });
  }

  res.json(question);
});

// POST /questions
router.post("/", (req, res) => {
  const { quiz, answer, keywords } = req.body;

  if (!quiz || !answer) {
    return res.status(400).json({
      message: "quiz and answer are required"
    });
  }
  const maxId = Math.max(...questions.map(q => q.id), 0);

  const newQuestion = {
    id: questions.length ? maxId + 1 : 1,
    quiz, answer,
    keywords: Array.isArray(keywords) ? keywords : []
  };
  questions.push(newQuestion);
  res.status(201).json(newQuestion);
});

// PUT /questions/:questionId
router.put("/:questionId", (req, res) => {
  const questionId = Number(req.params.questionId);
  const question = questions.find((q) => q.id === questionId);
  if (!question) {
    return res.status(404).json({ message: "Question not found" });
  }

  const { quiz, answer, keywords } = req.body;
  if (!quiz || !answer) {
    return res.json({
      message: "quiz and answer are required"
    });
  }

  question.quiz = quiz;
  question.answer = answer;
  question.keywords = Array.isArray(keywords) ? keywords : [];

  res.json(question);
});

// DELETE /questions/:questionId
router.delete("/:questionId", (req, res) => {
  const questionId = Number(req.params.questionId);

  const questionIndex = questions.findIndex((q) => q.id === questionId);

  if (questionIndex === -1) {
    return res.status(404).json({ message: "Question not found" });
  }

  const deletedQuestion = questions.splice(questionIndex, 1);

  res.json({
    message: "Question deleted successfully",
    question: deletedQuestion[0]
  });
});

module.exports = router;