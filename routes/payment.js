const express = require("express");
const router = express.Router();
const { ObjectId } = require("mongodb");
const { client } = require("../config/db");
const { verifyToken } = require("../middleware/auth");
const stripe = require("stripe")(process.env.STRIPE_SECRET);

const ordersCollection = client.db("garmentsDB").collection("orders");

// Create payment intent
router.post("/create-payment-intent", verifyToken, async (req, res) => {
  try {
    const { orderId } = req.body;
    if (!orderId) return res.status(400).send({ message: "Order ID required" });

    const order = await ordersCollection.findOne({
      _id: new ObjectId(orderId),
    });
    if (!order) return res.status(404).send({ message: "Order not found" });

    const amount = Math.round(order.totalPrice * 100);

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: "usd",
      payment_method_types: ["card"],
      metadata: { orderId: order._id.toString() },
    });

    await ordersCollection.updateOne(
      { _id: order._id },
      { $set: { paymentIntentId: paymentIntent.id } },
    );

    res.send({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: "Server error" });
  }
});

// Confirm payment success
router.patch("/orders/payment-success/:id", verifyToken, async (req, res) => {
  try {
    const orderId = req.params.id;
    const result = await ordersCollection.updateOne(
      { _id: new ObjectId(orderId) },
      {
        $set: {
          paymentStatus: "paid",
          orderStatus: "confirmed",
          paidAt: new Date(),
        },
      },
    );
    res.send(result);
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: "Server error" });
  }
});

module.exports = router;
