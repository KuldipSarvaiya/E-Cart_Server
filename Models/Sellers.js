import mongoose, { Schema } from "mongoose";

const SellersSchema = mongoose.Schema(
  {
    role: {
      type: String,
      required: [true, "Role of Guest is required"],
      enum: { values: ["seller"] },
      immutable: true,
    },
    name: {
      type: String,
      required: [true, "Enter a valid Name"],
    },
    surname: {
      type: String,
      required: false,
    },
    password: {
      type: String,
      required: [true, "Password Must Required"],
    },
    email: {
      type: String,
      required: [true, "must include Email"],
      immutable: true,
      unique: true,
    },
    phone: {
      type: String,
      required: [true, "must include Mobile Number"],
      immutable: false,
    },
    gender: {
      type: String,
      required: false,
      enum: {
        values: ["male", "female"],
        message: `this Gender is not supported...`,
      },
      immutable: true,
    },
    shop_address: {
      type: String,
      required: [true, "home address is important"],
      immutable: false,
    },
    jwt: {
      type: String,
      required: [true, "JsonWebTOken is key of Access, is important"],
    },
    payment_dtl: {
      type: String,
      required: false,
    },
    products: {
      type: [Schema.Types.ObjectId],
      ref: "Products",
      required: false,
      immutable: false,
    },
    pending_orders: {
      type: [Schema.Types.ObjectId],
      ref: "Order",
      required: false,
      immutable: false,
      unique: true,
    },
    completed_orders: {
      type: [Schema.Types.ObjectId],
      ref: "Order",
      required: false,
      immutable: false,
    },
  },
  { timestamp: true }
);

const Sellers = mongoose.model("Sellers", SellersSchema);
export default Sellers;
