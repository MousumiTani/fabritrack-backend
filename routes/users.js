const express = require("express");
const router = express.Router();
const { ObjectId } = require("mongodb");
const { client } = require("../config/db");
const { verifyToken, verifyAdmin } = require("../middleware/auth");

const usersCollection = client.db("garmentsDB").collection("users");

// JWT
router.post("/jwt", async (req, res) => {
  const { email } = req.body;
  const user = await usersCollection.findOne({ email });
  if (!user) return res.status(401).send({ message: "User not found" });

  const token = require("jsonwebtoken").sign(
    { email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "7d" },
  );

  res.send({ token, role: user.role, status: user.status });
});

// Add user
router.post("/", async (req, res) => {
  const { name, email, role, managerCode } = req.body;
  if (!email) return res.status(400).send({ message: "Email required" });

  const exists = await usersCollection.findOne({ email });
  if (exists) return res.send({ message: "User already exists" });

  let finalRole = "buyer";
  if (role === "manager" && managerCode === process.env.MANAGER_SECRET)
    finalRole = "manager";

  const user = {
    name: name || "N/A",
    email,
    role: finalRole,
    status: "pending",
    createdAt: new Date(),
  };

  const result = await usersCollection.insertOne(user);
  res.send(result);
});

// Get all users (Admin)
router.get("/", verifyToken, verifyAdmin, async (req, res) => {
  res.send(await usersCollection.find().toArray());
});

// Update user status (approve or suspend)
router.patch("/status/:id", verifyToken, verifyAdmin, async (req, res) => {
  const { status } = req.body;
  if (!["active", "suspended"].includes(status))
    return res.status(400).send({ message: "Invalid status" });

  const result = await usersCollection.updateOne(
    { _id: new ObjectId(req.params.id) },
    { $set: { status } },
  );
  res.send(result);
});

module.exports = router;
