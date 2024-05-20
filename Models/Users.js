import mongoose, { Schema } from "mongoose";

const UserSchema = mongoose.Schema(
  {
    role: {
      type: String,
      required: [true, "Role of Guest is required"],
      enum: { values: ["user"] },
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
    gender: {
      type: String,
      required: false,
      enum: {
        values: ["male", "female"],
        message: `Gender is not supported...`,
      },
      immutable: true,
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
    },
    cart: {
      type: [Schema.Types.ObjectId],
      ref: "Order",
      required: false,
    },
    orders: {
      type: [Schema.Types.ObjectId],
      ref: "Order",
      required: false,
      unique: true,
    },
    orders_summary: {
      type: Schema.Types.ObjectId,
      ref: "OrderSummary",
      required: false,
    },
    favourite: {
      type: [Schema.Types.ObjectId],
      ref: "Products",
      required: false,
    },
    recently_viewed: {
      type: [Schema.Types.ObjectId],
      ref: "Products",
      required: false,
    },
    address: {
      type: String,
      required: [true, "home address is important"],
      validate: {
        validator: function (address) {
          if (address.trim() !== " ") return true;
        },
      },
    },
    jwt: {
      type: String,
      required: [true, "JsonWebTOken is key of Access, is important"],
    },
    payment_dtl: {
      type: String,
      required: false,
    },
  },
  { timestamp: true }
);

const Users = mongoose.model("Users", UserSchema);
export default Users;
