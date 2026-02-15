const jwt = require("jsonwebtoken");
const { client } = require("../config/db");
const usersCollection = client.db("garmentsDB").collection("users");

const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).send({ message: "Unauthorized" });

  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).send({ message: "Forbidden" });
    req.decoded = decoded;
    next();
  });
};

const verifyAdmin = async (req, res, next) => {
  const user = await usersCollection.findOne({ email: req.decoded.email });
  if (!user || user.role !== "admin")
    return res.status(403).send({ message: "Admin only" });
  if (user.status !== "active")
    return res.status(403).send({ message: "Account not active" });
  next();
};

const verifyManager = async (req, res, next) => {
  const user = await usersCollection.findOne({ email: req.decoded.email });
  if (!user || !["manager", "admin"].includes(user.role))
    return res.status(403).send({ message: "Manager only" });
  if (user.status !== "active")
    return res.status(403).send({ message: "Account not approved" });
  next();
};

module.exports = { verifyToken, verifyAdmin, verifyManager };
