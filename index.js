require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ObjectId, ServerApiVersion } = require("mongodb");
const stripe = require("stripe")(process.env.STRIPE_SECRET);

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection
const client = new MongoClient(process.env.MONGODB_URI, {
  serverApi: { version: ServerApiVersion.v1 },
});

let usersCollection;
let productsCollection;
let ordersCollection;

async function connectDB() {
  try {
    await client.connect();
    const db = client.db("garmentsDB");
    usersCollection = db.collection("users");
    productsCollection = db.collection("products");
    ordersCollection = db.collection("orders");
    console.log("Connected to MongoDB!");
  } catch (err) {
    console.error(err);
  }
}

connectDB();

// All products
app.get("/products", async (req, res) => {
  const products = await productsCollection.find().toArray();
  res.send(products);
});

// Homepage products (limit 6)
app.get("/products/home", async (req, res) => {
  const products = await productsCollection
    .find({ showOnHome: true }) // ✅ only featured
    .sort({ createdAt: -1 }) // optional: newest first
    .limit(6)
    .toArray();

  res.send(products);
});

// Single product by id
app.get("/products/:id", async (req, res) => {
  const id = req.params.id;
  const product = await productsCollection.findOne({ _id: new ObjectId(id) });
  res.send(product);
});

// Add product (manager/admin)
app.post("/products", async (req, res) => {
  const product = req.body;
  product.createdAt = new Date();
  const result = await productsCollection.insertOne(product);
  res.send(result);
});

// UPDATE product
app.patch("/products/:id", async (req, res) => {
  const id = req.params.id;
  const updatedData = req.body;

  const result = await productsCollection.updateOne(
    { _id: new ObjectId(id) },
    {
      $set: updatedData,
    }
  );

  res.send(result);
});

app.post("/orders", async (req, res) => {
  const order = req.body;

  order.createdAt = new Date();
  order.orderStatus = "pending";

  const result = await ordersCollection.insertOne(order);
  res.send(result);
});

app.get("/orders", async (req, res) => {
  const orders = await ordersCollection
    .find()
    .sort({ createdAt: -1 })
    .toArray();
  res.send(orders);
});

app.get("/orders/:email", async (req, res) => {
  const orders = await ordersCollection
    .find({ userEmail: req.params.email })
    .toArray();
  res.send(orders);
});

app.get("/orders/pending", async (req, res) => {
  const orders = await ordersCollection
    .find({ orderStatus: "pending" })
    .toArray();
  res.send(orders);
});

app.patch("/orders/approve/:id", async (req, res) => {
  const id = req.params.id;

  const result = await ordersCollection.updateOne(
    { _id: new ObjectId(id) },
    {
      $set: {
        status: "approved",
        approvedAt: new Date(),
      },
    }
  );

  res.send(result);
});

app.patch("/orders/reject/:id", async (req, res) => {
  const id = req.params.id;

  const result = await ordersCollection.updateOne(
    { _id: new ObjectId(id) },
    { $set: { status: "rejected" } }
  );

  res.send(result);
});

app.patch("/products/show-home/:id", async (req, res) => {
  const { showOnHome } = req.body;
  const result = await productsCollection.updateOne(
    { _id: new ObjectId(req.params.id) },
    { $set: { showOnHome } }
  );
  res.send(result);
});

app.delete("/products/:id", async (req, res) => {
  const result = await productsCollection.deleteOne({
    _id: new ObjectId(req.params.id),
  });
  res.send(result);
});

// save user
app.post("/users", async (req, res) => {
  const { name, email } = req.body;

  if (!email) {
    return res.status(400).send({ message: "Email required" });
  }

  const existing = await usersCollection.findOne({ email });
  if (existing) {
    return res.send({ message: "User already exists" });
  }

  const user = {
    name: name || "N/A",
    email,
    role: "user",
    status: "active",
    createdAt: new Date(),
  };

  const result = await usersCollection.insertOne(user);
  res.send(result);
});

app.get("/users", async (req, res) => {
  const users = await usersCollection.find().toArray();
  res.send(users);
});
app.patch("/users/:id", async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  const result = await usersCollection.updateOne(
    { _id: new ObjectId(id) },
    { $set: updateData }
  );

  res.send(result);
});
app.get("/orders/track/:id", async (req, res) => {
  const { id } = req.params;

  const order = await ordersCollection.findOne(
    { _id: new ObjectId(id) },
    { projection: { tracking: 1, productTitle: 1, orderStatus: 1 } }
  );

  if (!order) {
    return res.status(404).send({ message: "Order not found" });
  }

  res.send(order);
});
app.patch("/orders/track/:id", async (req, res) => {
  const { id } = req.params;
  const trackingStep = req.body;

  trackingStep.time = new Date();

  const result = await ordersCollection.updateOne(
    { _id: new ObjectId(id) },
    {
      $push: { tracking: trackingStep },
    }
  );

  res.send(result);
});

app.post("/create-payment-session", async (req, res) => {
  try {
    const { orderId } = req.body;

    // 1. get order from DB
    const order = await ordersCollection.findOne({
      _id: new ObjectId(orderId),
    });

    if (!order) {
      return res.status(404).send({ message: "Order not found" });
    }

    const amount = Math.round(Number(order.totalPrice) * 100);

    // 2. create stripe session
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: order.userEmail,

      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: amount,
            product_data: {
              name: order.productTitle || "Garments Order",
            },
          },
          quantity: 1,
        },
      ],

      metadata: {
        orderId: order._id.toString(),
      },

      success_url: `${process.env.SITE_DOMAIN}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.SITE_DOMAIN}/payment-cancelled`,
    });

    res.send({ url: session.url });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Payment session failed" });
  }
});
app.post("/verify-payment", async (req, res) => {
  try {
    const { sessionId } = req.body;

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status === "paid") {
      const orderId = session.metadata.orderId;

      // update order payment status
      await ordersCollection.updateOne(
        { _id: new ObjectId(orderId) },
        {
          $set: {
            paymentStatus: "paid",
            transactionId: session.payment_intent,
            paidAt: new Date(),
          },
        }
      );

      res.send({ paid: true });
    } else {
      res.send({ paid: false });
    }
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Payment verification failed" });
  }
});

// --- Test ---
app.get("/", (req, res) => res.send("FabriTrack Backend is running!"));

// Start server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
