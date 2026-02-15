const express = require("express");
const router = express.Router();
const { ObjectId } = require("mongodb");
const { client } = require("../config/db");
const { verifyToken, verifyManager } = require("../middleware/auth");

const ordersCollection = client.db("garmentsDB").collection("orders");

//////////////////////////
// Buyer Routes
//////////////////////////

// Place an order
router.post("/", verifyToken, async (req, res) => {
  const order = {
    ...req.body,
    userEmail: req.decoded.email,
    orderStatus: "pending",
    paymentStatus: "pending",
    createdAt: new Date(),
    tracking: [],
  };
  const result = await ordersCollection.insertOne(order);
  res.send({ success: true, insertedId: result.insertedId });
});

// Get own orders
router.get("/buyer/:email", verifyToken, async (req, res) => {
  if (req.decoded.email !== req.params.email)
    return res.status(403).send("Forbidden");

  const orders = await ordersCollection
    .find({ userEmail: req.params.email, orderStatus: { $ne: "rejected" } })
    .sort({ createdAt: -1 })
    .toArray();

  res.send(orders);
});

// Cancel pending order
router.patch("/cancel/:id", verifyToken, async (req, res) => {
  const result = await ordersCollection.updateOne(
    {
      _id: new ObjectId(req.params.id),
      userEmail: req.decoded.email,
      orderStatus: "pending",
    },
    { $set: { orderStatus: "rejected", cancelledAt: new Date() } },
  );

  if (result.modifiedCount === 0)
    return res.status(403).send({ message: "You cannot cancel this order" });

  res.send({ success: true, message: "Order cancelled successfully" });
});

//////////////////////////
// Manager Routes
//////////////////////////

// Get all orders
router.get("/", verifyToken, verifyManager, async (req, res) => {
  const orders = await ordersCollection
    .find()
    .sort({ createdAt: -1 })
    .toArray();
  res.send(orders);
});

// Get pending orders
router.get("/pending", verifyToken, verifyManager, async (req, res) => {
  const pendingOrders = await ordersCollection
    .find({ orderStatus: "pending" })
    .sort({ createdAt: -1 })
    .toArray();
  res.send(pendingOrders);
});

// Approve order
router.patch("/approve/:id", verifyToken, verifyManager, async (req, res) => {
  const result = await ordersCollection.updateOne(
    { _id: new ObjectId(req.params.id) },
    { $set: { orderStatus: "confirmed", approvedAt: new Date() } },
  );
  res.send(result);
});

// Reject order
router.patch("/reject/:id", verifyToken, verifyManager, async (req, res) => {
  const result = await ordersCollection.updateOne(
    { _id: new ObjectId(req.params.id) },
    { $set: { orderStatus: "rejected", rejectedAt: new Date() } },
  );
  res.send(result);
});

// Add tracking info
router.patch("/tracking/:id", verifyToken, verifyManager, async (req, res) => {
  const { status, location, note, time } = req.body;
  const allowedStatuses = [
    "Cutting Completed",
    "Sewing Started",
    "Finishing",
    "QC Checked",
    "Packed",
    "Shipped / Out for Delivery",
  ];

  if (!allowedStatuses.includes(status))
    return res.status(400).send({ message: "Invalid status" });

  const result = await ordersCollection.updateOne(
    { _id: new ObjectId(req.params.id), orderStatus: "confirmed" },
    {
      $push: {
        tracking: {
          status,
          location,
          note,
          time: time ? new Date(time) : new Date(),
        },
      },
    },
  );

  res.send(result);
});

//////////////////////////
// Single Order Route (Buyer + Manager + Admin)
//////////////////////////
router.get("/:id", verifyToken, async (req, res) => {
  try {
    const orderId = req.params.id;
    const order = await ordersCollection.findOne({
      _id: new ObjectId(orderId),
    });

    if (!order) return res.status(404).json({ message: "Order not found" });

    // Buyers can only see their own orders
    if (req.decoded.role === "buyer" && req.decoded.email !== order.userEmail) {
      return res.status(403).json({ message: "Forbidden" });
    }

    // Managers and Admin can see any order
    res.json(order);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
