require("dotenv").config();
const express = require("express");
const cors = require("cors");

const usersRouter = require("./routes/users");
const productsRouter = require("./routes/products");
const ordersRouter = require("./routes/orders");
const paymentRouter = require("./routes/payment");
// add ordersRouter, paymentsRouter if needed

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.use("/users", usersRouter);
app.use("/products", productsRouter);
app.use("/orders", ordersRouter);
app.use("/payment", paymentRouter);

app.get("/", (req, res) => res.send("FabriTrack Backend Running"));

app.listen(PORT, () => console.log(`🔥 Server running on port ${PORT}`));
