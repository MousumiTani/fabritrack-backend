const express = require("express");
const router = express.Router();
const { ObjectId } = require("mongodb");
const { client } = require("../config/db");
const {
  verifyToken,
  verifyManager,
  verifyAdmin,
} = require("../middleware/auth");

const productsCollection = client.db("garmentsDB").collection("products");

// Get all products (Admin + Manager)
router.get("/", verifyToken, async (req, res) => {
  try {
    const products = await productsCollection.find().toArray();
    res.send(products);
  } catch (err) {
    console.error("Fetch products error:", err);
    res.status(500).send({ message: "Failed to fetch products" });
  }
});

// Get home products (Public)
router.get("/home", async (req, res) => {
  try {
    const products = await productsCollection
      .find({ showOnHome: true })
      .sort({ createdAt: -1 })
      .limit(6)
      .toArray();
    res.send(products);
  } catch (err) {
    console.error("Fetch home products error:", err);
    res.status(500).send({ message: "Failed to fetch home products" });
  }
});

// Get single product (Protected)
router.get("/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: "Invalid product id" });
    }

    const product = await productsCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!product) {
      return res.status(404).send({ message: "Product not found" });
    }

    res.send(product);
  } catch (err) {
    console.error("Get single product error:", err);
    res.status(500).send({ message: "Failed to fetch product" });
  }
});

// Add product (Manager only)
router.post("/", verifyToken, verifyManager, async (req, res) => {
  try {
    const {
      title,
      category,
      price,
      availableQuantity,
      moq,
      paymentOption,
      showOnHome,
    } = req.body;

    // ✅ Check for exact duplicate product
    const duplicateProduct = await productsCollection.findOne({
      title: title.trim(),
      category,
      price: Number(price),
      availableQuantity: Number(availableQuantity),
      moq: Number(moq),
      paymentOption,
      showOnHome: showOnHome || false,
    });

    if (duplicateProduct) {
      return res
        .status(400)
        .send({ message: "This exact product already exists" });
    }

    req.body.createdAt = new Date();
    req.body.createdBy = req.decoded.email;
    if (req.body.showOnHome === undefined) req.body.showOnHome = false;

    const result = await productsCollection.insertOne(req.body);
    res.send(result);
  } catch (err) {
    console.error("Add product error:", err);
    res.status(500).send({ message: "Failed to add product" });
  }
});

// Update product (Manager only)
router.patch("/:id", verifyToken, verifyManager, async (req, res) => {
  try {
    const result = await productsCollection.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: req.body },
    );
    res.send(result);
  } catch (err) {
    console.error("Update product error:", err);
    res.status(500).send({ message: "Failed to update product" });
  }
});

// Delete product (Admin + Manager)
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id))
      return res.status(400).send({ message: "Invalid product id" });

    const userRole = req.decoded.role;
    const userEmail = req.decoded.email;

    const product = await productsCollection.findOne({ _id: new ObjectId(id) });
    if (!product) return res.status(404).send({ message: "Product not found" });

    if (
      userRole !== "admin" &&
      !(userRole === "manager" && product.createdBy === userEmail)
    ) {
      return res.status(403).send({ message: "Forbidden" });
    }

    const result = await productsCollection.deleteOne({
      _id: new ObjectId(id),
    });
    res.send(result);
  } catch (err) {
    console.error("Delete product error:", err);
    res.status(500).send({ message: "Failed to delete product" });
  }
});

// Toggle Show on Home (Admin only)
router.patch("/show-home/:id", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { showOnHome } = req.body;
    const result = await productsCollection.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { showOnHome } },
    );
    res.send(result);
  } catch (err) {
    console.error("Toggle showOnHome error:", err);
    res.status(500).send({ message: "Failed to update showOnHome" });
  }
});

module.exports = router;
